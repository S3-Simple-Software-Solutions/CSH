import { ApiError } from '../../core/errors';
import type { Reserva, ReservaEstado, Salon } from './venues.types';
import { RESERVA_ESTADOS } from './venues.types';
import {
  deleteReserva,
  findBloqueos,
  findDiasBloqueadosEn,
  findOcupadas,
  findReservaById,
  findReservas,
  findSalonById,
  findSalones,
  haySolape,
  insertReserva,
  setBloqueos,
  updateReserva,
} from './venues.repository';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const str = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

// ---- Helpers puros (exportados para test unitario) ----

export function minutosDe(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// Se cobra por hora, pero nunca más que la tarifa de día completo.
export function calcularPrecio(salon: Pick<Salon, 'tarifaHoraCrc' | 'tarifaDiaCrc'>, horaInicio: string, horaFin: string): number {
  const horas = (minutosDe(horaFin) - minutosDe(horaInicio)) / 60;
  if (horas <= 0) return 0;
  const porHora = Math.round(horas * salon.tarifaHoraCrc);
  if (salon.tarifaDiaCrc > 0 && porHora > salon.tarifaDiaCrc) return salon.tarifaDiaCrc;
  return porHora;
}

// Sólo estas transiciones tienen sentido para una reserva.
const TRANSICIONES: Record<ReservaEstado, ReservaEstado[]> = {
  solicitada: ['confirmada', 'cancelada'],
  confirmada: ['completada', 'cancelada'],
  cancelada: [],
  completada: [],
};

export function puedeTransicionar(actual: ReservaEstado, nuevo: ReservaEstado): boolean {
  return (TRANSICIONES[actual] || []).includes(nuevo);
}

// ---- Validación de entrada ----

interface DatosReserva {
  salonId: string; clienteNombre: string; clienteEmail: string; clienteTelefono: string;
  tipoEvento: string; fecha: string; horaInicio: string; horaFin: string; personas: number; notas: string;
}

function normalizeReserva(body: any): DatosReserva {
  const datos: DatosReserva = {
    salonId: str(body?.salonId, 40),
    clienteNombre: str(body?.clienteNombre, 120),
    clienteEmail: str(body?.clienteEmail, 140).toLowerCase(),
    clienteTelefono: str(body?.clienteTelefono, 40),
    tipoEvento: str(body?.tipoEvento, 80),
    fecha: str(body?.fecha, 10),
    horaInicio: str(body?.horaInicio, 5),
    horaFin: str(body?.horaFin, 5),
    personas: Math.max(0, Math.round(Number(body?.personas) || 0)),
    notas: str(body?.notas, 1000),
  };
  if (!datos.salonId) throw new ApiError(400, 'Elegí un salón');
  if (!datos.clienteNombre) throw new ApiError(400, 'El nombre es obligatorio');
  if (!EMAIL_RE.test(datos.clienteEmail)) throw new ApiError(400, 'El correo no es válido');
  if (!FECHA_RE.test(datos.fecha)) throw new ApiError(400, 'La fecha no es válida');
  if (!HORA_RE.test(datos.horaInicio) || !HORA_RE.test(datos.horaFin)) throw new ApiError(400, 'El horario no es válido');
  if (minutosDe(datos.horaFin) <= minutosDe(datos.horaInicio)) throw new ApiError(400, 'La hora de fin debe ser posterior a la de inicio');
  return datos;
}

async function salonDeReserva(datos: DatosReserva): Promise<Salon> {
  const salon = await findSalonById(datos.salonId);
  if (!salon) throw new ApiError(404, 'Salón no encontrado');
  if (salon.capacidad > 0 && datos.personas > salon.capacidad) {
    throw new ApiError(400, `${salon.nombre} admite hasta ${salon.capacidad} personas`);
  }
  return salon;
}

// ---- Público ----

export async function getSalonesPublicos() {
  const salones = await findSalones(true);
  const [ocupadas, bloqueadas] = await Promise.all([findOcupadas(), findBloqueos()]);
  return {
    // Días que el club cerró a mano; el público solo necesita saber la fecha.
    bloqueadas: bloqueadas.map((b) => ({ salonId: b.salonId, fecha: b.fecha })),
    salones: salones.map((s) => ({
      id: s.id, slug: s.slug, nombre: s.nombre, descripcion: s.descripcion, ubicacion: s.ubicacion,
      capacidad: s.capacidad, tarifaHoraCrc: s.tarifaHoraCrc, tarifaDiaCrc: s.tarifaDiaCrc,
      imagenUrl: s.imagenUrl, amenidades: s.amenidades,
    })),
    // Sólo lo necesario para pintar el calendario: nunca datos del cliente.
    ocupadas: ocupadas.map((r) => ({ salonId: r.salonId, fecha: r.fecha, horaInicio: r.horaInicio, horaFin: r.horaFin })),
  };
}

// Una solicitud pública nace como 'solicitada': no bloquea agenda hasta que el
// club la confirma, así que acá no se rechaza por solape (sólo se avisa).
export async function crearSolicitudPublica(body: any) {
  const datos = normalizeReserva(body);
  const salon = await salonDeReserva(datos);
  if (!salon.activo) throw new ApiError(400, 'Ese salón no está disponible por ahora');
  if (datos.fecha < new Date().toISOString().slice(0, 10)) throw new ApiError(400, 'Elegí una fecha futura');
  if ((await findDiasBloqueadosEn(salon.id, [datos.fecha])).length) {
    throw new ApiError(409, `${salon.nombre} no está disponible el ${datos.fecha}. Elegí otra fecha.`);
  }

  const reserva = await insertReserva({
    ...datos,
    estado: 'solicitada',
    precioCrc: calcularPrecio(salon, datos.horaInicio, datos.horaFin),
  });
  const ocupado = await haySolape(salon.id, datos.fecha, datos.horaInicio, datos.horaFin);
  return { reserva, salon, ocupado };
}

// ---- Admin ----

export async function getAdminVenues(filtro: { estado?: string; salonId?: string } = {}) {
  const [salones, reservas, bloqueadas, agenda] = await Promise.all([
    findSalones(false),
    findReservas({
      ...(filtro.estado && RESERVA_ESTADOS.includes(filtro.estado as ReservaEstado) && { estado: filtro.estado }),
      ...(filtro.salonId && { salonId: filtro.salonId }),
    }),
    // El calendario de disponibilidad mira hacia adelante desde ayer, para que
    // el mes en curso se pinte completo.
    findBloqueos(undefined, new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)),
    // Agenda confirmada sin filtrar: el calendario siempre la necesita completa.
    findOcupadas(),
  ]);
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    salones,
    reservas,
    bloqueadas,
    agenda: agenda.map((r) => ({ salonId: r.salonId, fecha: r.fecha, horaInicio: r.horaInicio, horaFin: r.horaFin, codigo: r.codigo })),
    metricas: {
      solicitudes: reservas.filter((r) => r.estado === 'solicitada').length,
      confirmadas: reservas.filter((r) => r.estado === 'confirmada' && r.fecha >= hoy).length,
      ingresosConfirmados: reservas.filter((r) => r.estado === 'confirmada').reduce((sum, r) => sum + r.precioCrc, 0),
    },
  };
}

