import { ApiError } from '../../core/errors';
import { env } from '../../config/env';
import type { AdminUser } from '../usuarios/usuarios.data';
import { canManageEvents, canOperateGate, canViewSales } from '../usuarios/usuarios.service';
import { getEntradasRepository, EntradasRepository } from './entradas.repository';
import { sendEntradasEmail } from './entradas.mail';
import { sendEntradasWhatsApp } from './entradas.whatsapp';
import { aplicarTemplate, serializeEvento, validatePayload } from './entradas.templates';
import { isWhatsAppEnabled, normalizePhone } from '../../core/whatsapp';
import type { Boleto } from './entradas.types';
import {
  calcularTotales,
  DescuentoAplicado,
  extractCodigo,
  FeeConfig,
  normalizeCodigo,
  Totales,
} from './entradas.helpers';
import {
  ComisionTipo,
  CompraLinea,
  Descuento,
  DescuentoInput,
  DescuentoTipo,
  Evento,
  EventoInput,
  FeeTipo,
  MapaBatchInput,
  MapaEventoInput,
  MapaTipoInput,
  MapPoint,
  MapRect,
  MapZoneKey,
  PromotorInput,
  TandaInput,
  TicketType,
  TipoInput,
} from './entradas.types';
import { isValidZoneKey, mapaFromZoneKey } from './entradas.erc.zones';
import { getPaymentGateway } from './payments/payments.factory';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_POR_LINEA = 10;
const MAX_BOLETOS = 20;

type Actor = { id: string; name: string; eventsRole: string };

function safeLogValue(value: unknown): string {
  return String(value ?? '').replace(/[\r\n\u2028\u2029]/g, ' ');
}

// Envío WhatsApp best-effort: nunca afecta la compra ni el email.
async function tryWhatsApp(telefono: string | null | undefined, evento: Evento, boletos: Boleto[]): Promise<boolean> {
  if (!telefono || !isWhatsAppEnabled()) return false;
  try {
    await sendEntradasWhatsApp({ to: telefono, evento, boletos });
    return true;
  } catch (err) {
    console.error(`[whatsapp] Error enviando entradas a ${safeLogValue(telefono)}: ${safeLogValue((err as Error).message)}`);
    return false;
  }
}

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
    if (!tipoId) continue;
    // Sectores numerados: la cantidad se deriva de las butacas elegidas.
    const rawAsientos = (item as any)?.asientos;
    const asientos = Array.isArray(rawAsientos)
      ? [...new Set(rawAsientos.map((a: unknown) => String(a || '').trim()).filter(Boolean))]
      : undefined;
    const cantidad = asientos && asientos.length > 0 ? asientos.length : Number((item as any)?.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_POR_LINEA) throw new ApiError(400, `Cantidad invalida (1-${MAX_POR_LINEA} por sector)`);
    totalBoletos += cantidad;
    lineas.push({ tipoId, cantidad, asientos: asientos && asientos.length > 0 ? asientos : undefined });
  }
  if (lineas.length === 0 || totalBoletos === 0) throw new ApiError(400, 'Selecciona al menos una entrada');
  if (totalBoletos > MAX_BOLETOS) throw new ApiError(400, `Maximo ${MAX_BOLETOS} boletos por compra`);
  return lineas;
}

// ---- Fee + descuentos ----

async function resolveFeeForEvento(_repo: EntradasRepository, evento: Evento): Promise<FeeConfig> {
  if (evento.feeTipo) return { tipo: evento.feeTipo, valor: evento.feeValor ?? 0 };
  // Cargo por servicio global eliminado: si el evento no define su propio cargo, no hay cargo.
  return { tipo: 'ninguno', valor: 0 };
}

