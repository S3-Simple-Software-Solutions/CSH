import { env } from '../../config/env';
import { ApiError } from '../../core/errors';
import type { AdminUser } from '../usuarios/usuarios.data';
import { isRestaurantAdmin } from '../usuarios/usuarios.service';
import { getRestaurantesPaymentGateway } from './restaurantes.payments';
import { trySendConfirmacion } from './restaurantes.mail';
import type { Entrega, OrdenEstado, Restaurante } from './restaurantes.types';
import {
  confirmarOrden,
  deleteCategoria,
  deleteItem,
  deleteRestaurante,
  expirarOrden,
  findCategoriaById,
  findCategorias,
  findItemById,
  findItems,
  findOrdenById,
  findOrdenes,
  findOwners,
  findOwnerCandidates,
  grantRestaurantOwner,
  revokeRestaurantOwner,
  findRestauranteById,
  findRestaurantePublicoBySlug,
  findRestaurantes,
  findRestaurantesPublicos,
  getConfig,
  getOrdenPublica,
  iniciarOrdenPendiente,
  insertCategoria,
  insertItem,
  insertRestaurante,
  setConfig,
  setItemImagen,
  setProviderRef,
  setRestauranteImagen,
  updateCategoria,
  updateItem,
  updateOrdenEstado,
  updateRestaurante,
} from './restaurantes.repository';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appBaseUrl(): string {
  return String(env.MAIL_APP_URL || 'http://localhost:8088').replace(/\/$/, '');
}

// ---- Helpers puros (exportados para test unitario) ----

export function calcularTotales(subtotalCrc: number, feeCrc: number) {
  const subtotal = Math.max(0, Math.round(subtotalCrc));
  const fee = subtotal > 0 ? Math.max(0, Math.round(feeCrc)) : 0;
  return { subtotalCrc: subtotal, feeCrc: fee, totalCrc: subtotal + fee };
}

// Máquina de estados de la orden (solo transiciones manuales del restaurante).
const TRANSICIONES: Record<OrdenEstado, OrdenEstado[]> = {
  pendiente_pago: [],
  pendiente: ['en_preparacion', 'rechazada'],
  en_preparacion: ['listo', 'rechazada'],
  listo: ['entregada'],
  entregada: [],
  rechazada: [],
  cancelada: [],
};

export function puedeTransicionar(actual: OrdenEstado, nuevo: OrdenEstado): boolean {
  return (TRANSICIONES[actual] || []).includes(nuevo);
}

// ---- Validación / normalización de entrada ----

function normalizeEntrega(raw: any): Entrega {
  const tipo = raw?.tipo === 'asiento' ? 'asiento' : 'pickup';
  if (tipo === 'asiento') {
    const seccion = String(raw?.seccion || '').trim().slice(0, 40);
    const fila = String(raw?.fila || '').trim().slice(0, 20);
    const asiento = String(raw?.asiento || '').trim().slice(0, 20);
    if (!seccion || !fila || !asiento) {
      throw new ApiError(400, 'Para entrega en asiento indicá sección, fila y asiento');
    }
    return { tipo, seccion, fila, asiento };
  }
  return { tipo: 'pickup', seccion: '', fila: '', asiento: '' };
}

function normalizeLineas(raw: unknown): { itemId: string; cantidad: number }[] {
  if (!Array.isArray(raw)) throw new ApiError(400, 'Carrito inválido');
  const out: { itemId: string; cantidad: number }[] = [];
  for (const l of raw) {
    const itemId = String((l as any)?.itemId || '').trim();
    const cantidad = Math.round(Number((l as any)?.cantidad) || 0);
    if (itemId && cantidad > 0) out.push({ itemId, cantidad });
  }
  if (!out.length) throw new ApiError(400, 'Agregá al menos un producto al carrito');
  return out;
}

// ---- Público ----

export async function getPublicRestaurantes() {
  const restaurantes = (await findRestaurantesPublicos()).map((r) => ({
    slug: r.slug,
    nombre: r.nombre,
    descripcion: r.descripcion,
    ubicacion: r.ubicacion,
    imagenUrl: r.imagenUrl,
    abierto: r.abierto,
    tiempoPrepMin: r.tiempoPrepMin,
  }));
  return { restaurantes };
}

