import { Router } from 'express';
import { z } from 'zod';
import { CalendarStatus, RelationshipType, Role } from '@prisma/client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { ensureParentForStudent, ensureTutorForStudent, ensureParticipant } from '../services/access';
import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { recordAudit } from '../services/audit';

const router = Router();

const proposalSchema = z.object({
  studentId: z.string().cuid(),
  options: z
    .array(
      z.object({
        start: z.string(),
        end: z.string()
      })
    )
    .min(3)
});

router.post('/proposals', requireAuth, requireRole([Role.Tutor]), async (req: AuthenticatedRequest, res) => {
  const parsed = proposalSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid proposal payload', parsed.error.flatten());
  }

  const tutorId = req.user!.id;
  const { studentId, options } = parsed.data;

  await ensureTutorForStudent(tutorId, studentId);

  const parentRelation = await prisma.relationship.findFirst({
    where: { aUserId: studentId, type: RelationshipType.S_P, consent: true }
  });
  const parentId = parentRelation?.bUserId;

  const events = [];
  for (const option of options) {
    const start = new Date(option.start);
    const end = new Date(option.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new AppError(400, 'Invalid option times');
    }

    const event = await prisma.calendarEvent.create({
      data: {
        participants: [tutorId, studentId, parentId].filter(Boolean),
        tutorId,
        studentId,
        parentId: parentId ?? undefined,
        start,
        end,
        status: CalendarStatus.Proposed
      }
    });
    await recordAudit({
      actorId: tutorId,
      entity: 'CalendarEvent',
      entityId: event.id,
      action: 'CALENDAR_PROPOSED'
    });
    events.push(event);
  }

  res.status(201).json({ events });
});

const confirmSchema = z.object({
  eventId: z.string().cuid()
});

router.post('/confirm', requireAuth, requireRole([Role.Parent]), async (req: AuthenticatedRequest, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid confirm payload', parsed.error.flatten());
  }

  const event = await prisma.calendarEvent.findUnique({ where: { id: parsed.data.eventId } });
  if (!event) {
    throw new AppError(404, 'Event not found');
  }

  await ensureParticipant(req.user!.id, event.id);
  await ensureParentForStudent(req.user!.id, event.studentId ?? '');

  const overlapping = await prisma.calendarEvent.findMany({
    where: {
      id: { not: event.id },
      status: CalendarStatus.Confirmed,
      OR: [
        { tutorId: event.tutorId ?? undefined },
        { studentId: event.studentId ?? undefined },
        { parentId: event.parentId ?? undefined }
      ]
    }
  });

  const conflict = overlapping.some((other) => other.start < event.end && other.end > event.start);

  const updated = await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { status: CalendarStatus.Confirmed }
  });

  await recordAudit({
    actorId: req.user!.id,
    entity: 'CalendarEvent',
    entityId: event.id,
    action: 'CALENDAR_CONFIRMED',
    metadata: { conflict }
  });

  res.json({ event: updated, conflict });
});

const rescheduleSchema = z.object({
  eventId: z.string().cuid(),
  newStart: z.string(),
  newEnd: z.string()
});

router.post('/reschedule', requireAuth, requireRole([Role.Tutor, Role.Parent]), async (req: AuthenticatedRequest, res) => {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid reschedule payload', parsed.error.flatten());
  }

  const { eventId, newStart, newEnd } = parsed.data;
  const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, 'Event not found');
  }

  await ensureParticipant(req.user!.id, eventId);

  const start = new Date(newStart);
  const end = new Date(newEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new AppError(400, 'Invalid schedule window');
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      start,
      end,
      status: CalendarStatus.Rescheduled
    }
  });

  await recordAudit({
    actorId: req.user!.id,
    entity: 'CalendarEvent',
    entityId: eventId,
    action: 'CALENDAR_RESCHEDULED',
    metadata: { previousStart: event.start, previousEnd: event.end }
  });

  res.json({ event: updated });
});

export default router;