// Valida (sin consumir) un código de descuento para un evento. Lanza 400 si no aplica.
function assertDescuentoAplica(d: Descuento, eventoId: string): DescuentoAplicado {
  if (!d.activo) throw new ApiError(400, 'El código de descuento está inactivo');
  if (d.eventoId && d.eventoId !== eventoId) throw new ApiError(400, 'El código no aplica a este evento');
  const now = Date.now();
  if (d.vigenciaDesde && new Date(d.vigenciaDesde).getTime() > now) throw new ApiError(400, 'El código aún no está vigente');
  if (d.vigenciaHasta && new Date(d.vigenciaHasta).getTime() < now) throw new ApiError(400, 'El código de descuento venció');
  if (d.usosMax != null && d.usosActuales >= d.usosMax) throw new ApiError(400, 'El código de descuento se agotó');
  return { tipo: d.tipo, valor: d.valor };
}

// Recalcula subtotal/fee/descuento en el servidor a partir de los tipos reales.
async function computeTotales(
  repo: EntradasRepository,
  evento: Evento,
  tipos: TicketType[],
  lineas: CompraLinea[],
  descuentoCodigo: string | null,
): Promise<{ totales: Totales; descAplicado: DescuentoAplicado | null }> {
  const tipoMap = new Map(tipos.map((t) => [t.id, t]));
  let subtotal = 0;
  for (const linea of lineas) {
    const tipo = tipoMap.get(linea.tipoId);
    if (!tipo) throw new ApiError(404, 'Tipo de entrada no encontrado');
    // Preventa: el precio vigente puede venir de una tanda activa.
    subtotal += (tipo.precioVigente ?? tipo.precioCrc) * linea.cantidad;
  }
  const fee = await resolveFeeForEvento(repo, evento);
  let descAplicado: DescuentoAplicado | null = null;
  if (descuentoCodigo) {
    const d = await repo.getDescuentoByCodigo(descuentoCodigo);
    if (!d) throw new ApiError(400, 'Código de descuento no encontrado');
    descAplicado = assertDescuentoAplica(d, evento.id);
  }
  return { totales: calcularTotales(subtotal, fee, descAplicado), descAplicado };
}

export async function validarDescuentoPublico(body: { slug?: unknown; lineas?: unknown; codigo?: unknown }) {
  const slug = String(body.slug || '').trim();
  const codigo = normalizeCodigo(body.codigo);
  if (!codigo) throw new ApiError(400, 'Ingresa un código de descuento');
  const lineas = normalizeLineas(body.lineas);
  const repo = getEntradasRepository();
  const data = await repo.publicEventoBySlug(slug);
  if (!data) throw new ApiError(404, 'Evento no disponible');
  const { totales } = await computeTotales(repo, data.evento, data.tipos, lineas, codigo);
  return { codigo, ...totales };
}

// ---- Público ----

export async function getPublicEventos() {
  return { eventos: await getEntradasRepository().publicEventos() };
}

export async function getPublicEvento(slug: string) {
  const repo = getEntradasRepository();
  const data = await repo.publicEventoBySlug(String(slug || '').trim());
  if (!data) throw new ApiError(404, 'Evento no encontrado');
  // Fee efectivo (override del evento o default global) para mostrar el desglose en el checkout.
  const fee = await resolveFeeForEvento(repo, data.evento);
  return { ...data, fee };
}

