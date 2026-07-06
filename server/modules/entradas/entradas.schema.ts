import { pool, query } from '../../core/db';
import { genId } from './entradas.helpers';
import { ERC_LAYOUT, ERC_SECTORES, GRAMILLA_SECTORES, mapaFromZoneKey } from './entradas.erc.zones';

const ERC_ESPECTACULO_LAYOUT = 'vector:erc-espectaculo-v1';

export async function ensureEntradasSchema(): Promise<void> {
  await pool.query(`
    create table if not exists entrada_eventos (
      id text primary key,
      slug text unique not null,
      nombre text not null,
      descripcion text not null default '',
      venue text not null default '',
      fecha timestamptz not null,
      estado text not null default 'borrador',
      imagen_url text not null default '',
      creado_at timestamptz not null default now()
    );
    create table if not exists entrada_tipos (
      id text primary key,
      evento_id text not null references entrada_eventos(id) on delete cascade,
      nombre text not null,
      precio_crc integer not null default 0,
      stock_total integer not null default 0,
      stock_vendido integer not null default 0,
      estado text not null default 'activo',
      orden integer not null default 0
    );
    create table if not exists entrada_ordenes (
      id text primary key,
      evento_id text not null references entrada_eventos(id),
      comprador_nombre text not null,
      comprador_email text not null,
      total_crc integer not null default 0,
      pago jsonb,
      estado text not null default 'pagada',
      created_at timestamptz not null default now()
    );
    create table if not exists entrada_boletos (
      id text primary key,
      orden_id text not null references entrada_ordenes(id) on delete cascade,
      tipo_id text not null references entrada_tipos(id),
      evento_id text not null references entrada_eventos(id),
      codigo text unique not null,
      qr_data text not null,
      estado text not null default 'valido',
      validado_at timestamptz,
      validado_por text
    );
    create table if not exists entrada_log (
      id bigserial primary key,
      tipo text not null,
      evento_id text,
      boleto_id text,
      user_id text,
      user_name text,
      notas text,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_entrada_tipos_evento on entrada_tipos(evento_id);
    create index if not exists idx_entrada_boletos_evento on entrada_boletos(evento_id);
    create index if not exists idx_entrada_boletos_orden on entrada_boletos(orden_id);
    create index if not exists idx_entrada_log_evento_created on entrada_log(evento_id, created_at desc);
    create index if not exists idx_entrada_log_created on entrada_log(created_at desc);
  `);
  // Mapa de zonas del estadio (idempotente via alter ... if not exists)
  await pool.query(`
    alter table entrada_eventos
      add column if not exists map_image_url text not null default '/brand/estadio.jpg',
      add column if not exists map_version   integer not null default 0;
    alter table entrada_tipos
      add column if not exists map_color   text,
      add column if not exists map_shape   text,
      add column if not exists map_points  jsonb,
      add column if not exists map_label_x double precision,
      add column if not exists map_label_y double precision;
    create index if not exists idx_entrada_tipos_map on entrada_tipos(evento_id) where map_shape is not null;
  `);
  // Espectáculos: formato, field_template, field_splits
  await pool.query(`
    alter table entrada_eventos
      add column if not exists formato        text    not null default 'partido',
      add column if not exists field_template text,
      add column if not exists field_splits   jsonb;
  `);
  // Pagos con pasarela: orden 'pendiente' hasta que el webhook confirme.
  // provider/provider_ref correlacionan con la sesión de la pasarela; lineas es
  // el snapshot de lo comprado para materializar los boletos al confirmar.
  await pool.query(`
    alter table entrada_ordenes
      add column if not exists provider     text,
      add column if not exists provider_ref text,
      add column if not exists lineas       jsonb;
    create index if not exists idx_entrada_ordenes_provider_ref on entrada_ordenes(provider_ref);
  `);

  // P1: cargo por servicio (fee), desglose de orden, descuentos y config global.
  await pool.query(`
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
    create table if not exists entrada_promotores (
      id             text primary key,
      nombre         text not null,
      codigo         text unique not null,
      comision_tipo  text not null default 'pct',
      comision_valor integer not null default 0,
      activo         boolean not null default true,
      creado_at      timestamptz not null default now()
    );
    alter table entrada_ordenes
      add column if not exists promotor_id  text,
      add column if not exists comision_crc integer not null default 0;
    create index if not exists idx_entrada_ordenes_promotor on entrada_ordenes(promotor_id) where promotor_id is not null;
  `);
  // Templates de evento: snapshot reutilizable (sectores, butacas, tandas, fee).
  await pool.query(`
    create table if not exists entrada_event_templates (
      id          text primary key,
      nombre      text unique not null,
      descripcion text not null default '',
      payload     jsonb not null,
      creado_at   timestamptz not null default now()
    );
  `);
  // Asientos numerados (P2): butaca individual por sector, con soft-lock de reserva.
  await pool.query(`
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
      estado          text not null default 'disponible',
      reservado_hasta timestamptz,
      hold_id         text,
      boleto_id       text,
      orden_id        text,
      unique (tipo_id, fila, numero)
    );
    create index if not exists idx_entrada_asientos_evento on entrada_asientos(evento_id);
    create index if not exists idx_entrada_asientos_tipo on entrada_asientos(tipo_id);
  `);

  const count = Number((await query<{ count: number }>('select count(*)::int as count from entrada_eventos'))[0].count);
  if (count === 0) await seedEntradas();
  await ensureErcVectorMap();
  await ensureConciertoDemoMap();
}

