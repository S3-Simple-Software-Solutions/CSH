import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import * as entradas from './entradas.service';

export const entradasRouter = Router();

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

entradasRouter.post('/api/entradas/publico/comprar', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await entradas.comprarPublico(req.body)) });
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
