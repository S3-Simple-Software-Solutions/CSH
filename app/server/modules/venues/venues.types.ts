export type ReservaEstado = 'solicitada' | 'confirmada' | 'cancelada' | 'completada';

export const RESERVA_ESTADOS: ReservaEstado[] = ['solicitada', 'confirmada', 'cancelada', 'completada'];

export interface Salon {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  capacidad: number;
  tarifaHoraCrc: number;
  tarifaDiaCrc: number;
  imagenUrl: string;
  amenidades: string[];
  activo: boolean;
  orden: number;
}

export interface SalonRow {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  capacidad: number;
  tarifa_hora_crc: number;
  tarifa_dia_crc: number;
  imagen_url: string;
  amenidades: string[] | null;
  activo: boolean;
  orden: number;
}

export interface Reserva {
  id: string;
  codigo: string;
  salonId: string;
  salonNombre?: string;
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  tipoEvento: string;
  fecha: string;        // YYYY-MM-DD
  horaInicio: string;   // HH:MM
  horaFin: string;      // HH:MM
  personas: number;
  notas: string;
  estado: ReservaEstado;
  precioCrc: number;
  motivo: string;
  creadoAt: string;
}

export interface ReservaRow {
  id: string;
  codigo: string;
  salon_id: string;
  salon_nombre?: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  tipo_evento: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  personas: number;
  notas: string;
  estado: ReservaEstado;
  precio_crc: number;
  motivo: string;
  creado_at: string;
}
