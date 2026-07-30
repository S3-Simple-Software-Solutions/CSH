import { pool, query } from '../../core/db';
import { genId, slugify } from '../../core/id';
import { ApiError } from '../../core/errors';
import type {
  Entrega,
  MenuCategoria,
  MenuItem,
  OrdenEstado,
  OrdenLinea,
  OrdenRestaurante,
  PagoRestaurante,
  Restaurante,
  RestauranteConfig,
} from './restaurantes.types';

// ---- Row types + mappers ----

interface RestauranteRow {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  imagen_url: string;
  abierto: boolean;
  estado: string;
  tiempo_prep_min: number;
  owner_user_id: string;
  creado_at: string;
}

function toRestaurante(r: RestauranteRow): Restaurante {
  return {
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    descripcion: r.descripcion,
    ubicacion: r.ubicacion,
    imagenUrl: r.imagen_url,
    abierto: r.abierto,
    estado: (r.estado as Restaurante['estado']) || 'activo',
    tiempoPrepMin: r.tiempo_prep_min,
    ownerUserId: r.owner_user_id,
    creadoAt: r.creado_at,
  };
}

interface CategoriaRow {
  id: string;
  restaurante_id: string;
  nombre: string;
  orden: number;
}

function toCategoria(r: CategoriaRow): MenuCategoria {
  return { id: r.id, restauranteId: r.restaurante_id, nombre: r.nombre, orden: r.orden };
}

interface ItemRow {
  id: string;
  restaurante_id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string;
  precio_crc: number;
  imagen_url: string;
  disponible: boolean;
  orden: number;
}

function toItem(r: ItemRow): MenuItem {
  return {
    id: r.id,
    restauranteId: r.restaurante_id,
    categoriaId: r.categoria_id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    precioCrc: r.precio_crc,
    imagenUrl: r.imagen_url,
    disponible: r.disponible,
    orden: r.orden,
  };
}

interface OrdenRow {
  id: string;
  restaurante_id: string;
  restaurante_nombre?: string;
  codigo: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  entrega_tipo: string;
  entrega_seccion: string;
  entrega_fila: string;
  entrega_asiento: string;
  notas: string;
  lineas: OrdenLinea[];
  subtotal_crc: number;
  fee_crc: number;
  total_crc: number;
  estado: string;
  rechazo_motivo: string;
  creado_at: string;
  pagada_at: string | null;
  entregada_at: string | null;
}

function toOrden(r: OrdenRow): OrdenRestaurante {
  const entrega: Entrega = {
    tipo: (r.entrega_tipo as Entrega['tipo']) || 'pickup',
    seccion: r.entrega_seccion || '',
    fila: r.entrega_fila || '',
    asiento: r.entrega_asiento || '',
  };
  return {
    id: r.id,
    restauranteId: r.restaurante_id,
    restauranteNombre: r.restaurante_nombre || '',
    codigo: r.codigo,
    clienteNombre: r.cliente_nombre,
    clienteEmail: r.cliente_email,
    clienteTelefono: r.cliente_telefono || '',
    entrega,
    notas: r.notas || '',
    lineas: Array.isArray(r.lineas) ? r.lineas : [],
    subtotalCrc: r.subtotal_crc,
    feeCrc: r.fee_crc,
    totalCrc: r.total_crc,
    estado: (r.estado as OrdenEstado) || 'pendiente_pago',
    rechazoMotivo: r.rechazo_motivo || '',
    creadoAt: r.creado_at,
    pagadaAt: r.pagada_at,
    entregadaAt: r.entregada_at,
  };
}

const REST_COLS = 'id, slug, nombre, descripcion, ubicacion, imagen_url, abierto, estado, tiempo_prep_min, owner_user_id, creado_at';
const ORDEN_COLS = `o.id, o.restaurante_id, o.codigo, o.cliente_nombre, o.cliente_email, o.cliente_telefono,
  o.entrega_tipo, o.entrega_seccion, o.entrega_fila, o.entrega_asiento, o.notas, o.lineas,
  o.subtotal_crc, o.fee_crc, o.total_crc, o.estado, o.rechazo_motivo, o.creado_at, o.pagada_at, o.entregada_at`;

