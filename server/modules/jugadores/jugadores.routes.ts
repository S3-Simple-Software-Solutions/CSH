import fs from 'fs';
import path from 'path';
import { Router, raw } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import { PUBLIC_DIR } from '../../config/constants';
import { genId, slugify, IMG_EXT } from '../../core/id';
import { ApiError } from '../../core/errors';
import {
  findJugadoresActivos, findAllJugadores, findDestacados,
  findJugadorById, findJugadorBySlug,
  insertJugador, updateJugador, deleteJugador, reorderJugadores,
} from './jugadores.repository';

export const jugadoresRouter = Router();

const photoUpload = raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], limit: '8mb' });
const PLAYERS_DIR = path.join(PUBLIC_DIR, 'brand', 'players');

// ── Públicas ──────────────────────────────────────────────────────────────────

jugadoresRouter.get('/api/jugadores', async (_req, res, next) => {
  try {
    const jugadores = await findJugadoresActivos();
    const categorias = ['Porteros', 'Defensas', 'Mediocampistas', 'Mediocampistas Ofensivos', 'Delanteros'];
    const squad = categorias.map((cat) => ({
      categoria: cat,
      jugadores: jugadores.filter((j) => j.categoria === cat),
    })).filter((g) => g.jugadores.length > 0);
    const staff = jugadores.filter((j) => j.categoria === 'Staff');
    res.json({ ok: true, squad, staff });
  } catch (err) { next(err); }
});

jugadoresRouter.get('/api/jugadores/destacados', async (_req, res, next) => {
  try {
    const destacados = await findDestacados();
    res.json({ ok: true, jugadores: destacados });
  } catch (err) { next(err); }
});

// ── Admin CRUD ────────────────────────────────────────────────────────────────

jugadoresRouter.get('/admin/api/jugadores', requireAdmin, async (_req, res, next) => {
  try {
    const jugadores = await findAllJugadores();
    res.json({ ok: true, jugadores });
  } catch (err) { next(err); }
});

jugadoresRouter.post('/admin/api/jugadores', requireAdmin, async (req, res, next) => {
  try {
    const { nombre, dorsal, posicion, categoria, nacionalidad, destacado, orden } = req.body;
    if (!nombre || !categoria) throw new ApiError(400, 'nombre y categoria son obligatorios');
    const slug = slugify(nombre);
    const existing = await findJugadorBySlug(slug);
    if (existing) throw new ApiError(409, `Ya existe un jugador con ese nombre (slug: ${slug})`);
    const jugador = await insertJugador({
      id: genId('JUG'), slug, nombre: String(nombre).trim(),
      dorsal: dorsal != null ? Number(dorsal) : null,
      posicion: posicion ? String(posicion).trim() : null,
      categoria: String(categoria).trim(),
      nacionalidad: String(nacionalidad || 'CRC').trim(),
      fotoPath: null, destacado: Boolean(destacado), orden: Number(orden ?? 0),
    });
    res.status(201).json({ ok: true, jugador });
  } catch (err) { next(err); }
});

jugadoresRouter.patch('/admin/api/jugadores/:id', requireAdmin, async (req, res, next) => {
  try {
    const jugador = await findJugadorById(String(req.params.id));
    if (!jugador) throw new ApiError(404, 'Jugador no encontrado');
    const { nombre, dorsal, posicion, categoria, nacionalidad, destacado, orden, activo } = req.body;
    const updated = await updateJugador(jugador.id, {
      ...(nombre !== undefined && { nombre: String(nombre).trim() }),
      ...(dorsal !== undefined && { dorsal: dorsal !== null ? Number(dorsal) : null }),
      ...(posicion !== undefined && { posicion: posicion ? String(posicion).trim() : null }),
      ...(categoria !== undefined && { categoria: String(categoria).trim() }),
      ...(nacionalidad !== undefined && { nacionalidad: String(nacionalidad).trim() }),
      ...(destacado !== undefined && { destacado: Boolean(destacado) }),
      ...(orden !== undefined && { orden: Number(orden) }),
      ...(activo !== undefined && { activo: Boolean(activo) }),
    });
    res.json({ ok: true, jugador: updated });
  } catch (err) { next(err); }
});

jugadoresRouter.delete('/admin/api/jugadores/:id', requireAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteJugador(String(req.params.id));
    if (!deleted) throw new ApiError(404, 'Jugador no encontrado');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

jugadoresRouter.post('/admin/api/jugadores/reorder', requireAdmin, async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) throw new ApiError(400, 'items debe ser un array');
    await reorderJugadores(items.map((it: any) => ({ id: String(it.id), orden: Number(it.orden) })));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Upload foto ───────────────────────────────────────────────────────────────

jugadoresRouter.post('/admin/api/jugadores/:id/foto', requireAdmin, photoUpload, async (req, res, next) => {
  try {
    const jugador = await findJugadorById(String(req.params.id));
    if (!jugador) throw new ApiError(404, 'Jugador no encontrado');
    const ct = req.headers['content-type'] || '';
    const ext = IMG_EXT[ct] ?? '.jpg';
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new ApiError(400, 'Enviá la imagen como cuerpo binario');
    fs.mkdirSync(PLAYERS_DIR, { recursive: true });
    const filename = `${jugador.slug}${ext}`;
    fs.writeFileSync(path.join(PLAYERS_DIR, filename), req.body);
    const fotoPath = `/brand/players/${filename}`;
    const updated = await updateJugador(jugador.id, { fotoPath });
    res.json({ ok: true, jugador: updated });
  } catch (err) { next(err); }
});
