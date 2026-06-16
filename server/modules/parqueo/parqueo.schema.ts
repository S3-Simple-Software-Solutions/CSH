import type { Pool, PoolClient } from 'pg';
import { pool, query } from '../../core/db';
import { buildStalls } from './parqueo.layout';

export async function ensureParqueoSchema(): Promise<void> {
  await pool.query(`
    create table if not exists parking_spaces (
      id text primary key,
      floor integer not null,
      zone text not null,
      num integer not null,
      type text not null default 'regular',
      status text not null default 'disponible',
      reservation_id text
    );
    create table if not exists parking_layout (
      stall_id text primary key,
      floor integer not null,
      zona text not null,
      x double precision not null,
      y double precision not null,
      w double precision not null,
      h double precision not null
    );
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
  `);
  // El layout de los planos (SÓTANO -1/-2) es la fuente de verdad. Si el conteo de
  // plazas no coincide con el layout actual, se re-siembra (migra el grid sintético
  // anterior de 400 plazas al croquis real).
  const stalls = buildStalls();
  const count = Number((await query<{ count: number }>('select count(*)::int as count from parking_spaces'))[0].count);
  if (count !== stalls.length) await reseedParking(stalls);

  // La geometría editable del croquis se siembra una vez desde el layout calculado.
  // A partir de ahí, los administradores pueden moverla/redimensionarla y persiste.
  const layoutCount = Number((await query<{ count: number }>('select count(*)::int as count from parking_layout'))[0].count);
  if (layoutCount !== stalls.length) await pool.connect().then((c) => seedParkingLayout(c).finally(() => c.release()));
}

// Reescribe parking_layout con la geometría calculada del layout (fuente original).
// Usado en el seed inicial y por el "Restaurar layout" del editor de plazas.
export async function seedParkingLayout(client: Pool | PoolClient): Promise<void> {
  await client.query('begin');
  try {
    await client.query('delete from parking_layout');
    for (const s of buildStalls()) {
      await client.query(
        'insert into parking_layout (stall_id, floor, zona, x, y, w, h) values ($1,$2,$3,$4,$5,$6,$7)',
        [s.id, s.piso, s.zona, s.x, s.y, s.w, s.h],
      );
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

async function reseedParking(stalls: ReturnType<typeof buildStalls>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from parking_reservations');
    await client.query('delete from parking_spaces');
    for (const s of stalls) {
      await client.query(
        'insert into parking_spaces (id, floor, zone, num, type, status, reservation_id) values ($1,$2,$3,$4,$5,$6,$7)',
        [s.id, s.piso, s.zona, s.num, 'regular', 'disponible', null],
      );
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
