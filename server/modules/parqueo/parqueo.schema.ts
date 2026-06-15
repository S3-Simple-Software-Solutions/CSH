import fs from 'fs';
import { USE_DB, getPool, query } from '../../core/db';
import { PARQUEO_FILE } from '../../config/constants';
import { initParqueoJsonShape } from './parqueo.repository.json';
import { ParqueoData } from './parqueo.types';

export async function ensureParqueoSchema(): Promise<void> {
  if (!USE_DB) {
    // JSON mode: ensure the data file exists with the initial 400-space shape.
    if (!fs.existsSync(PARQUEO_FILE)) {
      fs.writeFileSync(PARQUEO_FILE, `${JSON.stringify(initParqueoJsonShape(), null, 2)}\n`);
    }
    return;
  }
  await getPool().query(`
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
  let data: ParqueoData = initParqueoJsonShape();
  if (fs.existsSync(PARQUEO_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(PARQUEO_FILE, 'utf8'));
    } catch {
      /* keep generated shape */
    }
  }
  const client = await getPool().connect();
  try {
    await client.query('begin');
    for (const e of data.espacios || []) {
      await client.query(
        'insert into parking_spaces (id, floor, zone, num, type, status, reservation_id) values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing',
        [e.id, (e as any).piso || (e as any).floor, (e as any).zona || (e as any).zone, e.num, (e as any).tipo || (e as any).type || 'regular', (e as any).estado || (e as any).status || 'disponible', (e as any).reservaId || (e as any).reservation_id || null],
      );
    }
    for (const r of data.reservas || []) {
      await client.query(
        `insert into parking_reservations (id, space_id, user_id, user_name, plate, role, status, starts_at, ends_at, code, qr_data, email_qr, payment)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict do nothing`,
        [r.id, r.espacioId, r.userId || null, r.userName || 'Invitado', r.placa, r.rol || 'invitado', r.estado, r.inicio, r.fin, r.codigo || `CSH-${r.id}`, r.qrData || '', r.emailQr || null, r.pago ? JSON.stringify(r.pago) : null],
      );
    }
    for (const e of data.eventos || []) {
      await client.query('insert into parking_events (type, space_id, user_id, user_name, plate, notes, created_at) values ($1,$2,$3,$4,$5,$6,$7)', [
        e.tipo,
        e.espacioId || null,
        e.userId || null,
        e.userName || '',
        e.placa || '',
        e.notas || '',
        e.timestamp || new Date().toISOString(),
      ]);
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
