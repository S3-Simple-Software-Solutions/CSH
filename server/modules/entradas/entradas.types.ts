export type EventoEstado = 'borrador' | 'publicado' | 'agotado' | 'finalizado';
export type TipoEstado = 'activo' | 'inactivo';
export type OrdenEstado = 'pagada' | 'cancelada';
export type BoletoEstado = 'valido' | 'usado' | 'cancelado';

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

export interface ListLogOptions {
  limit: number;
  offset: number;
  eventoId?: string;
}
