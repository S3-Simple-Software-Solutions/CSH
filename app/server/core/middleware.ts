import type { Request, Response, NextFunction } from 'express';
import { ApiError } from './errors';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ ok: false, error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ ok: false, error: 'Error interno' });
}
