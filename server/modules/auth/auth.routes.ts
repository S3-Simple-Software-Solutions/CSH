import { Router } from 'express';
import { env } from '../../config/env';
import { COOKIE, ADMIN_COOKIE, SESSION_HOURS, ADMIN_SESSION_HOURS } from '../../config/constants';
import { parseCookies, cookieAttrs, safeEqual, safeNext } from '../../core/http';
import { makeToken, makeAdminToken, validAdminToken } from './auth.tokens';
import { findAdminUser } from '../usuarios/usuarios.service';
import { loginPage } from './auth.views';

export const authRouter = Router();

authRouter.get('/api/session', async (req, res, next) => {
  try {
    const user = await validAdminToken(parseCookies(req.headers.cookie)[ADMIN_COOKIE]);
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
            sponsor: user.sponsor,
          }
        : null,
    });
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

authRouter.post('/admin/sign-in', async (req, res, next) => {
  try {
    const user = await findAdminUser(req.body.usuario, req.body.clave);
    if (!user) return res.status(401).json({ ok: false, error: 'Usuario o contrasena incorrectos.' });
    res.setHeader('set-cookie', [
      cookieAttrs(req, ADMIN_COOKIE, '', 0, '/admin'),
      cookieAttrs(req, ADMIN_COOKIE, makeAdminToken(user), ADMIN_SESSION_HOURS * 3600, '/'),
    ]);
    res.json({ ok: true, user: { id: user.id, name: user.name, role: user.role, parkingRole: user.parkingRole, couponRole: user.couponRole, eventsRole: user.eventsRole, sponsor: user.sponsor } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/admin/logout', (req, res) => {
  res.setHeader('set-cookie', [cookieAttrs(req, ADMIN_COOKIE, '', 0, '/admin'), cookieAttrs(req, ADMIN_COOKIE, '', 0, '/')]);
  res.json({ ok: true });
});
