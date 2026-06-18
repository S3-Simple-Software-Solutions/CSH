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

export interface ContactReply {
  id: string;
  messageId: string;
  cuerpo: string;
  adminName: string;
  creadoAt: string;
}

export interface ContactReplyRow {
  id: string;
  message_id: string;
  cuerpo: string;
  admin_name: string;
  creado_at: string;
}
