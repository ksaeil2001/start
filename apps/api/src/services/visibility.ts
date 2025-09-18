import { Role, SessionVisibility } from '@prisma/client';
import { prisma } from '../prisma';

export function scopeAllows(scope: SessionVisibility, role: Role): boolean {
  switch (role) {
    case Role.Student:
      return scope === SessionVisibility.S || scope === SessionVisibility.SP || scope === SessionVisibility.ST || scope === SessionVisibility.SPT;
    case Role.Parent:
      return scope === SessionVisibility.SP || scope === SessionVisibility.SPT;
    case Role.Tutor:
      return scope === SessionVisibility.ST || scope === SessionVisibility.SPT;
    default:
      return false;
  }
}

const DEFAULT_SCOPE = SessionVisibility.SPT;

export async function getVisibility(entityRef: string): Promise<SessionVisibility> {
  const record = await prisma.visibilitySetting.findUnique({ where: { entityRef } });
  return record?.scope ?? DEFAULT_SCOPE;
}
