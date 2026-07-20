export type ParqueoModoCobro = 'hora' | 'fijo';

// Etiquetas que el admin puede colgarle a una plaza. El id se guarda en
// parking_spaces.etiquetas; 'discapacitado' además refleja accessible.
export const ETIQUETAS_PLAZA = [
  { id: 'discapacitado', nombre: 'Discapacitados', icono: '\u267F' },
  { id: 'electrico', nombre: 'Carga eléctrica', icono: '\u26A1' },
  { id: 'moto', nombre: 'Motos', icono: '\uD83C\uDFCD' },
  { id: 'familiar', nombre: 'Familiar', icono: '\uD83D\uDC76' },
  { id: 'visitante', nombre: 'Visitantes', icono: '\uD83D\uDC64' },
  { id: 'vip', nombre: 'VIP / directiva', icono: '\u2B50' },
  { id: 'carga', nombre: 'Carga y descarga', icono: '\uD83D\uDCE6' },
] as const;

export const ETIQUETA_IDS: readonly string[] = ETIQUETAS_PLAZA.map((e) => e.id);

export interface Parqueo {
  id: string;
  piso: number;
  nombre: string;
  slug: string;
  croquisUrl: string;
  aspect: number;
  precioCrc: number;
  modoCobro: ParqueoModoCobro;
  estado: 'activo' | 'inactivo';
  orden: number;
}

export interface Space {
  id: string;
  piso: number;
  zona: string;
  num: number;
  tipo: string;
  estado: 'disponible' | 'reservado' | 'ocupado' | 'no_disponible';
  reservaId: string | null;
  utilizado: boolean;
  nombre: string | null;
  ancho: number | null;
  alto: number | null;
  discapacitado: boolean;
  etiquetas: string[];
}

export interface Reservation {
  id: string;
  espacioId: string;
  userId: string | null;
  userName: string;
  placa: string;
  rol: string;
  estado: 'reservado' | 'ocupado' | 'finalizada' | 'cancelada';
  inicio: string;
  fin: string;
  codigo: string;
  qrData: string;
  emailQr?: string | null;
  pago?: PaymentRecord | null;
}

export interface PaymentRecord {
  transaccion: string;
  monto: number;
  horas: number;
  timestamp: string;
  metodo: string;
}

export interface ParkingEvent {
  id: string | number;
  tipo: string;
  espacioId: string;
  userId: string | null;
  userName: string;
  placa: string;
  timestamp: string;
  notas: string;
}

export interface ParqueoData {
  espacios: Space[];
  reservas: Reservation[];
  eventos: ParkingEvent[];
}

export interface PublicSpace {
  id: string;
  piso: number;
  zona: string;
  num: number;
  estado: string;
  reserva: { inicio: string; fin: string } | null;
  utilizado: boolean;
  nombre: string | null;
  tipo: string;
  ancho: number | null;
  alto: number | null;
  discapacitado: boolean;
}

export interface EventActor {
  id: string | null;
  name: string;
}

export interface CreateReservationInput {
  espacioId: string;
  placa: string;
  duracion: number;
  user: { id: string; name: string; parkingRole: string };
}

export interface OccupyPublicInput {
  espacioId: string;
  placa: string;
  email: string;
  duracion: number;
}

export interface Recibo {
  espacioId: string;
  placa: string;
  horas: number;
  monto: number;
  transaccion: string;
  correo: string;
}
