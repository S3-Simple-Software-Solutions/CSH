-- Reventa de entradas (mercado secundario).
-- Paridad con ensureEntradasSchema() (server/modules/entradas/entradas.schema.ts).
-- No se ejecuta automáticamente: el runtime usa ensure*Schema() idempotente.

-- Vínculo de compras/boletos con cuentas de aficionado.
alter table entrada_ordenes
  add column if not exists comprador_user_id text,
  add column if not exists reventa_id        text;
create index if not exists idx_entrada_ordenes_comprador_email_lower on entrada_ordenes (lower(comprador_email));
create index if not exists idx_entrada_ordenes_comprador_user on entrada_ordenes(comprador_user_id) where comprador_user_id is not null;

alter table entrada_boletos
  add column if not exists owner_user_id text,
  add column if not exists owner_email   text;
create index if not exists idx_entrada_boletos_owner_user on entrada_boletos(owner_user_id) where owner_user_id is not null;

-- Listings de reventa.
create table if not exists entrada_reventas (
  id                 text primary key,
  boleto_id          text not null references entrada_boletos(id) on delete cascade,
  evento_id          text not null references entrada_eventos(id) on delete cascade,
  seller_user_id     text not null,
  seller_email       text not null default '',
  precio_crc         integer not null default 0,
  fee_comprador_crc  integer not null default 0,
  fee_vendedor_crc   integer not null default 0,
  estado             text not null default 'activa',   -- activa|reservada|vendida|cancelada|expirada
  buyer_user_id      text,
  orden_reventa_id   text,
  created_at         timestamptz not null default now(),
  vendida_at         timestamptz
);
-- Un boleto solo puede tener un listing abierto (activa o reservada) a la vez.
create unique index if not exists idx_entrada_reventas_boleto_activa on entrada_reventas(boleto_id) where estado in ('activa','reservada');
create index if not exists idx_entrada_reventas_evento on entrada_reventas(evento_id);
create index if not exists idx_entrada_reventas_seller on entrada_reventas(seller_user_id);
create index if not exists idx_entrada_reventas_estado on entrada_reventas(estado);

-- Saldo a pagar al vendedor (payout manual, MVP sin Stripe Connect).
create table if not exists entrada_reventa_payouts (
  id              text primary key,
  reventa_id      text not null references entrada_reventas(id) on delete cascade,
  seller_user_id  text not null,
  seller_email    text not null default '',
  monto_neto_crc  integer not null default 0,
  estado          text not null default 'pendiente',   -- pendiente|pagado
  metodo          text,
  referencia      text,
  created_at      timestamptz not null default now(),
  pagado_at       timestamptz,
  pagado_por      text
);
create index if not exists idx_entrada_payouts_estado on entrada_reventa_payouts(estado);

-- Configuración de reventa (en el singleton entrada_config).
alter table entrada_config
  add column if not exists reventa_activa            boolean not null default true,
  add column if not exists reventa_tope_nominal      boolean not null default true,
  add column if not exists reventa_fee_comprador_pct integer not null default 0,
  add column if not exists reventa_fee_vendedor_pct  integer not null default 0;
