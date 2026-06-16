export type EstadoMensaje = 'nuevo' | 'leido' | 'respondido' | 'archivado';

export interface ContactMessage {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  asunto: string;
  mensaje: string;
  estado: EstadoMensaje;
  ip: string | null;
  creadoAt: string;
}

export interface ContactMessageRow {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  asunto: string;
  mensaje: string;
  estado: string;
  ip: string | null;
  creado_at: string;
}
