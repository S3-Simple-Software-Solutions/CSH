import type { Pool, PoolClient } from 'pg';
import { pool, query } from '../../core/db';
import { ApiError } from '../../core/errors';
import {
  CreateReservationInput,
  EventActor,
  OccupyPublicInput,
  ParkingEvent,
  Parqueo,
  PaymentRecord,
  PublicSpace,
  Reservation,
  Space,
} from './parqueo.types';
import { AddEspacioInput, AddFlowArrowInput, AddRoadInput, CreateParqueoInput, CroquisDot, FlowArrow, ListEventosOptions, LogEventoInput, ParkingSpaceStatus, ParqueoRepository, Road, UpdateEspacioInput, UpdateFlowArrowInput, UpdateParqueoInput } from './parqueo.repository';
import { genId, slugify } from '../../core/id';

const activeWhere = "status in ('reservado','ocupado')";
const activeReservationWhere = "r.status in ('reservado','ocupado')";
const activeUsedWhere = `${activeReservationWhere} and s.utilizado = true`;

function toSpace(row: any): Space {
  return {
    id: row.id,
    piso: row.floor,
    zona: row.zone,
    num: row.num,
    tipo: row.type,
    estado: row.status,
    reservaId: row.reservation_id,
    utilizado: Boolean(row.utilizado ?? (row.pos_x !== null && row.pos_y !== null)),
    nombre: row.name || null,
    ancho: row.spot_width == null ? null : Number(row.spot_width),
    alto: row.spot_height == null ? null : Number(row.spot_height),
    discapacitado: Boolean(row.accessible),
    etiquetas: toEtiquetas(row.etiquetas),
  };
}

// La columna jsonb puede venir como array o como string según el driver.
function toEtiquetas(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
  }
  return [];
}

function toFlowArrow(row: any): FlowArrow {
  return {
    id: row.id,
    plan: row.plan,
    x: Number(row.pos_x),
    y: Number(row.pos_y),
    r: Number(row.rotation),
    kind: (row.arrow_type || 'straight') as FlowArrow['kind'],
  };
}

async function nextFlowArrowId(client: Pool | PoolClient, plan: string): Promise<string> {
  const res = await client.query('select id from parking_flow_arrows where plan = $1', [plan]);
  const prefix = `${plan}-arrow-`;
  const max = res.rows.reduce((best: number, row: { id: string }) => {
    if (!row.id.startsWith(prefix)) return best;
    const n = Number(row.id.slice(prefix.length));
    return Number.isFinite(n) ? Math.max(best, n) : best;
  }, 0);
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

function toRoad(row: any): Road {
  const raw = typeof row.points === 'string' ? JSON.parse(row.points || '[]') : row.points;
  const points = Array.isArray(raw)
    ? raw.map((p: any) => ({ x: Number(p.x), y: Number(p.y) })).filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y))
    : [];
  return { id: row.id, plan: row.plan, points };
}