// ---- Config ----

export async function getConfig(): Promise<RestauranteConfig> {
  const rows = await query<{ fee_crc_default: number }>('select fee_crc_default from restaurante_config where id = 1');
  return { feeCrcDefault: Number(rows[0]?.fee_crc_default ?? 1000) };
}

export async function setConfig(feeCrcDefault: number): Promise<RestauranteConfig> {
  const fee = Math.max(0, Math.round(feeCrcDefault));
  await pool.query('update restaurante_config set fee_crc_default = $1 where id = 1', [fee]);
  return { feeCrcDefault: fee };
}

// ---- Restaurantes (lectura) ----

export async function findRestaurantesPublicos(): Promise<Restaurante[]> {
  const rows = await query<RestauranteRow>(
    `select ${REST_COLS} from restaurantes where estado = 'activo' order by abierto desc, nombre asc`,
  );
  return rows.map(toRestaurante);
}

export async function findRestaurantePublicoBySlug(slug: string): Promise<Restaurante | null> {
  const rows = await query<RestauranteRow>(
    `select ${REST_COLS} from restaurantes where slug = $1 and estado = 'activo' limit 1`,
    [slug],
  );
  return rows[0] ? toRestaurante(rows[0]) : null;
}

export async function findRestauranteById(id: string): Promise<Restaurante | null> {
  const rows = await query<RestauranteRow>(`select ${REST_COLS} from restaurantes where id = $1 limit 1`, [id]);
  return rows[0] ? toRestaurante(rows[0]) : null;
}

// Lista para el panel: si ownerId viene, filtra por los locales donde es
// propietario (principal o agregado); si no, todos (admin).
export async function findRestaurantes(ownerId?: string): Promise<Restaurante[]> {
  const rows = ownerId
    ? await query<RestauranteRow>(
      `select ${REST_COLS.split(', ').map((c) => `r.${c}`).join(', ')}
         from restaurantes r
        where r.owner_user_id = $1
           or exists(select 1 from restaurante_owners o where o.restaurante_id = r.id and o.user_id = $1)
        order by r.nombre asc`,
      [ownerId],
    )
    : await query<RestauranteRow>(`select ${REST_COLS} from restaurantes order by nombre asc`);
  return rows.map(toRestaurante);
}

// Usuarios activos: candidatos a dueño de un restaurante (selector del admin).
export async function findOwners(): Promise<{ id: string; nombre: string; username: string }[]> {
  return query<{ id: string; nombre: string; username: string }>(
    `select u.id, u.full_name as nombre, u.username
       from app_users u
      where lower(u.status) not in ('suspendido','suspended','inactivo','inactive')
      order by u.full_name asc`,
  );
}

// ---- Propietarios de un restaurante ----

export type RestauranteOwner = { id: string; nombre: string; username: string; email: string; principal: boolean };

export async function findRestauranteOwners(restauranteId: string): Promise<RestauranteOwner[]> {
  return query<RestauranteOwner>(
    `select u.id, u.full_name as nombre, u.username, u.email, o.principal
       from restaurante_owners o
       join app_users u on u.id = o.user_id
      where o.restaurante_id = $1
      order by o.principal desc, u.full_name asc`,
    [restauranteId],
  );
}

export async function isRestauranteOwner(restauranteId: string, userId: string): Promise<boolean> {
  const rows = await query(
    'select 1 from restaurante_owners where restaurante_id = $1 and user_id = $2 limit 1',
    [restauranteId, userId],
  );
  return Boolean(rows[0]);
}

// Agrega un propietario y le concede el rol global "Mi restaurante" para que
// pueda entrar al panel.
export async function addRestauranteOwner(restauranteId: string, userId: string, principal = false): Promise<void> {
  const u = await query('select id from app_users where id = $1', [userId]);
  if (!u[0]) throw new ApiError(404, 'Usuario no encontrado');
  await pool.query(
    `insert into restaurante_owners (restaurante_id, user_id, principal) values ($1,$2,$3)
     on conflict (restaurante_id, user_id) do nothing`,
    [restauranteId, userId, principal],
  );
  await pool.query(
    "insert into app_user_roles (user_id, role_id) values ($1, 'restaurant:owner') on conflict do nothing",
    [userId],
  );
}

