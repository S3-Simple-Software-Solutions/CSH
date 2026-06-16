import { pool, query } from '../../core/db';
import type { Sponsor, SponsorRow } from './sponsors.types';

function toSponsor(r: SponsorRow): Sponsor {
  return {
    id: r.id,
    nombre: r.nombre,
    logoPath: r.logo_path,
    orden: r.orden,
    activo: r.activo,
    esApparel: r.es_apparel,
    creadoAt: r.creado_at,
  };
}

export async function findSponsorsActivos(): Promise<Sponsor[]> {
  const rows = await query<SponsorRow>('select * from club_sponsors where activo=true order by orden asc');
  return rows.map(toSponsor);
}

export async function findAllSponsors(): Promise<Sponsor[]> {
  const rows = await query<SponsorRow>('select * from club_sponsors order by orden asc');
  return rows.map(toSponsor);
}

export async function findSponsorById(id: string): Promise<Sponsor | null> {
  const rows = await query<SponsorRow>('select * from club_sponsors where id=$1', [id]);
  return rows[0] ? toSponsor(rows[0]) : null;
}

export async function insertSponsor(fields: {
  id: string; nombre: string; logoPath: string | null; orden: number; esApparel: boolean;
}): Promise<Sponsor> {
  const rows = await query<SponsorRow>(
    `insert into club_sponsors (id, nombre, logo_path, orden, es_apparel)
     values ($1,$2,$3,$4,$5) returning *`,
    [fields.id, fields.nombre, fields.logoPath, fields.orden, fields.esApparel],
  );
  return toSponsor(rows[0]);
}

export async function updateSponsor(id: string, fields: Partial<{
  nombre: string; logoPath: string | null; orden: number; activo: boolean; esApparel: boolean;
}>): Promise<Sponsor | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (fields.nombre !== undefined) { sets.push(`nombre=$${i++}`); vals.push(fields.nombre); }
  if (fields.logoPath !== undefined) { sets.push(`logo_path=$${i++}`); vals.push(fields.logoPath); }
  if (fields.orden !== undefined) { sets.push(`orden=$${i++}`); vals.push(fields.orden); }
  if (fields.activo !== undefined) { sets.push(`activo=$${i++}`); vals.push(fields.activo); }
  if (fields.esApparel !== undefined) { sets.push(`es_apparel=$${i++}`); vals.push(fields.esApparel); }
  if (!sets.length) return findSponsorById(id);
  vals.push(id);
  const rows = await query<SponsorRow>(`update club_sponsors set ${sets.join(',')} where id=$${i} returning *`, vals);
  return rows[0] ? toSponsor(rows[0]) : null;
}

export async function deleteSponsor(id: string): Promise<boolean> {
  const result = await pool.query('delete from club_sponsors where id=$1', [id]);
  return (result.rowCount ?? 0) > 0;
}