async function nextRoadId(client: Pool | PoolClient, plan: string): Promise<string> {
  const res = await client.query('select id from parking_roads where plan = $1', [plan]);
  const prefix = `${plan}-road-`;
  const max = res.rows.reduce((best: number, row: { id: string }) => {
    if (!row.id.startsWith(prefix)) return best;
    const n = Number(row.id.slice(prefix.length));
    return Number.isFinite(n) ? Math.max(best, n) : best;
  }, 0);
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
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

function toParqueo(row: any): Parqueo {
  return {
    id: row.id,
    piso: Number(row.piso),
    nombre: row.nombre,
    slug: row.slug,
    croquisUrl: row.croquis_url || '',
    aspect: Number(row.aspect) || 1.5,
    precioCrc: Number(row.precio_crc) || 0,
    modoCobro: (row.modo_cobro === 'fijo' ? 'fijo' : 'hora'),
    estado: (row.estado === 'inactivo' ? 'inactivo' : 'activo'),
    orden: Number(row.orden) || 0,
  };
}

export class PgParqueoRepository implements ParqueoRepository {
  async listParqueos(): Promise<Parqueo[]> {
    const rows = await query<any>('select * from parqueos order by orden, piso');
    return rows.map(toParqueo);
  }

  async getParqueoById(id: string): Promise<Parqueo | null> {
    const rows = await query<any>('select * from parqueos where id = $1 limit 1', [id]);
    return rows[0] ? toParqueo(rows[0]) : null;
  }

  async getParqueoForEspacio(espacioId: string): Promise<Parqueo | null> {
    const rows = await query<any>(
      `select p.* from parqueos p
         join parking_spaces s on (s.parqueo_id = p.id or s.floor = p.piso)
        where s.id = $1 limit 1`,
      [espacioId],
    );
    return rows[0] ? toParqueo(rows[0]) : null;
  }

  async createParqueo(input: CreateParqueoInput): Promise<Parqueo> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const pisoRows = await client.query('select coalesce(max(piso), 0) + 1 as next, coalesce(max(orden), -1) + 1 as ord from parqueos');
      const piso = Number(pisoRows.rows[0].next);
      const orden = Number(pisoRows.rows[0].ord);
      let slug = slugify(input.nombre) || `parqueo-${piso}`;
      const clash = await client.query('select 1 from parqueos where slug = $1', [slug]);
      if (clash.rowCount) slug = `${slug}-${piso}`;
      const id = genId('PKO');
      const rows = await client.query(
        `insert into parqueos (id, piso, nombre, slug, croquis_url, aspect, precio_crc, modo_cobro, estado, orden)
         values ($1,$2,$3,$4,'',1.5,$5,$6,'activo',$7) returning *`,
        [id, piso, input.nombre, slug, input.precioCrc, input.modoCobro, orden],
      );
      await client.query('commit');
      return toParqueo(rows.rows[0]);
    } catch (err) {
      try { await client.query('rollback'); } catch { /* noop */ }
      throw err;
    } finally {
      client.release();
    }
  }

  async updateParqueo(id: string, patch: UpdateParqueoInput): Promise<Parqueo> {
    const rows = await query<any>(
      `update parqueos set
         nombre = coalesce($2, nombre),
         precio_crc = coalesce($3, precio_crc),
         modo_cobro = coalesce($4, modo_cobro),
         estado = coalesce($5, estado)
       where id = $1 returning *`,
      [id, patch.nombre ?? null, patch.precioCrc ?? null, patch.modoCobro ?? null, patch.estado ?? null],
    );
    if (!rows[0]) throw new ApiError(404, 'El parqueo no existe');
    return toParqueo(rows[0]);
  }

  async setParqueoCroquis(id: string, croquisUrl: string, aspect: number): Promise<Parqueo> {
    const rows = await query<any>(
      'update parqueos set croquis_url = $2, aspect = $3 where id = $1 returning *',
      [id, croquisUrl, aspect],
    );
    if (!rows[0]) throw new ApiError(404, 'El parqueo no existe');
    return toParqueo(rows[0]);
  }

  async deleteParqueo(id: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const parq = await client.query('select piso from parqueos where id = $1 for update', [id]);
      if (!parq.rowCount) { await client.query('rollback'); throw new ApiError(404, 'El parqueo no existe'); }
      const piso = Number(parq.rows[0].piso);
      const active = await client.query(
        `select 1 from parking_reservations r join parking_spaces s on s.id = r.space_id
          where s.floor = $1 and r.status in ('reservado','ocupado') limit 1`,
        [piso],
      );
      if (active.rowCount) { await client.query('rollback'); throw new ApiError(409, 'No se puede eliminar: hay reservas activas en este parqueo'); }
      await client.query("delete from parking_reservations where space_id in (select id from parking_spaces where floor = $1)", [piso]);
      await client.query('delete from parking_spaces where floor = $1', [piso]);
      await client.query('delete from parking_flow_arrows where plan = (select slug from parqueos where id = $1)', [id]);
      await client.query('delete from parking_roads where plan = (select slug from parqueos where id = $1)', [id]);
      await client.query('delete from parqueos where id = $1', [id]);
      await client.query('commit');
    } catch (err) {
      try { await client.query('rollback'); } catch { /* noop */ }
      throw err;
    } finally {
      client.release();
    }
  }

  async publicEstado(): Promise<PublicSpace[]> {
    const rows = await query<any>(`
      select s.*, r.starts_at, r.ends_at
      from parking_spaces s
      left join parking_reservations r on r.id = s.reservation_id and r.status in ('reservado','ocupado')
      where s.utilizado = true
      order by s.floor, s.zone, s.num
    `);
    return rows.map((r) => ({
      id: r.id,
      piso: r.floor,
      zona: r.zone,
      num: r.num,
      estado: r.status,
      reserva: r.starts_at ? { inicio: r.starts_at.toISOString(), fin: r.ends_at.toISOString() } : null,
      utilizado: Boolean(r.utilizado),
      nombre: r.name || null,
      tipo: r.type,
      ancho: r.spot_width == null ? null : Number(r.spot_width),
      alto: r.spot_height == null ? null : Number(r.spot_height),
      discapacitado: Boolean(r.accessible),
      etiquetas: toEtiquetas(r.etiquetas),
    }));
  }

  async adminEstado(): Promise<{ espacios: Space[]; reservas: Reservation[] }> {
    const espacios = (await query<any>('select * from parking_spaces where utilizado = true order by floor, zone, num')).map(toSpace);
    const reservas = (
      await query<any>(`
        select r.*
        from parking_reservations r
        join parking_spaces s on s.id = r.space_id
        where ${activeUsedWhere}
        order by r.starts_at desc
      `)
    ).map(toReservation);
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
    const rows = await query<any>(
      `
        select r.*
        from parking_reservations r
        join parking_spaces s on s.id = r.space_id
        where ${activeUsedWhere} and r.plate = $1
        order by r.starts_at desc
        limit 1
      `,
      [plate],
    );
    return rows[0] ? toReservation(rows[0]) : null;
  }

  async getActiveReservationById(id: string): Promise<Reservation | null> {
    const rows = await query<any>(
      `
        select r.*
        from parking_reservations r
        join parking_spaces s on s.id = r.space_id
        where ${activeUsedWhere} and r.id = $1
        limit 1
      `,
      [id],
    );
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
      if (!space.utilizado) {
        await client.query('rollback');
        throw new ApiError(404, 'El espacio no esta marcado en el croquis');
      }
      if (space.status !== 'disponible') {
        await client.query('rollback');
        throw new ApiError(409, 'El espacio no esta disponible');
      }
      const exists = await client.query(
        `
          select r.id
          from parking_reservations r
          join parking_spaces s on s.id = r.space_id
          where ${activeUsedWhere} and r.plate = $1
          limit 1
        `,
        [placa],
      );
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
      if (!space.utilizado) {
        await client.query('rollback');
        throw new ApiError(404, 'El espacio no esta marcado en el croquis');
      }
      if (space.status !== 'disponible') {
        await client.query('rollback');
        throw new ApiError(409, 'El espacio no esta disponible');
      }
      if (!isAdmin) {
        const mine = await client.query(
          `
            select r.id
            from parking_reservations r
            join parking_spaces s on s.id = r.space_id
            where ${activeUsedWhere} and r.user_id = $1
            limit 1
          `,
          [user.id],
        );
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
    if (!space.utilizado) throw new ApiError(404, 'El espacio no esta marcado en el croquis');
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

  async croquisDots(): Promise<CroquisDot[]> {
    const rows = await query<any>('select id, floor, zone, num, type, status, reservation_id, pos_x, pos_y, utilizado, name, spot_width, spot_height, accessible, etiquetas from parking_spaces where utilizado = true and pos_x is not null and pos_y is not null order by floor, num');
    return rows.map((r) => ({
      id: r.id,
      piso: r.floor,
      zona: r.zone,
      num: r.num,
      x: Number(r.pos_x),
      y: Number(r.pos_y),
      utilizado: Boolean(r.utilizado),
      estado: r.status,
      reservaId: r.reservation_id,
      nombre: r.name || null,
      tipo: r.type,
      ancho: r.spot_width == null ? null : Number(r.spot_width),
      alto: r.spot_height == null ? null : Number(r.spot_height),
      discapacitado: Boolean(r.accessible),
      etiquetas: toEtiquetas(r.etiquetas),
    }));
  }

  async flowArrows(): Promise<FlowArrow[]> {
    const rows = await query<any>('select id, plan, pos_x, pos_y, rotation, arrow_type from parking_flow_arrows order by plan, id');
    return rows.map(toFlowArrow);
  }

  async roads(): Promise<Road[]> {
    const rows = await query<any>('select id, plan, points from parking_roads order by plan, id');
    return rows.map(toRoad);
  }

  async addRoad(input: AddRoadInput): Promise<Road> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const id = await nextRoadId(client, input.plan);
      const rows = await client.query(
        'insert into parking_roads (id, plan, points) values ($1,$2,$3::jsonb) returning id, plan, points',
        [id, input.plan, JSON.stringify(input.points)],
      );
      await client.query('commit');
      return toRoad(rows.rows[0]);
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

  async removeRoad(id: string): Promise<void> {
    const res = await pool.query('delete from parking_roads where id = $1', [id]);
    if (!res.rowCount) throw new ApiError(404, 'La ruta no existe');
  }

  async planVisibility(): Promise<Record<string, boolean>> {
    const rows = await query<any>('select plan, show_plan from parking_plan_settings');
    const out: Record<string, boolean> = {};
    for (const row of rows) out[row.plan] = row.show_plan !== false;
    return out;
  }

  async setPlanVisibility(plan: string, show: boolean): Promise<void> {
    await pool.query(
      'insert into parking_plan_settings (plan, show_plan) values ($1, $2) on conflict (plan) do update set show_plan = excluded.show_plan',
      [plan, show],
    );
  }

  async addEspacio({ piso, zona, x, y }: AddEspacioInput): Promise<Space> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const nextRows = await client.query('select coalesce(max(num), 0) + 1 as next from parking_spaces where floor = $1', [piso]);
      const num = Number(nextRows.rows[0].next);
      const idRows = await client.query("select coalesce(max(nullif(regexp_replace(id, '\\D', '', 'g'), '')::bigint), 0) + 1 as next from parking_spaces");
      const id = `P-${String(Number(idRows.rows[0].next)).padStart(4, '0')}`;
      const parqRows = await client.query('select id from parqueos where piso = $1 limit 1', [piso]);
      const parqueoId = parqRows.rows[0]?.id ?? null;
      await client.query(
        'insert into parking_spaces (id, floor, zone, num, type, status, reservation_id, pos_x, pos_y, utilizado, accessible, parqueo_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [id, piso, zona, num, 'regular', 'disponible', null, x, y, true, false, parqueoId],
      );
      await client.query('commit');
      return { id, piso, zona, num, tipo: 'regular', estado: 'disponible', reservaId: null, utilizado: true, nombre: null, ancho: null, alto: null, discapacitado: false, etiquetas: [] };
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

  async updateEspacio(id: string, { nombre, tipo, ancho, alto, discapacitado, etiquetas }: UpdateEspacioInput): Promise<Space> {
    const rows = await query<any>(
      `
        update parking_spaces
        set name = $1,
            type = $2,
            spot_width = $3,
            spot_height = $4,
            accessible = $5,
            etiquetas = $6::jsonb
        where id = $7
        returning *
      `,
      [nombre, tipo, ancho, alto, discapacitado, JSON.stringify(etiquetas), id],
    );
    if (!rows[0]) throw new ApiError(404, 'El espacio no existe');
    return toSpace(rows[0]);
  }

  // Agrega o quita una etiqueta a varias plazas de una sola vez.
  async setEtiquetaEspacios(ids: string[], etiqueta: string, activar: boolean): Promise<number> {
    const uniqueIds = Array.from(new Set(ids));
    if (!uniqueIds.length) return 0;
    const result = await pool.query(
      activar
        ? `update parking_spaces
             set etiquetas = (select jsonb_agg(distinct e) from jsonb_array_elements_text(etiquetas || to_jsonb($2::text)) e),
                 accessible = case when $2 = 'discapacitado' then true else accessible end,
                 type = case when $2 = 'discapacitado' then 'discapacitado' else type end
           where id = any($1::text[])`
        : `update parking_spaces
             set etiquetas = coalesce((select jsonb_agg(e) from jsonb_array_elements_text(etiquetas) e where e <> $2), '[]'::jsonb),
                 accessible = case when $2 = 'discapacitado' then false else accessible end,
                 type = case when $2 = 'discapacitado' then 'regular' else type end
           where id = any($1::text[])`,
      [uniqueIds, etiqueta],
    );
    return result.rowCount ?? 0;
  }

  async updateEspaciosEstado(ids: string[], estado: ParkingSpaceStatus, actor: EventActor): Promise<number> {
    const uniqueIds = Array.from(new Set(ids));
    const client = await pool.connect();
    try {
      await client.query('begin');
      const locked = await client.query<any>('select id, reservation_id from parking_spaces where id = any($1::text[]) and utilizado = true for update', [uniqueIds]);
      if (locked.rowCount !== uniqueIds.length) {
        await client.query('rollback');
        throw new ApiError(404, 'Uno o mas espacios no existen');
      }

      if (estado === 'disponible' || estado === 'no_disponible') {
        await client.query(
          "update parking_reservations set status = $2 where space_id = any($1::text[]) and status in ('reservado','ocupado')",
          [uniqueIds, estado === 'disponible' ? 'finalizada' : 'cancelada'],
        );
        await client.query('update parking_spaces set status = $2, reservation_id = null where id = any($1::text[])', [uniqueIds, estado]);
      } else if (estado === 'ocupado') {
        const reservationIds = locked.rows.map((row) => row.reservation_id).filter(Boolean);
        if (reservationIds.length) {
          await client.query("update parking_reservations set status = 'ocupado' where id = any($1::text[]) and status in ('reservado','ocupado')", [reservationIds]);
        }
        await client.query("update parking_spaces set status = 'ocupado' where id = any($1::text[])", [uniqueIds]);
      } else {
        await client.query('rollback');
        throw new ApiError(400, 'Estado invalido');
      }

      for (const id of uniqueIds) {
        await logEvento(client, 'edicion', { espacioId: id, user: actor, notas: `Estado ${estado}` });
      }
      await client.query('commit');
      return uniqueIds.length;
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

  async moveEspacio(id: string, x: number, y: number): Promise<void> {
    const res = await pool.query('update parking_spaces set pos_x = $1, pos_y = $2, utilizado = true where id = $3', [x, y, id]);
    if (!res.rowCount) throw new ApiError(404, 'El espacio no existe');
  }

  async moveFlowArrow(id: string, x: number, y: number): Promise<void> {
    const res = await pool.query('update parking_flow_arrows set pos_x = $1, pos_y = $2 where id = $3', [x, y, id]);
    if (!res.rowCount) throw new ApiError(404, 'La flecha no existe');
  }

  async addFlowArrow(input: AddFlowArrowInput): Promise<FlowArrow> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const id = await nextFlowArrowId(client, input.plan);
      const rows = await client.query(
        'insert into parking_flow_arrows (id, plan, pos_x, pos_y, rotation, arrow_type) values ($1,$2,$3,$4,$5,$6) returning id, plan, pos_x, pos_y, rotation, arrow_type',
        [id, input.plan, input.x, input.y, input.r, input.kind],
      );
      await client.query('commit');
      return toFlowArrow(rows.rows[0]);
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

  async updateFlowArrow(id: string, input: UpdateFlowArrowInput): Promise<FlowArrow> {
    const rows = await query<any>(
      `
        update parking_flow_arrows
        set pos_x = coalesce($1, pos_x),
            pos_y = coalesce($2, pos_y),
            rotation = coalesce($3, rotation),
            arrow_type = coalesce($4, arrow_type)
        where id = $5
        returning id, plan, pos_x, pos_y, rotation, arrow_type
      `,
      [input.x ?? null, input.y ?? null, input.r ?? null, input.kind ?? null, id],
    );
    if (!rows[0]) throw new ApiError(404, 'La flecha no existe');
    return toFlowArrow(rows[0]);
  }

  async removeFlowArrow(id: string): Promise<void> {
    const res = await pool.query('delete from parking_flow_arrows where id = $1', [id]);
    if (!res.rowCount) throw new ApiError(404, 'La flecha no existe');
  }

  async removeEspacio(id: string): Promise<void> {
    const rows = await query<any>('select * from parking_spaces where id = $1', [id]);
    if (!rows[0]) throw new ApiError(404, 'El espacio no existe');
    if (rows[0].status !== 'disponible') throw new ApiError(409, 'No se puede borrar un espacio con reserva activa');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("delete from parking_reservations where space_id = $1 and status not in ('reservado','ocupado')", [id]);
      await client.query('delete from parking_spaces where id = $1', [id]);
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

  async removeEspacios(ids: string[]): Promise<number> {
    const uniqueIds = Array.from(new Set(ids));
    const client = await pool.connect();
    try {
      await client.query('begin');
      const locked = await client.query<any>('select id from parking_spaces where id = any($1::text[]) and utilizado = true for update', [uniqueIds]);
      if (locked.rowCount !== uniqueIds.length) {
        await client.query('rollback');
        throw new ApiError(404, 'Uno o mas espacios no existen');
      }
      const active = await client.query<any>("select space_id from parking_reservations where space_id = any($1::text[]) and status in ('reservado','ocupado') limit 1", [uniqueIds]);
      if (active.rows[0]) {
        await client.query('rollback');
        throw new ApiError(409, 'No se pueden borrar espacios con reserva activa');
      }
      await client.query("delete from parking_reservations where space_id = any($1::text[]) and status not in ('reservado','ocupado')", [uniqueIds]);
      const removed = await client.query('delete from parking_spaces where id = any($1::text[])', [uniqueIds]);
      await client.query('commit');
      return removed.rowCount || 0;
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

  async clearEspacios(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from parking_reservations');
      await client.query('delete from parking_spaces');
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
}