// Quita a un propietario. El principal no se puede quitar (es el titular del
// local). Si el usuario ya no es dueño de ningún restaurante, pierde el rol.
export async function removeRestauranteOwner(restauranteId: string, userId: string): Promise<void> {
  const rows = await query<{ principal: boolean }>(
    'select principal from restaurante_owners where restaurante_id = $1 and user_id = $2',
    [restauranteId, userId],
  );
  if (!rows[0]) throw new ApiError(404, 'Ese usuario no es dueño de este restaurante');
  if (rows[0].principal) throw new ApiError(409, 'No se puede quitar al dueño principal. Primero transferí el restaurante.');
  await pool.query('delete from restaurante_owners where restaurante_id = $1 and user_id = $2', [restauranteId, userId]);
  const otros = await query('select 1 from restaurante_owners where user_id = $1 limit 1', [userId]);
  if (!otros[0]) {
    await pool.query("delete from app_user_roles where user_id = $1 and role_id = 'restaurant:owner'", [userId]);
  }
}

// ---- Restaurantes (escritura) ----

export async function insertRestaurante(data: {
  nombre: string; descripcion: string; ubicacion: string; tiempoPrepMin: number; ownerUserId: string;
}): Promise<Restaurante> {
  const id = genId('RST');
  const base = slugify(data.nombre) || 'restaurante';
  const slug = `${base}-${id.slice(-4).toLowerCase()}`;
  const rows = await query<RestauranteRow>(
    `insert into restaurantes (id, slug, nombre, descripcion, ubicacion, tiempo_prep_min, owner_user_id)
     values ($1,$2,$3,$4,$5,$6,$7) returning ${REST_COLS}`,
    [id, slug, data.nombre, data.descripcion, data.ubicacion, data.tiempoPrepMin, data.ownerUserId],
  );
  await addRestauranteOwner(id, data.ownerUserId, true);
  return toRestaurante(rows[0]);
}

export async function updateRestaurante(id: string, patch: {
  nombre?: string; descripcion?: string; ubicacion?: string; tiempoPrepMin?: number; abierto?: boolean; estado?: string;
}): Promise<Restaurante | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  const add = (col: string, val: unknown) => { sets.push(`${col} = $${i++}`); params.push(val); };
  if (patch.nombre !== undefined) add('nombre', patch.nombre);
  if (patch.descripcion !== undefined) add('descripcion', patch.descripcion);
  if (patch.ubicacion !== undefined) add('ubicacion', patch.ubicacion);
  if (patch.tiempoPrepMin !== undefined) add('tiempo_prep_min', patch.tiempoPrepMin);
  if (patch.abierto !== undefined) add('abierto', patch.abierto);
  if (patch.estado !== undefined) add('estado', patch.estado);
  if (!sets.length) return findRestauranteById(id);
  params.push(id);
  const rows = await query<RestauranteRow>(
    `update restaurantes set ${sets.join(', ')} where id = $${i} returning ${REST_COLS}`,
    params,
  );
  return rows[0] ? toRestaurante(rows[0]) : null;
}

export async function setRestauranteImagen(id: string, imagenUrl: string): Promise<Restaurante | null> {
  const rows = await query<RestauranteRow>(
    `update restaurantes set imagen_url = $2 where id = $1 returning ${REST_COLS}`,
    [id, imagenUrl],
  );
  return rows[0] ? toRestaurante(rows[0]) : null;
}

export async function deleteRestaurante(id: string): Promise<void> {
  await pool.query('delete from restaurantes where id = $1', [id]);
}

// ---- Menú: categorías ----

export async function findCategorias(restauranteId: string): Promise<MenuCategoria[]> {
  const rows = await query<CategoriaRow>(
    'select id, restaurante_id, nombre, orden from restaurante_menu_categorias where restaurante_id = $1 order by orden asc, nombre asc',
    [restauranteId],
  );
  return rows.map(toCategoria);
}

export async function findCategoriaById(id: string): Promise<MenuCategoria | null> {
  const rows = await query<CategoriaRow>(
    'select id, restaurante_id, nombre, orden from restaurante_menu_categorias where id = $1 limit 1',
    [id],
  );
  return rows[0] ? toCategoria(rows[0]) : null;
}

