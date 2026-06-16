-- ─────────────────────────────────────────────
-- 001_users.sql — Núcleo de usuarios y roles
-- ─────────────────────────────────────────────

-- ROLES (catálogo fijo)
CREATE TABLE IF NOT EXISTS roles (
    id          TEXT PRIMARY KEY,          -- 'admin','socio','arrendatario','vip'
    name        TEXT NOT NULL,
    description TEXT
);

INSERT INTO roles (id, name, description) VALUES
  ('admin',        'Administrador',  'Acceso total al sistema'),
  ('socio',        'Socio',          'Cuenta registrada, prioridad en taquilleria'),
  ('arrendatario', 'Arrendatario',   'Derecho de asiento anual o semestral'),
  ('vip',          'VIP',            'Acceso a lista de beneficios')
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description;

-- USERS (autenticados — el invitado NO va aquí, es anónimo)
CREATE TABLE IF NOT EXISTS users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    username      TEXT        UNIQUE,
    password_hash TEXT        NOT NULL,
    full_name     TEXT        NOT NULL,
    phone         TEXT,
    status        TEXT        NOT NULL DEFAULT 'activo'
                              CHECK (status IN ('activo','suspendido','pendiente')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER_ROLES (many-to-many: un usuario puede tener varios roles)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id    TEXT        NOT NULL REFERENCES roles(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,                          -- NULL = nunca vence
    granted_by UUID        REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
