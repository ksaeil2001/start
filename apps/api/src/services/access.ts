import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { Role, RelationshipType } from '@prisma/client';

export async function ensureTutorForStudent(tutorId: string, studentId: string): Promise<void> {
  const relation = await prisma.relationship.findFirst({
    where: {
      type: RelationshipType.S_T,
      aUserId: studentId,
      bUserId: tutorId,
      consent: true
    }
  });
  if (!relation) {
    throw new AppError(403, 'Tutor not linked to student');
  }
}

export async function ensureParentForStudent(parentId: string, studentId: string): Promise<void> {
  const relation = await prisma.relationship.findFirst({
    where: {
      type: RelationshipType.S_P,
      aUserId: studentId,
      bUserId: parentId,
      consent: true
    }
  });
  if (!relation) {
    throw new AppError(403, 'Parent not linked to student');
  }
}

export async function ensureParticipant(userId: string, eventId: string): Promise<void> {
  const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, 'Event not found');
  }

  const participants = Array.isArray(event.participants) ? (event.participants as string[]) : [];
  if (!participants.includes(userId)) {
    throw new AppError(403, 'Not a participant');
  }
}

export async function ensureStudentVisibility(userId: string, role: Role, studentId: string): Promise<void> {
  if (role === Role.Student) {
    if (userId !== studentId) {
      throw new AppError(403, 'Cannot access other students');
    }
    return;
  }

  if (role === Role.Tutor) {
    await ensureTutorForStudent(userId, studentId);
    return;
  }

  if (role === Role.Parent) {
    await ensureParentForStudent(userId, studentId);
  }
}