export async function insertCategoria(restauranteId: string, nombre: string, orden: number): Promise<MenuCategoria> {
  const rows = await query<CategoriaRow>(
    'insert into restaurante_menu_categorias (id, restaurante_id, nombre, orden) values ($1,$2,$3,$4) returning id, restaurante_id, nombre, orden',
    [genId('RMC'), restauranteId, nombre, orden],
  );
  return toCategoria(rows[0]);
}

export async function updateCategoria(id: string, patch: { nombre?: string; orden?: number }): Promise<MenuCategoria | null> {
  const rows = await query<CategoriaRow>(
    `update restaurante_menu_categorias
        set nombre = coalesce($2, nombre), orden = coalesce($3, orden)
      where id = $1 returning id, restaurante_id, nombre, orden`,
    [id, patch.nombre ?? null, patch.orden ?? null],
  );
  return rows[0] ? toCategoria(rows[0]) : null;
}

export async function deleteCategoria(id: string): Promise<void> {
  await pool.query('delete from restaurante_menu_categorias where id = $1', [id]);
}

// ---- Menú: ítems ----

export async function findItems(restauranteId: string, soloDisponibles = false): Promise<MenuItem[]> {
  const rows = await query<ItemRow>(
    `select id, restaurante_id, categoria_id, nombre, descripcion, precio_crc, imagen_url, disponible, orden
       from restaurante_menu_items
      where restaurante_id = $1 ${soloDisponibles ? 'and disponible = true' : ''}
      order by orden asc, nombre asc`,
    [restauranteId],
  );
  return rows.map(toItem);
}

export async function findItemById(id: string): Promise<MenuItem | null> {
  const rows = await query<ItemRow>(
    'select id, restaurante_id, categoria_id, nombre, descripcion, precio_crc, imagen_url, disponible, orden from restaurante_menu_items where id = $1 limit 1',
    [id],
  );
  return rows[0] ? toItem(rows[0]) : null;
}

export async function insertItem(restauranteId: string, data: {
  categoriaId: string | null; nombre: string; descripcion: string; precioCrc: number; disponible: boolean; orden: number;
}): Promise<MenuItem> {
  const rows = await query<ItemRow>(
    `insert into restaurante_menu_items (id, restaurante_id, categoria_id, nombre, descripcion, precio_crc, disponible, orden)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id, restaurante_id, categoria_id, nombre, descripcion, precio_crc, imagen_url, disponible, orden`,
    [genId('RMI'), restauranteId, data.categoriaId, data.nombre, data.descripcion, data.precioCrc, data.disponible, data.orden],
  );
  return toItem(rows[0]);
}

export async function updateItem(id: string, patch: {
  categoriaId?: string | null; nombre?: string; descripcion?: string; precioCrc?: number; disponible?: boolean; orden?: number;
}): Promise<MenuItem | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  const add = (col: string, val: unknown) => { sets.push(`${col} = $${i++}`); params.push(val); };
  if (patch.categoriaId !== undefined) add('categoria_id', patch.categoriaId);
  if (patch.nombre !== undefined) add('nombre', patch.nombre);
  if (patch.descripcion !== undefined) add('descripcion', patch.descripcion);
  if (patch.precioCrc !== undefined) add('precio_crc', patch.precioCrc);
  if (patch.disponible !== undefined) add('disponible', patch.disponible);
  if (patch.orden !== undefined) add('orden', patch.orden);
  if (!sets.length) return findItemById(id);
  params.push(id);
  const rows = await query<ItemRow>(
    `update restaurante_menu_items set ${sets.join(', ')} where id = $${i}
     returning id, restaurante_id, categoria_id, nombre, descripcion, precio_crc, imagen_url, disponible, orden`,
    params,
  );
  return rows[0] ? toItem(rows[0]) : null;
}

export async function setItemImagen(id: string, imagenUrl: string): Promise<MenuItem | null> {
  const rows = await query<ItemRow>(
    `update restaurante_menu_items set imagen_url = $2 where id = $1
     returning id, restaurante_id, categoria_id, nombre, descripcion, precio_crc, imagen_url, disponible, orden`,
    [id, imagenUrl],
  );
  return rows[0] ? toItem(rows[0]) : null;
}

