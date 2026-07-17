import { pool } from '../../core/db';
import { DEFAULT_FLOW_ARROWS } from './parqueo.flow';

// Modelo de croquis basado en PUNTOS (dots): cada espacio de parqueo es un punto
// (pos_x, pos_y en fracciones 0..1 sobre la imagen del plano) que el administrador
// coloca con un clic. No se siembra ningún layout automático: el plano arranca
// vacío y se construye marcando espacios.
export async function ensureParqueoSchema(): Promise<void> {
  await pool.query(`
    create table if not exists parking_spaces (
      id text primary key,
      floor integer not null,
      zone text not null,
      num integer not null,
      type text not null default 'regular',
      status text not null default 'disponible',
      reservation_id text,
      pos_x double precision,
      pos_y double precision,
      utilizado boolean not null default false,
      name text,
      spot_width double precision,
      spot_height double precision,
      accessible boolean not null default false
    );
    alter table parking_spaces add column if not exists pos_x double precision;
    alter table parking_spaces add column if not exists pos_y double precision;
    alter table parking_spaces add column if not exists utilizado boolean not null default false;
    alter table parking_spaces add column if not exists name text;
    alter table parking_spaces add column if not exists spot_width double precision;
    alter table parking_spaces add column if not exists spot_height double precision;
    alter table parking_spaces add column if not exists accessible boolean not null default false;
    update parking_spaces
      set accessible = true
      where lower(type) in ('discapacitado','discapacitados','accessible','disabled') and accessible = false;
    update parking_spaces
      set utilizado = (pos_x is not null and pos_y is not null)
      where utilizado is distinct from (pos_x is not null and pos_y is not null);
    create table if not exists parking_reservations (
      id text primary key,
      space_id text not null references parking_spaces(id),
      user_id text,
      user_name text not null,
      plate text not null,
      role text not null,
      status text not null,
      starts_at timestamptz not null,
      ends_at timestamptz not null,
      code text not null,
      qr_data text not null,
      email_qr text,
      payment jsonb
    );
    create table if not exists parking_events (
      id bigserial primary key,
      type text not null,
      space_id text,
      user_id text,
      user_name text,
      plate text,
      notes text,
      created_at timestamptz not null default now()
    );
    create table if not exists parking_flow_arrows (
      id text primary key,
      plan text not null,
      pos_x double precision not null,
      pos_y double precision not null,
      rotation double precision not null default 0,
      arrow_type text not null default 'straight'
    );
    alter table parking_flow_arrows add column if not exists arrow_type text not null default 'straight';
    update parking_flow_arrows
      set arrow_type = 'straight'
      where arrow_type is null or arrow_type = '';
    create table if not exists parking_roads (
      id text primary key,
      plan text not null,
      points jsonb not null default '[]'
    );
    create table if not exists parking_plan_settings (
      plan text primary key,
      show_plan boolean not null default true
    );
    -- Cada "parqueo" es un croquis (una imagen) con su nombre, precio y modo de
    -- cobro. Se identifica por piso (int) para reutilizar el resto del andamiaje
    -- (parking_spaces.floor, flechas/rutas keyed por plan).
    create table if not exists parqueos (
      id text primary key,
      piso integer not null unique,
      nombre text not null,
      slug text not null,
      croquis_url text not null default '',
      aspect double precision not null default 1.5,
      precio_crc integer not null default 0,
      modo_cobro text not null default 'hora',
      estado text not null default 'activo',
      orden integer not null default 0,
      creado_at timestamptz not null default now()
    );
    alter table parking_spaces add column if not exists parqueo_id text;
  `);
  for (const arrow of DEFAULT_FLOW_ARROWS) {
    await pool.query(
      'insert into parking_flow_arrows (id, plan, pos_x, pos_y, rotation, arrow_type) values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing',
      [arrow.id, arrow.plan, arrow.x, arrow.y, arrow.r, arrow.kind || 'straight'],
    );
  }
  await seedParqueos();
}

// Migra los dos pisos históricos (Sótano -1/-2) a filas de la tabla parqueos con
// su croquis (imagen ya copiada a public) y un precio inicial = tarifa por hora
// vigente. Solo corre una vez (cuando la tabla está vacía) para no pisar edits.
async function seedParqueos(): Promise<void> {
  const { rows } = await pool.query('select count(*)::int as n from parqueos');
  if (Number(rows[0].n) > 0) return;
  const aspect = 1700 / 1134;
  const seed = [
    { piso: 1, nombre: 'Sótano -1', slug: 'sotano-1', croquis: '/brand/parqueos/sotano-1.png' },
    { piso: 2, nombre: 'Sótano -2', slug: 'sotano-2', croquis: '/brand/parqueos/sotano-2.png' },
  ];
  for (const [i, p] of seed.entries()) {
    await pool.query(
      `insert into parqueos (id, piso, nombre, slug, croquis_url, aspect, precio_crc, modo_cobro, estado, orden)
       values ($1,$2,$3,$4,$5,$6,1000,'hora','activo',$7) on conflict (piso) do nothing`,
      [`PKO-${p.slug}`, p.piso, p.nombre, p.slug, p.croquis, aspect, i],
    );
  }
  // Vincula los espacios existentes a su parqueo por piso.
  await pool.query('update parking_spaces set parqueo_id = (select id from parqueos where piso = parking_spaces.floor) where parqueo_id is null');
}