// Inicia el checkout: reserva cupo (orden pendiente con tandas, descuento, fee,
// butacas y atribución RRPP) y crea la sesión de pago hospedada en la pasarela.
// Devuelve la URL a la que el frontend redirige. El boleto NO se emite aquí:
// se materializa en el webhook al confirmar el pago.
export async function iniciarCheckoutPublico(body: { slug: string; lineas: unknown; comprador?: { nombre?: unknown; email?: unknown; telefono?: unknown; notifWhatsapp?: unknown }; descuentoCodigo?: unknown; holdId?: unknown; ref?: unknown }) {
  const slug = String(body.slug || '').trim();
  const nombre = String(body.comprador?.nombre || '').trim();
  const email = normalizeEmail(body.comprador?.email);
  validateComprador(nombre, email);
  const lineas = normalizeLineas(body.lineas);
  const descuentoCodigo = body.descuentoCodigo ? normalizeCodigo(body.descuentoCodigo) : null;
  const holdId = body.holdId ? String(body.holdId).trim() : null;
  const refCodigo = body.ref ? normalizeCodigo(body.ref) : null;
  // WhatsApp opt-in: solo se guarda/notifica con consentimiento y teléfono válido.
  const notifWhatsapp = Boolean(body.comprador?.notifWhatsapp);
  const telefono = notifWhatsapp ? normalizePhone(body.comprador?.telefono) : '';
  if (notifWhatsapp && !telefono) throw new ApiError(400, 'Ingresa un teléfono válido para WhatsApp (8 dígitos CR o formato internacional)');

  const repo = getEntradasRepository();
  const gateway = getPaymentGateway();
  // El repositorio es la fuente autoritativa: recalcula precios (tandas), consume
  // descuento, resuelve fee, atribuye promotor y toma el hold de butacas.
  const { ordenId, total, lineItems, desglose } = await repo.iniciarOrdenPendiente({
    slug,
    lineas,
    comprador: { nombre, email, telefono: telefono || null, notifWhatsapp },
    provider: gateway.id,
    descuentoCodigo,
    holdId,
    refCodigo,
  });

  if (total <= 0) {
    // Compras gratuitas (100% descuento o precio 0): no hay pago que cobrar.
    const resultado = await repo.confirmarOrden(ordenId, { transaccion: `CSH-FREE-${Date.now().toString(36).toUpperCase()}`, monto: 0, timestamp: new Date().toISOString(), metodo: 'gratis' });
    if (resultado) await trySendEntradas(email, resultado);
    return { url: `${appBaseUrl()}/entradas/${encodeURIComponent(slug)}?orden=${encodeURIComponent(ordenId)}`, ordenId, desglose };
  }

  try {
    // Nota: el retorno usa ?orden= (no ?ref=) para no chocar con el código de
    // promotor RRPP que viaja como ?ref=CODIGO en los links compartidos.
    const successUrl = `${appBaseUrl()}/entradas/${encodeURIComponent(slug)}?orden=${encodeURIComponent(ordenId)}`;
    const cancelUrl = `${appBaseUrl()}/entradas/${encodeURIComponent(slug)}?pago=cancelado`;
    const { url, providerRef } = await gateway.createCheckout({ ordenId, lineas: lineItems, comprador: { nombre, email }, successUrl, cancelUrl });
    await repo.setProviderRef(ordenId, providerRef);
    return { url, ordenId, desglose };
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

// Envía los boletos por correo y, si el comprador dio consentimiento, por WhatsApp.
async function trySendEntradas(email: string, resultado: { orden?: any; evento: any; boletos: any[] }): Promise<void> {
  try {
    await sendEntradasEmail({ to: email, evento: resultado.evento, boletos: resultado.boletos });
  } catch (err) {
    console.error(`[mail] Error enviando entradas a ${safeLogValue(email)}: ${safeLogValue((err as Error).message)}`);
  }
  const orden = resultado.orden;
  if (orden?.notifWhatsapp && orden?.compradorTelefono) {
    await tryWhatsApp(orden.compradorTelefono, resultado.evento, resultado.boletos);
  }
}

// Procesa el webhook de la pasarela. Verifica la firma (dentro de parseWebhook),
// y al confirmar el pago materializa los boletos y envía correo/WhatsApp. Idempotente.
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

// ── Asientos numerados (P2) ──────────────────────────────────────

export async function getAsientosPublico(slug: string) {
  return { asientos: await getEntradasRepository().getAsientosPublico(String(slug || '').trim()) };
}

export async function reservarAsientosPublico(body: { slug?: unknown; asientos?: unknown }) {
  const slug = String(body.slug || '').trim();
  if (!Array.isArray(body.asientos)) throw new ApiError(400, 'Selecciona tus asientos');
  const asientos = [...new Set(body.asientos.map((a: unknown) => String(a || '').trim()).filter(Boolean))];
  if (asientos.length === 0) throw new ApiError(400, 'Selecciona tus asientos');
  if (asientos.length > MAX_BOLETOS) throw new ApiError(400, `Maximo ${MAX_BOLETOS} asientos por compra`);
  return getEntradasRepository().reservarAsientos(slug, asientos);
}

export async function adminListAsientos(tipoId: string, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  return { asientos: await getEntradasRepository().listAsientosTipo(String(tipoId)) };
}

export async function adminGenerarAsientos(tipoId: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const filas = Number(body?.filas);
  const porFila = Number(body?.porFila);
  if (!Number.isInteger(filas) || filas < 1 || filas > 100) throw new ApiError(400, 'Filas inválidas (1-100)');
  if (!Number.isInteger(porFila) || porFila < 1 || porFila > 100) throw new ApiError(400, 'Asientos por fila inválidos (1-100)');
  if (filas * porFila > 5000) throw new ApiError(400, 'Máximo 5000 butacas por sector');
  const result = await getEntradasRepository().generarAsientos(String(tipoId), { filas, porFila });
  await getEntradasRepository().logEvento('asientos_generados', {
    eventoId: result.tipo.eventoId,
    user: actorOf(user),
    notas: `${result.tipo.nombre}: ${filas}×${porFila} = ${result.total} butacas`,
  });
  return result;
}

export async function adminSetEstadoAsiento(asientoId: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const estado = String(body?.estado || '').trim();
  if (estado !== 'disponible' && estado !== 'bloqueado') throw new ApiError(400, 'Estado inválido (disponible|bloqueado)');
  const asiento = await getEntradasRepository().setEstadoAsiento(String(asientoId), estado);
  await getEntradasRepository().logEvento('asiento_estado', {
    eventoId: asiento.eventoId,
    user: actorOf(user),
    notas: `${asiento.fila}${asiento.numero}: ${estado}`,
  });
  return { asiento };
}

export async function adminSetEstadoAsientosBulk(body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const estado = String(body?.estado || '').trim();
  if (estado !== 'disponible' && estado !== 'bloqueado') throw new ApiError(400, 'Estado inválido (disponible|bloqueado)');
  const ids: string[] = Array.isArray(body?.ids)
    ? [...new Set(body.ids.map((id: unknown) => String(id)).filter(Boolean))] as string[]
    : [];
  if (ids.length === 0) throw new ApiError(400, 'Seleccioná al menos una butaca');
  if (ids.length > 5000) throw new ApiError(400, 'Máximo 5000 butacas por operación');
  const repo = getEntradasRepository();
  let eventoId: string | null = null;
  let actualizados = 0;
  let omitidos = 0;
  for (const id of ids) {
    try {
      const asiento = await repo.setEstadoAsiento(id, estado as 'disponible' | 'bloqueado');
      eventoId = asiento.eventoId;
      actualizados += 1;
    } catch {
      omitidos += 1; // vendidas o inexistentes: no interrumpen el resto
    }
  }
  if (eventoId) {
    await repo.logEvento('asiento_estado', {
      eventoId,
      user: actorOf(user),
      notas: `selección múltiple: ${actualizados} butacas → ${estado}${omitidos ? ` (${omitidos} omitidas)` : ''}`,
    });
  }
  return { actualizados, omitidos };
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
  if (orden.notifWhatsapp) await tryWhatsApp(orden.compradorTelefono, data.evento, boletos);
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

export async function adminGetEventoEditable(id: string, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para gestionar eventos');
  return adminGetEvento(id);
}

function buildEventoInput(body: any): EventoInput {
  const nombre = String(body?.nombre || '').trim();
  if (nombre.length < 3) throw new ApiError(400, 'Nombre del evento muy corto');
  const fecha = String(body?.fecha || '').trim();
  if (!fecha || Number.isNaN(new Date(fecha).getTime())) throw new ApiError(400, 'Fecha invalida');
  // Sin formato en el body => undefined: los PUT parciales (p.ej. editar solo
  // datos básicos) no deben resetear el formato del evento.
  const rawFormato = String(body?.formato || '').trim();
  const formato = rawFormato === 'espectaculo' ? 'espectaculo' as const : rawFormato === 'partido' ? 'partido' as const : undefined;
  const fee = parseFee(body);
  return {
    nombre,
    descripcion: String(body?.descripcion || '').trim(),
    venue: String(body?.venue || '').trim(),
    fecha,
    imagenUrl: String(body?.imagenUrl || '').trim(),
    formato,
    feeTipo: fee.tipo,
    feeValor: fee.valor,
  };
}

// Normaliza el fee de un body. feeTipo vacío/null => null (usa el default global).
function parseFee(body: any): { tipo: FeeTipo | null; valor: number | null } {
  const raw = String(body?.feeTipo ?? '').trim();
  if (!raw) return { tipo: null, valor: null };
  if (!['pct', 'crc', 'ninguno'].includes(raw)) throw new ApiError(400, 'Tipo de cargo inválido');
  if (raw === 'ninguno') return { tipo: 'ninguno', valor: 0 };
  const valor = Number(body?.feeValor);
  if (!Number.isFinite(valor) || valor < 0) throw new ApiError(400, 'Valor de cargo inválido');
  if (raw === 'pct' && valor > 100) throw new ApiError(400, 'El porcentaje no puede superar 100');
  return { tipo: raw as FeeTipo, valor: Math.round(valor) };
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

export async function adminActualizarFlyer(id: string, imagenUrl: string, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para gestionar eventos');
  const evento = await getEntradasRepository().actualizarEvento(String(id), { imagenUrl });
  await getEntradasRepository().logEvento('evento_actualizado', {
    eventoId: evento.id,
    user: actorOf(user),
    notas: `Flyer actualizado: ${evento.nombre}`,
  });
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
  // Nota: `numerado` NO se acepta por este endpoint. El invariante es que solo
  // generarAsientos lo activa (con grilla real); si no, se venderían asientos
  // inexistentes o se desincronizaría un sector con butacas ya vendidas.
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

export async function adminEliminarTipo(id: string, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para gestionar eventos');
  const borrado = await getEntradasRepository().eliminarTipo(String(id));
  await getEntradasRepository().logEvento('sector_eliminado', {
    eventoId: borrado.eventoId,
    user: actorOf(user),
    notas: borrado.nombre,
  });
  return { eventoId: borrado.eventoId };
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

export async function adminCortesia(body: { eventoId?: unknown; tipoId?: unknown; nombre?: unknown; email?: unknown; telefono?: unknown }, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para emitir cortesias');
  const eventoId = String(body.eventoId || '').trim();
  const tipoId = String(body.tipoId || '').trim();
  const nombre = String(body.nombre || '').trim();
  const email = normalizeEmail(body.email);
  const telefono = normalizePhone(body.telefono);
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
  const whatsappSent = await tryWhatsApp(telefono || null, resultado.evento, resultado.boletos);
  return { boleto: resultado.boletos[0], emailSent, whatsappSent };
}

export async function adminLog(opts: { limit: number; offset: number; eventoId?: string }, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso para ver el log');
  return getEntradasRepository().listLog(opts);
}

// ── Tandas / preventa ────────────────────────────────────────────

function buildTandaInput(body: any): TandaInput {
  const nombre = String(body?.nombre || '').trim();
  if (nombre.length < 2 || nombre.length > 60) throw new ApiError(400, 'Nombre de tanda inválido (2-60 caracteres)');
  const precioCrc = Number(body?.precioCrc);
  if (!Number.isInteger(precioCrc) || precioCrc < 0 || precioCrc > 10000000) throw new ApiError(400, 'Precio de tanda inválido');
  const cupo = body?.cupo == null || body?.cupo === '' ? null : Number(body.cupo);
  if (cupo != null && (!Number.isInteger(cupo) || cupo < 1)) throw new ApiError(400, 'Cupo de tanda inválido');
  const ventaDesde = body?.ventaDesde ? String(body.ventaDesde) : null;
  const ventaHasta = body?.ventaHasta ? String(body.ventaHasta) : null;
  if (ventaDesde && Number.isNaN(new Date(ventaDesde).getTime())) throw new ApiError(400, 'Fecha "desde" inválida');
  if (ventaHasta && Number.isNaN(new Date(ventaHasta).getTime())) throw new ApiError(400, 'Fecha "hasta" inválida');
  if (ventaDesde && ventaHasta && new Date(ventaDesde) >= new Date(ventaHasta)) throw new ApiError(400, 'La ventana de venta es inválida (desde >= hasta)');
  const orden = body?.orden == null || body?.orden === '' ? undefined : Number(body.orden);
  if (orden !== undefined && (!Number.isInteger(orden) || orden < 0)) throw new ApiError(400, 'Orden inválido');
  return { nombre, precioCrc, ventaDesde, ventaHasta, cupo, orden };
}

export async function adminListTandas(tipoId: string, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  return { tandas: await getEntradasRepository().listTandas(String(tipoId)) };
}

export async function adminCrearTanda(tipoId: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const tanda = await getEntradasRepository().crearTanda(String(tipoId), buildTandaInput(body));
  await getEntradasRepository().logEvento('tanda_creada', { user: actorOf(user), notas: `${tanda.nombre} · CRC ${tanda.precioCrc}` });
  return { tanda };
}

export async function adminActualizarTanda(id: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const tanda = await getEntradasRepository().actualizarTanda(String(id), buildTandaInput(body));
  await getEntradasRepository().logEvento('tanda_actualizada', { user: actorOf(user), notas: `${tanda.nombre} · CRC ${tanda.precioCrc}` });
  return { tanda };
}

export async function adminEliminarTanda(id: string, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  await getEntradasRepository().eliminarTanda(String(id));
  await getEntradasRepository().logEvento('tanda_eliminada', { user: actorOf(user), notas: String(id) });
  return { ok: true };
}

// ── Templates de evento ──────────────────────────────────────────

function validateTemplateNombre(raw: unknown): string {
  const nombre = String(raw || '').trim();
  if (nombre.length < 3 || nombre.length > 80) throw new ApiError(400, 'Nombre de template inválido (3-80 caracteres)');
  return nombre;
}

export async function adminListTemplates(user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const templates = await getEntradasRepository().listTemplates();
  // La lista no necesita el payload completo; se resume para la UI.
  return {
    templates: templates.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
      creadoAt: t.creadoAt,
      formato: t.payload?.formato ?? 'partido',
      sectores: t.payload?.sectores?.length ?? 0,
      numerados: t.payload?.sectores?.filter((s) => s.numerado).length ?? 0,
    })),
  };
}

export async function adminCrearTemplate(body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const nombre = validateTemplateNombre(body?.nombre);
  const payload = validatePayload(body?.payload);
  const template = await getEntradasRepository().crearTemplate(nombre, String(body?.descripcion || '').trim(), payload);
  await getEntradasRepository().logEvento('template_creado', { user: actorOf(user), notas: nombre });
  return { template };
}

export async function adminActualizarTemplate(id: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const nombre = validateTemplateNombre(body?.nombre);
  const template = await getEntradasRepository().actualizarTemplate(String(id), nombre, String(body?.descripcion || '').trim());
  await getEntradasRepository().logEvento('template_actualizado', { user: actorOf(user), notas: nombre });
  return { template };
}

export async function adminEliminarTemplate(id: string, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  await getEntradasRepository().eliminarTemplate(String(id));
  await getEntradasRepository().logEvento('template_eliminado', { user: actorOf(user), notas: String(id) });
  return { ok: true };
}

export async function adminGuardarComoTemplate(eventoId: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const nombre = validateTemplateNombre(body?.nombre);
  const payload = await serializeEvento(String(eventoId));
  const template = await getEntradasRepository().crearTemplate(nombre, String(body?.descripcion || '').trim(), payload);
  await getEntradasRepository().logEvento('template_creado', { eventoId: String(eventoId), user: actorOf(user), notas: `${nombre} (desde evento)` });
  return { template };
}

export async function adminAplicarTemplate(eventoId: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const templateId = String(body?.templateId || '').trim();
  if (!templateId) throw new ApiError(400, 'Selecciona un template');
  const resultado = await aplicarTemplate(String(eventoId), templateId);
  await getEntradasRepository().logEvento('template_aplicado', {
    eventoId: String(eventoId),
    user: actorOf(user),
    notas: `${resultado.sectores} sectores, ${resultado.butacas} butacas, ${resultado.tandas} tandas${resultado.advertencias.length ? `, ${resultado.advertencias.length} advertencias` : ''}`,
  });
  return resultado;
}

// ── Promotores / RRPP ────────────────────────────────────────────

function buildPromotorInput(body: any): PromotorInput {
  const nombre = String(body?.nombre || '').trim();
  if (nombre.length < 3 || nombre.length > 80) throw new ApiError(400, 'Nombre de promotor inválido (3-80 caracteres)');
  let codigo = normalizeCodigo(body?.codigo);
  if (!codigo) {
    // Sin código explícito: se genera uno legible a partir del nombre.
    codigo = `${normalizeCodigo(nombre).replace(/-/g, '').slice(0, 8)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  }
  if (codigo.length < 3 || codigo.length > 40) throw new ApiError(400, 'Código de promotor inválido (3-40 caracteres)');
  const comisionTipo = body?.comisionTipo === 'crc' ? 'crc' : 'pct';
  const comisionValor = Number(body?.comisionValor);
  if (!Number.isInteger(comisionValor) || comisionValor < 0) throw new ApiError(400, 'Comisión inválida');
  if (comisionTipo === 'pct' && comisionValor > 100) throw new ApiError(400, 'El porcentaje no puede superar 100');
  return {
    nombre,
    codigo,
    comisionTipo: comisionTipo as ComisionTipo,
    comisionValor,
    activo: body?.activo === undefined ? true : Boolean(body.activo),
  };
}

export async function adminListPromotores(user: AdminUser) {
  if (!canViewSales(user)) throw new ApiError(403, 'Sin permiso');
  return { promotores: await getEntradasRepository().listPromotores() };
}

export async function adminRankingPromotores(user: AdminUser) {
  if (!canViewSales(user)) throw new ApiError(403, 'Sin permiso');
  return { ranking: await getEntradasRepository().rankingPromotores() };
}

export async function adminCrearPromotor(body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const promotor = await getEntradasRepository().crearPromotor(buildPromotorInput(body));
  await getEntradasRepository().logEvento('promotor_creado', { user: actorOf(user), notas: `${promotor.nombre} (${promotor.codigo})` });
  return { promotor };
}

export async function adminActualizarPromotor(id: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const promotor = await getEntradasRepository().actualizarPromotor(String(id), buildPromotorInput(body));
  await getEntradasRepository().logEvento('promotor_actualizado', { user: actorOf(user), notas: `${promotor.nombre} (${promotor.codigo})` });
  return { promotor };
}

export async function adminEliminarPromotor(id: string, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  await getEntradasRepository().eliminarPromotor(String(id));
  await getEntradasRepository().logEvento('promotor_eliminado', { user: actorOf(user), notas: String(id) });
  return { ok: true };
}

// ── Config global (cargo por servicio) ───────────────────────────

export async function adminGetConfig(user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  return { config: await getEntradasRepository().getConfig() };
}

export async function adminSetConfig(body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const fee = parseFee({ feeTipo: body?.feeTipoDefault, feeValor: body?.feeValorDefault });
  const config = await getEntradasRepository().setConfig({
    feeTipoDefault: (fee.tipo ?? 'ninguno') as FeeTipo,
    feeValorDefault: fee.valor ?? 0,
  });
  await getEntradasRepository().logEvento('config_fee', { user: actorOf(user), notas: `${config.feeTipoDefault} ${config.feeValorDefault}` });
  return { config };
}

// ── Códigos de descuento ─────────────────────────────────────────

function buildDescuentoInput(body: any): DescuentoInput {
  const codigo = normalizeCodigo(body?.codigo);
  if (codigo.length < 3 || codigo.length > 40) throw new ApiError(400, 'El código debe tener entre 3 y 40 caracteres');
  const tipo = body?.tipo === 'monto' ? 'monto' : 'pct';
  const valor = Number(body?.valor);
  if (!Number.isInteger(valor) || valor <= 0) throw new ApiError(400, 'Valor de descuento inválido');
  if (tipo === 'pct' && valor > 100) throw new ApiError(400, 'El porcentaje no puede superar 100');
  const eventoId = body?.eventoId ? String(body.eventoId).trim() : null;
  const usosMax = body?.usosMax == null || body?.usosMax === '' ? null : Number(body.usosMax);
  if (usosMax != null && (!Number.isInteger(usosMax) || usosMax < 1)) throw new ApiError(400, 'Límite de usos inválido');
  const vigenciaDesde = body?.vigenciaDesde ? String(body.vigenciaDesde) : null;
  const vigenciaHasta = body?.vigenciaHasta ? String(body.vigenciaHasta) : null;
  if (vigenciaDesde && Number.isNaN(new Date(vigenciaDesde).getTime())) throw new ApiError(400, 'Fecha "desde" inválida');
  if (vigenciaHasta && Number.isNaN(new Date(vigenciaHasta).getTime())) throw new ApiError(400, 'Fecha "hasta" inválida');
  return {
    codigo,
    tipo: tipo as DescuentoTipo,
    valor,
    eventoId,
    usosMax,
    vigenciaDesde,
    vigenciaHasta,
    activo: body?.activo === undefined ? true : Boolean(body.activo),
  };
}

export async function adminListDescuentos(eventoId: string | undefined, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  return { descuentos: await getEntradasRepository().listDescuentos(eventoId) };
}

export async function adminCrearDescuento(body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const descuento = await getEntradasRepository().crearDescuento(buildDescuentoInput(body));
  await getEntradasRepository().logEvento('descuento_creado', { eventoId: descuento.eventoId, user: actorOf(user), notas: descuento.codigo });
  return { descuento };
}

export async function adminActualizarDescuento(id: string, body: any, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  const descuento = await getEntradasRepository().actualizarDescuento(String(id), buildDescuentoInput(body));
  await getEntradasRepository().logEvento('descuento_actualizado', { eventoId: descuento.eventoId, user: actorOf(user), notas: descuento.codigo });
  return { descuento };
}

export async function adminEliminarDescuento(id: string, user: AdminUser) {
  if (!canManageEvents(user)) throw new ApiError(403, 'Sin permiso');
  await getEntradasRepository().eliminarDescuento(String(id));
  await getEntradasRepository().logEvento('descuento_eliminado', { user: actorOf(user), notas: String(id) });
  return { ok: true };
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
    if (r.rot !== undefined && (typeof r.rot !== 'number' || !isFinite(r.rot) || r.rot < -180 || r.rot > 360))
      throw new ApiError(400, 'Rotación inválida (grados entre -180 y 360)');
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
