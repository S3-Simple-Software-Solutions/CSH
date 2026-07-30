-- Soporte para eventos tipo espectáculo (concierto, festival, etc.)
-- con la gramilla del ERC dividida en zonas vendibles.

alter table entrada_eventos
  add column if not exists formato        text    not null default 'partido',
  add column if not exists field_template text,
  add column if not exists field_splits   jsonb;

comment on column entrada_eventos.formato        is '''partido'' (default) | ''espectaculo''';
comment on column entrada_eventos.field_template is 'Plantilla de división de gramilla: ''2'', ''3'' o ''4'' partes';
comment on column entrada_eventos.field_splits   is 'Ratios de líneas divisorias, ej. [0.5] o [0.33, 0.66]';
