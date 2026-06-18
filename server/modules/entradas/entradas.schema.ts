import { pool, query } from '../../core/db';
import { genId } from './entradas.helpers';
import { ERC_LAYOUT, ERC_SECTORES, mapaFromZoneKey } from './entradas.erc.zones';

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

  const count = Number((await query<{ count: number }>('select count(*)::int as count from entrada_eventos'))[0].count);
  if (count === 0) await seedEntradas();
  await ensureErcVectorMap();
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
      },
      {
        slug: 'herediano-vs-alajuelense-demo',
        nombre: 'Herediano vs Alajuelense',
        descripcion: 'Partido de alto voltaje. Pronto a la venta.',
        venue: 'Estadio Eladio Rosabal Cordero',
        dias: 21,
        estado: 'borrador',
      },
    ];
    for (const ev of eventos) {
      const id = genId('EV');
      const fecha = new Date(Date.now() + ev.dias * 86400000);
      await client.query(
        'insert into entrada_eventos (id, slug, nombre, descripcion, venue, fecha, estado, map_image_url) values ($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, ev.slug, ev.nombre, ev.descripcion, ev.venue, fecha, ev.estado, ERC_LAYOUT],
      );
      let orden = 0;
      for (const s of SECTORES) {
        await client.query(
          'insert into entrada_tipos (id, evento_id, nombre, precio_crc, stock_total, stock_vendido, estado, orden, map_color, map_shape, map_points) values ($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10)',
          [genId('TT'), id, s.nombre, s.precio, s.stock, 'activo', orden++, s.color ?? null, s.mapa?.shape ?? null, s.mapa ? JSON.stringify(s.mapa.points) : null],
        );
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
