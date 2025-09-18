import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { recordAudit } from '../services/audit';

const router = Router();

const exceptionSchema = z.object({
  type: z.enum(['absence', 'late', 'make_up']),
  context: z.record(z.unknown())
});

router.post('/apply', requireAuth, requireRole([Role.Tutor, Role.Parent]), async (req: AuthenticatedRequest, res) => {
  const parsed = exceptionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid exception payload', parsed.error.flatten());
  }

  const policy = await prisma.policy.findFirst({ orderBy: { effectiveFrom: 'desc' } });
  if (!policy) {
    throw new AppError(404, 'No policy configured');
  }

  const rules = policy.rules as {
    late?: { grace_minutes?: number; option?: string };
    absence?: { notice_hours?: number; charge_policy?: string };
    make_up?: { window_days?: number; slots?: string };
  };
  let outcome: Record<string, unknown> = {};

  switch (parsed.data.type) {
    case 'late': {
      const minutesLate = Number(parsed.data.context.minutesLate ?? 0);
      const grace = Number(rules.late?.grace_minutes ?? 0);
      const waived = minutesLate <= grace;
      outcome = {
        waived,
        adjustment: waived ? 0 : minutesLate - grace,
        option: rules.late?.option ?? 'standard'
      };
      break;
    }
    case 'absence': {
      const noticeHours = Number(parsed.data.context.noticeHours ?? 0);
      const requiredNotice = Number(rules.absence?.notice_hours ?? 0);
      const chargePolicy = rules.absence?.charge_policy ?? 'full';
      const chargeRate = chargePolicy === '50_percent' ? 0.5 : 1;
      const waived = noticeHours >= requiredNotice;
      outcome = {
        waived,
        chargeRate: waived ? 0 : chargeRate,
        policy: chargePolicy
      };
      break;
    }
    case 'make_up': {
      outcome = {
        window_days: rules.make_up?.window_days ?? 0,
        slots: rules.make_up?.slots ?? 'none'
      };
      break;
    }
    default:
      throw new AppError(400, 'Unsupported exception type');
  }

  await recordAudit({
    actorId: req.user!.id,
    entity: 'Policy',
    entityId: policy.id,
    action: 'POLICY_EXCEPTION_APPLIED',
    metadata: {
      type: parsed.data.type,
      context: parsed.data.context,
      outcome
    }
  });

  res.json({ policy: policy.id, outcome });
});

export default router;
