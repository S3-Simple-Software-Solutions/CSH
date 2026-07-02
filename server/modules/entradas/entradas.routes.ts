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
