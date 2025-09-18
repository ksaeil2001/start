import { Router } from 'express';
import { z } from 'zod';
import { AssignmentStatus, Role, SubmissionStatus } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { ensureTutorForStudent } from '../services/access';
import { recordAudit } from '../services/audit';
import { setAssignmentStatus } from '../services/assignments';

const router = Router();

const ALLOWED_MIME = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg'];

type SubmissionFile = { name: string; mime: string; url: string };

const submissionSchema = z.object({
  assignmentId: z.string().cuid(),
  files: z.array(
    z.object({
      name: z.string().min(1),
      mime: z.string().min(1),
      url: z.string().url()
    })
  ),
  coverMeta: z.object({ unit: z.string().min(1), pages: z.number().int().positive().optional() })
});

router.post('/', requireAuth, requireRole([Role.Student]), async (req: AuthenticatedRequest, res) => {
  const parsed = submissionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid submission payload', parsed.error.flatten());
  }

  const { assignmentId, files, coverMeta } = parsed.data;
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { submissions: true } });
  if (!assignment) {
    throw new AppError(404, 'Assignment not found');
  }

  if (assignment.studentId !== req.user!.id) {
    throw new AppError(403, 'Cannot submit for other students');
  }

  const invalid = files.find((file) => !ALLOWED_MIME.includes(file.mime));
  if (invalid) {
    throw new AppError(400, `Unsupported file type ${invalid.mime}`);
  }

  const version = assignment.submissions.length + 1;

  const submission = await prisma.submission.create({
    data: {
      assignmentId,
      studentId: req.user!.id,
      version,
      files,
      coverMeta,
      status: SubmissionStatus.Submitted
    }
  });

  await setAssignmentStatus(assignmentId, AssignmentStatus.Submitted, req.user!.id);
  await recordAudit({
    actorId: req.user!.id,
    entity: 'Submission',
    entityId: submission.id,
    action: 'SUBMISSION_CREATED',
    toState: SubmissionStatus.Submitted
  });

  res.status(201).json({ submission });
});

const reviewSchema = z.object({
  rubricScore: z.record(z.unknown()),
  comment: z.string().optional(),
  resubmit_flag: z.boolean()
});

const resubmitSchema = z
  .object({
    files: submissionSchema.shape.files.optional(),
    coverMeta: submissionSchema.shape.coverMeta.optional()
  })
  .refine((data) => data.files !== undefined || data.coverMeta !== undefined, {
    message: 'files or coverMeta required'
  });

router.post('/:id/review', requireAuth, requireRole([Role.Tutor]), async (req: AuthenticatedRequest, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid review payload', parsed.error.flatten());
  }

  const submission = await prisma.submission.findUnique({
    where: { id: req.params.id },
    include: { assignment: true }
  });
  if (!submission) {
    throw new AppError(404, 'Submission not found');
  }

  await ensureTutorForStudent(req.user!.id, submission.assignment.studentId);

  const status = parsed.data.resubmit_flag ? SubmissionStatus.NeedsResubmit : SubmissionStatus.Approved;
  const now = new Date();
  const reviewDurationSeconds = Math.max(0, Math.round((now.getTime() - submission.createdAt.getTime()) / 1000));

  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status,
      rubricScore: parsed.data.rubricScore,
      comment: parsed.data.comment,
      requestedResubmit: parsed.data.resubmit_flag,
      reviewedAt: now,
      reviewDurationSeconds
    }
  });

  if (parsed.data.resubmit_flag) {
    await setAssignmentStatus(submission.assignmentId, AssignmentStatus.Reviewed, req.user!.id);
  } else {
    const targetStatus = submission.version > 1 || submission.assignment.status === AssignmentStatus.Resubmitted ? AssignmentStatus.Finalized : AssignmentStatus.Reviewed;
    await setAssignmentStatus(submission.assignmentId, targetStatus, req.user!.id);
  }

  await recordAudit({
    actorId: req.user!.id,
    entity: 'Submission',
    entityId: submission.id,
    action: 'SUBMISSION_REVIEWED',
    fromState: submission.status,
    toState: status,
    metadata: { resubmit: parsed.data.resubmit_flag }
  });

  const slaSeconds = reviewDurationSeconds;
  res.json({ submission: updated, slaSeconds });
});

router.post('/:id/resubmit', requireAuth, requireRole([Role.Student]), async (req: AuthenticatedRequest, res) => {
  const original = await prisma.submission.findUnique({
    where: { id: req.params.id },
    include: { assignment: { include: { submissions: true } } }
  });
  if (!original) {
    throw new AppError(404, 'Submission not found');
  }

  if (original.studentId !== req.user!.id) {
    throw new AppError(403, 'Cannot resubmit others work');
  }

  if (original.status !== SubmissionStatus.NeedsResubmit) {
    throw new AppError(400, 'Submission not flagged for resubmission');
  }

  const parsed = resubmitSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new AppError(400, 'Invalid resubmission payload', parsed.error.flatten());
  }

  const latestVersion = original.assignment.submissions.length;

  const fallbackFiles = Array.isArray(original.files) ? (original.files as SubmissionFile[]) : [];
  const files: SubmissionFile[] = parsed.data.files ?? fallbackFiles;

  if (files.length === 0) {
    throw new AppError(400, 'Resubmission requires at least one file');
  }

  const invalid = files.find((file) => !ALLOWED_MIME.includes(file.mime));
  if (invalid) {
    throw new AppError(400, `Unsupported file type ${invalid.mime}`);
  }

  const fallbackCoverMeta =
    typeof original.coverMeta === 'object' && original.coverMeta !== null ? original.coverMeta : null;
  const coverMeta = parsed.data.coverMeta ?? fallbackCoverMeta;

  if (!coverMeta) {
    throw new AppError(400, 'Resubmission requires cover metadata');
  }

  const newSubmission = await prisma.submission.create({
    data: {
      assignmentId: original.assignmentId,
      studentId: req.user!.id,
      version: latestVersion + 1,
      files,
      coverMeta,
      status: SubmissionStatus.Submitted
    }
  });

  await setAssignmentStatus(original.assignmentId, AssignmentStatus.Resubmitted, req.user!.id);
  await recordAudit({
    actorId: req.user!.id,
    entity: 'Submission',
    entityId: newSubmission.id,
    action: 'SUBMISSION_RESUBMITTED',
    fromState: original.status,
    toState: SubmissionStatus.Submitted
  });

  res.status(201).json({ submission: newSubmission });
});

export default router;
