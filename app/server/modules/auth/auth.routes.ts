import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env';
import { COOKIE, ADMIN_COOKIE, SESSION_HOURS, ADMIN_SESSION_HOURS } from '../../config/constants';
import { parseCookies, cookieAttrs, safeEqual, safeNext } from '../../core/http';
import { makeToken, makeAdminToken, validAdminToken } from './auth.tokens';
import { findAdminUser, registerAficionado, getUserProfile } from '../usuarios/usuarios.service';
import type { AdminUser } from '../usuarios/usuarios.data';
import { loginPage } from './auth.views';

export const authRouter = Router();

const registerRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

function sessionUserPayload(user: AdminUser) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    parkingRole: user.parkingRole,
    couponRole: user.couponRole,
    eventsRole: user.eventsRole,
    restaurantRole: user.restaurantRole,
    sponsor: user.sponsor,
    isSuperAdmin: user.isSuperAdmin,
  };
}

function setAdminSessionCookie(req: Parameters<typeof cookieAttrs>[0], res: { setHeader: (name: string, value: string | string[]) => void }, user: AdminUser) {
  res.setHeader('set-cookie', [
    cookieAttrs(req, ADMIN_COOKIE, '', 0, '/admin'),
    cookieAttrs(req, ADMIN_COOKIE, makeAdminToken(user), ADMIN_SESSION_HOURS * 3600, '/'),
  ]);
}

authRouter.get('/api/session', async (req, res, next) => {
  try {
    const user = await validAdminToken(parseCookies(req.headers.cookie).get(ADMIN_COOKIE));
    res.json({
      ok: true,
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            area: user.area,
            status: user.status,
            parkingRole: user.parkingRole,
            couponRole: user.couponRole,
            eventsRole: user.eventsRole,
            restaurantRole: user.restaurantRole,
            sponsor: user.sponsor,
            isSuperAdmin: user.isSuperAdmin,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/api/me', async (req, res, next) => {
  try {
    const sessionUser = await validAdminToken(parseCookies(req.headers.cookie).get(ADMIN_COOKIE));
    if (!sessionUser) return res.status(401).json({ ok: false, error: 'No autenticado' });
    const user = await getUserProfile(sessionUser.id);
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/__login', (req, res) => res.type('html').send(loginPage({ next: safeNext(req.query.next) })));

authRouter.post('/__login', (req, res) => {
  if (safeEqual(req.body.usuario, env.AUTH_USER) && safeEqual(req.body.clave, env.AUTH_PASS)) {
    res.setHeader('set-cookie', cookieAttrs(req, COOKIE, makeToken(), SESSION_HOURS * 3600, '/'));
    return res.redirect(safeNext(req.query.next));
  }
  return res.status(401).type('html').send(loginPage({ error: 'Usuario o contrasena incorrectos.', next: safeNext(req.query.next) }));
});

authRouter.get('/__logout', (req, res) => {
  res.setHeader('set-cookie', cookieAttrs(req, COOKIE, '', 0, '/'));
  res.redirect('/__login');
});

authRouter.post('/api/register', registerRateLimit, async (req, res, next) => {
  try {
    const user = await registerAficionado(req.body);
    setAdminSessionCookie(req, res, user);
    res.status(201).json({ ok: true, user: sessionUserPayload(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/admin/sign-in', async (req, res, next) => {
  try {
    const user = await findAdminUser(req.body.usuario, req.body.clave);
    if (!user) return res.status(401).json({ ok: false, error: 'Usuario o contrasena incorrectos.' });
    setAdminSessionCookie(req, res, user);
    res.json({ ok: true, user: sessionUserPayload(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/admin/logout', (req, res) => {
  res.setHeader('set-cookie', [cookieAttrs(req, ADMIN_COOKIE, '', 0, '/admin'), cookieAttrs(req, ADMIN_COOKIE, '', 0, '/')]);
  res.json({ ok: true });
});
