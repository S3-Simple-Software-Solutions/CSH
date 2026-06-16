import fs from 'fs';
import path from 'path';
import { Router, raw } from 'express';
import { requireAdmin } from '../auth/auth.middleware';
import { PUBLIC_DIR } from '../../config/constants';
import { genId, slugify, IMG_EXT } from '../../core/id';
import { ApiError } from '../../core/errors';
import { CATEGORIAS_NOTICIA } from './noticias.types';
import {
  findNoticiasPublicadas, findAllNoticias, findNoticiaById, findNoticiaBySlug,
  insertNoticia, updateNoticia, deleteNoticia,
} from './noticias.repository';

export const noticiasRouter = Router();

const imageUpload = raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], limit: '8mb' });
const NEWS_DIR = path.join(PUBLIC_DIR, 'brand', 'news');

// ── Públicas ──────────────────────────────────────────────────────────────────

noticiasRouter.get('/api/noticias', async (req, res, next) => {
  try {
    const categoria = String(req.query.categoria || '');
    const noticias = await findNoticiasPublicadas(categoria || undefined);
    res.json({ ok: true, noticias, categorias: ['Todas', ...CATEGORIAS_NOTICIA] });
  } catch (err) { next(err); }
});

// ── Admin CRUD ────────────────────────────────────────────────────────────────

noticiasRouter.get('/admin/api/noticias', requireAdmin, async (_req, res, next) => {
  try {
    const noticias = await findAllNoticias();
    res.json({ ok: true, noticias, categorias: CATEGORIAS_NOTICIA });
  } catch (err) { next(err); }
});

noticiasRouter.post('/admin/api/noticias', requireAdmin, async (req, res, next) => {
  try {
    const { titulo, categoria, fuente, resumen, estado, fecha } = req.body;
    if (!titulo || !categoria) throw new ApiError(400, 'titulo y categoria son obligatorios');
    const slug = slugify(titulo);
    const existing = await findNoticiaBySlug(slug);
    if (existing) throw new ApiError(409, `Ya existe una noticia con ese título (slug: ${slug})`);
    const noticia = await insertNoticia({
      id: genId('NOT'), slug,
      titulo: String(titulo).trim(),
      categoria: String(categoria).trim(),
      fuente: String(fuente || 'Prensa CSH').trim(),
      resumen: String(resumen || '').trim(),
      imagenPath: null,
      estado: String(estado || 'borrador'),
      fecha: String(fecha || new Date().toISOString().slice(0, 10)),
    });
    res.status(201).json({ ok: true, noticia });
  } catch (err) { next(err); }
});

noticiasRouter.patch('/admin/api/noticias/:id', requireAdmin, async (req, res, next) => {
  try {
    const noticia = await findNoticiaById(String(req.params.id));
    if (!noticia) throw new ApiError(404, 'Noticia no encontrada');
    const { titulo, categoria, fuente, resumen, estado, fecha } = req.body;
    const updated = await updateNoticia(noticia.id, {
      ...(titulo !== undefined && { titulo: String(titulo).trim() }),
      ...(categoria !== undefined && { categoria: String(categoria).trim() }),
      ...(fuente !== undefined && { fuente: String(fuente).trim() }),
      ...(resumen !== undefined && { resumen: String(resumen).trim() }),
      ...(estado !== undefined && { estado: String(estado) }),
      ...(fecha !== undefined && { fecha: String(fecha) }),
    });
    res.json({ ok: true, noticia: updated });
  } catch (err) { next(err); }
});

noticiasRouter.delete('/admin/api/noticias/:id', requireAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteNoticia(String(req.params.id));
    if (!deleted) throw new ApiError(404, 'Noticia no encontrada');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Upload imagen ─────────────────────────────────────────────────────────────

noticiasRouter.post('/admin/api/noticias/:id/imagen', requireAdmin, imageUpload, async (req, res, next) => {
  try {
    const noticia = await findNoticiaById(String(req.params.id));
    if (!noticia) throw new ApiError(404, 'Noticia no encontrada');
    const ct = req.headers['content-type'] || '';
    const ext = IMG_EXT[ct] ?? '.jpg';
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new ApiError(400, 'Enviá la imagen como cuerpo binario');
    fs.mkdirSync(NEWS_DIR, { recursive: true });
    const filename = `${noticia.slug}${ext}`;
    fs.writeFileSync(path.join(NEWS_DIR, filename), req.body);
    const imagenPath = `/brand/news/${filename}`;
    const updated = await updateNoticia(noticia.id, { imagenPath });
    res.json({ ok: true, noticia: updated });
  } catch (err) { next(err); }
});
