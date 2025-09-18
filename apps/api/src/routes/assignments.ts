import { Router } from 'express';
import { z } from 'zod';
import { AssignmentStatus, Role, SessionVisibility } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { ensureStudentVisibility, ensureTutorForStudent } from '../services/access';
import { getVisibility, scopeAllows } from '../services/visibility';
import { recordAudit } from '../services/audit';

const router = Router();

const createSchema = z.object({
  studentId: z.string().cuid(),
  title: z.string().min(1),
  goal: z.string().min(1),
  difficulty: z.enum(['E', 'M', 'H']),
  dueAt: z.string(),
  rubricId: z.string().optional(),
  modelAnswerRef: z.string().optional(),
  visibilityScope: z.enum(['S', 'SP', 'ST', 'SPT']).optional()
});

router.post('/', requireAuth, requireRole([Role.Tutor]), async (req: AuthenticatedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid assignment payload', parsed.error.flatten());
  }

  const { studentId, title, goal, difficulty, dueAt, rubricId, modelAnswerRef, visibilityScope } = parsed.data;
  const tutorId = req.user!.id;

  await ensureTutorForStudent(tutorId, studentId);

  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    throw new AppError(400, 'Invalid due date');
  }

  const assignment = await prisma.assignment.create({
    data: {
      tutorId,
      studentId,
      title,
      goal,
      difficulty,
      dueAt: dueDate,
      rubricId,
      modelAnswerRef,
      status: AssignmentStatus.Open
    }
  });

  await prisma.visibilitySetting.upsert({
    where: { entityRef: `assignment:${assignment.id}` },
    update: { scope: (visibilityScope as SessionVisibility | undefined) ?? SessionVisibility.SPT },
    create: { entityRef: `assignment:${assignment.id}`, scope: (visibilityScope as SessionVisibility | undefined) ?? SessionVisibility.SPT }
  });

  await recordAudit({
    actorId: tutorId,
    entity: 'Assignment',
    entityId: assignment.id,
    action: 'ASSIGNMENT_CREATED',
    toState: AssignmentStatus.Open
  });

  res.status(201).json({ assignment });
});

router.get('/students/:studentId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { studentId } = req.params;
  if (!studentId) {
    throw new AppError(400, 'Student id required');
  }

  await ensureStudentVisibility(req.user!.id, req.user!.role, studentId);

  const assignments = await prisma.assignment.findMany({
    where: { studentId },
    orderBy: { dueAt: 'asc' },
    include: {
      submissions: {
        orderBy: { version: 'asc' }
      },
      tutor: true
    }
  });

  const filtered = [];
  for (const assignment of assignments) {
    const scope = await getVisibility(`assignment:${assignment.id}`);
    if (!scopeAllows(scope, req.user!.role)) {
      continue;
    }
    filtered.push({ assignment, scope });
  }

  res.json({ assignments: filtered });
});

export default router;
