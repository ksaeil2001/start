import { Router } from 'express';
import { z } from 'zod';
import { Role, SessionVisibility } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { recordAudit } from '../services/audit';

const router = Router();

const visibilitySchema = z.object({
  entityRef: z.string().min(3),
  scope: z.enum(['S', 'SP', 'ST', 'SPT'])
});

router.post('/', requireAuth, requireRole([Role.Tutor, Role.Parent]), async (req: AuthenticatedRequest, res) => {
  const parsed = visibilitySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid visibility payload', parsed.error.flatten());
  }

  const record = await prisma.visibilitySetting.upsert({
    where: { entityRef: parsed.data.entityRef },
    update: { scope: parsed.data.scope as SessionVisibility },
    create: { entityRef: parsed.data.entityRef, scope: parsed.data.scope as SessionVisibility }
  });

  await recordAudit({
    actorId: req.user!.id,
    entity: 'Visibility',
    entityId: record.id,
    action: 'VISIBILITY_UPDATED',
    metadata: { entityRef: parsed.data.entityRef, scope: parsed.data.scope }
  });

  res.json({ visibility: record });
});

export default router;
