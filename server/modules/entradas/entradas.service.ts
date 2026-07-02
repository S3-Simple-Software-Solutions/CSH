import { ApiError } from '../../core/errors';
import { env } from '../../config/env';
import type { AdminUser } from '../usuarios/usuarios.data';
import { canManageEvents, canOperateGate, canViewSales } from '../usuarios/usuarios.service';
import { getEntradasRepository } from './entradas.repository';
import { sendEntradasEmail } from './entradas.mail';
import { extractCodigo } from './entradas.helpers';
import { CompraLinea, EventoInput, MapaBatchInput, MapaEventoInput, MapaTipoInput, MapPoint, MapRect, MapZoneKey, TipoInput } from './entradas.types';
import { isValidZoneKey, mapaFromZoneKey } from './entradas.erc.zones';
import { getPaymentGateway } from './payments/payments.factory';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_POR_LINEA = 10;
const MAX_BOLETOS = 20;

type Actor = { id: string; name: string; eventsRole: string };

function actorOf(user: AdminUser): Actor {
  return { id: user.id, name: user.name, eventsRole: user.eventsRole };
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function validateComprador(nombre: string, email: string): void {
  if (nombre.length < 3 || nombre.length > 80) throw new ApiError(400, 'Ingresa el nombre del comprador');
  if (!email || email.length > 120 || !EMAIL_RE.test(email)) throw new ApiError(400, 'Correo invalido');
}

function normalizeLineas(raw: unknown): CompraLinea[] {
  if (!Array.isArray(raw)) throw new ApiError(400, 'Selecciona al menos una entrada');
  const lineas: CompraLinea[] = [];
  let totalBoletos = 0;
  for (const item of raw) {
    const tipoId = String((item as any)?.tipoId || '').trim();
    const cantidad = Number((item as any)?.cantidad);
    if (!tipoId) continue;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_POR_LINEA) throw new ApiError(400, `Cantidad invalida (1-${MAX_POR_LINEA} por sector)`);
    totalBoletos += cantidad;
    lineas.push({ tipoId, cantidad });
  }
  if (lineas.length === 0 || totalBoletos === 0) throw new ApiError(400, 'Selecciona al menos una entrada');
  if (totalBoletos > MAX_BOLETOS) throw new ApiError(400, `Maximo ${MAX_BOLETOS} boletos por compra`);
  return lineas;
}

// ---- Público ----

export async function getPublicEventos() {
  return { eventos: await getEntradasRepository().publicEventos() };
}

export async function getPublicEvento(slug: string) {
  const data = await getEntradasRepository().publicEventoBySlug(String(slug || '').trim());
  if (!data) throw new ApiError(404, 'Evento no encontrado');
  return data;
}

// Inicia el checkout: reserva cupo (orden pendiente) y crea la sesión de pago
// hospedada en la pasarela. Devuelve la URL a la que el frontend redirige.
// El boleto NO se emite aquí: se materializa en el webhook al confirmar el pago.
export async function iniciarCheckoutPublico(body: { slug: string; lineas: unknown; comprador?: { nombre?: unknown; email?: unknown } }) {
  const slug = String(body.slug || '').trim();
  const nombre = String(body.comprador?.nombre || '').trim();
  const email = normalizeEmail(body.comprador?.email);
  validateComprador(nombre, email);
  const lineas = normalizeLineas(body.lineas);

  const repo = getEntradasRepository();
  const gateway = getPaymentGateway();
  const { ordenId, total, lineItems } = await repo.iniciarOrdenPendiente({ slug, lineas, comprador: { nombre, email }, provider: gateway.id });

  if (total <= 0) {
    // Eventos gratuitos: no hay pago que cobrar, se confirma de una vez.
    const resultado = await repo.confirmarOrden(ordenId, { transaccion: `CSH-FREE-${Date.now().toString(36).toUpperCase()}`, monto: 0, timestamp: new Date().toISOString(), metodo: 'gratis' });
    if (resultado) await trySendEntradas(email, resultado);
    return { url: `${appBaseUrl()}/entradas/${encodeURIComponent(slug)}?ref=${encodeURIComponent(ordenId)}`, ordenId };
  }

  try {
    const successUrl = `${appBaseUrl()}/entradas/${encodeURIComponent(slug)}?ref=${encodeURIComponent(ordenId)}`;
    const cancelUrl = `${appBaseUrl()}/entradas/${encodeURIComponent(slug)}?pago=cancelado`;
    const { url, providerRef } = await gateway.createCheckout({ ordenId, lineas: lineItems, comprador: { nombre, email }, successUrl, cancelUrl });
    await repo.setProviderRef(ordenId, providerRef);
    return { url, ordenId };
  } catch (err) {
    // Si la pasarela falla, liberamos el cupo reservado para no dejarlo colgado.
    await repo.expirarOrden(ordenId).catch(() => { /* noop */ });
    console.error(`[pagos] Error creando checkout para orden ${ordenId}: ${(err as Error).message}`);
    throw new ApiError(502, 'No se pudo iniciar el pago. Intenta de nuevo.');
  }
}

