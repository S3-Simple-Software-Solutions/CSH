-- ─────────────────────────────────────────────
-- 001_users.sql — Usuarios, roles y permisos de app
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_roles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    scope       TEXT NOT NULL,
    description TEXT
);

INSERT INTO app_roles (id, name, scope, description) VALUES
  ('system:admin',        'Super admin',               'system',  'Acceso total al sistema'),
  ('system:demo',         'Demo',                      'system',  'Cuenta demostrativa'),
  ('site:authenticated',  'Usuario autenticado',       'site',    'Puede iniciar sesion en la app'),
  ('parking:admin',       'Administrador de parqueo',  'parking', 'Administra espacios, reservas y croquis'),
  ('parking:socio',       'Socio de parqueo',          'parking', 'Puede reservar parqueo como socio'),
  ('parking:invitado',    'Invitado de parqueo',       'parking', 'Acceso minimo de parqueo'),
  ('coupon:admin',        'Administrador de cuponera', 'coupon',  'Administra todos los beneficios'),
  ('coupon:patrocinador', 'Patrocinador',              'coupon',  'Administra beneficios propios'),
  ('coupon:socio',        'Socio de cuponera',         'coupon',  'Puede usar beneficios'),
  ('events:admin',        'Administrador de eventos',  'events',  'Administra eventos y entradas'),
  ('events:operador',     'Operador de puerta',        'events',  'Opera ingresos y ve ventas'),
  ('events:comercial',    'Comercial',                 'events',  'Ve reportes de ventas')
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      scope = EXCLUDED.scope,
      description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS app_users (
    id                  TEXT PRIMARY KEY,
    username            TEXT NOT NULL UNIQUE,
    email               TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    display_role        TEXT NOT NULL,
    area                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'Activo',
    sponsor             TEXT,
    password_managed_by TEXT NOT NULL DEFAULT 'database'
                        CHECK (password_managed_by IN ('env','database')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_user_roles (
    user_id    TEXT        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role_id    TEXT        NOT NULL REFERENCES app_roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_app_users_username_lower ON app_users (lower(username));
CREATE INDEX IF NOT EXISTS idx_app_users_email_lower ON app_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_app_user_roles_role ON app_user_roles(role_id);
