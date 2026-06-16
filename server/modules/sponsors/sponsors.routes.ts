import fs from 'fs';
import path from 'path';
import { Router, raw } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import { PUBLIC_DIR } from '../../config/constants';
import { genId, slugify, IMG_EXT } from '../../core/id';
import { ApiError } from '../../core/errors';
import {
  findSponsorsActivos, findAllSponsors, findSponsorById,
  insertSponsor, updateSponsor, deleteSponsor,
} from './sponsors.repository';

export const sponsorsRouter = Router();

const logoUpload = raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'], limit: '4mb' });
const SPONSORS_DIR = path.join(PUBLIC_DIR, 'brand', 'sponsors');

// ── Pública ───────────────────────────────────────────────────────────────────

sponsorsRouter.get('/api/sponsors', async (_req, res, next) => {
  try {
    const sponsors = await findSponsorsActivos();
    const main = sponsors.filter((s) => !s.esApparel);
    const apparel = sponsors.find((s) => s.esApparel) ?? null;
    res.json({ ok: true, sponsors: main, apparelPartner: apparel });
  } catch (err) { next(err); }
});

// ── Admin CRUD ────────────────────────────────────────────────────────────────

sponsorsRouter.get('/admin/api/sponsors', requireAdmin, async (_req, res, next) => {
  try {
    const sponsors = await findAllSponsors();
    res.json({ ok: true, sponsors });
  } catch (err) { next(err); }
});

sponsorsRouter.post('/admin/api/sponsors', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, orden, esApparel } = req.body;
    if (!nombre) throw new ApiError(400, 'nombre es obligatorio');
    const sponsor = await insertSponsor({
      id: genId('SPO'),
      nombre: String(nombre).trim(),
      logoPath: null,
      orden: Number(orden ?? 0),
      esApparel: Boolean(esApparel),
    });
    res.status(201).json({ ok: true, sponsor });
  } catch (err) { next(err); }
});

sponsorsRouter.patch('/admin/api/sponsors/:id', requireAdmin, async (req, res, next) => {
  try {
    const sponsor = await findSponsorById(String(req.params.id));
    if (!sponsor) throw new ApiError(404, 'Sponsor no encontrado');
    const { nombre, orden, activo, esApparel } = req.body;
    const updated = await updateSponsor(sponsor.id, {
      ...(nombre !== undefined && { nombre: String(nombre).trim() }),
      ...(orden !== undefined && { orden: Number(orden) }),
      ...(activo !== undefined && { activo: Boolean(activo) }),
      ...(esApparel !== undefined && { esApparel: Boolean(esApparel) }),
    });
    res.json({ ok: true, sponsor: updated });
  } catch (err) { next(err); }
});

sponsorsRouter.delete('/admin/api/sponsors/:id', requireAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteSponsor(String(req.params.id));
    if (!deleted) throw new ApiError(404, 'Sponsor no encontrado');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Upload logo ───────────────────────────────────────────────────────────────

sponsorsRouter.post('/admin/api/sponsors/:id/logo', requireAdmin, logoUpload, async (req, res, next) => {
  try {
    const sponsor = await findSponsorById(String(req.params.id));
    if (!sponsor) throw new ApiError(404, 'Sponsor no encontrado');
    const ct = req.headers['content-type'] || '';
    const ext = ct === 'image/svg+xml' ? '.svg' : (IMG_EXT[ct] ?? '.png');
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new ApiError(400, 'Enviá la imagen como cuerpo binario');
    fs.mkdirSync(SPONSORS_DIR, { recursive: true });
    const filename = `${slugify(sponsor.nombre)}${ext}`;
    fs.writeFileSync(path.join(SPONSORS_DIR, filename), req.body);
    const logoPath = `/brand/sponsors/${filename}`;
    const updated = await updateSponsor(sponsor.id, { logoPath });
    res.json({ ok: true, sponsor: updated });
  } catch (err) { next(err); }
});
