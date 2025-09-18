import {
  PrismaClient,
  Role,
  AssignmentDifficulty,
  AssignmentStatus,
  SubmissionStatus,
  SessionVisibility,
  CalendarStatus,
  RelationshipType
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.encouragement.deleteMany();
  await prisma.attendanceLog.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.sessionNote.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.report.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.visibilitySetting.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('password123', 10);

  const tutor = await prisma.user.create({
    data: {
      email: 'tutor@example.com',
      passwordHash: password,
      role: Role.Tutor,
      name: 'Tutor A'
    }
  });

  const parent = await prisma.user.create({
    data: {
      email: 'parent@example.com',
      passwordHash: password,
      role: Role.Parent,
      name: 'Parent P'
    }
  });

  const student = await prisma.user.create({
    data: {
      email: 'student@example.com',
      passwordHash: password,
      role: Role.Student,
      name: 'Student S'
    }
  });

  await prisma.relationship.createMany({
    data: [
      { aUserId: student.id, bUserId: parent.id, type: RelationshipType.S_P, consent: true },
      { aUserId: student.id, bUserId: tutor.id, type: RelationshipType.S_T, consent: true },
      { aUserId: parent.id, bUserId: tutor.id, type: RelationshipType.P_T, consent: true }
    ]
  });

  const policy = await prisma.policy.create({
    data: {
      title: 'Default Engagement Policy',
      version: 1,
      effectiveFrom: new Date(),
      rules: {
        late: { grace_minutes: 5, option: 'shorten' },
        absence: { notice_hours: 12, charge_policy: '50_percent' },
        make_up: { window_days: 14, slots: 'weekday_evening' }
      }
    }
  });

  const assignment = await prisma.assignment.create({
    data: {
      tutorId: tutor.id,
      studentId: student.id,
      title: 'Seed Essay',
      goal: 'Write a 3 paragraph essay',
      difficulty: AssignmentDifficulty.M,
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      rubricId: 'rubric-1',
      modelAnswerRef: 's3://answers/model.pdf',
      status: AssignmentStatus.Open
    }
  });

  await prisma.assignment.update({
    where: { id: assignment.id },
    data: { status: AssignmentStatus.Submitted }
  });

  await prisma.submission.create({
    data: {
      assignmentId: assignment.id,
      studentId: student.id,
      version: 1,
      files: [{ name: 'essay.pdf', mime: 'application/pdf', url: 'https://example.com/essay.pdf' }],
      coverMeta: { unit: 'Writing', pages: 2 },
      status: SubmissionStatus.Submitted
    }
  });

  await prisma.sessionNote.create({
    data: {
      tutorId: tutor.id,
      studentId: student.id,
      date: new Date(),
      summary: 'Focused on thesis statements.',
      issues: ['Time management'],
      nextActions: ['Practice outlines'],
      visibilityScope: SessionVisibility.SPT
    }
  });

  const options = [1, 2, 3].map((offset) => ({
    start: new Date(Date.now() + offset * 24 * 60 * 60 * 1000),
    end: new Date(Date.now() + offset * 24 * 60 * 60 * 1000 + 60 * 60 * 1000)
  });

  for (const opt of options) {
    await prisma.calendarEvent.create({
      data: {
        participants: [tutor.id, parent.id, student.id],
        tutorId: tutor.id,
        parentId: parent.id,
        studentId: student.id,
        start: opt.start,
        end: opt.end,
        status: CalendarStatus.Proposed
      }
    });
  }

  await prisma.visibilitySetting.create({
    data: {
      entityRef: `assignment:${assignment.id}`,
      scope: SessionVisibility.SPT
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: tutor.id,
      entity: 'Policy',
      entityId: policy.id,
      action: 'SEED_POLICY',
      metadata: { source: 'seed' }
    }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
