import { pool, query } from '../../core/db';
import type { Jugador, JugadorRow } from './jugadores.types';

function toJugador(r: JugadorRow): Jugador {
  return {
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    dorsal: r.dorsal,
    posicion: r.posicion,
    categoria: r.categoria as Jugador['categoria'],
    nacionalidad: r.nacionalidad,
    fotoPath: r.foto_path,
    destacado: r.destacado,
    orden: r.orden,
    activo: r.activo,
    creadoAt: r.creado_at,
  };
}

export async function findAllJugadores(): Promise<Jugador[]> {
  const rows = await query<JugadorRow>('select * from jugadores order by orden asc, nombre asc');
  return rows.map(toJugador);
}

export async function findJugadoresActivos(): Promise<Jugador[]> {
  const rows = await query<JugadorRow>('select * from jugadores where activo = true order by orden asc, nombre asc');
  return rows.map(toJugador);
}

export async function findDestacados(): Promise<Jugador[]> {
  const rows = await query<JugadorRow>(
    `select * from jugadores where destacado = true and activo = true and categoria != 'Staff'
     order by orden asc limit 10`,
  );
  return rows.map(toJugador);
}

export async function findJugadorById(id: string): Promise<Jugador | null> {
  const rows = await query<JugadorRow>('select * from jugadores where id = $1', [id]);
  return rows[0] ? toJugador(rows[0]) : null;
}

export async function findJugadorBySlug(slug: string): Promise<Jugador | null> {
  const rows = await query<JugadorRow>('select * from jugadores where slug = $1', [slug]);
  return rows[0] ? toJugador(rows[0]) : null;
}

export async function insertJugador(fields: {
  id: string; slug: string; nombre: string; dorsal: number | null;
  posicion: string | null; categoria: string; nacionalidad: string;
  fotoPath: string | null; destacado: boolean; orden: number;
}): Promise<Jugador> {
  const rows = await query<JugadorRow>(
    `insert into jugadores (id, slug, nombre, dorsal, posicion, categoria, nacionalidad, foto_path, destacado, orden)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [fields.id, fields.slug, fields.nombre, fields.dorsal, fields.posicion, fields.categoria,
     fields.nacionalidad, fields.fotoPath, fields.destacado, fields.orden],
  );
  return toJugador(rows[0]);
}

export async function updateJugador(id: string, fields: Partial<{
  nombre: string; dorsal: number | null; posicion: string | null; categoria: string;
  nacionalidad: string; fotoPath: string | null; destacado: boolean; orden: number; activo: boolean;
}>): Promise<Jugador | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (fields.nombre !== undefined) { sets.push(`nombre=$${i++}`); vals.push(fields.nombre); }
  if (fields.dorsal !== undefined) { sets.push(`dorsal=$${i++}`); vals.push(fields.dorsal); }
  if (fields.posicion !== undefined) { sets.push(`posicion=$${i++}`); vals.push(fields.posicion); }
  if (fields.categoria !== undefined) { sets.push(`categoria=$${i++}`); vals.push(fields.categoria); }
  if (fields.nacionalidad !== undefined) { sets.push(`nacionalidad=$${i++}`); vals.push(fields.nacionalidad); }
  if (fields.fotoPath !== undefined) { sets.push(`foto_path=$${i++}`); vals.push(fields.fotoPath); }
  if (fields.destacado !== undefined) { sets.push(`destacado=$${i++}`); vals.push(fields.destacado); }
  if (fields.orden !== undefined) { sets.push(`orden=$${i++}`); vals.push(fields.orden); }
  if (fields.activo !== undefined) { sets.push(`activo=$${i++}`); vals.push(fields.activo); }
  if (!sets.length) return findJugadorById(id);
  vals.push(id);
  const rows = await query<JugadorRow>(`update jugadores set ${sets.join(',')} where id=$${i} returning *`, vals);
  return rows[0] ? toJugador(rows[0]) : null;
}

export async function deleteJugador(id: string): Promise<boolean> {
  const result = await pool.query('delete from jugadores where id=$1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function reorderJugadores(items: { id: string; orden: number }[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const { id, orden } of items) {
      await client.query('update jugadores set orden=$1 where id=$2', [orden, id]);
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