// Bloquea o libera varios días de un salón de una vez (selección tipo Airbnb).
// Un día con reserva confirmada no se puede bloquear: primero hay que cancelarla.
export async function adminSetDisponibilidad(salonId: string, body: any) {
  const salon = await findSalonById(salonId);
  if (!salon) throw new ApiError(404, 'Salón no encontrado');
  const crudas: unknown[] = Array.isArray(body?.fechas) ? body.fechas : [];
  const fechas = [...new Set(crudas.map((f) => str(f, 10)))].filter((f) => FECHA_RE.test(f));
  if (!fechas.length) throw new ApiError(400, 'Elegí al menos un día');
  if (fechas.length > 400) throw new ApiError(400, 'Demasiados días en una sola operación');
  const bloquear = body?.bloquear !== false;
  const motivo = str(body?.motivo, 200);

  if (bloquear) {
    const conReserva = (await findReservas({ estado: 'confirmada', salonId }))
      .filter((r) => fechas.includes(r.fecha))
      .map((r) => r.fecha);
    if (conReserva.length) {
      throw new ApiError(409, `Hay reservas confirmadas el ${[...new Set(conReserva)].join(', ')}. Cancelalas antes de bloquear esos días.`);
    }
  }

  await setBloqueos(salonId, fechas, bloquear, motivo);
  return { bloqueadas: await findBloqueos(salonId, new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)) };
}