export async function getPublicRestaurante(slug: string) {
  const restaurante = await findRestaurantePublicoBySlug(String(slug || '').trim());
  if (!restaurante) throw new ApiError(404, 'Restaurante no encontrado');
  const [categorias, items, config] = await Promise.all([
    findCategorias(restaurante.id),
    findItems(restaurante.id, true),
    getConfig(),
  ]);
  return {
    restaurante: {
      slug: restaurante.slug,
      nombre: restaurante.nombre,
      descripcion: restaurante.descripcion,
      ubicacion: restaurante.ubicacion,
      imagenUrl: restaurante.imagenUrl,
      abierto: restaurante.abierto,
      tiempoPrepMin: restaurante.tiempoPrepMin,
    },
    categorias: categorias.map((c) => ({ id: c.id, nombre: c.nombre })),
    items: items.map((i) => ({
      id: i.id, categoriaId: i.categoriaId, nombre: i.nombre, descripcion: i.descripcion,
      precioCrc: i.precioCrc, imagenUrl: i.imagenUrl,
    })),
    feeCrc: config.feeCrcDefault,
  };
}

export async function iniciarCheckoutPublico(body: {
  slug?: unknown;
  lineas?: unknown;
  cliente?: { nombre?: unknown; email?: unknown; telefono?: unknown };
  entrega?: unknown;
  notas?: unknown;
}) {
  const slug = String(body.slug || '').trim();
  const nombre = String(body.cliente?.nombre || '').trim().slice(0, 80);
  const email = String(body.cliente?.email || '').trim().toLowerCase();
  const telefono = String(body.cliente?.telefono || '').trim().slice(0, 30);
  if (!nombre) throw new ApiError(400, 'Ingresá tu nombre');
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Ingresá un correo válido');
  const lineas = normalizeLineas(body.lineas);
  const entrega = normalizeEntrega(body.entrega);
  const notas = String(body.notas || '').trim().slice(0, 400);

  // Nota: el gateway se construye SOLO si hay monto a cobrar (su constructor
  // exige la llave de Stripe). Así la ruta gratuita funciona sin configurar pagos.
  const orden = await iniciarOrdenPendiente({
    slug, lineas, cliente: { nombre, email, telefono }, entrega, notas, provider: env.PAYMENTS_PROVIDER,
  });

  // Sin monto a cobrar (fee 0 + productos 0): confirmamos de una.
  if (orden.totalCrc <= 0) {
    const confirmada = await confirmarOrden(orden.ordenId, {
      transaccion: `CSH-FREE-${Date.now().toString(36).toUpperCase()}`, monto: 0, timestamp: new Date().toISOString(), metodo: 'gratis',
    });
    if (confirmada) await trySendConfirmacion(confirmada);
    return { url: `${appBaseUrl()}/comida/${encodeURIComponent(slug)}?orden=${encodeURIComponent(orden.ordenId)}`, ordenId: orden.ordenId, codigo: orden.codigo };
  }

  try {
    const gateway = getRestaurantesPaymentGateway();
    const successUrl = `${appBaseUrl()}/comida/${encodeURIComponent(slug)}?orden=${encodeURIComponent(orden.ordenId)}`;
    const cancelUrl = `${appBaseUrl()}/comida/${encodeURIComponent(slug)}?pago=cancelado`;
    const { url, providerRef } = await gateway.createCheckout({
      ordenId: orden.ordenId, lineas: orden.lineItems, comprador: { nombre, email }, successUrl, cancelUrl,
    });
    await setProviderRef(orden.ordenId, providerRef);
    return { url, ordenId: orden.ordenId, codigo: orden.codigo };
  } catch (err) {
    await expirarOrden(orden.ordenId).catch(() => { /* noop */ });
    console.error(`[pagos] Error creando checkout de comida para ${orden.ordenId}: ${(err as Error).message}`);
    throw new ApiError(502, 'No se pudo iniciar el pago. Intentá de nuevo.');
  }
}

