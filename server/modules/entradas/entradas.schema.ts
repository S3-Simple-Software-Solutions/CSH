import { pool, query } from '../../core/db';
import { genId } from './entradas.helpers';

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

  const count = Number((await query<{ count: number }>('select count(*)::int as count from entrada_eventos'))[0].count);
  if (count === 0) await seedEntradas();
}

const SECTORES = [
  { nombre: 'Sol Sur', precio: 8000, stock: 500 },
  { nombre: 'Sol Norte', precio: 8000, stock: 500 },
  { nombre: 'Palco', precio: 25000, stock: 50 },
  { nombre: 'Socio', precio: 5000, stock: 200 },
];

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
        'insert into entrada_eventos (id, slug, nombre, descripcion, venue, fecha, estado) values ($1,$2,$3,$4,$5,$6,$7)',
        [id, ev.slug, ev.nombre, ev.descripcion, ev.venue, fecha, ev.estado],
      );
      let orden = 0;
      for (const s of SECTORES) {
        await client.query(
          'insert into entrada_tipos (id, evento_id, nombre, precio_crc, stock_total, stock_vendido, estado, orden) values ($1,$2,$3,$4,$5,0,$6,$7)',
          [genId('TT'), id, s.nombre, s.precio, s.stock, 'activo', orden++],
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
