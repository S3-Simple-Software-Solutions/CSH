import { pool, query } from '../../core/db';
import { genId, slugify } from '../../core/id';
import type { Reserva, ReservaEstado, ReservaRow, Salon, SalonRow } from './venues.types';

function toSalon(r: SalonRow): Salon {
  return {
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    descripcion: r.descripcion,
    ubicacion: r.ubicacion,
    capacidad: r.capacidad,
    tarifaHoraCrc: r.tarifa_hora_crc,
    tarifaDiaCrc: r.tarifa_dia_crc,
    imagenUrl: r.imagen_url,
    amenidades: r.amenidades ?? [],
    activo: r.activo,
    orden: r.orden,
  };
}

function toReserva(r: ReservaRow): Reserva {
  return {
    id: r.id,
    codigo: r.codigo,
    salonId: r.salon_id,
    ...(r.salon_nombre !== undefined && { salonNombre: r.salon_nombre }),
    clienteNombre: r.cliente_nombre,
    clienteEmail: r.cliente_email,
    clienteTelefono: r.cliente_telefono,
    tipoEvento: r.tipo_evento,
    fecha: r.fecha,
    horaInicio: r.hora_inicio,
    horaFin: r.hora_fin,
    personas: r.personas,
    notas: r.notas,
    estado: r.estado,
    precioCrc: r.precio_crc,
    motivo: r.motivo,
    creadoAt: r.creado_at,
  };
}

// `fecha` es un date de Postgres: se formatea en SQL para que viaje como
// 'YYYY-MM-DD' y no como Date con zona horaria.
const RESERVA_COLS = `r.id, r.codigo, r.salon_id, r.cliente_nombre, r.cliente_email, r.cliente_telefono,
  r.tipo_evento, to_char(r.fecha,'YYYY-MM-DD') as fecha, r.hora_inicio, r.hora_fin, r.personas,
  r.notas, r.estado, r.precio_crc, r.motivo, r.creado_at`;

// ---- Salones ----

export async function findSalones(soloActivos = false): Promise<Salon[]> {
  const rows = soloActivos
    ? await query<SalonRow>('select * from venue_salones where activo = true order by orden asc, nombre asc')
    : await query<SalonRow>('select * from venue_salones order by orden asc, nombre asc');
  return rows.map(toSalon);
}

export async function findSalonById(id: string): Promise<Salon | null> {
  const rows = await query<SalonRow>('select * from venue_salones where id = $1', [id]);
  return rows[0] ? toSalon(rows[0]) : null;
}

export async function insertSalon(data: {
  nombre: string; descripcion: string; ubicacion: string; capacidad: number;
  tarifaHoraCrc: number; tarifaDiaCrc: number; amenidades: string[];
}): Promise<Salon> {
  const id = genId('VSA');
  const slug = `${slugify(data.nombre) || 'salon'}-${id.slice(-4).toLowerCase()}`;
  const rows = await query<SalonRow>(
    `insert into venue_salones (id, slug, nombre, descripcion, ubicacion, capacidad, tarifa_hora_crc, tarifa_dia_crc, amenidades)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) returning *`,
    [id, slug, data.nombre, data.descripcion, data.ubicacion, data.capacidad, data.tarifaHoraCrc, data.tarifaDiaCrc, JSON.stringify(data.amenidades)],
  );
  return toSalon(rows[0]);
}

export async function updateSalon(id: string, patch: Partial<{
  nombre: string; descripcion: string; ubicacion: string; capacidad: number;
  tarifaHoraCrc: number; tarifaDiaCrc: number; amenidades: string[]; activo: boolean; imagenUrl: string;
}>): Promise<Salon | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const add = (col: string, val: unknown) => { sets.push(`${col} = $${i++}`); vals.push(val); };
  if (patch.nombre !== undefined) add('nombre', patch.nombre);
  if (patch.descripcion !== undefined) add('descripcion', patch.descripcion);
  if (patch.ubicacion !== undefined) add('ubicacion', patch.ubicacion);
  if (patch.capacidad !== undefined) add('capacidad', patch.capacidad);
  if (patch.tarifaHoraCrc !== undefined) add('tarifa_hora_crc', patch.tarifaHoraCrc);
  if (patch.tarifaDiaCrc !== undefined) add('tarifa_dia_crc', patch.tarifaDiaCrc);
  if (patch.activo !== undefined) add('activo', patch.activo);
  if (patch.imagenUrl !== undefined) add('imagen_url', patch.imagenUrl);
  if (patch.amenidades !== undefined) { sets.push(`amenidades = $${i++}::jsonb`); vals.push(JSON.stringify(patch.amenidades)); }
  if (!sets.length) return findSalonById(id);
  vals.push(id);
  const rows = await query<SalonRow>(`update venue_salones set ${sets.join(', ')} where id = $${i} returning *`, vals);
  return rows[0] ? toSalon(rows[0]) : null;
}

