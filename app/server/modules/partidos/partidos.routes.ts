import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import { genId } from '../../core/id';
import { ApiError } from '../../core/errors';
import {
  findProximos, findSiguiente, findResultados, findAllPartidos,
  findPartidoById, insertPartido, updatePartido, deletePartido,
} from './partidos.repository';

export const partidosRouter = Router();

// ── Públicas ──────────────────────────────────────────────────────────────────

partidosRouter.get('/api/partidos', async (_req, res, next) => {
  try {
    const [proximos, resultados] = await Promise.all([findProximos(), findResultados()]);
    res.json({ ok: true, proximos, resultados });
  } catch (err) { next(err); }
});

partidosRouter.get('/api/partidos/siguiente', async (_req, res, next) => {
  try {
    const partido = await findSiguiente();
    res.json({ ok: true, partido });
  } catch (err) { next(err); }
});

// ── Admin CRUD ────────────────────────────────────────────────────────────────

partidosRouter.get('/admin/api/partidos', requireAdmin, async (_req, res, next) => {
  try {
    const partidos = await findAllPartidos();
    res.json({ ok: true, partidos });
  } catch (err) { next(err); }
});

partidosRouter.post('/admin/api/partidos', requireAdmin, async (req, res, next) => {
  try {
    const { competicion, tipo, equipoLocal, equipoVisita, fecha, estadio, golesLocal, golesVisita, estado } = req.body;
    if (!competicion || !equipoLocal || !equipoVisita || !fecha) {
      throw new ApiError(400, 'competicion, equipoLocal, equipoVisita y fecha son obligatorios');
    }
    const partido = await insertPartido({
      id: genId('PAR'),
      competicion: String(competicion).trim(),
      tipo: String(tipo || 'proximo'),
      equipoLocal: String(equipoLocal).trim(),
      equipoVisita: String(equipoVisita).trim(),
      logoVisitaPath: null,
      fecha: String(fecha),
      estadio: estadio ? String(estadio).trim() : null,
      golesLocal: golesLocal != null ? Number(golesLocal) : null,
      golesVisita: golesVisita != null ? Number(golesVisita) : null,
      estado: String(estado || 'programado'),
    });
    res.status(201).json({ ok: true, partido });
  } catch (err) { next(err); }
});

partidosRouter.patch('/admin/api/partidos/:id', requireAdmin, async (req, res, next) => {
  try {
    const partido = await findPartidoById(String(req.params.id));
    if (!partido) throw new ApiError(404, 'Partido no encontrado');
    const { competicion, tipo, equipoLocal, equipoVisita, fecha, estadio, golesLocal, golesVisita, estado } = req.body;
    const updated = await updatePartido(partido.id, {
      ...(competicion !== undefined && { competicion: String(competicion).trim() }),
      ...(tipo !== undefined && { tipo: String(tipo) }),
      ...(equipoLocal !== undefined && { equipoLocal: String(equipoLocal).trim() }),
      ...(equipoVisita !== undefined && { equipoVisita: String(equipoVisita).trim() }),
      ...(fecha !== undefined && { fecha: String(fecha) }),
      ...(estadio !== undefined && { estadio: estadio ? String(estadio).trim() : null }),
      ...(golesLocal !== undefined && { golesLocal: golesLocal !== null ? Number(golesLocal) : null }),
      ...(golesVisita !== undefined && { golesVisita: golesVisita !== null ? Number(golesVisita) : null }),
      ...(estado !== undefined && { estado: String(estado) }),
    });
    res.json({ ok: true, partido: updated });
  } catch (err) { next(err); }
});

partidosRouter.delete('/admin/api/partidos/:id', requireAdmin, async (req, res, next) => {
  try {
    const deleted = await deletePartido(String(req.params.id));
    if (!deleted) throw new ApiError(404, 'Partido no encontrado');
    res.json({ ok: true });
  } catch (err) { next(err); }
});
