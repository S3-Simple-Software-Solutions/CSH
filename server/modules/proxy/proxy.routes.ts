import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import express, { type Express } from 'express';
import { ADMIN_LOGO_PATH, SITE_LOGO_PATH, DIST_DIR, COOKIE } from '../../config/constants';
import { getCachedAsset } from '../../core/cache';
import { parseCookies } from '../../core/http';
import { validToken } from '../auth/auth.tokens';
import { decorateSiteHtml } from './proxy.nav';

// El proxy se registra al final del pipeline: sirve assets cacheados del sitio
// oficial, la SPA de React (dist) y, como ultimo recurso, hace de proxy con cadte.
export function registerProxy(app: Express): void {
  app.get(ADMIN_LOGO_PATH, async (_req, res, next) => {
    try {
      const entry = await getCachedAsset(SITE_LOGO_PATH);
      res.setHeader('cache-control', 'public, max-age=86400');
      res.type(entry.meta.ct || 'image/png').send(entry.body);
    } catch (err) {
      next(err);
    }
  });

  if (fs.existsSync(DIST_DIR)) {
    app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { maxAge: '1y', immutable: true }));
    app.get('/parqueo', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
    app.get('/cuponera', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
    app.get(/^\/admin(?:\/.*)?$/, (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
  }

  app.use(async (req, res, next) => {
    try {
      if (req.method !== 'GET') return res.status(405).send('Metodo no permitido');
      const loopback = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
      if (!loopback && !validToken(parseCookies(req.headers.cookie)[COOKIE])) {
        return res.redirect(`/__login?next=${encodeURIComponent(req.originalUrl || '/')}`);
      }
      const entry = await getCachedAsset(req.originalUrl);
      let body = entry.body;
      if (/text\/html/i.test(entry.meta.ct || '')) {
        body = Buffer.from(decorateSiteHtml(body.toString('utf8')), 'utf8');
      }
      const isHtml = /text\/html/i.test(entry.meta.ct || '');
      const headers: Record<string, string> = {
        'content-type': entry.meta.ct || 'application/octet-stream',
        'cache-control': isHtml ? 'no-store' : 'public, max-age=3600',
      };
      if (/gzip/.test(req.headers['accept-encoding'] || '') && /text\/|javascript|json|xml|svg/i.test(entry.meta.ct || '')) {
        res.set({ ...headers, 'content-encoding': 'gzip' });
        return res.status(entry.meta.status || 200).send(zlib.gzipSync(body));
      }
      res.set(headers).status(entry.meta.status || 200).send(body);
    } catch (err) {
      next(err);
    }
  });
}