// Webhook de la pasarela. Verifica firma (en parseWebhook) e ignora órdenes que
// no sean de este módulo (prefijo ROR-) o inexistentes (confirmarOrden → null).
export async function procesarWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  const gateway = getRestaurantesPaymentGateway();
  const evento = gateway.parseWebhook(rawBody, signature);

  if (!evento.ordenId || !evento.ordenId.startsWith('ROR-')) return; // orden de otro módulo/cuenta
  if (evento.type === 'paid' && evento.pago) {
    const orden = await confirmarOrden(evento.ordenId, evento.pago);
    if (orden) await trySendConfirmacion(orden);
    return;
  }
  if (evento.type === 'expired') {
    await expirarOrden(evento.ordenId);
  }
}

export async function consultarOrdenPublica(ref: string) {
  const orden = await getOrdenPublica(String(ref || '').trim());
  if (!orden) throw new ApiError(404, 'Orden no encontrada');
  // Vista pública: nunca exponemos datos sensibles del pago.
  return {
    ordenId: orden.id,
    codigo: orden.codigo,
    restaurante: orden.restauranteNombre,
    estado: orden.estado,
    entrega: orden.entrega,
    lineas: orden.lineas,
    subtotalCrc: orden.subtotalCrc,
    feeCrc: orden.feeCrc,
    totalCrc: orden.totalCrc,
    rechazoMotivo: orden.rechazoMotivo,
  };
}

// ---- Owner / Admin ----

// Autorización central: existe (404) y es del dueño o admin (403).
async function assertOwnRestaurante(user: AdminUser, restauranteId: string): Promise<Restaurante> {
  const r = await findRestauranteById(restauranteId);
  if (!r) throw new ApiError(404, 'Restaurante no encontrado');
  if (!isRestaurantAdmin(user) && r.ownerUserId !== user.id) {
    throw new ApiError(403, 'Solo podés administrar tus propios restaurantes');
  }
  return r;
}

export async function getAdminRestaurantes(user: AdminUser) {
  const admin = isRestaurantAdmin(user);
  const restaurantes = await findRestaurantes(admin ? undefined : user.id);
  const owners = admin ? await findOwners() : undefined;
  return { role: admin ? 'admin' : 'owner', restaurantes, owners };
}

export async function adminCrearRestaurante(body: any, user: AdminUser) {
  const nombre = String(body?.nombre || '').trim().slice(0, 80);
  if (!nombre) throw new ApiError(400, 'El nombre es obligatorio');
  const admin = isRestaurantAdmin(user);
  const ownerUserId = admin && body?.ownerUserId ? String(body.ownerUserId) : user.id;
  const restaurante = await insertRestaurante({
    nombre,
    descripcion: String(body?.descripcion || '').trim().slice(0, 500),
    ubicacion: String(body?.ubicacion || '').trim().slice(0, 120),
    tiempoPrepMin: Math.max(1, Math.min(240, Math.round(Number(body?.tiempoPrepMin) || 15))),
    ownerUserId,
  });
  return { restaurante };
}

export async function adminActualizarRestaurante(id: string, body: any, user: AdminUser) {
  await assertOwnRestaurante(user, id);
  const patch: any = {};
  if (body?.nombre !== undefined) patch.nombre = String(body.nombre).trim().slice(0, 80);
  if (body?.descripcion !== undefined) patch.descripcion = String(body.descripcion).trim().slice(0, 500);
  if (body?.ubicacion !== undefined) patch.ubicacion = String(body.ubicacion).trim().slice(0, 120);
  if (body?.tiempoPrepMin !== undefined) patch.tiempoPrepMin = Math.max(1, Math.min(240, Math.round(Number(body.tiempoPrepMin) || 15)));
  if (body?.abierto !== undefined) patch.abierto = Boolean(body.abierto);
  // El estado (activo/suspendido) es una decisión del club: solo admin.
  if (body?.estado !== undefined) {
    if (!isRestaurantAdmin(user)) throw new ApiError(403, 'Solo un administrador puede suspender un restaurante');
    patch.estado = body.estado === 'suspendido' ? 'suspendido' : 'activo';
  }
  const restaurante = await updateRestaurante(id, patch);
  return { restaurante };
}

