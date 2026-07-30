-- 005_entradas_p1.sql
-- P1 del módulo entradas: cargo por servicio (fee), desglose de orden,
-- códigos de descuento y configuración global. Idempotente.
-- La fuente de verdad en runtime es entradas.schema.ts; esto lo refleja.

alter table entrada_eventos
  add column if not exists fee_tipo  text,
  add column if not exists fee_valor integer;

alter table entrada_ordenes
  add column if not exists subtotal_crc        integer not null default 0,
  add column if not exists descuento_crc       integer not null default 0,
  add column if not exists descuento_codigo    text,
  add column if not exists fee_crc             integer not null default 0,
  add column if not exists comprador_telefono  text,
  add column if not exists notif_whatsapp      boolean not null default false;

update entrada_ordenes set subtotal_crc = total_crc where subtotal_crc = 0 and total_crc > 0;

create table if not exists entrada_config (
  id                integer primary key default 1,
  fee_tipo_default  text    not null default 'ninguno',
  fee_valor_default integer not null default 0,
  constraint entrada_config_singleton check (id = 1)
);
insert into entrada_config (id) values (1) on conflict (id) do nothing;

create table if not exists entrada_descuentos (
  id             text primary key,
  codigo         text unique not null,
  tipo           text not null default 'pct',
  valor          integer not null default 0,
  evento_id      text references entrada_eventos(id) on delete cascade,
  usos_max       integer,
  usos_actuales  integer not null default 0,
  vigencia_desde timestamptz,
  vigencia_hasta timestamptz,
  activo         boolean not null default true,
  creado_at      timestamptz not null default now()
);
create index if not exists idx_entrada_descuentos_codigo on entrada_descuentos(codigo);

-- Tandas de precio por tipo de entrada (preventa / early bird).
create table if not exists entrada_tipo_tandas (
  id          text primary key,
  tipo_id     text not null references entrada_tipos(id) on delete cascade,
  nombre      text not null,
  precio_crc  integer not null default 0,
  venta_desde timestamptz,
  venta_hasta timestamptz,
  cupo        integer,
  vendidos    integer not null default 0,
  orden       integer not null default 0
);
create index if not exists idx_entrada_tandas_tipo on entrada_tipo_tandas(tipo_id);

-- RRPP / promotores: atribución de ventas y comisión.
create table if not exists entrada_promotores (
  id             text primary key,
  nombre         text not null,
  codigo         text unique not null,
  comision_tipo  text not null default 'pct', -- pct (sobre subtotal) | crc (monto fijo por orden)
  comision_valor integer not null default 0,
  activo         boolean not null default true,
  creado_at      timestamptz not null default now()
);
alter table entrada_ordenes
  add column if not exists promotor_id  text,
  add column if not exists comision_crc integer not null default 0;
create index if not exists idx_entrada_ordenes_promotor on entrada_ordenes(promotor_id) where promotor_id is not null;
