import fs from 'fs';
import { PARQUEO_FILE } from '../../config/constants';
import { ApiError } from '../../core/errors';
import {
  CreateReservationInput,
  EventActor,
  OccupyPublicInput,
  ParkingEvent,
  ParqueoData,
  PaymentRecord,
  PublicSpace,
  Reservation,
  Space,
} from './parqueo.types';
import { ListEventosOptions, LogEventoInput, ParqueoRepository } from './parqueo.repository';

export function initParqueoJsonShape(): ParqueoData {
  const espacios: Space[] = [];
  for (const floor of [1, 2]) {
    for (const zone of ['A', 'B']) {
      for (let num = 1; num <= 100; num++) {
        espacios.push({ id: `P${floor}-${zone}${String(num).padStart(3, '0')}`, piso: floor, zona: zone, num, tipo: 'regular', estado: 'disponible', reservaId: null });
      }
    }
  }
  return { espacios, reservas: [], eventos: [] };
}

function readParkingData(): ParqueoData {
  if (!fs.existsSync(PARQUEO_FILE)) {
    const initial = initParqueoJsonShape();
    writeParkingData(initial);
    return initial;
  }
  try {
    const data = JSON.parse(fs.readFileSync(PARQUEO_FILE, 'utf8'));
    return {
      espacios: Array.isArray(data.espacios) ? data.espacios : [],
      reservas: Array.isArray(data.reservas) ? data.reservas : [],
      eventos: Array.isArray(data.eventos) ? data.eventos : [],
    };
  } catch {
    const initial = initParqueoJsonShape();
    writeParkingData(initial);
    return initial;
  }
}

