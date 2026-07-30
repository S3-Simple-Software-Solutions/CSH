import { pool } from '../../core/db';

export async function ensureContactoSchema(): Promise<void> {
  await pool.query(`
    create table if not exists contact_messages (
      id text primary key,
      nombre text not null,
      apellido text not null default '',
      email text not null,
      telefono text not null default '',
      asunto text not null,
      mensaje text not null,
      estado text not null default 'nuevo',
      ip text,
      creado_at timestamptz not null default now()
    );
    alter table contact_messages add column if not exists apellido text not null default '';
    alter table contact_messages add column if not exists telefono text not null default '';
    create index if not exists idx_contact_messages_estado on contact_messages(estado, creado_at desc);

    create table if not exists contact_replies (
      id text primary key,
      message_id text not null references contact_messages(id) on delete cascade,
      cuerpo text not null,
      admin_name text not null default '',
      creado_at timestamptz not null default now()
    );
    create index if not exists idx_contact_replies_msg on contact_replies(message_id, creado_at);
  `);
}
