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

export interface ListEventosOptions {
  limit: number;
  offset: number;
  plate?: string;
}

export interface LogEventoInput {
  espacioId?: string;
  user?: EventActor;
  placa?: string;
  notas?: string;
}

// Un espacio en el croquis es un punto (dot) ubicado sobre el plano.
export interface CroquisDot {
  id: string;
  piso: number;
  zona: string;
  num: number;
  x: number;
  y: number;
  utilizado: boolean;
  nombre: string | null;
  tipo: string;
  ancho: number | null;
  alto: number | null;
  discapacitado: boolean;
}

export interface AddEspacioInput {
  piso: number;
  zona: string;
  x: number;
  y: number;
}

export interface UpdateEspacioInput {
  nombre: string | null;
  tipo: string;
  ancho: number | null;
  alto: number | null;
  discapacitado: boolean;
}

export interface ParqueoRepository {
  publicEstado(): Promise<PublicSpace[]>;
  adminEstado(): Promise<{ espacios: Space[]; reservas: Reservation[] }>;
  listEventos(opts: ListEventosOptions): Promise<{ total: number; eventos: ParkingEvent[] }>;
  getActiveReservationByPlate(plate: string): Promise<Reservation | null>;
  getActiveReservationById(id: string): Promise<Reservation | null>;
  occupyPublic(input: OccupyPublicInput): Promise<Reservation>;
  reservar(input: CreateReservationInput): Promise<Reservation>;
  ocupar(reservaId: string, actor: EventActor): Promise<void>;
  liberar(espacioId: string, actor: { id: string; name: string; parkingRole: string }): Promise<void>;
  extender(reservaId: string, minutos: number, actor: { id: string; name: string; parkingRole: string }): Promise<void>;
  cancelar(id: string, actor: { id: string; name: string; parkingRole: string }): Promise<void>;
  finalizePayment(reserva: Reservation, payment: PaymentRecord, recibo: { monto: number; horas: number; transaccion: string }): Promise<void>;
  setReservationEmail(id: string, email: string): Promise<void>;
  logEvento(type: string, input: LogEventoInput): Promise<void>;
  croquisDots(): Promise<CroquisDot[]>;
  addEspacio(input: AddEspacioInput): Promise<Space>;
  updateEspacio(id: string, input: UpdateEspacioInput): Promise<Space>;
  moveEspacio(id: string, x: number, y: number): Promise<void>;
  removeEspacio(id: string): Promise<void>;
  clearEspacios(): Promise<void>;
}

import { PgParqueoRepository } from './parqueo.repository.pg';

let instance: ParqueoRepository | null = null;

export function getParqueoRepository(): ParqueoRepository {
  if (!instance) instance = new PgParqueoRepository();
  return instance;
}
