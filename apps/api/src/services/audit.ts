import { AuditLog } from '@prisma/client';
import { prisma } from '../prisma';

export interface AuditInput {
  actorId?: string;
  entity: string;
  entityId: string;
  action: string;
  fromState?: string | null;
  toState?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordAudit(input: AuditInput): Promise<AuditLog> {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      fromState: input.fromState ?? undefined,
      toState: input.toState ?? undefined,
      metadata: input.metadata ?? undefined
    }
  });
}