// Reserva cargada a mano por el club: nace confirmada y sí valida el solape.
export async function adminCrearReserva(body: any) {
  const datos = normalizeReserva(body);
  const salon = await salonDeReserva(datos);
  const estado: ReservaEstado = RESERVA_ESTADOS.includes(body?.estado) ? body.estado : 'confirmada';
  if (estado === 'confirmada' && await haySolape(salon.id, datos.fecha, datos.horaInicio, datos.horaFin)) {
    throw new ApiError(409, 'Ya hay una reserva confirmada en ese salón y horario');
  }
  const precioCrc = body?.precioCrc !== undefined
    ? Math.max(0, Math.round(Number(body.precioCrc) || 0))
    : calcularPrecio(salon, datos.horaInicio, datos.horaFin);
  return { reserva: await insertReserva({ ...datos, estado, precioCrc }) };
}

export async function adminActualizarReserva(id: string, body: any): Promise<{ reserva: Reserva }> {
  const actual = await findReservaById(id);
  if (!actual) throw new ApiError(404, 'Reserva no encontrada');
  const patch: any = {};
  if (body?.precioCrc !== undefined) patch.precioCrc = Math.max(0, Math.round(Number(body.precioCrc) || 0));
  if (body?.notas !== undefined) patch.notas = str(body.notas, 1000);
  if (body?.motivo !== undefined) patch.motivo = str(body.motivo, 300);
  if (body?.tipoEvento !== undefined) patch.tipoEvento = str(body.tipoEvento, 80);
  if (body?.personas !== undefined) patch.personas = Math.max(0, Math.round(Number(body.personas) || 0));
  if (body?.fecha !== undefined) {
    if (!FECHA_RE.test(str(body.fecha, 10))) throw new ApiError(400, 'La fecha no es válida');
    patch.fecha = str(body.fecha, 10);
  }
  if (body?.horaInicio !== undefined) {
    if (!HORA_RE.test(str(body.horaInicio, 5))) throw new ApiError(400, 'El horario no es válido');
    patch.horaInicio = str(body.horaInicio, 5);
  }
  if (body?.horaFin !== undefined) {
    if (!HORA_RE.test(str(body.horaFin, 5))) throw new ApiError(400, 'El horario no es válido');
    patch.horaFin = str(body.horaFin, 5);
  }

  if (body?.estado !== undefined) {
    const nuevo = String(body.estado) as ReservaEstado;
    if (!RESERVA_ESTADOS.includes(nuevo)) throw new ApiError(400, 'Estado inválido');
    if (nuevo !== actual.estado && !puedeTransicionar(actual.estado, nuevo)) {
      throw new ApiError(409, `No se puede pasar de ${actual.estado} a ${nuevo}`);
    }
    patch.estado = nuevo;
  }

  const fecha = patch.fecha ?? actual.fecha;
  const horaInicio = patch.horaInicio ?? actual.horaInicio;
  const horaFin = patch.horaFin ?? actual.horaFin;
  if (minutosDe(horaFin) <= minutosDe(horaInicio)) throw new ApiError(400, 'La hora de fin debe ser posterior a la de inicio');
  const quedaConfirmada = (patch.estado ?? actual.estado) === 'confirmada';
  if (quedaConfirmada && await haySolape(actual.salonId, fecha, horaInicio, horaFin, actual.id)) {
    throw new ApiError(409, 'Ya hay una reserva confirmada en ese salón y horario');
  }

  return { reserva: (await updateReserva(id, patch))! };
}

export async function adminEliminarReserva(id: string) {
  if (!(await deleteReserva(id))) throw new ApiError(404, 'Reserva no encontrada');
  return { ok: true };
}
