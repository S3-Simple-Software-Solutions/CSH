import express from 'express';
import { errorHandler } from './core/middleware';
import { authRouter } from './modules/auth/auth.routes';
import { parqueoRouter } from './modules/parqueo/parqueo.routes';
import { cuponeraRouter } from './modules/cuponera/cuponera.routes';
import { usuariosRouter } from './modules/usuarios/usuarios.routes';
import { webRouter } from './modules/web/web.routes';
import { registerProxy } from './modules/proxy/proxy.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  // Routers de dominio (rutas API y de sesion).
  app.use(authRouter);
  app.use(parqueoRouter);
  app.use(cuponeraRouter);
  app.use(usuariosRouter);
  app.use(webRouter);

  // El proxy (assets cacheados + SPA + catch-all) se monta al final.
  registerProxy(app);

  app.use(errorHandler);
  return app;
}
