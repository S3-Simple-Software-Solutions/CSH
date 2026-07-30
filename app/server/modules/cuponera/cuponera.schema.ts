import fs from 'fs';
import { pool, query } from '../../core/db';
import { CUPONERA_FILE } from '../../config/constants';
import { genId } from '../../core/id';

export async function ensureCuponeraSchema(): Promise<void> {
  await pool.query(`
    create table if not exists cupones (
      id text primary key,
      sponsor_id text references club_sponsors(id) on delete set null,
      proveedor text not null,
      logo text not null default '',
      titulo text not null,
      descripcion text not null default '',
      codigo text not null,
      categoria text not null,
      descuento integer not null default 0,
      vigencia timestamptz not null,
      estado text not null default 'habilitado',
      usos integer not null default 0,
      limite integer not null default 100,
      actualizado_at timestamptz not null default now()
    );
    create table if not exists cupon_eventos (
      id text primary key,
      cupon_id text references cupones(id) on delete set null,
      proveedor text,
      estado text,
      user_id text,
      user_name text,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_cupones_proveedor on cupones(proveedor);
    create index if not exists idx_cupon_eventos_created on cupon_eventos(created_at desc);
  `);

  const { count } = (await query<{ count: number }>('select count(*)::int as count from cupones'))[0];
  if (count === 0) await migrateOrSeedCupones();
}

async function migrateOrSeedCupones(): Promise<void> {
  if (fs.existsSync(CUPONERA_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CUPONERA_FILE, 'utf8'));
      const cupones = Array.isArray(data.cupones) ? data.cupones : [];
      for (const c of cupones) {
        const sponsor = await findSponsorByNombre(String(c.proveedor || ''));
        await pool.query(
          `insert into cupones (id, sponsor_id, proveedor, logo, titulo, descripcion, codigo, categoria, descuento, vigencia, estado, usos, limite, actualizado_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict (id) do nothing`,
          [
            c.id || genId('CUP'),
            sponsor?.id ?? null,
            c.proveedor,
            c.logo || sponsor?.logo_path || '',
            c.titulo,
            c.descripcion || '',
            c.codigo,
            c.categoria,
            Number(c.descuento || 0),
            c.vigencia,
            c.estado || 'habilitado',
            Number(c.usos || 0),
            Number(c.limite || 100),
            c.actualizado || new Date().toISOString(),
          ],
        );
      }
      const eventos = Array.isArray(data.eventos) ? data.eventos : [];
      for (const e of eventos) {
        await pool.query(
          `insert into cupon_eventos (id, cupon_id, proveedor, estado, user_id, user_name, created_at)
           values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
          [e.id || genId('CE'), e.cuponId, e.proveedor, e.estado, e.userId, e.userName, e.timestamp || new Date().toISOString()],
        );
      }
      return;
    } catch {
      /* fall through to seed */
    }
  }
  await seedCuponesFromSponsors();
}

async function findSponsorByNombre(nombre: string): Promise<{ id: string; logo_path: string | null } | null> {
  const rows = await query<{ id: string; logo_path: string | null }>(
    'select id, logo_path from club_sponsors where nombre=$1 limit 1',
    [nombre],
  );
  return rows[0] ?? null;
}

async function seedCuponesFromSponsors(): Promise<void> {
  const sponsors = await query<{ id: string; nombre: string; logo_path: string | null }>(
    'select id, nombre, logo_path from club_sponsors where es_apparel=false order by orden asc',
  );
  const offers = ['20% en articulo seleccionado', '2x1 en combo familiar', '15% pagando con tarjeta CSH', 'Upgrade gratis', '10% en tienda oficial', 'Bebida gratis', 'Envio sin costo'];
  const categories = ['Indumentaria', 'Alimentos', 'Finanzas', 'Hidratacion', 'Automotriz', 'Entretenimiento'];
  for (let i = 0; i < sponsors.length; i++) {
    const s = sponsors[i];
    await pool.query(
      `insert into cupones (id, sponsor_id, proveedor, logo, titulo, descripcion, codigo, categoria, descuento, vigencia, estado, usos, limite)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        `CUP-${String(i + 1).padStart(3, '0')}`,
        s.id,
        s.nombre,
        s.logo_path || '',
        offers[i % offers.length],
        `Beneficio demo para socios CSH con ${s.nombre}.`,
        `CSH${s.nombre.replace(/\W/g, '').slice(0, 4).toUpperCase()}${10 + i}`,
        categories[i % categories.length],
        [20, 25, 15, 30, 10, 12, 18][i % 7],
        new Date(Date.now() + (i + 14) * 86400000).toISOString(),
        i === 2 ? 'retirado' : 'habilitado',
        40 + i * 9,
        120 + i * 20,
      ],
    );
  }
}
