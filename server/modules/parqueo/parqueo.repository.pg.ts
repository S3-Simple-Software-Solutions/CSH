import type { Pool, PoolClient } from 'pg';
import { pool, query } from '../../core/db';
import { ApiError } from '../../core/errors';
import {
  CreateReservationInput,
  EventActor,
  OccupyPublicInput,
  ParkingEvent,
  PaymentRecord,
  PublicSpace,
  Reservation,
  Space,
} from './parqueo.types';
import { LayoutGeometry, LayoutStall, ListEventosOptions, LogEventoInput, ParqueoRepository } from './parqueo.repository';
import { seedParkingLayout } from './parqueo.schema';

const activeWhere = "status in ('reservado','ocupado')";

function toSpace(row: any): Space {
  return { id: row.id, piso: row.floor, zona: row.zone, num: row.num, tipo: row.type, estado: row.status, reservaId: row.reservation_id };
}

function toReservation(row: any): Reservation {
  return {
    id: row.id,
    espacioId: row.space_id,
    userId: row.user_id,
    userName: row.user_name,
    placa: row.plate,
    rol: row.role,
    estado: row.status,
    inicio: row.starts_at.toISOString(),
    fin: row.ends_at.toISOString(),
    codigo: row.code,
    qrData: row.qr_data,
    emailQr: row.email_qr,
    pago: row.payment || null,
  };
}

async function nextReservationId(client: Pool | PoolClient): Promise<string> {
  const rows = await client.query("select coalesce(max(nullif(regexp_replace(id, '\\D', '', 'g'), '')::int), 0) + 1 as next from parking_reservations");
  return `R-${String(Number(rows.rows[0].next)).padStart(3, '0')}`;
}

async function logEvento(client: Pool | PoolClient, type: string, { espacioId, user, placa, notas }: LogEventoInput): Promise<void> {
  await client.query('insert into parking_events (type, space_id, user_id, user_name, plate, notes) values ($1,$2,$3,$4,$5,$6)', [
    type,
    espacioId || '',
    user ? user.id : null,
    user ? user.name : '',
    placa || '',
    notas || '',
  ]);
}

export class PgParqueoRepository implements ParqueoRepository {
  async publicEstado(): Promise<PublicSpace[]> {
    const rows = await query<any>(`
      select s.*, r.starts_at, r.ends_at
      from parking_spaces s
      left join parking_reservations r on r.id = s.reservation_id and r.status in ('reservado','ocupado')
      order by s.floor, s.zone, s.num
    `);
    return rows.map((r) => ({
      id: r.id,
      piso: r.floor,
      zona: r.zone,
      num: r.num,
      estado: r.status,
      reserva: r.starts_at ? { inicio: r.starts_at.toISOString(), fin: r.ends_at.toISOString() } : null,
    }));
  }

  async adminEstado(): Promise<{ espacios: Space[]; reservas: Reservation[] }> {
    const espacios = (await query<any>('select * from parking_spaces order by floor, zone, num')).map(toSpace);
    const reservas = (await query<any>(`select * from parking_reservations where ${activeWhere} order by starts_at desc`)).map(toReservation);
    return { espacios, reservas };
  }

  async listEventos({ limit, offset, plate }: ListEventosOptions): Promise<{ total: number; eventos: ParkingEvent[] }> {
    const where = plate ? 'where upper(plate) like $1' : '';
    const params = plate ? [`%${plate}%`, limit, offset] : [limit, offset];
    const countParams = plate ? [`%${plate}%`] : [];
    const total = Number((await query<any>(`select count(*)::int as total from parking_events ${where}`, countParams))[0].total);
    const rows = await query<any>(`select * from parking_events ${where} order by created_at desc limit $${plate ? 2 : 1} offset $${plate ? 3 : 2}`, params);
    const eventos: ParkingEvent[] = rows.map((e) => ({
      id: e.id,
      tipo: e.type,
      espacioId: e.space_id,
      userId: e.user_id,
      userName: e.user_name,
      placa: e.plate,
      notas: e.notes,
      timestamp: e.created_at.toISOString(),
    }));
    return { total, eventos };
  }

  async getActiveReservationByPlate(plate: string): Promise<Reservation | null> {
    const rows = await query<any>(`select * from parking_reservations where ${activeWhere} and plate = $1 order by starts_at desc limit 1`, [plate]);
    return rows[0] ? toReservation(rows[0]) : null;
  }

  async getActiveReservationById(id: string): Promise<Reservation | null> {
    const rows = await query<any>(`select * from parking_reservations where ${activeWhere} and id = $1 limit 1`, [id]);
    return rows[0] ? toReservation(rows[0]) : null;
  }