export async function adminEliminarRestaurante(id: string, user: AdminUser) {
  const r = await assertOwnRestaurante(user, id);
  if (!isRestaurantAdmin(user)) throw new ApiError(403, 'Solo un administrador puede eliminar un restaurante');
  await deleteRestaurante(id);
  return { nombre: r.nombre };
}

// Para el handler de subida de imagen: valida ownership y devuelve el restaurante.
export async function adminGetRestauranteEditable(id: string, user: AdminUser): Promise<Restaurante> {
  return assertOwnRestaurante(user, id);
}

export async function adminSetRestauranteImagen(id: string, imagenUrl: string, user: AdminUser) {
  await assertOwnRestaurante(user, id);
  const restaurante = await setRestauranteImagen(id, imagenUrl);
  return { restaurante };
}

// Menú completo (incluye no disponibles) para el panel del dueño.
export async function adminGetMenu(restauranteId: string, user: AdminUser) {
  await assertOwnRestaurante(user, restauranteId);
  const [categorias, items] = await Promise.all([findCategorias(restauranteId), findItems(restauranteId, false)]);
  return { categorias, items };
}

// ---- Menú: categorías ----

export async function adminCrearCategoria(restauranteId: string, body: any, user: AdminUser) {
  await assertOwnRestaurante(user, restauranteId);
  const nombre = String(body?.nombre || '').trim().slice(0, 60);
  if (!nombre) throw new ApiError(400, 'El nombre de la categoría es obligatorio');
  const categoria = await insertCategoria(restauranteId, nombre, Math.round(Number(body?.orden) || 0));
  return { categoria };
}

export async function adminActualizarCategoria(id: string, body: any, user: AdminUser) {
  const cat = await findCategoriaById(id);
  if (!cat) throw new ApiError(404, 'Categoría no encontrada');
  await assertOwnRestaurante(user, cat.restauranteId);
  const categoria = await updateCategoria(id, {
    nombre: body?.nombre !== undefined ? String(body.nombre).trim().slice(0, 60) : undefined,
    orden: body?.orden !== undefined ? Math.round(Number(body.orden) || 0) : undefined,
  });
  return { categoria };
}

export async function adminEliminarCategoria(id: string, user: AdminUser) {
  const cat = await findCategoriaById(id);
  if (!cat) throw new ApiError(404, 'Categoría no encontrada');
  await assertOwnRestaurante(user, cat.restauranteId);
  await deleteCategoria(id);
  return { ok: true };
}

// ---- Menú: ítems ----

export async function adminCrearItem(restauranteId: string, body: any, user: AdminUser) {
  await assertOwnRestaurante(user, restauranteId);
  const nombre = String(body?.nombre || '').trim().slice(0, 80);
  if (!nombre) throw new ApiError(400, 'El nombre del producto es obligatorio');
  const item = await insertItem(restauranteId, {
    categoriaId: body?.categoriaId ? String(body.categoriaId) : null,
    nombre,
    descripcion: String(body?.descripcion || '').trim().slice(0, 300),
    precioCrc: Math.max(0, Math.round(Number(body?.precioCrc) || 0)),
    disponible: body?.disponible === undefined ? true : Boolean(body.disponible),
    orden: Math.round(Number(body?.orden) || 0),
  });
  return { item };
}

async function assertOwnItem(user: AdminUser, itemId: string) {
  const item = await findItemById(itemId);
  if (!item) throw new ApiError(404, 'Producto no encontrado');
  await assertOwnRestaurante(user, item.restauranteId);
  return item;
}

