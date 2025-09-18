import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { ensureStudentVisibility } from '../services/access';
import { prisma } from '../prisma';

const router = Router();

router.get('/feedback/:studentId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { studentId } = req.params;
  await ensureStudentVisibility(req.user!.id, req.user!.role, studentId);

  const submission = await prisma.submission.findFirst({
    where: { studentId },
    orderBy: { createdAt: 'desc' }
  });

  if (!submission) {
    res.json({ status: 'done', etaWindow: null });
    return;
  }

  if (submission.status === 'Submitted') {
    const etaEnd = new Date(submission.createdAt.getTime() + 24 * 60 * 60 * 1000);
    res.json({ status: 'waiting', etaWindow: { start: submission.createdAt.toISOString(), end: etaEnd.toISOString() } });
    return;
  }

  if (submission.status === 'NeedsResubmit') {
    const etaEnd = new Date(submission.createdAt.getTime() + 48 * 60 * 60 * 1000);
    res.json({ status: 'in_progress', etaWindow: { start: submission.createdAt.toISOString(), end: etaEnd.toISOString() } });
    return;
  }

  res.json({ status: 'done', etaWindow: null });
});

export default router;
