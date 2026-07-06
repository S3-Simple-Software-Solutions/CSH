-- 007_entradas_templates.sql
-- Templates de evento: snapshot reutilizable de la configuración de un evento
-- (sectores, butacas, tandas con offsets relativos, fee, plantilla de campo).
-- La fuente de verdad en runtime es entradas.schema.ts; esto lo refleja. Idempotente.

create table if not exists entrada_event_templates (
  id          text primary key,
  nombre      text unique not null,
  descripcion text not null default '',
  payload     jsonb not null,
  creado_at   timestamptz not null default now()
);
