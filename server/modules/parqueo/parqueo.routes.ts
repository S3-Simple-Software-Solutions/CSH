import fs from 'fs';
import path from 'path';
import { Router, raw } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAdmin } from '../auth/auth.middleware';
import { PUBLIC_DIR } from '../../config/constants';
import { IMG_EXT } from '../../core/id';
import { ApiError } from '../../core/errors';
import * as parqueo from './parqueo.service';

export const parqueoRouter = Router();

// Subida del croquis (imagen del plano) de un parqueo. Mismo patrón que
// restaurantes: cuerpo binario, límite por IP, y se guarda en public/.
const imgUpload = raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], limit: '8mb' });
const imgRateLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
const PARQUEO_IMG_DIR = path.join(PUBLIC_DIR, 'brand', 'parqueos');

function guardarCroquis(prefix: string, contentType: string, body: unknown): string {
  const ext = IMG_EXT[contentType];
  if (!ext) throw new ApiError(415, 'Formato no permitido. Usá JPG, PNG, WebP o AVIF');
  if (!Buffer.isBuffer(body) || !body.length) throw new ApiError(400, 'Enviá la imagen como cuerpo binario');
  fs.mkdirSync(PARQUEO_IMG_DIR, { recursive: true });
  const filename = `${prefix}-${Date.now()}${ext}`;
  fs.writeFileSync(path.join(PARQUEO_IMG_DIR, filename), body);
  return `/brand/parqueos/${filename}`;
}

function borrarCroquisAnterior(url: string | undefined, exceptoUrl: string): void {
  const prev = String(url || '').split('?')[0];
  // Solo borra archivos subidos; nunca los croquis semilla compartidos.
  if (prev.startsWith('/brand/parqueos/') && prev !== exceptoUrl && /-\d{10,}\.(jpg|png|webp|avif)$/.test(prev)) {
    fs.rmSync(path.join(PARQUEO_IMG_DIR, path.basename(prev)), { force: true });
  }
}

// ---- Rutas publicas ----
parqueoRouter.get('/api/parqueo/publico/estado', async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.getPublicEstado()) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.get('/api/parqueo/croquis', async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.getCroquis()) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/api/parqueo/publico/consulta', async (req, res, next) => {
  try {
    res.json({ ok: true, info: await parqueo.consultaPublica(req.body.placa) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/api/parqueo/publico/ocupar', async (req, res, next) => {
  try {
    res.json({ ok: true, sesion: await parqueo.occupyPublic(req.body) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/api/parqueo/publico/reenviar', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.reenviarPublico(req.body.placa)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/api/parqueo/publico/pagar', async (req, res, next) => {
  try {
    res.json({ ok: true, recibo: await parqueo.pagarPublico(req.body) });
  } catch (err) {
    next(err);
  }
});

// ---- Rutas admin: edición del croquis (puntos/dots) ----
parqueoRouter.post('/admin/api/parqueo/espacio', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.addEspacio(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/admin/api/parqueo/espacios/batch', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.batchEspacios(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.put('/admin/api/parqueo/espacio/:id/pos', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.moveEspacio(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.put('/admin/api/parqueo/flecha/:id/pos', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.moveFlecha(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/admin/api/parqueo/flecha', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.addFlecha(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.put('/admin/api/parqueo/flecha/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.updateFlecha(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.delete('/admin/api/parqueo/flecha/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.removeFlecha(String(req.params.id), req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/admin/api/parqueo/ruta', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.addRuta(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.delete('/admin/api/parqueo/ruta/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.removeRuta(String(req.params.id), req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/admin/api/parqueo/plan-visibilidad', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.setPlanVisibilidad(req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.put('/admin/api/parqueo/espacio/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.updateEspacio(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.delete('/admin/api/parqueo/espacio/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.removeEspacio(String(req.params.id), req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/admin/api/parqueo/croquis/clear', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.clearCroquis(req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.get('/admin/api/parqueo/estado', requireAdmin, async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.adminEstado()) });
  } catch (err) {
    next(err);
  }
});

// ---- Administración de parqueos (croquis + precio) ----
parqueoRouter.get('/admin/api/parqueo/parqueos', requireAdmin, async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.listParqueos()) });
  } catch (err) { next(err); }
});

parqueoRouter.post('/admin/api/parqueo/parqueos', requireAdmin, async (req, res, next) => {
  try {
    res.status(201).json({ ok: true, ...(await parqueo.crearParqueo(req.body, req.adminUser!)) });
  } catch (err) { next(err); }
});

parqueoRouter.put('/admin/api/parqueo/parqueos/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.actualizarParqueo(String(req.params.id), req.body, req.adminUser!)) });
  } catch (err) { next(err); }
});

parqueoRouter.delete('/admin/api/parqueo/parqueos/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.eliminarParqueo(String(req.params.id), req.adminUser!)) });
  } catch (err) { next(err); }
});

parqueoRouter.post('/admin/api/parqueo/parqueos/:id/croquis', imgRateLimit, requireAdmin, imgUpload, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const current = await parqueo.getParqueoById(id, req.adminUser!);
    const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
    const url = guardarCroquis(id, contentType, req.body);
    try {
      const aspect = Number(req.query.aspect);
      const result = await parqueo.setParqueoCroquis(id, url, aspect, req.adminUser!);
      borrarCroquisAnterior(current?.croquisUrl, url);
      res.json({ ok: true, ...result });
    } catch (err) {
      fs.rmSync(path.join(PARQUEO_IMG_DIR, path.basename(url)), { force: true });
      throw err;
    }
  } catch (err) { next(err); }
});

parqueoRouter.get('/admin/api/parqueo/eventos', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const plate = String(req.query.placa || '').trim().toUpperCase();
    res.json({ ok: true, ...(await parqueo.adminEventos({ limit, offset, plate: plate || undefined })) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/admin/api/parqueo/reservar', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, reserva: await parqueo.adminReservar(req.body, req.adminUser!) });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/admin/api/parqueo/ocupar', requireAdmin, async (req, res, next) => {
  try {
    if (req.adminUser!.parkingRole !== 'admin') return res.status(403).json({ ok: false, error: 'Solo administradores pueden marcar entradas' });
    await parqueo.adminOcupar(req.body.reservaId, req.adminUser!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/admin/api/parqueo/liberar', requireAdmin, async (req, res, next) => {
  try {
    await parqueo.adminLiberar(req.body.espacioId, req.adminUser!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/admin/api/parqueo/extender', requireAdmin, async (req, res, next) => {
  try {
    await parqueo.adminExtender(req.body.reservaId, req.body.minutos, req.adminUser!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.delete('/admin/api/parqueo/reserva/:id', requireAdmin, async (req, res, next) => {
  try {
    await parqueo.adminCancelar(String(req.params.id), req.adminUser!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

parqueoRouter.post('/admin/api/parqueo/enviar-qr', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await parqueo.adminEnviarQr(req.body.reservaId, req.body.email, req.adminUser!)) });
  } catch (err) {
    next(err);
  }
});
