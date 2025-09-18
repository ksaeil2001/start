import { AssignmentStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { recordAudit } from './audit';

export async function setAssignmentStatus(assignmentId: string, to: AssignmentStatus, actorId: string): Promise<void> {
  const current = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!current || current.status === to) {
    return;
  }

  await prisma.assignment.update({ where: { id: assignmentId }, data: { status: to } });
  await recordAudit({
    actorId,
    entity: 'Assignment',
    entityId: assignmentId,
    action: 'ASSIGNMENT_STATUS_CHANGED',
    fromState: current.status,
    toState: to
  });
}