export async function deleteItem(id: string): Promise<void> {
  await pool.query('delete from restaurante_menu_items where id = $1', [id]);
}

// ---- Órdenes ----

function nuevoCodigo(): string {
  return `R-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export interface IniciarOrdenInput {
  slug: string;
  lineas: { itemId: string; cantidad: number }[];
  cliente: { nombre: string; email: string; telefono: string };
  entrega: Entrega;
  notas: string;
  provider: string;
}

export interface IniciarOrdenResult {
  ordenId: string;
  codigo: string;
  subtotalCrc: number;
  feeCrc: number;
  totalCrc: number;
  lineItems: { nombre: string; montoUnitarioCrc: number; cantidad: number }[];
  restauranteNombre: string;
}

// Crea la orden en estado 'pendiente_pago' recalculando precios desde la BD
// (fuente autoritativa) dentro de una transacción con lock del restaurante.
export async function iniciarOrdenPendiente(input: IniciarOrdenInput): Promise<IniciarOrdenResult> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const restRows = await client.query<RestauranteRow>(
      `select ${REST_COLS} from restaurantes where slug = $1 for update`,
      [input.slug],
    );
    const rest = restRows.rows[0];
    if (!rest) throw new ApiError(404, 'Restaurante no encontrado');
    if (rest.estado !== 'activo') throw new ApiError(409, 'Este restaurante no está disponible');
    if (!rest.abierto) throw new ApiError(409, 'Este restaurante está cerrado en este momento');

    const lineas: OrdenLinea[] = [];
    let subtotal = 0;
    for (const l of input.lineas) {
      const itemRows = await client.query<ItemRow>(
        'select id, restaurante_id, categoria_id, nombre, descripcion, precio_crc, imagen_url, disponible, orden from restaurante_menu_items where id = $1 and restaurante_id = $2 for update',
        [l.itemId, rest.id],
      );
      const item = itemRows.rows[0];
      if (!item || !item.disponible) throw new ApiError(409, 'Un producto del carrito ya no está disponible');
      const cantidad = Math.max(1, Math.min(50, Math.round(l.cantidad)));
      lineas.push({ itemId: item.id, nombre: item.nombre, precioCrc: item.precio_crc, cantidad });
      subtotal += item.precio_crc * cantidad;
    }
    if (!lineas.length) throw new ApiError(400, 'El carrito está vacío');

    const feeRows = await client.query<{ fee_crc_default: number }>('select fee_crc_default from restaurante_config where id = 1');
    const feeCrc = subtotal > 0 ? Number(feeRows.rows[0]?.fee_crc_default ?? 1000) : 0;
    const totalCrc = subtotal + feeCrc;

    const ordenId = genId('ROR');
    const codigo = nuevoCodigo();
    await client.query(
      `insert into restaurante_ordenes
        (id, restaurante_id, codigo, cliente_nombre, cliente_email, cliente_telefono,
         entrega_tipo, entrega_seccion, entrega_fila, entrega_asiento, notas, lineas,
         subtotal_crc, fee_crc, total_crc, estado, provider)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pendiente_pago',$16)`,
      [
        ordenId, rest.id, codigo, input.cliente.nombre, input.cliente.email, input.cliente.telefono,
        input.entrega.tipo, input.entrega.seccion, input.entrega.fila, input.entrega.asiento, input.notas,
        JSON.stringify(lineas), subtotal, feeCrc, totalCrc, input.provider,
      ],
    );
    await client.query('commit');

    const lineItems = lineas.map((l) => ({ nombre: l.nombre, montoUnitarioCrc: l.precioCrc, cantidad: l.cantidad }));
    if (feeCrc > 0) lineItems.push({ nombre: 'Cargo por servicio', montoUnitarioCrc: feeCrc, cantidad: 1 });
    return { ordenId, codigo, subtotalCrc: subtotal, feeCrc, totalCrc, lineItems, restauranteNombre: rest.nombre };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function setProviderRef(ordenId: string, providerRef: string): Promise<void> {
  await pool.query('update restaurante_ordenes set provider_ref = $2 where id = $1', [ordenId, providerRef]);
}

