import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): Response {
  if (error instanceof AppError) {
    return res.status(error.status).json({ message: error.message, details: error.details ?? null });
  }

  console.error(error);
  return res.status(500).json({ message: 'Internal server error' });
}
