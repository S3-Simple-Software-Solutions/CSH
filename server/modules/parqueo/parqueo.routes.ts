import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import * as parqueo from './parqueo.service';

export const parqueoRouter = Router();

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