// Confirma el pago (idempotente): pendiente_pago → pendiente. Devuelve la orden
// (con nombre del restaurante) para el correo, o null si no aplica / no existe.
export async function confirmarOrden(ordenId: string, pago: PagoRestaurante): Promise<OrdenRestaurante | null> {
  const rows = await query<OrdenRow>(
    `update restaurante_ordenes
        set estado = 'pendiente', pago = $2, pagada_at = now()
      where id = $1 and estado = 'pendiente_pago'
      returning ${ordenColsAliased()}`,
    [ordenId, JSON.stringify(pago)],
  );
  if (!rows[0]) return null;
  return withRestauranteNombre(rows[0]);
}

export async function expirarOrden(ordenId: string): Promise<void> {
  await pool.query(
    "update restaurante_ordenes set estado = 'cancelada' where id = $1 and estado = 'pendiente_pago'",
    [ordenId],
  );
}

// Estado público (polling post-pago y tracking en vivo).
export async function getOrdenPublica(ref: string): Promise<OrdenRestaurante | null> {
  const rows = await query<OrdenRow>(
    `select ${ORDEN_COLS}, r.nombre as restaurante_nombre
       from restaurante_ordenes o join restaurantes r on r.id = o.restaurante_id
      where o.id = $1 or o.codigo = $1 limit 1`,
    [ref],
  );
  return rows[0] ? toOrden(rows[0]) : null;
}

export async function findOrdenById(id: string): Promise<OrdenRestaurante | null> {
  const rows = await query<OrdenRow>(
    `select ${ORDEN_COLS}, r.nombre as restaurante_nombre
       from restaurante_ordenes o join restaurantes r on r.id = o.restaurante_id
      where o.id = $1 limit 1`,
    [id],
  );
  return rows[0] ? toOrden(rows[0]) : null;
}

const ORDENES_ACTIVAS = ['pendiente', 'en_preparacion', 'listo'];

export async function findOrdenes(opts: { restauranteIds?: string[]; soloActivas: boolean }): Promise<OrdenRestaurante[]> {
  const where: string[] = ["o.estado <> 'pendiente_pago'"];
  const params: unknown[] = [];
  let i = 1;
  if (opts.restauranteIds) {
    if (!opts.restauranteIds.length) return []; // owner sin locales
    where.push(`o.restaurante_id = any($${i++})`); params.push(opts.restauranteIds);
  }
  if (opts.soloActivas) { where.push(`o.estado = any($${i++})`); params.push(ORDENES_ACTIVAS); }
  const rows = await query<OrdenRow>(
    `select ${ORDEN_COLS}, r.nombre as restaurante_nombre
       from restaurante_ordenes o join restaurantes r on r.id = o.restaurante_id
      where ${where.join(' and ')}
      order by o.creado_at desc limit 200`,
    params,
  );
  return rows.map(toOrden);
}

export async function updateOrdenEstado(id: string, estado: OrdenEstado, motivo: string): Promise<OrdenRestaurante | null> {
  const setEntregada = estado === 'entregada' ? ', entregada_at = now()' : '';
  const rows = await query<OrdenRow>(
    `update restaurante_ordenes
        set estado = $2, rechazo_motivo = $3 ${setEntregada}
      where id = $1
      returning ${ordenColsAliased()}`,
    [id, estado, motivo],
  );
  if (!rows[0]) return null;
  return withRestauranteNombre(rows[0]);
}

// Helpers para returning sin join (columnas sin alias 'o.')
function ordenColsAliased(): string {
  return `id, restaurante_id, codigo, cliente_nombre, cliente_email, cliente_telefono,
    entrega_tipo, entrega_seccion, entrega_fila, entrega_asiento, notas, lineas,
    subtotal_crc, fee_crc, total_crc, estado, rechazo_motivo, creado_at, pagada_at, entregada_at`;
}

async function withRestauranteNombre(row: OrdenRow): Promise<OrdenRestaurante> {
  const orden = toOrden(row);
  const r = await query<{ nombre: string }>('select nombre from restaurantes where id = $1', [orden.restauranteId]);
  orden.restauranteNombre = r[0]?.nombre || '';
  return orden;
}
