import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { signToken } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { recordAudit } from '../services/audit';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['Student', 'Parent', 'Tutor']),
  name: z.string().min(1)
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid register payload', parsed.error.flatten());
  }

  const { email, password, role, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, role, name } });
  const token = signToken({ id: user.id, role: user.role });

  await recordAudit({
    actorId: user.id,
    entity: 'User',
    entityId: user.id,
    action: 'REGISTER',
    metadata: { role: user.role }
  });

  res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid login payload', parsed.error.flatten());
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, 'Invalid credentials');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(401, 'Invalid credentials');
  }

  const token = signToken({ id: user.id, role: user.role });

  await recordAudit({
    actorId: user.id,
    entity: 'User',
    entityId: user.id,
    action: 'LOGIN'
  });

  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

export default router;
