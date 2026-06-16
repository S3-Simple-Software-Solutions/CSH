import {
  Boleto,
  CompraInput,
  CompraResultado,
  Evento,
  EventoInput,
  ListLogOptions,
  EntradaLog,
  TicketType,
  TipoInput,
  VentasEvento,
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
  comprar(input: CompraInput): Promise<CompraResultado>;
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
  validarBoleto(codigo: string, actor: { id: string; name: string }): Promise<Boleto>;
  emitirCortesia(eventoId: string, tipoId: string, comprador: { nombre: string; email: string }, actor: { id: string; name: string }): Promise<CompraResultado>;
  listLog(opts: ListLogOptions): Promise<{ total: number; eventos: EntradaLog[] }>;
  logEvento(tipo: string, input: LogEntradaInput): Promise<void>;
}

import { PgEntradasRepository } from './entradas.repository.pg';

let instance: EntradasRepository | null = null;

export function getEntradasRepository(): EntradasRepository {
  if (!instance) instance = new PgEntradasRepository();
  return instance;
}
