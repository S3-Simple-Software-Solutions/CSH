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

export interface LayoutStall {
  id: string;
  piso: number;
  zona: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutGeometry {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
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
  getLayout(): Promise<LayoutStall[]>;
  saveLayout(stalls: LayoutGeometry[]): Promise<void>;
  resetLayout(): Promise<void>;
}

import { PgParqueoRepository } from './parqueo.repository.pg';

let instance: ParqueoRepository | null = null;

export function getParqueoRepository(): ParqueoRepository {
  if (!instance) instance = new PgParqueoRepository();
  return instance;
}
