-- 006_entradas_asientos.sql
-- Asientos numerados (P2): butaca individual por sector con soft-lock de reserva.
-- La fuente de verdad en runtime es entradas.schema.ts; esto lo refleja. Idempotente.

alter table entrada_tipos
  add column if not exists numerado boolean not null default false;

alter table entrada_boletos
  add column if not exists asiento_id text;

create table if not exists entrada_asientos (
  id              text primary key,
  evento_id       text not null references entrada_eventos(id) on delete cascade,
  tipo_id         text not null references entrada_tipos(id) on delete cascade,
  fila            text not null,
  numero          integer not null,
  x               double precision,
  y               double precision,
  estado          text not null default 'disponible', -- disponible | reservado | vendido | bloqueado
  reservado_hasta timestamptz,
  hold_id         text,
  boleto_id       text,
  orden_id        text,
  unique (tipo_id, fila, numero)
);
create index if not exists idx_entrada_asientos_evento on entrada_asientos(evento_id);
create index if not exists idx_entrada_asientos_tipo on entrada_asientos(tipo_id);
