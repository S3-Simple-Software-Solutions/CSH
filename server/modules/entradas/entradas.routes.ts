import fs from 'fs';
import path from 'path';
import { Router, raw } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAdmin } from '../auth/auth.middleware';
import { PUBLIC_DIR } from '../../config/constants';
import { IMG_EXT } from '../../core/id';
import { ApiError } from '../../core/errors';
import * as entradas from './entradas.service';

export const entradasRouter = Router();

const flyerUpload = raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], limit: '8mb' });
// La subida de flyer escribe a disco; aunque exige sesión de admin, se limita
// por IP para acotar el abuso de I/O (CodeQL js/missing-rate-limiting).
const flyerRateLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const EVENT_FLYERS_DIR = path.join(PUBLIC_DIR, 'brand', 'events');

// ---- Rutas publicas ----
entradasRouter.get('/api/entradas/publico/eventos', async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.getPublicEventos()) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.get('/api/entradas/publico/eventos/:slug', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.getPublicEvento(String(req.params.slug))) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/api/entradas/publico/checkout', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.iniciarCheckoutPublico(req.body)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.get('/api/entradas/publico/orden/:ref', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.consultarOrdenPublica(String(req.params.ref))) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/api/entradas/publico/consulta', async (req, res, next) => {
  try {
    res.json({ ok: true, info: await entradas.consultaPublica(req.body) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/api/entradas/publico/reenviar', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.reenviarPublico(req.body)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/api/entradas/publico/validar-descuento', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.validarDescuentoPublico(req.body)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.get('/api/entradas/publico/eventos/:slug/asientos', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.getAsientosPublico(String(req.params.slug))) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/api/entradas/publico/reservar-asientos', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.reservarAsientosPublico(req.body)) });
  } catch (err) {
    next(err);
  }
});

// ---- Rutas admin ----
entradasRouter.get('/admin/api/entradas/eventos', requireAdmin, async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminListEventos()) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.get('/admin/api/entradas/eventos/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminGetEvento(String(req.params.id))) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/eventos', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminCrearEvento(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.put('/admin/api/entradas/eventos/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminActualizarEvento(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.delete('/admin/api/entradas/eventos/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await entradas.adminEliminarEvento(String(req.params.id), req.adminUser!);
    // Best-effort: borra el flyer subido del disco (si era propio del evento).
    const flyer = String(result.imagenUrl || '').split('?')[0];
    if (flyer.startsWith('/brand/events/')) {
      fs.rmSync(path.join(EVENT_FLYERS_DIR, path.basename(flyer)), { force: true });
    }
    res.json({ ok: true, nombre: result.nombre });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/eventos/:id/flyer', flyerRateLimit, requireAdmin, flyerUpload, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const current = await entradas.adminGetEventoEditable(id, req.adminUser!);
    const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
    const ext = IMG_EXT[contentType];
    if (!ext) throw new ApiError(415, 'Formato no permitido. Usá JPG, PNG, WebP o AVIF');
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new ApiError(400, 'Enviá el flyer como cuerpo binario');

    fs.mkdirSync(EVENT_FLYERS_DIR, { recursive: true });
    const filename = `${id}-${Date.now()}${ext}`;
    const filePath = path.join(EVENT_FLYERS_DIR, filename);
    fs.writeFileSync(filePath, req.body);

    try {
      const result = await entradas.adminActualizarFlyer(id, `/brand/events/${filename}`, req.adminUser!);
      const previous = String(current.evento.imagenUrl || '').split('?')[0];
      if (previous.startsWith('/brand/events/')) {
        const previousPath = path.join(EVENT_FLYERS_DIR, path.basename(previous));
        if (previousPath !== filePath) fs.rmSync(previousPath, { force: true });
      }
      res.json({ ok: true, ...result });
    } catch (err) {
      fs.rmSync(filePath, { force: true });
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/eventos/:id/estado', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminSetEstado(String(req.params.id), req.body.estado, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/eventos/:id/tipos', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminCrearTipo(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.put('/admin/api/entradas/tipos/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminActualizarTipo(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.delete('/admin/api/entradas/tipos/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminEliminarTipo(String(req.params.id), req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.get('/admin/api/entradas/ventas', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminVentas(req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.get('/admin/api/entradas/ventas/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminVentasEvento(String(req.params.id), req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/validar', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminValidar(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/cortesia', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminCortesia(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.get('/admin/api/entradas/log', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const eventoId = String(req.query.eventoId || '').trim();
    res.json({ ok: true, ...(await entradas.adminLog({ limit, offset, eventoId: eventoId || undefined }, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

// ── Asientos numerados ──────────────────────────────────────────────
entradasRouter.get('/admin/api/entradas/tipos/:id/asientos', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminListAsientos(String(req.params.id), req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/tipos/:id/asientos/generar', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminGenerarAsientos(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/asientos/estado', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminSetEstadoAsientosBulk(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.patch('/admin/api/entradas/asientos/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminSetEstadoAsiento(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

// ── Tandas / preventa ───────────────────────────────────────────────
entradasRouter.get('/admin/api/entradas/tipos/:id/tandas', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminListTandas(String(req.params.id), req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/tipos/:id/tandas', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminCrearTanda(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.put('/admin/api/entradas/tandas/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminActualizarTanda(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.delete('/admin/api/entradas/tandas/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json(await entradas.adminEliminarTanda(String(req.params.id), req.adminUser!));
  } catch (err) {
    next(err);
  }
});

// ── Templates de evento ─────────────────────────────────────────────
entradasRouter.get('/admin/api/entradas/templates', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminListTemplates(req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/templates', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminCrearTemplate(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.put('/admin/api/entradas/templates/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminActualizarTemplate(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.delete('/admin/api/entradas/templates/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json(await entradas.adminEliminarTemplate(String(req.params.id), req.adminUser!));
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/eventos/:id/guardar-template', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminGuardarComoTemplate(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/eventos/:id/aplicar-template', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminAplicarTemplate(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

// ── Promotores / RRPP ───────────────────────────────────────────────
entradasRouter.get('/admin/api/entradas/promotores', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminListPromotores(req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.get('/admin/api/entradas/promotores/ranking', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminRankingPromotores(req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/promotores', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminCrearPromotor(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.put('/admin/api/entradas/promotores/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminActualizarPromotor(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.delete('/admin/api/entradas/promotores/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json(await entradas.adminEliminarPromotor(String(req.params.id), req.adminUser!));
  } catch (err) {
    next(err);
  }
});

// ── Config global (fee) ────────────────────────────────────────────
entradasRouter.get('/admin/api/entradas/config', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminGetConfig(req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.put('/admin/api/entradas/config', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminSetConfig(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

// ── Códigos de descuento ────────────────────────────────────────────
entradasRouter.get('/admin/api/entradas/descuentos', requireAdmin, async (req, res, next) => {
  try {
    const eventoId = String(req.query.eventoId || '').trim();
    res.json({ ok: true, ...(await entradas.adminListDescuentos(eventoId || undefined, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/descuentos', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminCrearDescuento(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.put('/admin/api/entradas/descuentos/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.adminActualizarDescuento(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.delete('/admin/api/entradas/descuentos/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json(await entradas.adminEliminarDescuento(String(req.params.id), req.adminUser!));
  } catch (err) {
    next(err);
  }
});

// ── Rutas de mapa de zonas ─────────────────────────────────────────

entradasRouter.get('/admin/api/entradas/eventos/:id/mapa', requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    res.json({ ok: true, ...(await entradas.adminGetMapaEvento(id, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

entradasRouter.put('/admin/api/entradas/eventos/:id/mapa', requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const evento = await entradas.adminActualizarMapaEvento(id, req.body, req.adminUser!);
    res.json({ ok: true, evento });
  } catch (err) {
    next(err);
  }
});

entradasRouter.put('/admin/api/entradas/tipos/:id/mapa', requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const mapa = req.body.mapa ?? null;
    const tipo = await entradas.adminActualizarMapaTipo(id, mapa, req.adminUser!);
    res.json({ ok: true, tipo });
  } catch (err) {
    next(err);
  }
});

entradasRouter.post('/admin/api/entradas/eventos/:id/mapa/batch', requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const tipos = await entradas.adminGuardarMapaBatch(id, req.body, req.adminUser!);
    res.json({ ok: true, tipos });
  } catch (err) {
    next(err);
  }
});
