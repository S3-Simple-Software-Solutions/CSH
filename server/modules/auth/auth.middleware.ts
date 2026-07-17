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
    const user = await validAdminToken(parseCookies(req.headers.cookie).get(ADMIN_COOKIE));
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

// Alias semántico de requireAdmin para rutas que solo exigen una sesión válida
// (aficionado logueado), como el módulo de reventa (/api/me/*). Nota: separar
// staff vs aficionado en /admin/api/* sigue siendo deuda existente fuera de
// alcance; aquí basta con exigir sesión.
export const requireAuth = requireAdmin;
