import { pool, query } from '../../core/db';
import type { Noticia, NoticiaRow } from './noticias.types';

function toNoticia(r: NoticiaRow): Noticia {
  return {
    id: r.id,
    slug: r.slug,
    titulo: r.titulo,
    categoria: r.categoria as Noticia['categoria'],
    fuente: r.fuente,
    resumen: r.resumen,
    cuerpo: r.cuerpo ?? '',
    imagenPath: r.imagen_path,
    estado: r.estado as Noticia['estado'],
    fecha: r.fecha,
    creadoAt: r.creado_at,
  };
}

export async function findNoticiasPublicadas(categoria?: string): Promise<Noticia[]> {
  if (categoria && categoria !== 'Todas') {
    const rows = await query<NoticiaRow>(
      `select * from noticias where estado='publicado' and categoria=$1 order by fecha desc, creado_at desc`,
      [categoria],
    );
    return rows.map(toNoticia);
  }
  const rows = await query<NoticiaRow>(`select * from noticias where estado='publicado' order by fecha desc, creado_at desc`);
  return rows.map(toNoticia);
}

export async function findAllNoticias(): Promise<Noticia[]> {
  const rows = await query<NoticiaRow>('select * from noticias order by fecha desc, creado_at desc');
  return rows.map(toNoticia);
}

export async function findNoticiaById(id: string): Promise<Noticia | null> {
  const rows = await query<NoticiaRow>('select * from noticias where id=$1', [id]);
  return rows[0] ? toNoticia(rows[0]) : null;
}

export async function findNoticiaBySlug(slug: string): Promise<Noticia | null> {
  const rows = await query<NoticiaRow>('select * from noticias where slug=$1', [slug]);
  return rows[0] ? toNoticia(rows[0]) : null;
}

export async function insertNoticia(fields: {
  id: string; slug: string; titulo: string; categoria: string;
  fuente: string; resumen: string; cuerpo: string; imagenPath: string | null; estado: string; fecha: string;
}): Promise<Noticia> {
  const rows = await query<NoticiaRow>(
    `insert into noticias (id, slug, titulo, categoria, fuente, resumen, cuerpo, imagen_path, estado, fecha)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [fields.id, fields.slug, fields.titulo, fields.categoria, fields.fuente,
     fields.resumen, fields.cuerpo, fields.imagenPath, fields.estado, fields.fecha],
  );
  return toNoticia(rows[0]);
}

export async function updateNoticia(id: string, fields: Partial<{
  titulo: string; categoria: string; fuente: string; resumen: string; cuerpo: string;
  imagenPath: string | null; estado: string; fecha: string;
}>): Promise<Noticia | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (fields.titulo !== undefined) { sets.push(`titulo=$${i++}`); vals.push(fields.titulo); }
  if (fields.categoria !== undefined) { sets.push(`categoria=$${i++}`); vals.push(fields.categoria); }
  if (fields.fuente !== undefined) { sets.push(`fuente=$${i++}`); vals.push(fields.fuente); }
  if (fields.resumen !== undefined) { sets.push(`resumen=$${i++}`); vals.push(fields.resumen); }
  if (fields.cuerpo !== undefined) { sets.push(`cuerpo=$${i++}`); vals.push(fields.cuerpo); }
  if (fields.imagenPath !== undefined) { sets.push(`imagen_path=$${i++}`); vals.push(fields.imagenPath); }
  if (fields.estado !== undefined) { sets.push(`estado=$${i++}`); vals.push(fields.estado); }
  if (fields.fecha !== undefined) { sets.push(`fecha=$${i++}`); vals.push(fields.fecha); }
  if (!sets.length) return findNoticiaById(id);
  vals.push(id);
  const rows = await query<NoticiaRow>(`update noticias set ${sets.join(',')} where id=$${i} returning *`, vals);
  return rows[0] ? toNoticia(rows[0]) : null;
}

export async function deleteNoticia(id: string): Promise<boolean> {
  const result = await pool.query('delete from noticias where id=$1', [id]);
  return (result.rowCount ?? 0) > 0;
}
