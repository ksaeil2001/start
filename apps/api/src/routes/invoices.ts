import { Router } from 'express';
import { z } from 'zod';
import { Prisma, RelationshipType, Role } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../prisma';
import { AppError } from '../utils/errors';
import { recordAudit } from '../services/audit';
import { monthBounds } from '../utils/dates';

const router = Router();

const issueSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  parentId: z.string().cuid()
});

router.post('/issue', requireAuth, requireRole([Role.Tutor]), async (req: AuthenticatedRequest, res) => {
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid invoice payload', parsed.error.flatten());
  }

  const { period, parentId } = parsed.data;
  const { start, end } = monthBounds(period);

  const studentLinks = await prisma.relationship.findMany({
    where: { bUserId: parentId, type: RelationshipType.S_P, consent: true }
  });

  const lineItems: Array<{ type: string; qty: number; unitPrice: number }> = [];

  for (const link of studentLinks) {
    const attendance = await prisma.attendanceLog.findMany({
      where: { studentId: link.aUserId, sessionDate: { gte: start, lt: end } }
    });
    const minutes = attendance.reduce((sum, log) => sum + log.minutes, 0);
    if (minutes > 0) {
      lineItems.push({ type: 'tuition', qty: minutes, unitPrice: 1.2 });
    }
  }

  if (lineItems.length === 0) {
    lineItems.push({ type: 'materials', qty: 1, unitPrice: 10 });
  }

  const total = lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

  const invoice = await prisma.invoice.create({
    data: {
      period,
      parentId,
      lineItems,
      total: new Prisma.Decimal(total.toFixed(2)),
      status: 'Issued',
      issuedAt: new Date()
    }
  });

  await recordAudit({
    actorId: req.user!.id,
    entity: 'Invoice',
    entityId: invoice.id,
    action: 'INVOICE_ISSUED',
    metadata: { lineItemCount: lineItems.length }
  });

  res.status(201).json({ invoice });
});

router.get('/:id', requireAuth, requireRole([Role.Parent, Role.Tutor]), async (req: AuthenticatedRequest, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) {
    throw new AppError(404, 'Invoice not found');
  }

  if (req.user!.role === Role.Parent && invoice.parentId !== req.user!.id) {
    throw new AppError(403, 'Forbidden');
  }

  res.json({ invoice });
});

router.get('/:id/receipt', requireAuth, requireRole([Role.Parent, Role.Tutor]), async (req: AuthenticatedRequest, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) {
    throw new AppError(404, 'Invoice not found');
  }

  if (req.user!.role === Role.Parent && invoice.parentId !== req.user!.id) {
    throw new AppError(403, 'Forbidden');
  }

  const doc = new PDFDocument();
  const buffers: Buffer[] = [];
  doc.on('data', (chunk) => buffers.push(chunk as Buffer));
  doc.on('end', () => {
    const pdf = Buffer.concat(buffers);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length.toString());
    res.send(pdf);
  });

  doc.fontSize(18).text('Invoice Receipt', { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice ID: ${invoice.id}`);
  doc.text(`Period: ${invoice.period}`);
  doc.text(`Total: $${invoice.total.toString()}`);
  doc.text(`Status: ${invoice.status}`);
  doc.moveDown();
  doc.text('Line Items:');
  const items = invoice.lineItems as Array<{ type: string; qty: number; unitPrice: number }>;
  items.forEach((item) => {
    doc.text(`- ${item.type} x${item.qty} @ $${item.unitPrice}`);
  });

  doc.end();
});

export default router;
