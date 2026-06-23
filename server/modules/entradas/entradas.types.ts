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
export type OrdenEstado = 'pagada' | 'cancelada';
export type BoletoEstado = 'valido' | 'usado' | 'cancelado';

export type EventoFormato = 'partido' | 'espectaculo';

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
  totalCrc: number;
  pago: PagoEntrada | null;
  estado: OrdenEstado;
  createdAt: string;
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
}

export interface CompraInput {
  slug: string;
  lineas: CompraLinea[];
  comprador: { nombre: string; email: string };
  pago?: PagoEntrada;
}

export interface CompraResultado {
  orden: Orden;
  boletos: Boleto[];
  evento: Evento;
}

export interface EventoInput {
  nombre: string;
  descripcion?: string;
  venue?: string;
  fecha: string;
  imagenUrl?: string;
  formato?: EventoFormato;
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
