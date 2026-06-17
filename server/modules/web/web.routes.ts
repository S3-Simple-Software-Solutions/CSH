import { Router, raw } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import { getHeroImage, getWebConfig, removeHeroImage, resolvePublicHero, saveHeroImage, saveWebTexts } from './web.service';

export const webRouter = Router();

webRouter.get('/api/web/hero', (_req, res) => {
  res.json({ ok: true, hero: resolvePublicHero() });
});

const heroUpload = raw({ type: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'], limit: '8mb' });

webRouter.get('/admin/api/web', requireAdmin, (_req, res) => {
  res.json({ ok: true, ...getWebConfig() });
});

webRouter.post('/admin/api/web', requireAdmin, (req, res) => {
  res.json({ ok: true, config: saveWebTexts(req.body) });
});

webRouter.post('/admin/api/web/hero-imagen', requireAdmin, heroUpload, (req, res, next) => {
  try {
    res.json({ ok: true, config: saveHeroImage(req.body, req.headers['content-type']) });
  } catch (err) {
    next(err);
  }
});

webRouter.delete('/admin/api/web/hero-imagen', requireAdmin, (_req, res) => {
  res.json({ ok: true, config: removeHeroImage() });
});

webRouter.get('/site-assets/hero', (_req, res) => {
  const hero = getHeroImage();
  if (!hero) return res.status(404).end();
  res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  res.type(hero.imageType).send(hero.buffer);
});
