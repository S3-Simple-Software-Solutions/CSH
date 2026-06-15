export interface Space {
  id: string;
  piso: number;
  zona: string;
  num: number;
  tipo: string;
  estado: 'disponible' | 'reservado' | 'ocupado';
  reservaId: string | null;
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
