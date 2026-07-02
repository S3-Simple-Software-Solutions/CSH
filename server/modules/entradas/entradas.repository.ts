import {
  Boleto,
  CompraResultado,
  Evento,
  EventoInput,
  IniciarOrdenInput,
  IniciarOrdenResult,
  ListLogOptions,
  EntradaLog,
  MapaBatchInput,
  MapaEventoInput,
  MapaTipoInput,
  OrdenPublica,
  PagoEntrada,
  TicketType,
  TipoInput,
  VentasEvento,
  VentasPorDia,
} from './entradas.types';

export interface LogEntradaInput {
  eventoId?: string | null;
  boletoId?: string | null;
  user?: { id: string | null; name: string };
  notas?: string;
}

export interface EntradasRepository {
  // Público
  publicEventos(): Promise<Evento[]>;
  publicEventoBySlug(slug: string): Promise<{ evento: Evento; tipos: TicketType[] } | null>;
  // Flujo de pago con pasarela: reserva cupo + orden pendiente → webhook confirma.
  iniciarOrdenPendiente(input: IniciarOrdenInput): Promise<IniciarOrdenResult>;
  setProviderRef(ordenId: string, providerRef: string): Promise<void>;
  confirmarOrden(ordenId: string, pago: PagoEntrada): Promise<CompraResultado | null>;
  expirarOrden(ordenId: string): Promise<void>;
  getOrdenPublica(ref: string): Promise<OrdenPublica | null>;
  getBoletoByCodigo(codigo: string): Promise<Boleto | null>;
  getOrdenBoletos(ordenId: string): Promise<Boleto[]>;
  getOrden(ordenId: string): Promise<{ id: string; eventoId: string; compradorEmail: string; compradorNombre: string } | null>;

  // Admin
  adminListEventos(): Promise<VentasEvento[]>;
  adminGetEvento(id: string): Promise<{ evento: Evento; tipos: TicketType[] } | null>;
  crearEvento(input: EventoInput): Promise<Evento>;
  actualizarEvento(id: string, input: Partial<EventoInput>): Promise<Evento>;
  setEstadoEvento(id: string, estado: string): Promise<Evento>;
  crearTipo(eventoId: string, input: TipoInput): Promise<TicketType>;
  actualizarTipo(id: string, input: Partial<TipoInput>): Promise<TicketType>;
  ventasEvento(eventoId: string): Promise<VentasEvento | null>;
  ventasPorDiaEvento(eventoId: string): Promise<VentasPorDia[]>;
  validarBoleto(codigo: string, actor: { id: string; name: string }): Promise<Boleto>;
  emitirCortesia(eventoId: string, tipoId: string, comprador: { nombre: string; email: string }, actor: { id: string; name: string }): Promise<CompraResultado>;
  listLog(opts: ListLogOptions): Promise<{ total: number; eventos: EntradaLog[] }>;
  logEvento(tipo: string, input: LogEntradaInput): Promise<void>;

  // Mapa
  getMapaEvento(eventoId: string): Promise<{ evento: Evento; tipos: TicketType[] } | null>;
  actualizarMapaEvento(eventoId: string, input: MapaEventoInput): Promise<Evento>;
  actualizarMapaTipo(tipoId: string, input: MapaTipoInput | null): Promise<TicketType>;
  guardarMapaBatch(eventoId: string, input: MapaBatchInput): Promise<TicketType[]>;
}

import { PgEntradasRepository } from './entradas.repository.pg';

let instance: EntradasRepository | null = null;

export function getEntradasRepository(): EntradasRepository {
  if (!instance) instance = new PgEntradasRepository();
  return instance;
}
