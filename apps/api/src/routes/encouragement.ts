import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { ensureParentForStudent } from '../services/access';
import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { recordAudit } from '../services/audit';

const router = Router();

const encourageSchema = z
  .object({
    studentId: z.string().cuid(),
    templateId: z.string().optional(),
    message: z.string().optional()
  })
  .refine((data) => data.templateId || data.message, { message: 'templateId or message required' });

router.post('/', requireAuth, requireRole([Role.Parent]), async (req: AuthenticatedRequest, res) => {
  const parsed = encourageSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid encouragement payload', parsed.error.flatten());
  }

  const parentId = req.user!.id;
  const { studentId, templateId, message } = parsed.data;
  await ensureParentForStudent(parentId, studentId);

  const encouragement = await prisma.encouragement.create({
    data: {
      studentId,
      parentId,
      templateId,
      message
    }
  });

  await prisma.notification.create({
    data: {
      recipientId: studentId,
      type: 'encouragement',
      payload: {
        encouragementId: encouragement.id,
        templateId,
        message
      }
    }
  });

  await recordAudit({
    actorId: parentId,
    entity: 'Encouragement',
    entityId: encouragement.id,
    action: 'ENCOURAGEMENT_SENT'
  });

  res.status(201).json({ encouragement });
});

export default router;
