import fs from 'fs';
import path from 'path';
import { Router, raw } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAdmin } from '../auth/auth.middleware';
import { PUBLIC_DIR } from '../../config/constants';
import { IMG_EXT } from '../../core/id';
import { ApiError } from '../../core/errors';
import * as restaurantes from './restaurantes.service';

export const restaurantesRouter = Router();

const imgUpload = raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], limit: '8mb' });
// La subida escribe a disco; aunque exige admin/owner, se limita por IP (CodeQL js/missing-rate-limiting).
const imgRateLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
const REST_IMG_DIR = path.join(PUBLIC_DIR, 'brand', 'restaurantes');

// Guarda el buffer de imagen en public/brand/restaurantes/ y devuelve su URL pública.
function guardarImagen(prefix: string, contentType: string, body: unknown): string {
  const ext = IMG_EXT[contentType];
  if (!ext) throw new ApiError(415, 'Formato no permitido. Usá JPG, PNG, WebP o AVIF');
  if (!Buffer.isBuffer(body) || !body.length) throw new ApiError(400, 'Enviá la imagen como cuerpo binario');
  fs.mkdirSync(REST_IMG_DIR, { recursive: true });
  const filename = `${prefix}-${Date.now()}${ext}`;
  fs.writeFileSync(path.join(REST_IMG_DIR, filename), body);
  return `/brand/restaurantes/${filename}`;
}

function borrarImagenAnterior(url: string | undefined, exceptoUrl: string): void {
  const prev = String(url || '').split('?')[0];
  if (prev.startsWith('/brand/restaurantes/') && prev !== exceptoUrl) {
    fs.rmSync(path.join(REST_IMG_DIR, path.basename(prev)), { force: true });
  }
}

// ==== Rutas públicas ====

restaurantesRouter.get('/api/restaurantes/publico', async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.getPublicRestaurantes()) });
  } catch (err) { next(err); }
});

restaurantesRouter.get('/api/restaurantes/publico/orden/:ref', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.consultarOrdenPublica(String(req.params.ref))) });
  } catch (err) { next(err); }
});

restaurantesRouter.get('/api/restaurantes/publico/:slug', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.getPublicRestaurante(String(req.params.slug))) });
  } catch (err) { next(err); }
});

restaurantesRouter.post('/api/restaurantes/publico/checkout', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.iniciarCheckoutPublico(req.body)) });
  } catch (err) { next(err); }
});

// ==== Rutas owner/admin ====

restaurantesRouter.get('/admin/api/restaurantes', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.getAdminRestaurantes(req.adminUser!)) });
  } catch (err) { next(err); }
});

restaurantesRouter.post('/admin/api/restaurantes', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminCrearRestaurante(req.body, req.adminUser!)) });
  } catch (err) { next(err); }
});

// Gestión de dueños (solo admin) — literales antes de las rutas '/:id'.
restaurantesRouter.get('/admin/api/restaurantes/owners', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminListOwnerCandidates(req.adminUser!)) });
  } catch (err) { next(err); }
});

restaurantesRouter.post('/admin/api/restaurantes/owners', requireAdmin, async (req, res, next) => {
  try {
    res.json(await restaurantes.adminGrantOwner(String(req.body?.userId || ''), req.adminUser!));
  } catch (err) { next(err); }
});

restaurantesRouter.delete('/admin/api/restaurantes/owners/:userId', requireAdmin, async (req, res, next) => {
  try {
    res.json(await restaurantes.adminRevokeOwner(String(req.params.userId), req.adminUser!));
  } catch (err) { next(err); }
});

// Config (fee) — solo admin. Se define ANTES de las rutas '/:id' para que
// 'config' no se interprete como un id de restaurante.
restaurantesRouter.get('/admin/api/restaurantes/config', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminGetConfig(req.adminUser!)) });
  } catch (err) { next(err); }
});

restaurantesRouter.put('/admin/api/restaurantes/config', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminSetConfig(req.body, req.adminUser!)) });
  } catch (err) { next(err); }
});

restaurantesRouter.put('/admin/api/restaurantes/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminActualizarRestaurante(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) { next(err); }
});

restaurantesRouter.delete('/admin/api/restaurantes/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminEliminarRestaurante(String(req.params.id), req.adminUser!)) });
  } catch (err) { next(err); }
});

restaurantesRouter.post('/admin/api/restaurantes/:id/imagen', imgRateLimit, requireAdmin, imgUpload, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const current = await restaurantes.adminGetRestauranteEditable(id, req.adminUser!);
    const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
    const url = guardarImagen(id, contentType, req.body);
    try {
      const result = await restaurantes.adminSetRestauranteImagen(id, url, req.adminUser!);
      borrarImagenAnterior(current.imagenUrl, url);
      res.json({ ok: true, ...result });
    } catch (err) { fs.rmSync(path.join(REST_IMG_DIR, path.basename(url)), { force: true }); throw err; }
  } catch (err) { next(err); }
});

// Menú completo (incluye no disponibles) del restaurante
restaurantesRouter.get('/admin/api/restaurantes/:id/menu', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminGetMenu(String(req.params.id), req.adminUser!)) });
  } catch (err) { next(err); }
});

// Categorías del menú
restaurantesRouter.post('/admin/api/restaurantes/:id/categorias', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminCrearCategoria(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) { next(err); }
});

restaurantesRouter.put('/admin/api/restaurantes/categorias/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminActualizarCategoria(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) { next(err); }
});

restaurantesRouter.delete('/admin/api/restaurantes/categorias/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json(await restaurantes.adminEliminarCategoria(String(req.params.id), req.adminUser!));
  } catch (err) { next(err); }
});

// Ítems del menú
restaurantesRouter.post('/admin/api/restaurantes/:id/items', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminCrearItem(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) { next(err); }
});

restaurantesRouter.put('/admin/api/restaurantes/items/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminActualizarItem(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) { next(err); }
});

restaurantesRouter.delete('/admin/api/restaurantes/items/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json(await restaurantes.adminEliminarItem(String(req.params.id), req.adminUser!));
  } catch (err) { next(err); }
});

restaurantesRouter.post('/admin/api/restaurantes/items/:id/imagen', imgRateLimit, requireAdmin, imgUpload, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const current = await restaurantes.adminGetItemEditable(id, req.adminUser!);
    const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
    const url = guardarImagen(id, contentType, req.body);
    try {
      const result = await restaurantes.adminSetItemImagen(id, url, req.adminUser!);
      borrarImagenAnterior(current.imagenUrl, url);
      res.json({ ok: true, ...result });
    } catch (err) { fs.rmSync(path.join(REST_IMG_DIR, path.basename(url)), { force: true }); throw err; }
  } catch (err) { next(err); }
});

// Pedidos
restaurantesRouter.get('/admin/api/restaurantes/ordenes', requireAdmin, async (req, res, next) => {
  try {
    const restauranteId = String(req.query.restauranteId || '').trim();
    const soloActivas = String(req.query.filtro || 'activas') !== 'todas';
    res.json({ ok: true, ...(await restaurantes.adminListOrdenes(req.adminUser!, { restauranteId: restauranteId || undefined, soloActivas })) });
  } catch (err) { next(err); }
});

restaurantesRouter.post('/admin/api/restaurantes/ordenes/:id/estado', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await restaurantes.adminCambiarEstadoOrden(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) { next(err); }
});