async function ensureErcVectorMap(): Promise<void> {
  const eventos = await query<{ id: string; slug: string }>(
    'select id, slug from entrada_eventos where slug in ($1, $2)',
    ['herediano-vs-saprissa-demo', 'herediano-vs-alajuelense-demo'],
  );
  for (const ev of eventos) {
    await pool.query(
      'update entrada_eventos set map_image_url = $1 where id = $2 and map_image_url != $1',
      [ERC_LAYOUT, ev.id],
    );
    const tipos = await query<{ id: string; nombre: string }>(
      'select id, nombre from entrada_tipos where evento_id = $1',
      [ev.id],
    );
    const byName = new Map(tipos.map((t) => [t.nombre.toLowerCase(), t.id]));
    for (const s of ERC_SECTORES) {
      let tipoId = byName.get(s.nombre.toLowerCase());
      if (!tipoId) {
        tipoId = genId('TT');
        await pool.query(
          'insert into entrada_tipos (id, evento_id, nombre, precio_crc, stock_total, stock_vendido, estado, orden, map_color, map_shape, map_points) values ($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10)',
          [tipoId, ev.id, s.nombre, s.precio, s.stock, 'activo', ERC_SECTORES.indexOf(s), s.color, 'zone', JSON.stringify({ key: s.key })],
        );
      } else {
        const mapa = mapaFromZoneKey(s.key);
        if (mapa) {
          await pool.query(
            'update entrada_tipos set map_shape = $1, map_points = $2, map_color = $3 where id = $4',
            [mapa.shape, JSON.stringify(mapa.points), mapa.color, tipoId],
          );
        }
      }
    }
  }
}

async function ensureConciertoDemoMap(): Promise<void> {
  const slug = 'concierto-gramilla-demo';
  const rows = await query<{ id: string }>('select id from entrada_eventos where slug = $1', [slug]);
  if (!rows[0]) return; // no existe aún, seedEntradas lo crea si la BD estaba vacía

  const ev = rows[0];
  await pool.query(
    `update entrada_eventos set
       map_image_url  = $1,
       formato        = 'espectaculo',
       field_template = '3',
       field_splits   = $2
     where id = $3 and map_image_url != $1`,
    [ERC_ESPECTACULO_LAYOUT, JSON.stringify([0.3, 0.7]), ev.id],
  );

  // Sectores de gramilla para el demo (si no existen)
  const gramKeys = ['gramilla-1', 'gramilla-2', 'gramilla-3'] as const;
  for (const s of gramKeys) {
    const meta = GRAMILLA_SECTORES[s];
    if (!meta) continue;
    const exists = await query<any>('select 1 from entrada_tipos where evento_id = $1 and nombre = $2', [ev.id, meta.nombre]);
    if (!exists[0]) {
      const tipoId = genId('TT');
      const mapa = mapaFromZoneKey(s);
      await pool.query(
        'insert into entrada_tipos (id, evento_id, nombre, precio_crc, stock_total, stock_vendido, estado, orden, map_color, map_shape, map_points) values ($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10)',
        [tipoId, ev.id, meta.nombre, meta.precio, meta.stock, 'activo', 10 + gramKeys.indexOf(s), meta.color, mapa?.shape ?? null, mapa ? JSON.stringify(mapa.points) : null],
      );
    }
  }
}