function appBaseUrl(): string {
  return String(env.MAIL_APP_URL || 'http://localhost:8088').replace(/\/$/, '');
}

async function trySendEntradas(email: string, resultado: { evento: any; boletos: any[] }): Promise<void> {
  try {
    await sendEntradasEmail({ to: email, evento: resultado.evento, boletos: resultado.boletos });
  } catch (err) {
    console.error(`[mail] Error enviando entradas a ${email}: ${(err as Error).message}`);
  }
}

// Procesa el webhook de la pasarela. Verifica la firma (dentro de parseWebhook),
// y al confirmar el pago materializa los boletos y envía el correo. Idempotente.
export async function procesarWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  const gateway = getPaymentGateway();
  const evento = gateway.parseWebhook(rawBody, signature); // lanza si la firma es inválida
  const repo = getEntradasRepository();

  if (evento.type === 'paid' && evento.ordenId && evento.pago) {
    const resultado = await repo.confirmarOrden(evento.ordenId, evento.pago);
    if (resultado) await trySendEntradas(resultado.orden.compradorEmail, resultado);
    return;
  }
  if (evento.type === 'expired' && evento.ordenId) {
    await repo.expirarOrden(evento.ordenId);
  }
}

// Estado de la orden para el polling de la página de retorno tras el pago.
export async function consultarOrdenPublica(ref: string) {
  const orden = await getEntradasRepository().getOrdenPublica(String(ref || '').trim());
  if (!orden) throw new ApiError(404, 'Orden no encontrada');
  return orden;
}

export async function consultaPublica(body: { email?: unknown; codigo?: unknown }) {
  const email = normalizeEmail(body.email);
  const codigo = extractCodigo(body.codigo);
  if (!codigo) throw new ApiError(400, 'Ingresa el codigo del boleto');
  const repo = getEntradasRepository();
  const boleto = await repo.getBoletoByCodigo(codigo);
  if (!boleto) throw new ApiError(404, 'Boleto no encontrado');
  const orden = await repo.getOrden(boleto.ordenId);
  if (!orden || (email && orden.compradorEmail !== email)) throw new ApiError(403, 'El correo no coincide con el boleto');
  return {
    codigo: boleto.codigo,
    estado: boleto.estado,
    tipoNombre: boleto.tipoNombre,
    eventoNombre: boleto.eventoNombre,
    validadoAt: boleto.validadoAt,
  };
}

export async function reenviarPublico(body: { codigo?: unknown }) {
  const codigo = extractCodigo(body.codigo);
  if (!codigo) throw new ApiError(400, 'Ingresa el codigo del boleto');
  const repo = getEntradasRepository();
  const boleto = await repo.getBoletoByCodigo(codigo);
  if (!boleto) throw new ApiError(404, 'Boleto no encontrado');
  const orden = await repo.getOrden(boleto.ordenId);
  if (!orden) throw new ApiError(404, 'Orden no encontrada');
  const data = await repo.adminGetEvento(orden.eventoId);
  if (!data) throw new ApiError(404, 'Evento no encontrado');
  const boletos = await repo.getOrdenBoletos(orden.id);
  await sendEntradasEmail({ to: orden.compradorEmail, evento: data.evento, boletos });
  await repo.logEvento('reenvio', { eventoId: orden.eventoId, user: { id: null, name: 'Consulta publica' }, notas: `Reenvio a ${orden.compradorEmail}` });
  const masked = orden.compradorEmail.replace(/^(.{2}).*(@.*)$/, '$1***$2');
  return { correo: masked, boletos: boletos.length };
}

// ---- Admin ----

export async function adminListEventos() {
  return { eventos: await getEntradasRepository().adminListEventos() };
}

export async function adminGetEvento(id: string) {
  const data = await getEntradasRepository().adminGetEvento(String(id));
  if (!data) throw new ApiError(404, 'Evento no encontrado');
  return data;
}