export async function deleteSalon(id: string): Promise<boolean> {
  const result = await pool.query('delete from venue_salones where id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// ---- Reservas ----

function nuevoCodigo(): string {
  return `S-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function findReservas(filtro: { estado?: string; salonId?: string; desde?: string } = {}): Promise<Reserva[]> {
  const where: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (filtro.estado) { where.push(`r.estado = $${i++}`); vals.push(filtro.estado); }
  if (filtro.salonId) { where.push(`r.salon_id = $${i++}`); vals.push(filtro.salonId); }
  if (filtro.desde) { where.push(`r.fecha >= $${i++}::date`); vals.push(filtro.desde); }
  const rows = await query<ReservaRow>(
    `select ${RESERVA_COLS}, s.nombre as salon_nombre
       from venue_reservas r
       join venue_salones s on s.id = r.salon_id
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by r.fecha asc, r.hora_inicio asc`,
    vals,
  );
  return rows.map(toReserva);
}

export async function findReservaById(id: string): Promise<Reserva | null> {
  const rows = await query<ReservaRow>(
    `select ${RESERVA_COLS}, s.nombre as salon_nombre
       from venue_reservas r join venue_salones s on s.id = r.salon_id
      where r.id = $1`,
    [id],
  );
  return rows[0] ? toReserva(rows[0]) : null;
}

// Fechas ya comprometidas (sólo las confirmadas bloquean) para pintar la
// disponibilidad pública y para validar choques.
export async function findOcupadas(salonId?: string, desde = new Date().toISOString().slice(0, 10)): Promise<Reserva[]> {
  return findReservas({ estado: 'confirmada', ...(salonId && { salonId }), desde });
}

// ¿Hay otra reserva confirmada que se traslape en ese salón, fecha y horario?
export async function haySolape(salonId: string, fecha: string, horaInicio: string, horaFin: string, exceptoId?: string): Promise<boolean> {
  const rows = await query(
    `select 1 from venue_reservas
      where salon_id = $1 and fecha = $2::date and estado = 'confirmada'
        and hora_inicio < $4 and hora_fin > $3
        and ($5::text is null or id <> $5)
      limit 1`,
    [salonId, fecha, horaInicio, horaFin, exceptoId ?? null],
  );
  return rows.length > 0;
}

export async function insertReserva(data: {
  salonId: string; clienteNombre: string; clienteEmail: string; clienteTelefono: string;
  tipoEvento: string; fecha: string; horaInicio: string; horaFin: string; personas: number;
  notas: string; estado: ReservaEstado; precioCrc: number;
}): Promise<Reserva> {
  const id = genId('VRE');
  await pool.query(
    `insert into venue_reservas
      (id, codigo, salon_id, cliente_nombre, cliente_email, cliente_telefono, tipo_evento,
       fecha, hora_inicio, hora_fin, personas, notas, estado, precio_crc)
     values ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,$12,$13,$14)`,
    [id, nuevoCodigo(), data.salonId, data.clienteNombre, data.clienteEmail, data.clienteTelefono,
      data.tipoEvento, data.fecha, data.horaInicio, data.horaFin, data.personas, data.notas, data.estado, data.precioCrc],
  );
  return (await findReservaById(id))!;
}

export async function updateReserva(id: string, patch: Partial<{
  estado: ReservaEstado; motivo: string; precioCrc: number; notas: string;
  fecha: string; horaInicio: string; horaFin: string; personas: number; tipoEvento: string;
}>): Promise<Reserva | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const add = (col: string, val: unknown) => { sets.push(`${col} = $${i++}`); vals.push(val); };
  if (patch.estado !== undefined) add('estado', patch.estado);
  if (patch.motivo !== undefined) add('motivo', patch.motivo);
  if (patch.precioCrc !== undefined) add('precio_crc', patch.precioCrc);
  if (patch.notas !== undefined) add('notas', patch.notas);
  if (patch.horaInicio !== undefined) add('hora_inicio', patch.horaInicio);
  if (patch.horaFin !== undefined) add('hora_fin', patch.horaFin);
  if (patch.personas !== undefined) add('personas', patch.personas);
  if (patch.tipoEvento !== undefined) add('tipo_evento', patch.tipoEvento);
  if (patch.fecha !== undefined) { sets.push(`fecha = $${i++}::date`); vals.push(patch.fecha); }
  if (!sets.length) return findReservaById(id);
  vals.push(id);
  await pool.query(`update venue_reservas set ${sets.join(', ')} where id = $${i}`, vals);
  return findReservaById(id);
}

export async function deleteReserva(id: string): Promise<boolean> {
  const result = await pool.query('delete from venue_reservas where id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
