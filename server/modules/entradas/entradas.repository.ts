import {
  Asiento,
  AsientoPublico,
  Boleto,
  CompraResultado,
  Descuento,
  DescuentoInput,
  EntradaConfig,
  EntradaConfigInput,
  Evento,
  EventoInput,
  EventTemplate,
  EventTemplatePayload,
  GenerarAsientosInput,
  IniciarOrdenInput,
  IniciarOrdenResult,
  ListLogOptions,
  EntradaLog,
  MapaBatchInput,
  MapaEventoInput,
  MapaTipoInput,
  Promotor,
  PromotorInput,
  PromotorRanking,
  ReservaAsientos,
  Tanda,
  TandaInput,
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
  getOrden(ordenId: string): Promise<{ id: string; eventoId: string; compradorEmail: string; compradorNombre: string; compradorTelefono: string | null; notifWhatsapp: boolean } | null>;

  // Admin
  adminListEventos(): Promise<VentasEvento[]>;
  adminGetEvento(id: string): Promise<{ evento: Evento; tipos: TicketType[] } | null>;
  crearEvento(input: EventoInput): Promise<Evento>;
  actualizarEvento(id: string, input: Partial<EventoInput>): Promise<Evento>;
  setEstadoEvento(id: string, estado: string): Promise<Evento>;
  crearTipo(eventoId: string, input: TipoInput): Promise<TicketType>;
  actualizarTipo(id: string, input: Partial<TipoInput>): Promise<TicketType>;
  eliminarTipo(id: string): Promise<{ eventoId: string; nombre: string }>;
  eliminarEvento(id: string): Promise<{ nombre: string; imagenUrl: string }>;
  ventasEvento(eventoId: string): Promise<VentasEvento | null>;
  ventasPorDiaEvento(eventoId: string): Promise<VentasPorDia[]>;
  validarBoleto(codigo: string, actor: { id: string; name: string }): Promise<Boleto>;
  emitirCortesia(eventoId: string, tipoId: string, comprador: { nombre: string; email: string }, actor: { id: string; name: string }): Promise<CompraResultado>;
  listLog(opts: ListLogOptions): Promise<{ total: number; eventos: EntradaLog[] }>;
  logEvento(tipo: string, input: LogEntradaInput): Promise<void>;

  // Asientos numerados (P2)
  getAsientosPublico(slug: string): Promise<AsientoPublico[]>;
  reservarAsientos(slug: string, asientoIds: string[]): Promise<ReservaAsientos>;
  listAsientosTipo(tipoId: string): Promise<Asiento[]>;
  generarAsientos(tipoId: string, input: GenerarAsientosInput): Promise<{ tipo: TicketType; total: number }>;
  setEstadoAsiento(asientoId: string, estado: 'disponible' | 'bloqueado'): Promise<Asiento>;

  // Tandas / preventa (P1)
  listTandas(tipoId: string): Promise<Tanda[]>;
  crearTanda(tipoId: string, input: TandaInput): Promise<Tanda>;
  actualizarTanda(id: string, input: TandaInput): Promise<Tanda>;
  eliminarTanda(id: string): Promise<void>;

  // Templates de evento
  listTemplates(): Promise<EventTemplate[]>;
  getTemplate(id: string): Promise<EventTemplate | null>;
  crearTemplate(nombre: string, descripcion: string, payload: EventTemplatePayload): Promise<EventTemplate>;
  actualizarTemplate(id: string, nombre: string, descripcion: string): Promise<EventTemplate>;
  eliminarTemplate(id: string): Promise<void>;

  // Promotores / RRPP (P1)
  listPromotores(): Promise<Promotor[]>;
  crearPromotor(input: PromotorInput): Promise<Promotor>;
  actualizarPromotor(id: string, input: PromotorInput): Promise<Promotor>;
  eliminarPromotor(id: string): Promise<void>;
  rankingPromotores(): Promise<PromotorRanking[]>;

  // Fee + descuentos (P1)
  getConfig(): Promise<EntradaConfig>;
  setConfig(input: EntradaConfigInput): Promise<EntradaConfig>;
  listDescuentos(eventoId?: string): Promise<Descuento[]>;
  getDescuentoByCodigo(codigo: string): Promise<Descuento | null>;
  crearDescuento(input: DescuentoInput): Promise<Descuento>;
  actualizarDescuento(id: string, input: DescuentoInput): Promise<Descuento>;
  eliminarDescuento(id: string): Promise<void>;

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
