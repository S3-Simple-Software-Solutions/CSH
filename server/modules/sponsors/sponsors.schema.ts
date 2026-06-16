import { pool, query } from '../../core/db';
import { genId } from '../../core/id';

export async function ensureSponsorsSchema(): Promise<void> {
  await pool.query(`
    create table if not exists club_sponsors (
      id text primary key,
      nombre text not null,
      logo_path text,
      orden integer not null default 0,
      activo boolean not null default true,
      es_apparel boolean not null default false,
      creado_at timestamptz not null default now()
    );
  `);

  const { count } = (await query<{ count: number }>('select count(*)::int as count from club_sponsors'))[0];
  if (count === 0) await seedSponsors();
}

async function seedSponsors(): Promise<void> {
  const sponsors = [
    { nombre: 'Reebok', logo_path: '/brand/sponsors/reebok.png', orden: 0, es_apparel: false },
    { nombre: 'Taqueritos', logo_path: '/brand/sponsors/taqueritos.png', orden: 1, es_apparel: false },
    { nombre: 'Hariana', logo_path: '/brand/sponsors/hariana.png', orden: 2, es_apparel: false },
    { nombre: 'Transcomer', logo_path: '/brand/sponsors/transcomer.png', orden: 3, es_apparel: false },
    { nombre: 'Electrolit', logo_path: '/brand/sponsors/electrolit.png', orden: 4, es_apparel: false },
    { nombre: 'Chery', logo_path: '/brand/sponsors/chery.png', orden: 5, es_apparel: false },
    { nombre: 'Solo Cracks', logo_path: '/brand/partner-solocracks.png', orden: 6, es_apparel: true },
  ];

  for (const s of sponsors) {
    await pool.query(
      `insert into club_sponsors (id, nombre, logo_path, orden, es_apparel)
       values ($1,$2,$3,$4,$5)`,
      [genId('SPO'), s.nombre, s.logo_path, s.orden, s.es_apparel],
    );
  }
}
