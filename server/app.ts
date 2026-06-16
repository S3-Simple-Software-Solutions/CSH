import express from 'express';
import path from 'path';
import { errorHandler } from './core/middleware';
import { DIST_DIR, PUBLIC_DIR } from './config/constants';
import { authRouter } from './modules/auth/auth.routes';
import { parqueoRouter } from './modules/parqueo/parqueo.routes';
import { cuponeraRouter } from './modules/cuponera/cuponera.routes';
import { entradasRouter } from './modules/entradas/entradas.routes';
import { usuariosRouter } from './modules/usuarios/usuarios.routes';
import { webRouter } from './modules/web/web.routes';
import { contactoRouter } from './modules/contacto/contacto.routes';

// Rutas que NO deben caer en el fallback de la SPA (las maneja el backend).
const API_PREFIXES = ['/api', '/admin/api', '/admin/sign-in', '/admin/logout', '/site-assets', '/__login'];

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  // Routers de dominio (rutas API y de sesion).
  app.use(authRouter);
  app.use(parqueoRouter);
  app.use(cuponeraRouter);
  app.use(entradasRouter);
  app.use(usuariosRouter);
  app.use(webRouter);
  app.use(contactoRouter);

  // Assets estáticos: brand/favicon (public/) y bundle compilado de la SPA (dist/).
  app.use(express.static(PUBLIC_DIR, { maxAge: '1y' }));
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1y' }));

  // Fallback de la SPA: cualquier GET que no sea API ni asset sirve index.html.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (API_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + '/') || req.path.startsWith(p))) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });

  app.use(errorHandler);
  return app;
}
