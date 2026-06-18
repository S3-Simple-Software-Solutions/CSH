import type { Request, Response, NextFunction } from 'express';
import { ADMIN_COOKIE } from '../../config/constants';
import { parseCookies } from '../../core/http';
import { validAdminToken } from './auth.tokens';
import type { AdminUser } from '../usuarios/usuarios.data';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminUser?: AdminUser;
    }
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await validAdminToken(parseCookies(req.headers.cookie)[ADMIN_COOKIE]);
    if (!user) {
      res.status(401).json({ ok: false, error: 'No autenticado' });
      return;
    }
    req.adminUser = user;
    next();
  } catch (err) {
    next(err);
  }
}
