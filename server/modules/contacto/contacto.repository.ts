import { pool, query } from '../../core/db';
import type { ContactMessage, ContactMessageRow, ContactReply, ContactReplyRow, EstadoMensaje } from './contacto.types';

function toReply(r: ContactReplyRow): ContactReply {
  return { id: r.id, messageId: r.message_id, cuerpo: r.cuerpo, adminName: r.admin_name, creadoAt: r.creado_at };
}

function toMessage(r: ContactMessageRow): ContactMessage {
  return {
    id: r.id,
    nombre: r.nombre,
    apellido: r.apellido,
    email: r.email,
    telefono: r.telefono,
    asunto: r.asunto,
    mensaje: r.mensaje,
    estado: r.estado as EstadoMensaje,
    ip: r.ip,
    creadoAt: r.creado_at,
  };
}

export async function insertMessage(fields: {
  id: string; nombre: string; apellido: string; email: string; telefono: string;
  asunto: string; mensaje: string; ip: string | null;
}): Promise<ContactMessage> {
  const rows = await query<ContactMessageRow>(
    `insert into contact_messages (id, nombre, apellido, email, telefono, asunto, mensaje, ip)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [fields.id, fields.nombre, fields.apellido, fields.email, fields.telefono, fields.asunto, fields.mensaje, fields.ip],
  );
  return toMessage(rows[0]);
}

export async function findAllMessages(): Promise<ContactMessage[]> {
  const rows = await query<ContactMessageRow>('select * from contact_messages order by creado_at desc');
  return rows.map(toMessage);
}

export async function findMessageById(id: string): Promise<ContactMessage | null> {
  const rows = await query<ContactMessageRow>('select * from contact_messages where id=$1', [id]);
  return rows[0] ? toMessage(rows[0]) : null;
}

export async function updateMessageEstado(id: string, estado: EstadoMensaje): Promise<ContactMessage | null> {
  const rows = await query<ContactMessageRow>(
    'update contact_messages set estado=$1 where id=$2 returning *',
    [estado, id],
  );
  return rows[0] ? toMessage(rows[0]) : null;
}

export async function deleteMessage(id: string): Promise<boolean> {
  const result = await pool.query('delete from contact_messages where id=$1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function insertReply(fields: {
  id: string; messageId: string; cuerpo: string; adminName: string;
}): Promise<ContactReply> {
  const rows = await query<ContactReplyRow>(
    `insert into contact_replies (id, message_id, cuerpo, admin_name)
     values ($1,$2,$3,$4) returning *`,
    [fields.id, fields.messageId, fields.cuerpo, fields.adminName],
  );
  return toReply(rows[0]);
}

export async function findRepliesByMessage(messageId: string): Promise<ContactReply[]> {
  const rows = await query<ContactReplyRow>(
    'select * from contact_replies where message_id=$1 order by creado_at asc',
    [messageId],
  );
  return rows.map(toReply);
}