export async function adminActualizarItem(id: string, body: any, user: AdminUser) {
  await assertOwnItem(user, id);
  const patch: any = {};
  if (body?.categoriaId !== undefined) patch.categoriaId = body.categoriaId ? String(body.categoriaId) : null;
  if (body?.nombre !== undefined) patch.nombre = String(body.nombre).trim().slice(0, 80);
  if (body?.descripcion !== undefined) patch.descripcion = String(body.descripcion).trim().slice(0, 300);
  if (body?.precioCrc !== undefined) patch.precioCrc = Math.max(0, Math.round(Number(body.precioCrc) || 0));
  if (body?.disponible !== undefined) patch.disponible = Boolean(body.disponible);
  if (body?.orden !== undefined) patch.orden = Math.round(Number(body.orden) || 0);
  const item = await updateItem(id, patch);
  return { item };
}

export async function adminEliminarItem(id: string, user: AdminUser) {
  await assertOwnItem(user, id);
  await deleteItem(id);
  return { ok: true };
}

export async function adminGetItemEditable(id: string, user: AdminUser) {
  return assertOwnItem(user, id);
}

export async function adminSetItemImagen(id: string, imagenUrl: string, user: AdminUser) {
  await assertOwnItem(user, id);
  const item = await setItemImagen(id, imagenUrl);
  return { item };
}

// ---- Pedidos ----

export async function adminListOrdenes(user: AdminUser, opts: { restauranteId?: string; soloActivas: boolean }) {
  const admin = isRestaurantAdmin(user);
  if (opts.restauranteId) {
    await assertOwnRestaurante(user, opts.restauranteId);
    const ordenes = await findOrdenes({ restauranteIds: [opts.restauranteId], soloActivas: opts.soloActivas });
    return { ordenes };
  }
  if (admin) {
    const ordenes = await findOrdenes({ soloActivas: opts.soloActivas });
    return { ordenes };
  }
  // Owner sin filtro: pedidos de todos sus locales.
  const propios = await findRestaurantes(user.id);
  const ordenes = await findOrdenes({ restauranteIds: propios.map((r) => r.id), soloActivas: opts.soloActivas });
  return { ordenes };
}

export async function adminCambiarEstadoOrden(id: string, body: any, user: AdminUser) {
  const orden = await findOrdenById(id);
  if (!orden) throw new ApiError(404, 'Pedido no encontrado');
  await assertOwnRestaurante(user, orden.restauranteId);
  const nuevo = String(body?.estado || '') as OrdenEstado;
  if (!puedeTransicionar(orden.estado, nuevo)) {
    throw new ApiError(409, `No se puede pasar de "${orden.estado}" a "${nuevo}"`);
  }
  const motivo = nuevo === 'rechazada' ? String(body?.motivo || '').trim().slice(0, 200) : '';
  const actualizada = await updateOrdenEstado(id, nuevo, motivo);
  return { orden: actualizada };
}

// ---- Gestión de dueños (solo admin del club) ----

export async function adminListOwnerCandidates(user: AdminUser) {
  if (!isRestaurantAdmin(user)) throw new ApiError(403, 'Sin permiso');
  return { usuarios: await findOwnerCandidates() };
}

export async function adminGrantOwner(userId: string, user: AdminUser) {
  if (!isRestaurantAdmin(user)) throw new ApiError(403, 'Sin permiso');
  await grantRestaurantOwner(String(userId || '').trim());
  return { ok: true };
}

export async function adminRevokeOwner(userId: string, user: AdminUser) {
  if (!isRestaurantAdmin(user)) throw new ApiError(403, 'Sin permiso');
  await revokeRestaurantOwner(String(userId || '').trim());
  return { ok: true };
}

// ---- Config (solo admin) ----

export async function adminGetConfig(user: AdminUser) {
  if (!isRestaurantAdmin(user)) throw new ApiError(403, 'Sin permiso');
  return { config: await getConfig() };
}

export async function adminSetConfig(body: any, user: AdminUser) {
  if (!isRestaurantAdmin(user)) throw new ApiError(403, 'Sin permiso');
  const feeCrcDefault = Math.max(0, Math.round(Number(body?.feeCrcDefault) || 0));
  return { config: await setConfig(feeCrcDefault) };
}