function buildEventoInput(body: any): EventoInput {
  const nombre = String(body?.nombre || '').trim();
  if (nombre.length < 3) throw new ApiError(400, 'Nombre del evento muy corto');
  const fecha = String(body?.fecha || '').trim();
  if (!fecha || Number.isNaN(new Date(fecha).getTime())) throw new ApiError(400, 'Fecha invalida');
  const rawFormato = String(body?.formato || '').trim();
  const formato = rawFormato === 'espectaculo' ? 'espectaculo' : 'partido';
  return {
    nombre,
    descripcion: String(body?.descripcion || '').trim(),
    venue: String(body?.venue || '').trim(),
    fecha,
    imagenUrl: String(body?.imagenUrl || '').trim(),
    formato,
  };
}

export async function adminCrearEvento(body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para gestionar eventos');
  const evento = await getEntradasRepository().crearEvento(buildEventoInput(body));
  await getEntradasRepository().logEvento('evento_creado', { eventoId: evento.id, user: actorOf(user), notas: evento.nombre });
  return { evento };
}

export async function adminActualizarEvento(id: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para gestionar eventos');
  const evento = await getEntradasRepository().actualizarEvento(String(id), buildEventoInput(body));
  await getEntradasRepository().logEvento('evento_actualizado', { eventoId: evento.id, user: actorOf(user), notas: evento.nombre });
  return { evento };
}

export async function adminSetEstado(id: string, estado: unknown, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para gestionar eventos');
  const evento = await getEntradasRepository().setEstadoEvento(String(id), String(estado || ''));
  await getEntradasRepository().logEvento('evento_estado', { eventoId: evento.id, user: actorOf(user), notas: `Estado: ${evento.estado}` });
  return { evento };
}

function buildTipoInput(body: any): TipoInput {
  const nombre = String(body?.nombre || '').trim();
  if (nombre.length < 2) throw new ApiError(400, 'Nombre del sector muy corto');
  const precioCrc = Number(body?.precioCrc);
  if (!Number.isInteger(precioCrc) || precioCrc < 0 || precioCrc > 10000000) throw new ApiError(400, 'Precio invalido');
  const stockTotal = Number(body?.stockTotal);
  if (!Number.isInteger(stockTotal) || stockTotal < 0 || stockTotal > 200000) throw new ApiError(400, 'Stock invalido');
  const estado = body?.estado === 'inactivo' ? 'inactivo' : 'activo';
  return { nombre, precioCrc, stockTotal, estado };
}

export async function adminCrearTipo(eventoId: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para gestionar eventos');
  let tipo = await getEntradasRepository().crearTipo(String(eventoId), buildTipoInput(body));
  const zoneKey = String(body?.zoneKey || '').trim();
  if (zoneKey && isValidZoneKey(zoneKey)) {
    const mapa = mapaFromZoneKey(zoneKey);
    if (mapa) tipo = await getEntradasRepository().actualizarMapaTipo(tipo.id, mapa);
  }
  await getEntradasRepository().logEvento('sector_creado', {
    eventoId: tipo.eventoId,
    user: actorOf(user),
    notas: `${tipo.nombre} · CRC ${tipo.precioCrc} · cupo ${tipo.stockTotal}`,
  });
  return { tipo };
}

export async function adminActualizarTipo(id: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para gestionar eventos');
  const input = buildTipoInput(body);
  const tipo = await getEntradasRepository().actualizarTipo(String(id), input);
  await getEntradasRepository().logEvento('sector_actualizado', {
    eventoId: tipo.eventoId,
    user: actorOf(user),
    notas: `${tipo.nombre} · ${tipo.estado} · CRC ${tipo.precioCrc} · ${tipo.stockVendido}/${tipo.stockTotal}`,
  });
  return { tipo };
}

export async function adminVentas(user: AdminUser) {
  if (!canViewSales(user)) throw new ApiError(403, 'Sin permiso para ver ventas');
  return { eventos: await getEntradasRepository().adminListEventos() };
}

export async function adminVentasEvento(eventoId: string, user: AdminUser) {
  if (!canViewSales(user)) throw new ApiError(403, 'Sin permiso para ver ventas');
  const repo = getEntradasRepository();
  const ventas = await repo.ventasEvento(String(eventoId));
  if (!ventas) throw new ApiError(404, 'Evento no encontrado');
  const ventasPorDia = await repo.ventasPorDiaEvento(String(eventoId));
  return { ...ventas, ventasPorDia };
}

