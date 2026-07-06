export type EventoEstado = 'borrador' | 'publicado' | 'agotado' | 'finalizado';
export type MapShape = 'rect' | 'polygon' | 'zone';

export interface MapRect { x: number; y: number; w: number; h: number }
export interface MapPoint { x: number; y: number }
export interface MapZoneKey { key: string }
export type MapPoints = MapRect | MapPoint[] | MapZoneKey;

export interface ZonaMapa {
  shape: MapShape;
  points: MapPoints;
  color: string;
  labelX?: number | null;
  labelY?: number | null;
}
export type TipoEstado = 'activo' | 'inactivo';
export type OrdenEstado = 'pendiente' | 'pagada' | 'cancelada';
export type BoletoEstado = 'valido' | 'usado' | 'cancelado';

export type EventoFormato = 'partido' | 'espectaculo';
export type FeeTipo = 'pct' | 'crc' | 'ninguno';
export type DescuentoTipo = 'pct' | 'monto';

export interface Evento {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  venue: string;
  fecha: string;
  estado: EventoEstado;
  imagenUrl: string;
  creadoAt: string;
  mapImageUrl: string;
  mapVersion: number;
  formato: EventoFormato;
  fieldTemplate: string | null;
  fieldSplits: number[] | null;
  feeTipo: FeeTipo | null; // null => usa el default global (entrada_config)
  feeValor: number | null;
}

export interface TicketType {
  id: string;
  eventoId: string;
  nombre: string;
  precioCrc: number;
  stockTotal: number;
  stockVendido: number;
  estado: TipoEstado;
  orden: number;
  disponibles: number;
  mapa: ZonaMapa | null;
  // Preventa: precio de la tanda vigente (si hay); si no, igual a precioCrc.
  precioVigente?: number;
  tandaNombre?: string | null;
  // Asientos numerados: cuando true, la compra exige seleccionar butacas.
  numerado: boolean;
}

export type AsientoEstado = 'disponible' | 'reservado' | 'vendido' | 'bloqueado';

export interface Asiento {
  id: string;
  eventoId: string;
  tipoId: string;
  fila: string;
  numero: number;
  x: number | null;
  y: number | null;
  estado: AsientoEstado;
  reservadoHasta: string | null;
  boletoId: string | null;
  ordenId: string | null;
}

// Vista pública de una butaca: no expone quién la reservó ni distingue bloqueado.
export interface AsientoPublico {
  id: string;
  tipoId: string;
  fila: string;
  numero: number;
  x: number | null;
  y: number | null;
  estado: 'disponible' | 'reservado' | 'ocupado';
}

export interface GenerarAsientosInput {
  filas: number;
  porFila: number;
}

export interface ReservaAsientos {
  holdId: string;
  expiraAt: string;
  asientos: string[];
}

export interface Tanda {
  id: string;
  tipoId: string;
  nombre: string;
  precioCrc: number;
  ventaDesde: string | null;
  ventaHasta: string | null;
  cupo: number | null;
  vendidos: number;
  orden: number;
}

export interface TandaInput {
  nombre: string;
  precioCrc: number;
  ventaDesde?: string | null;
  ventaHasta?: string | null;
  cupo?: number | null;
  orden?: number;
}

export interface MapaTipoInput {
  shape: MapShape;
  points: MapPoints;
  color?: string;
  labelX?: number | null;
  labelY?: number | null;
}

export interface MapaEventoInput {
  mapImageUrl?: string;
  fieldTemplate?: string | null;
  fieldSplits?: number[] | null;
}

export interface MapaBatchInput {
  tipos: Array<{ tipoId: string; mapa: MapaTipoInput | null }>;
}

export interface PagoEntrada {
  transaccion: string;
  monto: number;
  timestamp: string;
  metodo: string;
}

export interface Orden {
  id: string;
  eventoId: string;
  compradorNombre: string;
  compradorEmail: string;
  subtotalCrc: number;
  descuentoCrc: number;
  descuentoCodigo: string | null;
  feeCrc: number;
  totalCrc: number;
  promotorId: string | null;
  comisionCrc: number;
  pago: PagoEntrada | null;
  estado: OrdenEstado;
  createdAt: string;
}

export interface Descuento {
  id: string;
  codigo: string;
  tipo: DescuentoTipo;
  valor: number;
  eventoId: string | null; // null => aplica a cualquier evento
  usosMax: number | null;
  usosActuales: number;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  activo: boolean;
  creadoAt: string;
}

export interface DescuentoInput {
  codigo: string;
  tipo: DescuentoTipo;
  valor: number;
  eventoId?: string | null;
  usosMax?: number | null;
  vigenciaDesde?: string | null;
  vigenciaHasta?: string | null;
  activo?: boolean;
}

export type ComisionTipo = 'pct' | 'crc';

export interface Promotor {
  id: string;
  nombre: string;
  codigo: string;
  comisionTipo: ComisionTipo; // pct: % sobre subtotal · crc: monto fijo por orden
  comisionValor: number;
  activo: boolean;
  creadoAt: string;
}

export interface PromotorInput {
  nombre: string;
  codigo: string;
  comisionTipo: ComisionTipo;
  comisionValor: number;
  activo?: boolean;
}

export interface PromotorRanking {
  promotor: Promotor;
  ordenes: number;
  boletos: number;
  ventasCrc: number;
  comisionCrc: number;
}

