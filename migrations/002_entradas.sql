-- ─────────────────────────────────────────────
-- 002_entradas.sql — Módulo de entradas (venta de boletos)
-- Paridad con ensureEntradasSchema() (fuente de verdad en arranque).
-- ─────────────────────────────────────────────

-- EVENTOS (partidos / espectáculos)
CREATE TABLE IF NOT EXISTS entrada_eventos (
    id          TEXT        PRIMARY KEY,
    slug        TEXT        UNIQUE NOT NULL,
    nombre      TEXT        NOT NULL,
    descripcion TEXT        NOT NULL DEFAULT '',
    venue       TEXT        NOT NULL DEFAULT '',
    fecha       TIMESTAMPTZ NOT NULL,
    estado      TEXT        NOT NULL DEFAULT 'borrador'   -- borrador|publicado|agotado|finalizado
                            CHECK (estado IN ('borrador','publicado','agotado','finalizado')),
    imagen_url  TEXT        NOT NULL DEFAULT '',
    creado_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TIPOS DE ENTRADA (sectores con precio y cupo)
CREATE TABLE IF NOT EXISTS entrada_tipos (
    id            TEXT    PRIMARY KEY,
    evento_id     TEXT    NOT NULL REFERENCES entrada_eventos(id) ON DELETE CASCADE,
    nombre        TEXT    NOT NULL,
    precio_crc    INTEGER NOT NULL DEFAULT 0,
    stock_total   INTEGER NOT NULL DEFAULT 0,
    stock_vendido INTEGER NOT NULL DEFAULT 0,
    estado        TEXT    NOT NULL DEFAULT 'activo'        -- activo|inactivo
                          CHECK (estado IN ('activo','inactivo')),
    orden         INTEGER NOT NULL DEFAULT 0
);

-- ÓRDENES DE COMPRA
CREATE TABLE IF NOT EXISTS entrada_ordenes (
    id               TEXT        PRIMARY KEY,
    evento_id        TEXT        NOT NULL REFERENCES entrada_eventos(id),
    comprador_nombre TEXT        NOT NULL,
    comprador_email  TEXT        NOT NULL,
    total_crc        INTEGER     NOT NULL DEFAULT 0,
    pago             JSONB,
    estado           TEXT        NOT NULL DEFAULT 'pagada' -- pagada|cancelada
                                 CHECK (estado IN ('pagada','cancelada')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOLETOS (1 por entrada, con QR y validación en puerta)
CREATE TABLE IF NOT EXISTS entrada_boletos (
    id           TEXT        PRIMARY KEY,
    orden_id     TEXT        NOT NULL REFERENCES entrada_ordenes(id) ON DELETE CASCADE,
    tipo_id      TEXT        NOT NULL REFERENCES entrada_tipos(id),
    evento_id    TEXT        NOT NULL REFERENCES entrada_eventos(id),
    codigo       TEXT        UNIQUE NOT NULL,
    qr_data      TEXT        NOT NULL,
    estado       TEXT        NOT NULL DEFAULT 'valido'     -- valido|usado|cancelado
                             CHECK (estado IN ('valido','usado','cancelado')),
    validado_at  TIMESTAMPTZ,
    validado_por TEXT
);

-- LOG / AUDITORÍA
CREATE TABLE IF NOT EXISTS entrada_log (
    id         BIGSERIAL   PRIMARY KEY,
    tipo       TEXT        NOT NULL,
    evento_id  TEXT,
    boleto_id  TEXT,
    user_id    TEXT,
    user_name  TEXT,
    notas      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entrada_tipos_evento   ON entrada_tipos(evento_id);
CREATE INDEX IF NOT EXISTS idx_entrada_boletos_evento ON entrada_boletos(evento_id);
CREATE INDEX IF NOT EXISTS idx_entrada_boletos_orden  ON entrada_boletos(orden_id);
