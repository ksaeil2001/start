import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { ensureTutorForStudent } from '../services/access';
import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { recordAudit } from '../services/audit';

const router = Router();

const noteSchema = z.object({
  studentId: z.string().cuid(),
  date: z.string(),
  summary: z.string().min(1),
  issues: z.array(z.unknown()).default([]),
  nextActions: z.array(z.unknown()).default([]),
  visibilityScope: z.enum(['S', 'SP', 'ST', 'SPT'])
});

router.post('/', requireAuth, requireRole([Role.Tutor]), async (req: AuthenticatedRequest, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid session note payload', parsed.error.flatten());
  }

  const tutorId = req.user!.id;
  const { studentId, date, summary, issues, nextActions, visibilityScope } = parsed.data;
  await ensureTutorForStudent(tutorId, studentId);

  const sessionDate = new Date(date);
  if (Number.isNaN(sessionDate.getTime())) {
    throw new AppError(400, 'Invalid date');
  }

  const latestAttendance = await prisma.attendanceLog.findFirst({
    where: { tutorId, studentId },
    orderBy: { endTs: 'desc' }
  });

  const now = new Date();
  let warning: string | undefined;
  if (latestAttendance) {
    const diff = Math.abs(now.getTime() - latestAttendance.endTs.getTime());
    if (diff > 60 * 1000) {
      warning = 'Session note created outside 60s window';
    }
  }

  const note = await prisma.sessionNote.create({
    data: {
      tutorId,
      studentId,
      date: sessionDate,
      summary,
      issues,
      nextActions,
      visibilityScope
    }
  });

  await recordAudit({
    actorId: tutorId,
    entity: 'SessionNote',
    entityId: note.id,
    action: 'SESSION_NOTE_RECORDED',
    metadata: { warning: warning ?? null }
  });

  res.status(201).json({ note, warning: warning ?? null });
});

export default router;