// ── Templates de evento ─────────────────────────────────────────────
// Snapshot versionado de la configuración de un evento. Las tandas guardan
// offsets en días antes de la fecha del evento (null = sin límite) para que
// el template sirva para cualquier fecha futura.

export interface TemplateTandaPayload {
  nombre: string;
  precioCrc: number;
  cupo: number | null;
  orden: number;
  ventaDesdeDias: number | null;
  ventaHastaDias: number | null;
}

export interface TemplateSectorPayload {
  nombre: string;
  precioCrc: number;
  stockTotal: number;
  estado?: TipoEstado;
  orden: number;
  mapa: ZonaMapa | null;
  numerado: boolean;
  filas: number | null;    // dimensiones de la grilla si es numerado
  porFila: number | null;
  bloqueadas: Array<{ fila: string; numero: number }>;
  tandas: TemplateTandaPayload[];
}

export interface EventTemplatePayload {
  v: 1;
  formato: EventoFormato;
  venue: string;
  imagenUrl: string;
  mapImageUrl: string;
  fieldTemplate: string | null;
  fieldSplits: number[] | null;
  feeTipo: FeeTipo | null;
  feeValor: number | null;
  sectores: TemplateSectorPayload[];
}

export interface EventTemplate {
  id: string;
  nombre: string;
  descripcion: string;
  payload: EventTemplatePayload;
  creadoAt: string;
}

export interface AplicarTemplateResultado {
  sectores: number;
  butacas: number;
  tandas: number;
  advertencias: string[];
}

export interface EntradaConfig {
  feeTipoDefault: FeeTipo;
  feeValorDefault: number;
}

export interface EntradaConfigInput {
  feeTipoDefault?: FeeTipo;
  feeValorDefault?: number;
}

export interface Boleto {
  id: string;
  ordenId: string;
  tipoId: string;
  eventoId: string;
  codigo: string;
  qrData: string;
  estado: BoletoEstado;
  validadoAt: string | null;
  validadoPor: string | null;
  tipoNombre?: string;
  eventoNombre?: string;
  asientoId?: string | null;
  asientoLabel?: string | null; // "Fila B · Asiento 12"
}

export interface EntradaLog {
  id: string | number;
  tipo: string;
  eventoId: string | null;
  boletoId: string | null;
  userId: string | null;
  userName: string;
  notas: string;
  timestamp: string;
}

export interface EntradaActor {
  id: string;
  name: string;
  eventsRole: string;
}

export interface CompraLinea {
  tipoId: string;
  cantidad: number;
  // Sectores numerados: ids de butacas elegidas (cantidad = asientos.length).
  asientos?: string[];
}

export interface CompraInput {
  slug: string;
  lineas: CompraLinea[];
  comprador: { nombre: string; email: string; telefono?: string | null; notifWhatsapp?: boolean };
  pago?: PagoEntrada;
  descuentoCodigo?: string | null;
  // Soft-lock: id del hold creado con reservar-asientos, si el comprador reservó.
  holdId?: string | null;
  // RRPP: código de promotor capturado de ?ref=. Inválido/inactivo => sin atribución.
  refCodigo?: string | null;
}

export interface CompraResultado {
  orden: Orden;
  boletos: Boleto[];
  evento: Evento;
}

// Snapshot de una línea comprada, guardado en la orden pendiente para poder
// materializar los boletos cuando el webhook confirma el pago. Registra la
// tanda consumida y las butacas del hold para poder revertir/confirmar.
export interface OrdenLineaSnapshot {
  tipoId: string;
  cantidad: number;
  nombre: string;
  precioCrc: number; // precio unitario efectivo (tanda vigente o base)
  tandaId?: string | null;
  asientos?: Array<{ id: string; fila: string; numero: number }>;
}

export interface IniciarOrdenInput {
  slug: string;
  lineas: CompraLinea[];
  comprador: { nombre: string; email: string; telefono?: string | null; notifWhatsapp?: boolean };
  provider: string;
  descuentoCodigo?: string | null;
  holdId?: string | null; // hold del selector de asientos (soft-lock previo)
  refCodigo?: string | null; // código de promotor RRPP
}

export interface IniciarOrdenResult {
  ordenId: string;
  total: number;
  evento: Evento;
  lineItems: { nombre: string; montoUnitarioCrc: number; cantidad: number }[];
  desglose: { subtotal: number; descuento: number; fee: number; total: number };
}

export interface OrdenPublica {
  estado: OrdenEstado;
  boletos: { codigo: string; qrData: string; tipoNombre?: string; asientoLabel?: string | null }[];
}

export interface EventoInput {
  nombre: string;
  descripcion?: string;
  venue?: string;
  fecha: string;
  imagenUrl?: string;
  formato?: EventoFormato;
  feeTipo?: FeeTipo | null;
  feeValor?: number | null;
}

export interface TipoInput {
  nombre: string;
  precioCrc: number;
  stockTotal: number;
  estado?: TipoEstado;
  orden?: number;
}

export interface VentasEvento {
  evento: Evento;
  tipos: TicketType[];
  boletosVendidos: number;
  boletosUsados: number;
  ingresosCrc: number;
}

export interface VentasPorDia {
  fecha: string; // YYYY-MM-DD (zona America/Costa_Rica)
  boletos: number;
  ingresos: number;
  ordenes: number;
}

export interface ListLogOptions {
  limit: number;
  offset: number;
  eventoId?: string;
}
