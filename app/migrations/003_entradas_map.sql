-- ─────────────────────────────────────────────
-- 003_entradas_map.sql — Mapa de zonas del estadio para entradas
-- Extiende entrada_eventos y entrada_tipos con geometría normalizada (0..1).
-- ─────────────────────────────────────────────

-- Plano del estadio por evento
ALTER TABLE entrada_eventos
  ADD COLUMN IF NOT EXISTS map_image_url TEXT NOT NULL DEFAULT '/brand/estadio.jpg',
  ADD COLUMN IF NOT EXISTS map_version   INTEGER NOT NULL DEFAULT 0;

-- Geometría de cada sector sobre el plano
ALTER TABLE entrada_tipos
  ADD COLUMN IF NOT EXISTS map_color   TEXT,
  ADD COLUMN IF NOT EXISTS map_shape   TEXT,     -- 'rect' | 'polygon' | NULL
  ADD COLUMN IF NOT EXISTS map_points  JSONB,    -- rect: {x,y,w,h} | polygon: [{x,y},...]
  ADD COLUMN IF NOT EXISTS map_label_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS map_label_y DOUBLE PRECISION;

-- Índice para consultar tipos con geometría definida
CREATE INDEX IF NOT EXISTS idx_entrada_tipos_map_shape ON entrada_tipos(evento_id) WHERE map_shape IS NOT NULL;
