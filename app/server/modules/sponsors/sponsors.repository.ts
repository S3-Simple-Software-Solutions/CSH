import { pool, query } from '../../core/db';
import { ESPACIO_IDS, type Sponsor, type SponsorRow } from './sponsors.types';

function toSponsor(r: SponsorRow): Sponsor {
  return {
    id: r.id,
    nombre: r.nombre,
    logoPath: r.logo_path,
    orden: r.orden,
    activo: r.activo,
    esApparel: r.es_apparel,
    espacios: r.espacios ?? [],
    creadoAt: r.creado_at,
  };
}

// Los espacios viajan siempre con el patrocinador (array agregado desde la
// tabla puente) para no hacer N+1 consultas en el panel.
const SPONSOR_SELECT = `
  select s.*,
    coalesce(array(select e.espacio_id from club_sponsor_espacios e where e.sponsor_id = s.id order by e.espacio_id), '{}') as espacios
    from club_sponsors s`;

// Público: sólo los activos que pautan en la página web.
export async function findSponsorsActivos(): Promise<Sponsor[]> {
  const rows = await query<SponsorRow>(
    `${SPONSOR_SELECT}
      where s.activo = true
        and exists(select 1 from club_sponsor_espacios e where e.sponsor_id = s.id and e.espacio_id = 'web')
      order by s.orden asc`,
  );
  return rows.map(toSponsor);
}

export async function findAllSponsors(): Promise<Sponsor[]> {
  const rows = await query<SponsorRow>(`${SPONSOR_SELECT} order by s.orden asc`);
  return rows.map(toSponsor);
}

export async function findSponsorById(id: string): Promise<Sponsor | null> {
  const rows = await query<SponsorRow>(`${SPONSOR_SELECT} where s.id=$1`, [id]);
  return rows[0] ? toSponsor(rows[0]) : null;
}

// Reemplaza el set completo de espacios de un patrocinador (ids desconocidos se
// descartan) y devuelve el patrocinador ya actualizado.
export async function setSponsorEspacios(id: string, espacios: string[]): Promise<Sponsor | null> {
  const validos = [...new Set(espacios.filter((e) => ESPACIO_IDS.includes(e)))];
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from club_sponsor_espacios where sponsor_id=$1', [id]);
    for (const espacio of validos) {
      await client.query('insert into club_sponsor_espacios (sponsor_id, espacio_id) values ($1,$2)', [id, espacio]);
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
  return findSponsorById(id);
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

export async function reorderSponsors(items: { id: string; orden: number }[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const { id, orden } of items) {
      await client.query('update club_sponsors set orden=$1 where id=$2', [orden, id]);
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
