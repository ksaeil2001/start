import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { ensureParentForStudent, ensureTutorForStudent } from '../services/access';
import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { recordAudit } from '../services/audit';

const router = Router();

const logSchema = z.object({
  studentId: z.string().cuid(),
  tutorId: z.string().cuid(),
  startTs: z.string(),
  endTs: z.string(),
  minutes: z.number().int().positive()
});

router.post('/:eventId/log', requireAuth, requireRole([Role.Tutor]), async (req: AuthenticatedRequest, res) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid attendance payload', parsed.error.flatten());
  }

  const { eventId } = req.params;
  const { studentId, tutorId, startTs, endTs, minutes } = parsed.data;
  await ensureTutorForStudent(req.user!.id, studentId);

  if (tutorId !== req.user!.id) {
    throw new AppError(403, 'Tutor mismatch');
  }

  const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, 'Event not found');
  }

  if (event.tutorId && event.tutorId !== tutorId) {
    throw new AppError(403, 'Tutor not assigned to event');
  }
  if (event.studentId && event.studentId !== studentId) {
    throw new AppError(403, 'Student not assigned to event');
  }

  const start = new Date(startTs);
  const end = new Date(endTs);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new AppError(400, 'Invalid attendance timestamps');
  }

  const log = await prisma.attendanceLog.create({
    data: {
      eventId,
      sessionDate: start,
      startTs: start,
      endTs: end,
      minutes,
      studentId,
      tutorId,
      confirmedByParent: false
    }
  });

  await recordAudit({
    actorId: req.user!.id,
    entity: 'AttendanceLog',
    entityId: log.id,
    action: 'ATTENDANCE_RECORDED'
  });

  res.status(201).json({ attendance: log });
});

router.post('/:id/sign', requireAuth, requireRole([Role.Parent]), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const log = await prisma.attendanceLog.findUnique({ where: { id } });
  if (!log) {
    throw new AppError(404, 'Attendance log not found');
  }

  await ensureParentForStudent(req.user!.id, log.studentId);

  const updated = await prisma.attendanceLog.update({
    where: { id },
    data: {
      confirmedByParent: true,
      signatureTs: new Date()
    }
  });

  await recordAudit({
    actorId: req.user!.id,
    entity: 'AttendanceLog',
    entityId: id,
    action: 'ATTENDANCE_SIGNED',
    metadata: { signatureTs: updated.signatureTs }
  });

  res.json({ attendance: updated });
});

export default router;
