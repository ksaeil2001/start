import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import assignmentRoutes from './routes/assignments';
import submissionRoutes from './routes/submissions';
import slaRoutes from './routes/sla';
import sessionRoutes from './routes/session-notes';
import calendarRoutes from './routes/calendar';
import attendanceRoutes from './routes/attendance';
import reportRoutes from './routes/reports';
import invoiceRoutes from './routes/invoices';
import digestRoutes from './routes/daily-digest';
import encouragementRoutes from './routes/encouragement';
import visibilityRoutes from './routes/visibility';
import exceptionRoutes from './routes/exceptions';
import { errorHandler } from './middleware/error';

dotenv.config();

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/auth', authRoutes);
  app.use('/assignments', assignmentRoutes);
  app.use('/submissions', submissionRoutes);
  app.use('/sla', slaRoutes);
  app.use('/session-notes', sessionRoutes);
  app.use('/calendar', calendarRoutes);
  app.use('/attendance', attendanceRoutes);
  app.use('/reports', reportRoutes);
  app.use('/invoices', invoiceRoutes);
  app.use('/daily-digest', digestRoutes);
  app.use('/encourage', encouragementRoutes);
  app.use('/visibility', visibilityRoutes);
  app.use('/exceptions', exceptionRoutes);

  app.use(errorHandler);

  return app;
}
