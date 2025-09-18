import { Router } from 'express';
import { z } from 'zod';
import { AssignmentStatus, Role } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { ensureTutorForStudent } from '../services/access';
import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { recordAudit } from '../services/audit';
import { monthBounds } from '../utils/dates';

const router = Router();

const issueSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  studentId: z.string().cuid()
});

router.post('/issue', requireAuth, requireRole([Role.Tutor]), async (req: AuthenticatedRequest, res) => {
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid report payload', parsed.error.flatten());
  }

  const { period, studentId } = parsed.data;
  await ensureTutorForStudent(req.user!.id, studentId);

  const { start, end } = monthBounds(period);

  const finalizedAssignments = await prisma.assignment.count({
    where: { studentId, status: AssignmentStatus.Finalized, createdAt: { gte: start, lt: end } }
  });

  const attendanceLogs = await prisma.attendanceLog.findMany({
    where: { studentId, sessionDate: { gte: start, lt: end } }
  });
  const attendanceMinutes = attendanceLogs.reduce((sum, log) => sum + log.minutes, 0);

  const latestSubmission = await prisma.submission.findFirst({
    where: { studentId },
    orderBy: { createdAt: 'desc' }
  });

  const latestNote = await prisma.sessionNote.findFirst({
    where: { studentId },
    orderBy: { date: 'desc' }
  });

  const report = await prisma.report.create({
    data: {
      period,
      studentId,
      KPIs: {
        assignmentsFinalized: finalizedAssignments,
        attendanceMinutes,
        submissionsThisMonth: latestSubmission ? 1 : 0
      },
      highlights: [
        latestSubmission ? { submission: latestSubmission.id, title: latestSubmission.assignmentId } : null,
        latestNote ? { note: latestNote.id, summary: latestNote.summary } : null
      ].filter(Boolean),
      nextPlan: latestNote?.nextActions ?? []
    }
  });

  await recordAudit({
    actorId: req.user!.id,
    entity: 'Report',
    entityId: report.id,
    action: 'REPORT_ISSUED'
  });

  res.status(201).json({ report });
});

export default router;