// Sectores demo — layout vectorial ERC v1 (6 zonas)
const SECTORES = ERC_SECTORES.map((s) => ({
  nombre: s.nombre,
  precio: s.precio,
  stock: s.stock,
  color: s.color,
  mapa: mapaFromZoneKey(s.key),
}));

async function seedEntradas(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const eventos = [
      {
        slug: 'herediano-vs-saprissa-demo',
        nombre: 'Herediano vs Saprissa',
        descripcion: 'Clásico de la jornada en el Estadio Eladio Rosabal Cordero. Vení a apoyar al Team.',
        venue: 'Estadio Eladio Rosabal Cordero',
        dias: 7,
        estado: 'publicado',
        formato: 'partido',
        mapUrl: ERC_LAYOUT,
        fieldTemplate: null,
      },
      {
        slug: 'herediano-vs-alajuelense-demo',
        nombre: 'Herediano vs Alajuelense',
        descripcion: 'Partido de alto voltaje. Pronto a la venta.',
        venue: 'Estadio Eladio Rosabal Cordero',
        dias: 21,
        estado: 'borrador',
        formato: 'partido',
        mapUrl: ERC_LAYOUT,
        fieldTemplate: null,
      },
      {
        slug: 'concierto-gramilla-demo',
        nombre: 'Gran Concierto Estadio',
        descripcion: 'Espectáculo con tribunas y gramilla habilitada. Ejemplo de evento no deportivo.',
        venue: 'Estadio Eladio Rosabal Cordero',
        dias: 14,
        estado: 'publicado',
        formato: 'espectaculo',
        mapUrl: ERC_ESPECTACULO_LAYOUT,
        fieldTemplate: '3',
      },
    ] as const;
    for (const ev of eventos) {
      const id = genId('EV');
      const fecha = new Date(Date.now() + ev.dias * 86400000);
      await client.query(
        'insert into entrada_eventos (id, slug, nombre, descripcion, venue, fecha, estado, map_image_url, formato, field_template, field_splits) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [id, ev.slug, ev.nombre, ev.descripcion, ev.venue, fecha, ev.estado, ev.mapUrl, ev.formato, ev.fieldTemplate ?? null, ev.formato === 'espectaculo' ? JSON.stringify([0.3, 0.7]) : null],
      );
      let orden = 0;
      // Tribunas (todas para partido; Sol Norte/Sur + Lateral Este para espectáculo)
      const sectoresToAdd = ev.formato === 'espectaculo'
        ? SECTORES.filter((s) => ['Sol Norte', 'Sol Sur', 'Lateral Este'].includes(s.nombre))
        : SECTORES;
      for (const s of sectoresToAdd) {
        await client.query(
          'insert into entrada_tipos (id, evento_id, nombre, precio_crc, stock_total, stock_vendido, estado, orden, map_color, map_shape, map_points) values ($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10)',
          [genId('TT'), id, s.nombre, s.precio, s.stock, 'activo', orden++, s.color ?? null, s.mapa?.shape ?? null, s.mapa ? JSON.stringify(s.mapa.points) : null],
        );
      }
      // Zonas de gramilla para espectáculo
      if (ev.formato === 'espectaculo') {
        const gramKeys = ['gramilla-1', 'gramilla-2', 'gramilla-3'] as const;
        for (const gk of gramKeys) {
          const meta = GRAMILLA_SECTORES[gk];
          if (!meta) continue;
          const mapa = mapaFromZoneKey(gk);
          await client.query(
            'insert into entrada_tipos (id, evento_id, nombre, precio_crc, stock_total, stock_vendido, estado, orden, map_color, map_shape, map_points) values ($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10)',
            [genId('TT'), id, meta.nombre, meta.precio, meta.stock, 'activo', orden++, meta.color, mapa?.shape ?? null, mapa ? JSON.stringify(mapa.points) : null],
          );
        }
      }
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
