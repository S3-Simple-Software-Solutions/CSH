import { pool, query } from '../../core/db';
import { genId, slugify } from '../../core/id';

// Crea (idempotente) las tablas del módulo de restaurantes y siembra un local demo.
// Se invoca en el bootstrap de server/index.ts DESPUÉS de ensureUsuariosSchema()
// porque restaurantes.owner_user_id referencia app_users(id).
export async function ensureRestaurantesSchema(): Promise<void> {
  await pool.query(`
    create table if not exists restaurante_config (
      id                integer primary key default 1,
      fee_crc_default   integer not null default 1000,
      constraint restaurante_config_singleton check (id = 1)
    );
    insert into restaurante_config (id) values (1) on conflict (id) do nothing;

    create table if not exists restaurantes (
      id              text primary key,
      slug            text unique not null,
      nombre          text not null,
      descripcion     text not null default '',
      ubicacion       text not null default '',
      imagen_url      text not null default '',
      abierto         boolean not null default false,
      estado          text not null default 'activo',
      tiempo_prep_min integer not null default 15,
      owner_user_id   text not null references app_users(id),
      creado_at       timestamptz not null default now()
    );

    create table if not exists restaurante_menu_categorias (
      id             text primary key,
      restaurante_id text not null references restaurantes(id) on delete cascade,
      nombre         text not null,
      orden          integer not null default 0
    );

    create table if not exists restaurante_menu_items (
      id             text primary key,
      restaurante_id text not null references restaurantes(id) on delete cascade,
      categoria_id   text references restaurante_menu_categorias(id) on delete set null,
      nombre         text not null,
      descripcion    text not null default '',
      precio_crc     integer not null default 0,
      imagen_url     text not null default '',
      disponible     boolean not null default true,
      orden          integer not null default 0
    );

    create table if not exists restaurante_ordenes (
      id               text primary key,
      restaurante_id   text not null references restaurantes(id),
      codigo           text unique not null,
      cliente_nombre   text not null,
      cliente_email    text not null,
      cliente_telefono text not null default '',
      entrega_tipo     text not null default 'pickup',
      entrega_seccion  text not null default '',
      entrega_fila     text not null default '',
      entrega_asiento  text not null default '',
      notas            text not null default '',
      lineas           jsonb not null,
      subtotal_crc     integer not null default 0,
      fee_crc          integer not null default 0,
      total_crc        integer not null default 0,
      estado           text not null default 'pendiente_pago',
      provider         text,
      provider_ref     text,
      pago             jsonb,
      rechazo_motivo   text not null default '',
      creado_at        timestamptz not null default now(),
      pagada_at        timestamptz,
      entregada_at     timestamptz
    );

    create index if not exists idx_restaurantes_owner on restaurantes(owner_user_id);
    create index if not exists idx_rest_categorias_rest on restaurante_menu_categorias(restaurante_id);
    create index if not exists idx_rest_items_rest on restaurante_menu_items(restaurante_id);
    create index if not exists idx_rest_ordenes_rest_creado on restaurante_ordenes(restaurante_id, creado_at desc);
    create index if not exists idx_rest_ordenes_provider_ref on restaurante_ordenes(provider_ref);
    create index if not exists idx_rest_ordenes_estado on restaurante_ordenes(estado);
  `);

  const count = Number((await query<{ count: number }>('select count(*)::int as count from restaurantes'))[0].count);
  if (count === 0) await seedRestaurantes();
}

// Restaurante demo con menú, atado al usuario demo `demo-restaurante` (rol restaurant:owner).
async function seedRestaurantes(): Promise<void> {
  const owner = (await query<{ id: string }>("select id from app_users where id = 'demo-restaurante' limit 1"))[0];
  if (!owner) return; // el usuario demo aún no existe; se sembrará en el próximo boot

  const client = await pool.connect();
  try {
    await client.query('begin');
    const restId = genId('RST');
    await client.query(
      `insert into restaurantes (id, slug, nombre, descripcion, ubicacion, imagen_url, abierto, estado, tiempo_prep_min, owner_user_id)
       values ($1,$2,$3,$4,$5,$6,true,'activo',15,$7)`,
      [
        restId,
        slugify('Soda La Herediana'),
        'Soda La Herediana',
        'Comida típica y bocas para disfrutar el partido sin perderte un minuto.',
        'Gradería Norte, local 2',
        '/brand/restaurantes/seed-soda-herediana.jpg',
        owner.id,
      ],
    );

    const categorias = [
      { nombre: 'Bocas', orden: 0, items: [
        { nombre: 'Nachos con queso', desc: 'Porción grande con queso cheddar y jalapeños.', precio: 3500, img: '/brand/restaurantes/seed-nachos.jpg' },
        { nombre: 'Papas fritas', desc: 'Papas crocantes con salsa de la casa.', precio: 2500, img: '/brand/restaurantes/seed-papas.jpg' },
        { nombre: 'Alitas BBQ (8u)', desc: 'Alitas bañadas en salsa BBQ.', precio: 5000, img: '/brand/restaurantes/seed-alitas.jpg' },
      ] },
      { nombre: 'Bebidas', orden: 1, items: [
        { nombre: 'Refresco natural', desc: 'Cas, mora o tamarindo (500ml).', precio: 1500, img: '/brand/restaurantes/seed-refresco.jpg' },
        { nombre: 'Agua', desc: 'Botella 600ml.', precio: 1000, img: '/brand/restaurantes/seed-agua.jpg' },
        { nombre: 'Gaseosa', desc: 'Lata 350ml.', precio: 1200, img: '/brand/restaurantes/seed-gaseosa.jpg' },
      ] },
    ];
    for (const cat of categorias) {
      const catId = genId('RMC');
      await client.query(
        'insert into restaurante_menu_categorias (id, restaurante_id, nombre, orden) values ($1,$2,$3,$4)',
        [catId, restId, cat.nombre, cat.orden],
      );
      let orden = 0;
      for (const it of cat.items) {
        await client.query(
          `insert into restaurante_menu_items (id, restaurante_id, categoria_id, nombre, descripcion, precio_crc, imagen_url, disponible, orden)
           values ($1,$2,$3,$4,$5,$6,$7,true,$8)`,
          [genId('RMI'), restId, catId, it.nombre, it.desc, it.precio, it.img, orden++],
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
