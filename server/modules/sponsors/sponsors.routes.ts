import fs from 'fs';
import path from 'path';
import { Router, raw } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import { PUBLIC_DIR } from '../../config/constants';
import { genId, slugify, IMG_EXT } from '../../core/id';
import { ApiError } from '../../core/errors';
import {
  findSponsorsActivos, findAllSponsors, findSponsorById,
  insertSponsor, updateSponsor, deleteSponsor, reorderSponsors, setSponsorEspacios,
} from './sponsors.repository';
import { ESPACIOS_PAUTA } from './sponsors.types';

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
    res.json({ ok: true, sponsors, espaciosCatalogo: ESPACIOS_PAUTA });
  } catch (err) { next(err); }
});

sponsorsRouter.post('/admin/api/sponsors', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, orden, esApparel, espacios } = req.body;
    if (!nombre) throw new ApiError(400, 'nombre es obligatorio');
    const creado = await insertSponsor({
      id: genId('SPO'),
      nombre: String(nombre).trim(),
      logoPath: null,
      orden: Number(orden ?? 0),
      esApparel: Boolean(esApparel),
    });
    // Un patrocinador nuevo sin espacios explícitos pauta al menos en la web.
    const sponsor = await setSponsorEspacios(creado.id, Array.isArray(espacios) ? espacios.map(String) : ['web']);
    res.status(201).json({ ok: true, sponsor });
  } catch (err) { next(err); }
});

// Espacios donde pauta un patrocinador: se reemplaza el set completo.
sponsorsRouter.put('/admin/api/sponsors/:id/espacios', requireAdmin, async (req, res, next) => {
  try {
    const sponsor = await findSponsorById(String(req.params.id));
    if (!sponsor) throw new ApiError(404, 'Patrocinador no encontrado');
    const { espacios } = req.body;
    if (!Array.isArray(espacios)) throw new ApiError(400, 'espacios debe ser un array');
    res.json({ ok: true, sponsor: await setSponsorEspacios(sponsor.id, espacios.map(String)) });
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

sponsorsRouter.post('/admin/api/sponsors/reorder', requireAdmin, async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) throw new ApiError(400, 'items debe ser un array');
    await reorderSponsors(items.map((it: any) => ({ id: String(it.id), orden: Number(it.orden) })));
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
