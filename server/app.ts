import express from 'express';
import path from 'path';
import fs from 'fs';
import { query } from './core/db';
import { errorHandler } from './core/middleware';
import { DIST_DIR, PUBLIC_DIR } from './config/constants';
import { getReleaseInfo } from './config/release';
import { authRouter } from './modules/auth/auth.routes';
import { parqueoRouter } from './modules/parqueo/parqueo.routes';
import { cuponeraRouter } from './modules/cuponera/cuponera.routes';
import { entradasRouter } from './modules/entradas/entradas.routes';
import { entradasWebhookRouter } from './modules/entradas/entradas.webhook';
import { restaurantesRouter } from './modules/restaurantes/restaurantes.routes';
import { restaurantesWebhookRouter } from './modules/restaurantes/restaurantes.webhook';
import { usuariosRouter } from './modules/usuarios/usuarios.routes';
import { webRouter } from './modules/web/web.routes';
import { contactoRouter } from './modules/contacto/contacto.routes';
import { jugadoresRouter } from './modules/jugadores/jugadores.routes';
import { noticiasRouter } from './modules/noticias/noticias.routes';
import { partidosRouter } from './modules/partidos/partidos.routes';
import { sponsorsRouter } from './modules/sponsors/sponsors.routes';
import { venuesRouter } from './modules/venues/venues.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';

// Rutas que NO deben caer en el fallback de la SPA (las maneja el backend).
const API_PREFIXES = ['/api', '/admin/api', '/admin/sign-in', '/admin/logout', '/site-assets', '/__login'];

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // El webhook de pagos necesita el body crudo para verificar la firma, así que
  // se monta ANTES del parser JSON global (usa su propio express.raw).
  app.use(entradasWebhookRouter);
  app.use(restaurantesWebhookRouter);

  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  app.get('/healthz', async (_req, res) => {
    try {
      await query('select 1 as ok');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.get('/api/version', (_req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.json({ ok: true, ...getReleaseInfo() });
  });

  // Routers de dominio (rutas API y de sesion).
  app.use(authRouter);
  app.use(parqueoRouter);
  app.use(cuponeraRouter);
  app.use(entradasRouter);
  app.use(restaurantesRouter);
  app.use(usuariosRouter);
  app.use(webRouter);
  app.use(contactoRouter);
  app.use(jugadoresRouter);
  app.use(noticiasRouter);
  app.use(partidosRouter);
  app.use(sponsorsRouter);
  app.use(venuesRouter);
  app.use(analyticsRouter);

  // Assets estáticos: brand/favicon (public/) y bundle compilado de la SPA (dist/).
  app.use(express.static(PUBLIC_DIR, { maxAge: '1y' }));
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1y' }));

  // Fallback de la SPA: cualquier GET que no sea API ni asset sirve index.html,
  // con las meta Open Graph resueltas al host de la petición (para el preview
  // al compartir el link en WhatsApp/redes).
  let indexHtmlTpl: string | null = null;
  const getIndexHtml = () => {
    if (indexHtmlTpl == null) indexHtmlTpl = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
    return indexHtmlTpl;
  };
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (API_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + '/') || req.path.startsWith(p))) return next();
    const host = req.get('host');
    const origin = host ? `https://${host}` : 'https://herediano.milocalhost.work';
    res.type('html').send(getIndexHtml().replace(/__OG_ORIGIN__/g, origin));
  });

  app.use(errorHandler);
  return app;
}