  async occupyPublic({ espacioId, placa, email, duracion }: OccupyPublicInput): Promise<Reservation> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const spaceRows = await client.query('select * from parking_spaces where id = $1 for update', [espacioId]);
      const space = spaceRows.rows[0];
      if (!space) {
        await client.query('rollback');
        throw new ApiError(404, 'El espacio no existe');
      }
      if (space.status !== 'disponible') {
        await client.query('rollback');
        throw new ApiError(409, 'El espacio no esta disponible');
      }
      const exists = await client.query(`select id from parking_reservations where ${activeWhere} and plate = $1 limit 1`, [placa]);
      if (exists.rows[0]) {
        await client.query('rollback');
        throw new ApiError(409, 'Esa placa ya tiene un espacio activo');
      }
      const id = await nextReservationId(client);
      const starts = new Date();
      const ends = new Date(starts.getTime() + duracion * 60000);
      const code = `CSH-R-${id.slice(2).padStart(4, '0')}`;
      const qrData = `${code}|${space.id}|${placa}|${ends.toISOString()}`;
      await client.query(
        `insert into parking_reservations (id, space_id, user_id, user_name, plate, role, status, starts_at, ends_at, code, qr_data, email_qr) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, space.id, null, 'Invitado', placa, 'invitado', 'ocupado', starts, ends, code, qrData, email],
      );
      await client.query("update parking_spaces set status = 'ocupado', reservation_id = $1 where id = $2", [id, space.id]);
      await logEvento(client, 'entrada', { espacioId: space.id, user: { id: null, name: 'Invitado' }, placa, notas: `Walk-in, estimado ${duracion} min, QR a ${email}` });
      await client.query('commit');
      return { id, espacioId: space.id, userId: null, userName: 'Invitado', placa, rol: 'invitado', estado: 'ocupado', inicio: starts.toISOString(), fin: ends.toISOString(), codigo: code, qrData, emailQr: email };
    } catch (err) {
      try {
        await client.query('rollback');
      } catch {
        /* noop */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async reservar({ espacioId, placa, duracion, user }: CreateReservationInput): Promise<Reservation> {
    const client = await pool.connect();
    try {
      const isAdmin = user.parkingRole === 'admin';
      await client.query('begin');
      const spaceRows = await client.query('select * from parking_spaces where id = $1 for update', [espacioId]);
      const space = spaceRows.rows[0];
      if (!space) {
        await client.query('rollback');
        throw new ApiError(404, 'El espacio no existe');
      }
      if (space.status !== 'disponible') {
        await client.query('rollback');
        throw new ApiError(409, 'El espacio no esta disponible');
      }
      if (!isAdmin) {
        const mine = await client.query(`select id from parking_reservations where ${activeWhere} and user_id = $1 limit 1`, [user.id]);
        if (mine.rows[0]) {
          await client.query('rollback');
          throw new ApiError(409, 'Ya tienes una reserva activa');
        }
      }
      const id = await nextReservationId(client);
      const starts = new Date();
      const ends = new Date(starts.getTime() + duracion * 60000);
      const code = `CSH-R-${id.slice(2).padStart(4, '0')}`;
      const qrData = `${code}|${space.id}|${placa}|${ends.toISOString()}`;
      await client.query(
        `insert into parking_reservations (id, space_id, user_id, user_name, plate, role, status, starts_at, ends_at, code, qr_data) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, space.id, user.id, user.name, placa, user.parkingRole || 'socio', 'reservado', starts, ends, code, qrData],
      );
      await client.query("update parking_spaces set status = 'reservado', reservation_id = $1 where id = $2", [id, space.id]);
      await logEvento(client, 'reserva', { espacioId: space.id, user, placa, notas: `Duracion ${duracion} min` });
      await client.query('commit');
      return { id, espacioId: space.id, userId: user.id, userName: user.name, placa, rol: user.parkingRole || 'socio', estado: 'reservado', inicio: starts.toISOString(), fin: ends.toISOString(), codigo: code, qrData };
    } catch (err) {
      try {
        await client.query('rollback');
      } catch {
        /* noop */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async ocupar(reservaId: string, actor: EventActor): Promise<void> {
    const reserva = await this.getActiveReservationById(reservaId);
    if (!reserva) throw new ApiError(404, 'Reserva no activa');
    if (reserva.estado === 'ocupado') throw new ApiError(409, 'El espacio ya esta ocupado');
    await pool.query("update parking_reservations set status = 'ocupado' where id = $1", [reserva.id]);
    await pool.query("update parking_spaces set status = 'ocupado' where id = $1", [reserva.espacioId]);
    await logEvento(pool, 'entrada', { espacioId: reserva.espacioId, user: actor, placa: reserva.placa });
  }

  async liberar(espacioId: string, actor: { id: string; name: string; parkingRole: string }): Promise<void> {
    const rows = await query<any>('select * from parking_spaces where id = $1', [espacioId]);
    const space = rows[0];
    if (!space) throw new ApiError(404, 'El espacio no existe');
    const reserva = space.reservation_id ? await this.getActiveReservationById(space.reservation_id) : null;
    if (!reserva) throw new ApiError(409, 'El espacio no tiene reserva activa');
    if (reserva.userId !== actor.id && actor.parkingRole !== 'admin') throw new ApiError(403, 'Sin permiso para liberar este espacio');
    await pool.query("update parking_reservations set status = 'finalizada' where id = $1", [reserva.id]);
    await pool.query("update parking_spaces set status = 'disponible', reservation_id = null where id = $1", [space.id]);
    await logEvento(pool, 'salida', { espacioId: space.id, user: actor, placa: reserva.placa, notas: reserva.userId === actor.id ? '' : 'Liberado por admin' });
  }

  async extender(reservaId: string, minutos: number, actor: { id: string; name: string; parkingRole: string }): Promise<void> {
    const reserva = await this.getActiveReservationById(reservaId);
    if (!reserva) throw new ApiError(404, 'Reserva no activa');
    if (reserva.userId !== actor.id && actor.parkingRole !== 'admin') throw new ApiError(403, 'Sin permiso para extender esta reserva');
    const base = Math.max(new Date(reserva.fin).getTime(), Date.now());
    const fin = new Date(base + minutos * 60000).toISOString();
    const qrData = `${reserva.codigo}|${reserva.espacioId}|${reserva.placa}|${fin}`;
    await pool.query('update parking_reservations set ends_at = $1, qr_data = $2 where id = $3', [fin, qrData, reserva.id]);
    await logEvento(pool, 'extension', { espacioId: reserva.espacioId, user: actor, placa: reserva.placa, notas: `+${minutos} min` });
  }

  async cancelar(id: string, actor: { id: string; name: string; parkingRole: string }): Promise<void> {
    const reserva = await this.getActiveReservationById(id);
    if (!reserva) throw new ApiError(404, 'Reserva no activa');
    if (reserva.userId !== actor.id && actor.parkingRole !== 'admin') throw new ApiError(403, 'Sin permiso para cancelar esta reserva');
    await pool.query("update parking_reservations set status = 'cancelada' where id = $1", [reserva.id]);
    await pool.query("update parking_spaces set status = 'disponible', reservation_id = null where id = $1", [reserva.espacioId]);
    await logEvento(pool, 'cancelacion', { espacioId: reserva.espacioId, user: actor, placa: reserva.placa, notas: reserva.userId === actor.id ? '' : 'Cancelada por admin' });
  }

  async finalizePayment(reserva: Reservation, payment: PaymentRecord, recibo: { monto: number; horas: number; transaccion: string }): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("update parking_reservations set status = 'finalizada', payment = $1 where id = $2", [JSON.stringify(payment), reserva.id]);
      await client.query("update parking_spaces set status = 'disponible', reservation_id = null where id = $1", [reserva.espacioId]);
      await logEvento(client, 'pago', { espacioId: reserva.espacioId, user: { id: null, name: 'Invitado' }, placa: reserva.placa, notas: `CRC ${recibo.monto} (${recibo.horas}h) - ${recibo.transaccion}` });
      await client.query('commit');
    } catch (err) {
      try {
        await client.query('rollback');
      } catch {
        /* noop */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async setReservationEmail(id: string, email: string): Promise<void> {
    await pool.query('update parking_reservations set email_qr = $1 where id = $2', [email, id]);
  }

  async logEvento(type: string, input: LogEventoInput): Promise<void> {
    await logEvento(pool, type, input);
  }

  async getLayout(): Promise<LayoutStall[]> {
    const rows = await query<any>('select * from parking_layout order by floor, stall_id');
    return rows.map((r) => ({ id: r.stall_id, piso: r.floor, zona: r.zona, x: Number(r.x), y: Number(r.y), w: Number(r.w), h: Number(r.h) }));
  }

  async saveLayout(stalls: LayoutGeometry[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const s of stalls) {
        await client.query('update parking_layout set x = $1, y = $2, w = $3, h = $4 where stall_id = $5', [s.x, s.y, s.w, s.h, s.id]);
      }
      await client.query('commit');
    } catch (err) {
      try {
        await client.query('rollback');
      } catch {
        /* noop */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async resetLayout(): Promise<void> {
    const client = await pool.connect();
    try {
      await seedParkingLayout(client);
    } finally {
      client.release();
    }
  }
}