export async function adminValidar(body: { codigo?: unknown }, user: AdminUser) {
  if (!canOperateGate(user)) throw new ApiError(403, 'Sin permiso para validar en puerta');
  const codigo = extractCodigo(body.codigo);
  if (!codigo) throw new ApiError(400, 'Ingresa o escanea un codigo');
  const boleto = await getEntradasRepository().validarBoleto(codigo, actorOf(user));
  return { boleto };
}

export async function adminCortesia(body: { eventoId?: unknown; tipoId?: unknown; nombre?: unknown; email?: unknown }, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para emitir cortesias');
  const eventoId = String(body.eventoId || '').trim();
  const tipoId = String(body.tipoId || '').trim();
  const nombre = String(body.nombre || '').trim();
  const email = normalizeEmail(body.email);
  if (!eventoId || !tipoId) throw new ApiError(400, 'Selecciona evento y sector');
  validateComprador(nombre, email);
  const repo = getEntradasRepository();
  const resultado = await repo.emitirCortesia(eventoId, tipoId, { nombre, email }, actorOf(user));
  let emailSent = false;
  try {
    await sendEntradasEmail({ to: email, evento: resultado.evento, boletos: resultado.boletos });
    emailSent = true;
  } catch (err) {
    console.error(`[mail] Error enviando cortesia a ${email}: ${(err as Error).message}`);
  }
  return { boleto: resultado.boletos[0], emailSent };
}

export async function adminLog(opts: { limit: number; offset: number; eventoId?: string }, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para ver el log');
  return getEntradasRepository().listLog(opts);
}

// ── Mapa de zonas ────────────────────────────────────────────────

function inUnit(n: number): boolean {
  return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 1;
}

function validateMapaTipo(input: MapaTipoInput): void {
  if (input.shape === 'rect') {
    const r = input.points as MapRect;
    if (!inUnit(r.x) || !inUnit(r.y) || typeof r.w !== 'number' || r.w <= 0 || typeof r.h !== 'number' || r.h <= 0)
      throw new ApiError(400, 'Rect inválido: x,y en [0,1] y w,h > 0');
    if (r.x + r.w > 1.001 || r.y + r.h > 1.001)
      throw new ApiError(400, 'Rect sale del mapa (x+w o y+h > 1)');
  } else if (input.shape === 'polygon') {
    const pts = input.points as MapPoint[];
    if (!Array.isArray(pts) || pts.length < 3)
      throw new ApiError(400, 'Polygon requiere al menos 3 puntos');
    for (const p of pts) {
      if (!inUnit(p.x) || !inUnit(p.y)) throw new ApiError(400, 'Punto de polígono fuera de [0,1]');
    }
  } else if (input.shape === 'zone') {
    const z = input.points as MapZoneKey;
    if (!z?.key || !isValidZoneKey(z.key))
      throw new ApiError(400, `Zona inválida: ${z?.key ?? 'sin key'}`);
  } else {
    throw new ApiError(400, `Shape inválido: ${input.shape}`);
  }
}

export async function adminGetMapaEvento(eventoId: string, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const result = await getEntradasRepository().getMapaEvento(eventoId);
  if (!result) throw new ApiError(404, 'Evento no encontrado');
  return result;
}

export async function adminActualizarMapaEvento(eventoId: string, rawInput: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const input: MapaEventoInput = { mapImageUrl: rawInput.mapImageUrl };
  if ('fieldTemplate' in rawInput) {
    const t = rawInput.fieldTemplate;
    if (t !== null && !['2', '3', '4'].includes(String(t)))
      throw new ApiError(400, 'fieldTemplate debe ser "2", "3" o "4"');
    input.fieldTemplate = t === null ? null : String(t);
  }
  if ('fieldSplits' in rawInput) {
    const s = rawInput.fieldSplits;
    if (s !== null) {
      if (!Array.isArray(s) || s.some((v: any) => typeof v !== 'number' || v <= 0 || v >= 1))
        throw new ApiError(400, 'fieldSplits debe ser array de números en (0,1)');
    }
    input.fieldSplits = s;
  }
  return getEntradasRepository().actualizarMapaEvento(eventoId, input);
}

export async function adminActualizarMapaTipo(tipoId: string, input: MapaTipoInput | null, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  if (input !== null) validateMapaTipo(input);
  return getEntradasRepository().actualizarMapaTipo(tipoId, input);
}

export async function adminGuardarMapaBatch(eventoId: string, input: MapaBatchInput, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  for (const item of input.tipos) {
    if (item.mapa !== null) validateMapaTipo(item.mapa);
  }
  return getEntradasRepository().guardarMapaBatch(eventoId, input);
}