function writeParkingData(data: ParqueoData): void {
  fs.writeFileSync(PARQUEO_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

function activeReservations(data: ParqueoData): Reservation[] {
  return data.reservas.filter((r) => r.estado === 'reservado' || r.estado === 'ocupado');
}

function nextJsonReservationId(data: ParqueoData): string {
  const max = data.reservas.reduce((n, r) => Math.max(n, Number(String(r.id || '').replace(/\D/g, '')) || 0), 0);
  return `R-${String(max + 1).padStart(3, '0')}`;
}

function nextJsonEventId(data: ParqueoData): string {
  const max = data.eventos.reduce((n, e) => Math.max(n, Number(String(e.id || '').replace(/\D/g, '')) || 0), 0);
  return `E-${String(max + 1).padStart(3, '0')}`;
}

function pushJsonEvent(data: ParqueoData, type: string, { espacioId, user, placa, notas }: LogEventoInput): void {
  data.eventos.push({
    id: nextJsonEventId(data),
    tipo: type,
    espacioId: espacioId || '',
    userId: user ? user.id : null,
    userName: user ? user.name : '',
    placa: placa || '',
    timestamp: new Date().toISOString(),
    notas: notas || '',
  });
}

function publicSpacesFromJson(data: ParqueoData): PublicSpace[] {
  const reservations = new Map(activeReservations(data).map((r) => [r.id, r]));
  return data.espacios
    .slice()
    .sort((a, b) => a.piso - b.piso || String(a.zona).localeCompare(String(b.zona)) || a.num - b.num)
    .map((s) => {
      const reserva = reservations.get(s.reservaId as string);
      return { id: s.id, piso: s.piso, zona: s.zona, num: s.num, estado: s.estado, reserva: reserva ? { inicio: reserva.inicio, fin: reserva.fin } : null };
    });
}

function getJsonActiveReservationByPlate(data: ParqueoData, plate: string): Reservation | null {
  return activeReservations(data).filter((r) => r.placa === plate).sort((a, b) => +new Date(b.inicio) - +new Date(a.inicio))[0] || null;
}

function getJsonActiveReservationById(data: ParqueoData, id: string): Reservation | null {
  return activeReservations(data).find((r) => r.id === id) || null;
}

export class JsonParqueoRepository implements ParqueoRepository {
  async publicEstado(): Promise<PublicSpace[]> {
    return publicSpacesFromJson(readParkingData());
  }

  async adminEstado(): Promise<{ espacios: Space[]; reservas: Reservation[] }> {
    const data = readParkingData();
    const espacios = data.espacios.slice().sort((a, b) => a.piso - b.piso || String(a.zona).localeCompare(String(b.zona)) || a.num - b.num);
    const reservas = activeReservations(data).slice().sort((a, b) => +new Date(b.inicio) - +new Date(a.inicio));
    return { espacios, reservas };
  }

  async listEventos({ limit, offset, plate }: ListEventosOptions): Promise<{ total: number; eventos: ParkingEvent[] }> {
    const filtered = readParkingData().eventos.filter((e) => !plate || String(e.placa || '').toUpperCase().includes(plate));
    filtered.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
    return { total: filtered.length, eventos: filtered.slice(offset, offset + limit) };
  }

  async getActiveReservationByPlate(plate: string): Promise<Reservation | null> {
    return getJsonActiveReservationByPlate(readParkingData(), plate);
  }

  async getActiveReservationById(id: string): Promise<Reservation | null> {
    return getJsonActiveReservationById(readParkingData(), id);
  }

  async occupyPublic({ espacioId, placa, email, duracion }: OccupyPublicInput): Promise<Reservation> {
    const data = readParkingData();
    const space = data.espacios.find((s) => s.id === espacioId);
    if (!space) throw new ApiError(404, 'El espacio no existe');
    if (space.estado !== 'disponible') throw new ApiError(409, 'El espacio no esta disponible');
    if (getJsonActiveReservationByPlate(data, placa)) throw new ApiError(409, 'Esa placa ya tiene un espacio activo');
    const id = nextJsonReservationId(data);
    const starts = new Date();
    const ends = new Date(starts.getTime() + duracion * 60000);
    const code = `CSH-R-${id.slice(2).padStart(4, '0')}`;
    const qrData = `${code}|${space.id}|${placa}|${ends.toISOString()}`;
    const reserva: Reservation = { id, espacioId: space.id, userId: null, userName: 'Invitado', placa, rol: 'invitado', estado: 'ocupado', inicio: starts.toISOString(), fin: ends.toISOString(), codigo: code, qrData, emailQr: email };
    data.reservas.push(reserva);
    space.estado = 'ocupado';
    space.reservaId = id;
    pushJsonEvent(data, 'entrada', { espacioId: space.id, user: { id: null, name: 'Invitado' }, placa, notas: `Walk-in, estimado ${duracion} min, QR a ${email}` });
    writeParkingData(data);
    return reserva;
  }

  async reservar({ espacioId, placa, duracion, user }: CreateReservationInput): Promise<Reservation> {
    const data = readParkingData();
    const isAdmin = user.parkingRole === 'admin';
    const space = data.espacios.find((s) => s.id === espacioId);
    if (!space) throw new ApiError(404, 'El espacio no existe');
    if (space.estado !== 'disponible') throw new ApiError(409, 'El espacio no esta disponible');
    if (!isAdmin && activeReservations(data).some((r) => r.userId === user.id)) throw new ApiError(409, 'Ya tienes una reserva activa');
    const id = nextJsonReservationId(data);
    const starts = new Date();
    const ends = new Date(starts.getTime() + duracion * 60000);
    const code = `CSH-R-${id.slice(2).padStart(4, '0')}`;
    const qrData = `${code}|${space.id}|${placa}|${ends.toISOString()}`;
    const reserva: Reservation = { id, espacioId: space.id, userId: user.id, userName: user.name, placa, rol: user.parkingRole || 'socio', estado: 'reservado', inicio: starts.toISOString(), fin: ends.toISOString(), codigo: code, qrData };
    data.reservas.push(reserva);
    space.estado = 'reservado';
    space.reservaId = id;
    pushJsonEvent(data, 'reserva', { espacioId: space.id, user, placa, notas: `Duracion ${duracion} min` });
    writeParkingData(data);
    return reserva;
  }

  async ocupar(reservaId: string, actor: EventActor): Promise<void> {
    const data = readParkingData();
    const reserva = getJsonActiveReservationById(data, reservaId);
    if (!reserva) throw new ApiError(404, 'Reserva no activa');
    if (reserva.estado === 'ocupado') throw new ApiError(409, 'El espacio ya esta ocupado');
    reserva.estado = 'ocupado';
    const space = data.espacios.find((s) => s.id === reserva.espacioId);
    if (space) space.estado = 'ocupado';
    pushJsonEvent(data, 'entrada', { espacioId: reserva.espacioId, user: actor, placa: reserva.placa });
    writeParkingData(data);
  }

  async liberar(espacioId: string, actor: { id: string; name: string; parkingRole: string }): Promise<void> {
    const data = readParkingData();
    const space = data.espacios.find((s) => s.id === espacioId);
    if (!space) throw new ApiError(404, 'El espacio no existe');
    const reserva = space.reservaId ? getJsonActiveReservationById(data, space.reservaId) : null;
    if (!reserva) throw new ApiError(409, 'El espacio no tiene reserva activa');
    if (reserva.userId !== actor.id && actor.parkingRole !== 'admin') throw new ApiError(403, 'Sin permiso para liberar este espacio');
    reserva.estado = 'finalizada';
    space.estado = 'disponible';
    space.reservaId = null;
    pushJsonEvent(data, 'salida', { espacioId: space.id, user: actor, placa: reserva.placa, notas: reserva.userId === actor.id ? '' : 'Liberado por admin' });
    writeParkingData(data);
  }

  async extender(reservaId: string, minutos: number, actor: { id: string; name: string; parkingRole: string }): Promise<void> {
    const data = readParkingData();
    const reserva = getJsonActiveReservationById(data, reservaId);
    if (!reserva) throw new ApiError(404, 'Reserva no activa');
    if (reserva.userId !== actor.id && actor.parkingRole !== 'admin') throw new ApiError(403, 'Sin permiso para extender esta reserva');
    const base = Math.max(new Date(reserva.fin).getTime(), Date.now());
    reserva.fin = new Date(base + minutos * 60000).toISOString();
    reserva.qrData = `${reserva.codigo}|${reserva.espacioId}|${reserva.placa}|${reserva.fin}`;
    pushJsonEvent(data, 'extension', { espacioId: reserva.espacioId, user: actor, placa: reserva.placa, notas: `+${minutos} min` });
    writeParkingData(data);
  }

  async cancelar(id: string, actor: { id: string; name: string; parkingRole: string }): Promise<void> {
    const data = readParkingData();
    const reserva = getJsonActiveReservationById(data, id);
    if (!reserva) throw new ApiError(404, 'Reserva no activa');
    if (reserva.userId !== actor.id && actor.parkingRole !== 'admin') throw new ApiError(403, 'Sin permiso para cancelar esta reserva');
    reserva.estado = 'cancelada';
    const space = data.espacios.find((s) => s.id === reserva.espacioId);
    if (space) {
      space.estado = 'disponible';
      space.reservaId = null;
    }
    pushJsonEvent(data, 'cancelacion', { espacioId: reserva.espacioId, user: actor, placa: reserva.placa, notas: reserva.userId === actor.id ? '' : 'Cancelada por admin' });
    writeParkingData(data);
  }

  async finalizePayment(reserva: Reservation, payment: PaymentRecord, recibo: { monto: number; horas: number; transaccion: string }): Promise<void> {
    const data = readParkingData();
    const current = getJsonActiveReservationById(data, reserva.id);
    if (!current) throw new ApiError(404, 'No hay parqueo activo para esa placa');
    current.estado = 'finalizada';
    current.pago = payment;
    const space = data.espacios.find((s) => s.id === current.espacioId);
    if (space) {
      space.estado = 'disponible';
      space.reservaId = null;
    }
    pushJsonEvent(data, 'pago', { espacioId: current.espacioId, user: { id: null, name: 'Invitado' }, placa: current.placa, notas: `CRC ${recibo.monto} (${recibo.horas}h) - ${recibo.transaccion}` });
    writeParkingData(data);
  }

  async setReservationEmail(id: string, email: string): Promise<void> {
    const data = readParkingData();
    const current = getJsonActiveReservationById(data, id);
    if (current) current.emailQr = email;
    writeParkingData(data);
  }

  async logEvento(type: string, input: LogEventoInput): Promise<void> {
    const data = readParkingData();
    pushJsonEvent(data, type, input);
    writeParkingData(data);
  }
}
