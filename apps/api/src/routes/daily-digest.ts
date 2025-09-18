import { Router } from 'express';
import { z } from 'zod';
import { AssignmentStatus, Role } from '@prisma/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { ensureParentForStudent, ensureStudentVisibility } from '../services/access';
import { prisma } from '../prisma';
import { getVisibility, scopeAllows } from '../services/visibility';

const router = Router();

const querySchema = z.object({
  relationship: z.enum(['S-P', 'S-T', 'P-T']),
  studentId: z.string().cuid()
});

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query' });
    return;
  }

  const { relationship, studentId } = parsed.data;
  if (relationship === 'S-P') {
    if (req.user!.role === Role.Parent) {
      await ensureParentForStudent(req.user!.id, studentId);
    } else if (req.user!.role === Role.Student) {
      await ensureStudentVisibility(req.user!.id, req.user!.role, studentId);
    } else {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
  }

  const lastSubmission = await prisma.submission.findFirst({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    include: { assignment: true }
  });

  const notes = await prisma.sessionNote.findMany({
    where: { studentId },
    orderBy: { date: 'desc' }
  });
  const allowedNote = notes.find((note) => scopeAllows(note.visibilityScope, req.user!.role));

  const now = new Date();
  const upcomingAssignments = await prisma.assignment.findMany({
    where: {
      studentId,
      dueAt: { lte: new Date(now.getTime() + 48 * 60 * 60 * 1000) }
    },
    include: { submissions: true }
  });

  const dueWithoutSubmission = [] as Array<{ id: string; title: string; dueAt: string }>;
  for (const assignment of upcomingAssignments) {
    const scope = await getVisibility(`assignment:${assignment.id}`);
    if (!scopeAllows(scope, req.user!.role)) {
      continue;
    }
    const hasRecentSubmission = assignment.submissions.length > 0;
    if (!hasRecentSubmission || assignment.status !== AssignmentStatus.Finalized) {
      dueWithoutSubmission.push({ id: assignment.id, title: assignment.title, dueAt: assignment.dueAt.toISOString() });
    }
  }

  const unsignedAttendance = await prisma.attendanceLog.findMany({
    where: { studentId, confirmedByParent: false }
  });

  const nextAssignment = await prisma.assignment.findFirst({
    where: { studentId },
    orderBy: { dueAt: 'asc' }
  });

  res.json({
    highlights: {
      last_submission: lastSubmission
        ? { title: lastSubmission.assignment.title, submittedAt: lastSubmission.createdAt.toISOString() }
        : null,
      last_session_note: allowedNote ? { summary: allowedNote.summary, date: allowedNote.date.toISOString() } : null
    },
    risks: {
      due_in_48h_without_submission: dueWithoutSubmission,
      attendance_missing_signature: unsignedAttendance.map((log) => ({ id: log.id, sessionDate: log.sessionDate.toISOString() }))
    },
    next: {
      next_due: nextAssignment
        ? { id: nextAssignment.id, title: nextAssignment.title, dueAt: nextAssignment.dueAt.toISOString() }
        : null,
      checklist: {
        exam_prep_items: (allowedNote?.nextActions as unknown[] | undefined) ?? []
      }
    }
  });
});

export default router;
