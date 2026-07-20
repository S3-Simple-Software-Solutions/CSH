import { pool, query } from '../../core/db';
import { genId, slugify } from '../../core/id';

// Alquiler de salones del club: catálogo de espacios + reservas.
export async function ensureVenuesSchema(): Promise<void> {
  await pool.query(`
    create table if not exists venue_salones (
      id              text primary key,
      slug            text unique not null,
      nombre          text not null,
      descripcion     text not null default '',
      ubicacion       text not null default '',
      capacidad       integer not null default 0,
      tarifa_hora_crc integer not null default 0,
      tarifa_dia_crc  integer not null default 0,
      imagen_url      text not null default '',
      amenidades      jsonb not null default '[]'::jsonb,
      activo          boolean not null default true,
      orden           integer not null default 0,
      creado_at       timestamptz not null default now()
    );

    create table if not exists venue_reservas (
      id               text primary key,
      codigo           text unique not null,
      salon_id         text not null references venue_salones(id) on delete cascade,
      cliente_nombre   text not null,
      cliente_email    text not null,
      cliente_telefono text not null default '',
      tipo_evento      text not null default '',
      fecha            date not null,
      hora_inicio      text not null,
      hora_fin         text not null,
      personas         integer not null default 0,
      notas            text not null default '',
      estado           text not null default 'solicitada',
      precio_crc       integer not null default 0,
      motivo           text not null default '',
      creado_at        timestamptz not null default now()
    );

    create index if not exists idx_venue_reservas_salon_fecha on venue_reservas(salon_id, fecha);
    create index if not exists idx_venue_reservas_estado on venue_reservas(estado);
  `);

  const { count } = (await query<{ count: number }>('select count(*)::int as count from venue_salones'))[0];
  if (count === 0) await seedSalones();
}

// Los dos salones que alquila el club hoy; el admin ajusta datos y fotos.
async function seedSalones(): Promise<void> {
  const salones = [
    {
      nombre: 'Salón Rojiamarillo',
      descripcion: 'Salón principal con vista a la cancha, ideal para eventos corporativos, celebraciones y conferencias de prensa.',
      ubicacion: 'Estadio Eladio Rosabal Cordero, nivel 2',
      capacidad: 120,
      tarifaHora: 45000,
      tarifaDia: 300000,
      imagenUrl: '/brand/salones/seed-salon-rojiamarillo.jpg',
      amenidades: ['Proyector y pantalla', 'Sonido', 'Aire acondicionado', 'Wi-Fi', 'Servicio de catering opcional', 'Parqueo incluido'],
    },
    {
      nombre: 'Salón Team',
      descripcion: 'Espacio más íntimo para reuniones, capacitaciones y celebraciones pequeñas.',
      ubicacion: 'Estadio Eladio Rosabal Cordero, nivel 1',
      capacidad: 40,
      tarifaHora: 25000,
      tarifaDia: 160000,
      imagenUrl: '/brand/salones/seed-salon-team.jpg',
      amenidades: ['Pantalla', 'Wi-Fi', 'Aire acondicionado', 'Mesa de reuniones'],
    },
  ];

  let orden = 0;
  for (const s of salones) {
    await pool.query(
      `insert into venue_salones (id, slug, nombre, descripcion, ubicacion, capacidad, tarifa_hora_crc, tarifa_dia_crc, imagen_url, amenidades, orden)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
      [genId('VSA'), slugify(s.nombre), s.nombre, s.descripcion, s.ubicacion, s.capacidad, s.tarifaHora, s.tarifaDia, s.imagenUrl, JSON.stringify(s.amenidades), orden++],
    );
  }
}
