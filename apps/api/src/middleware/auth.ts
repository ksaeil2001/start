import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AppError } from '../utils/errors';

type JwtPayload = {
  sub: string;
  role: Role;
};

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: Role;
  };
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'supersecret';

export function signToken(user: { id: string; role: Role }): string {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header) {
    throw new AppError(401, 'Missing authorization header');
  }

  const [, token] = header.split(' ');
  if (!token) {
    throw new AppError(401, 'Invalid authorization header');
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (error) {
    throw new AppError(401, 'Invalid token', error);
  }
}

export function requireRole(roles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized');
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'Forbidden');
    }

    next();
  };
}
