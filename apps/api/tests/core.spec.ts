import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();

describe('End-to-end MVP loops', () => {
  let tutorToken: string;
  let parentToken: string;
  let studentToken: string;
  let tutorId: string;
  let parentId: string;
  let studentId: string;
  let assignmentId: string;
  let firstSubmissionId: string;
  let resubmissionId: string;
  let attendanceId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const tutorLogin = await request(app).post('/auth/login').send({ email: 'tutor@example.com', password: 'password123' });
    tutorToken = tutorLogin.body.token;
    tutorId = tutorLogin.body.user.id;

    const parentLogin = await request(app).post('/auth/login').send({ email: 'parent@example.com', password: 'password123' });
    parentToken = parentLogin.body.token;
    parentId = parentLogin.body.user.id;

    const studentLogin = await request(app).post('/auth/login').send({ email: 'student@example.com', password: 'password123' });
    studentToken = studentLogin.body.token;
    studentId = studentLogin.body.user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs assignment submission and review loop to finalization', async () => {
    const createRes = await request(app)
      .post('/assignments')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        studentId,
        title: 'Weekly Writing',
        goal: 'Compose persuasive essay',
        difficulty: 'M',
        dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        rubricId: 'rubric-2',
        modelAnswerRef: 's3://answers/model2.pdf'
      })
      .expect(201);

    assignmentId = createRes.body.assignment.id;

    const submissionRes = await request(app)
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        assignmentId,
        files: [{ name: 'draft.pdf', mime: 'application/pdf', url: 'https://example.com/draft.pdf' }],
        coverMeta: { unit: 'Writing', pages: 3 }
      })
      .expect(201);

    firstSubmissionId = submissionRes.body.submission.id;

    const slaWaiting = await request(app)
      .get(`/sla/feedback/${studentId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(slaWaiting.body.status).toBe('waiting');

    await request(app)
      .post(`/submissions/${firstSubmissionId}/review`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ rubricScore: { writing: 2 }, comment: 'Revise thesis', resubmit_flag: true })
      .expect(200);

    const slaInProgress = await request(app)
      .get(`/sla/feedback/${studentId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(slaInProgress.body.status).toBe('in_progress');

    const resubmitRes = await request(app)
      .post(`/submissions/${firstSubmissionId}/resubmit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        files: [
          {
            name: 'draft-v2.pdf',
            mime: 'application/pdf',
            url: 'https://example.com/draft-v2.pdf'
          }
        ],
        coverMeta: { unit: 'Writing', pages: 4 }
      })
      .expect(201);
    resubmissionId = resubmitRes.body.submission.id;

    await request(app)
      .post(`/submissions/${resubmissionId}/review`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ rubricScore: { writing: 4 }, comment: 'Great job', resubmit_flag: false })
      .expect(200);

    const assignmentsForTutor = await request(app)
      .get(`/assignments/students/${studentId}`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200);

    const targetAssignment = assignmentsForTutor.body.assignments.find((entry: any) => entry.assignment.id === assignmentId);
    expect(targetAssignment.assignment.status).toBe('Finalized');

    const slaDone = await request(app)
      .get(`/sla/feedback/${studentId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(slaDone.body.status).toBe('done');
  });

  it('handles scheduling, attendance logging, signatures, and session note guard', async () => {
    const now = Date.now();
    const proposals = await request(app)
      .post('/calendar/proposals')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        studentId,
        options: [1, 2, 3].map((offset) => ({
          start: new Date(now + offset * 60 * 60 * 1000).toISOString(),
          end: new Date(now + offset * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString()
        }))
      })
      .expect(201);

    const eventId = proposals.body.events[0].id;

    await request(app)
      .post('/calendar/confirm')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ eventId })
      .expect(200);

    const attendanceRes = await request(app)
      .post(`/attendance/${eventId}/log`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        studentId,
        tutorId,
        startTs: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        endTs: new Date().toISOString(),
        minutes: 45
      })
      .expect(201);

    attendanceId = attendanceRes.body.attendance.id;

    await request(app)
      .post(`/attendance/${attendanceId}/sign`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);

    await request(app)
      .post('/session-notes')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        studentId,
        date: new Date().toISOString(),
        summary: 'Followed up on persuasive techniques',
        issues: ['Focus'],
        nextActions: ['Mock debate'],
        visibilityScope: 'SPT'
      })
      .expect(201);
  });

  it('issues monthly reports and invoices and serves PDF receipts', async () => {
    const period = new Date().toISOString().slice(0, 7);

    await request(app)
      .post('/reports/issue')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ period, studentId })
      .expect(201);

    const invoiceRes = await request(app)
      .post('/invoices/issue')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ period, parentId })
      .expect(201);

    invoiceId = invoiceRes.body.invoice.id;

    await request(app)
      .get(`/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);

    const receiptRes = await request(app)
      .get(`/invoices/${invoiceId}/receipt`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    expect(receiptRes.headers['content-type']).toContain('application/pdf');
  });

  it('generates daily digest, encouragement notifications, visibility controls, and policy exceptions', async () => {
    const digestRes = await request(app)
      .get('/daily-digest')
      .query({ relationship: 'S-P', studentId })
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    expect(digestRes.body.highlights).toBeDefined();

    await request(app)
      .post('/encourage')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ studentId, message: 'Proud of your progress!' })
      .expect(201);

    const notifications = await prisma.notification.findMany({ where: { recipientId: studentId } });
    expect(notifications.length).toBeGreaterThan(0);

    await request(app)
      .post('/visibility')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ entityRef: `assignment:${assignmentId}`, scope: 'S' })
      .expect(200);

    const parentAssignments = await request(app)
      .get(`/assignments/students/${studentId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    const visibleAssignments = parentAssignments.body.assignments.filter((entry: any) => entry.assignment.id === assignmentId);
    expect(visibleAssignments.length).toBe(0);

    const exceptionRes = await request(app)
      .post('/exceptions/apply')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ type: 'absence', context: { noticeHours: 2 } })
      .expect(200);
    expect(exceptionRes.body.outcome).toBeDefined();
  });
});
