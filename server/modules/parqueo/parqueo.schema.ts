import { pool, query } from '../../core/db';

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
  const count = Number((await query<{ count: number }>('select count(*)::int as count from parking_spaces'))[0].count);
  if (count === 0) await seedParking();
}

async function seedParking(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const floor of [1, 2]) {
      for (const zone of ['A', 'B']) {
        for (let num = 1; num <= 100; num++) {
          const id = `P${floor}-${zone}${String(num).padStart(3, '0')}`;
          await client.query(
            'insert into parking_spaces (id, floor, zone, num, type, status, reservation_id) values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing',
            [id, floor, zone, num, 'regular', 'disponible', null],
          );
        }
      }
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
