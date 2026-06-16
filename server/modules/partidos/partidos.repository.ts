import { pool, query } from '../../core/db';
import type { Partido, PartidoRow } from './partidos.types';

function toPartido(r: PartidoRow): Partido {
  return {
    id: r.id,
    competicion: r.competicion,
    tipo: r.tipo as Partido['tipo'],
    equipoLocal: r.equipo_local,
    equipoVisita: r.equipo_visita,
    logoVisitaPath: r.logo_visita_path,
    fecha: r.fecha,
    estadio: r.estadio,
    golesLocal: r.goles_local,
    golesVisita: r.goles_visita,
    estado: r.estado as Partido['estado'],
    creadoAt: r.creado_at,
  };
}

export async function findProximos(): Promise<Partido[]> {
  const rows = await query<PartidoRow>(
    `select * from partidos where tipo='proximo' and estado in ('programado','pospuesto')
     order by fecha asc`,
  );
  return rows.map(toPartido);
}

export async function findSiguiente(): Promise<Partido | null> {
  const rows = await query<PartidoRow>(
    `select * from partidos where tipo='proximo' and estado='programado' and fecha > now()
     order by fecha asc limit 1`,
  );
  return rows[0] ? toPartido(rows[0]) : null;
}

export async function findResultados(): Promise<Partido[]> {
  const rows = await query<PartidoRow>(
    `select * from partidos where tipo='resultado' order by fecha desc limit 20`,
  );
  return rows.map(toPartido);
}

export async function findAllPartidos(): Promise<Partido[]> {
  const rows = await query<PartidoRow>('select * from partidos order by fecha desc');
  return rows.map(toPartido);
}

export async function findPartidoById(id: string): Promise<Partido | null> {
  const rows = await query<PartidoRow>('select * from partidos where id=$1', [id]);
  return rows[0] ? toPartido(rows[0]) : null;
}

export async function insertPartido(fields: {
  id: string; competicion: string; tipo: string; equipoLocal: string; equipoVisita: string;
  logoVisitaPath: string | null; fecha: string; estadio: string | null;
  golesLocal: number | null; golesVisita: number | null; estado: string;
}): Promise<Partido> {
  const rows = await query<PartidoRow>(
    `insert into partidos (id, competicion, tipo, equipo_local, equipo_visita, logo_visita_path, fecha, estadio, goles_local, goles_visita, estado)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [fields.id, fields.competicion, fields.tipo, fields.equipoLocal, fields.equipoVisita,
     fields.logoVisitaPath, fields.fecha, fields.estadio, fields.golesLocal, fields.golesVisita, fields.estado],
  );
  return toPartido(rows[0]);
}

export async function updatePartido(id: string, fields: Partial<{
  competicion: string; tipo: string; equipoLocal: string; equipoVisita: string;
  logoVisitaPath: string | null; fecha: string; estadio: string | null;
  golesLocal: number | null; golesVisita: number | null; estado: string;
}>): Promise<Partido | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (fields.competicion !== undefined) { sets.push(`competicion=$${i++}`); vals.push(fields.competicion); }
  if (fields.tipo !== undefined) { sets.push(`tipo=$${i++}`); vals.push(fields.tipo); }
  if (fields.equipoLocal !== undefined) { sets.push(`equipo_local=$${i++}`); vals.push(fields.equipoLocal); }
  if (fields.equipoVisita !== undefined) { sets.push(`equipo_visita=$${i++}`); vals.push(fields.equipoVisita); }
  if (fields.logoVisitaPath !== undefined) { sets.push(`logo_visita_path=$${i++}`); vals.push(fields.logoVisitaPath); }
  if (fields.fecha !== undefined) { sets.push(`fecha=$${i++}`); vals.push(fields.fecha); }
  if (fields.estadio !== undefined) { sets.push(`estadio=$${i++}`); vals.push(fields.estadio); }
  if (fields.golesLocal !== undefined) { sets.push(`goles_local=$${i++}`); vals.push(fields.golesLocal); }
  if (fields.golesVisita !== undefined) { sets.push(`goles_visita=$${i++}`); vals.push(fields.golesVisita); }
  if (fields.estado !== undefined) { sets.push(`estado=$${i++}`); vals.push(fields.estado); }
  if (!sets.length) return findPartidoById(id);
  vals.push(id);
  const rows = await query<PartidoRow>(`update partidos set ${sets.join(',')} where id=$${i} returning *`, vals);
  return rows[0] ? toPartido(rows[0]) : null;
}

export async function deletePartido(id: string): Promise<boolean> {
  const result = await pool.query('delete from partidos where id=$1', [id]);
  return (result.rowCount ?? 0) > 0;
}
