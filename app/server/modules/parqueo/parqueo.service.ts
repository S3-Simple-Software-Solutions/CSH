import { TARIFA_HORA } from '../../config/constants';
import { ApiError } from '../../core/errors';
import { getParqueoRepository } from './parqueo.repository';
import type { ParkingSpaceStatus } from './parqueo.repository';
import { sendParkingQrEmail, sendPaymentReceiptEmail } from './parqueo.mail';
import { maskedReservaEmail, montoDe, reservaEmail } from './parqueo.helpers';
import { ETIQUETAS_PLAZA, ETIQUETA_IDS, PaymentRecord, Parqueo, Recibo } from './parqueo.types';
import { FLOW_ARROW_KINDS, FlowArrowKind } from './parqueo.flow';
import { findUserEmailById } from '../usuarios/usuarios.service';

type Actor = { id: string; name: string; parkingRole: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePlate(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

function validatePlate(plate: string, message = 'Placa invalida'): void {
  if (!plate || plate.length > 12) throw new ApiError(400, message);
}

function validateDuration(duracion: number): void {
  if (!Number.isFinite(duracion) || duracion < 15 || duracion > 1440) throw new ApiError(400, 'Duracion invalida (15-1440 minutos)');
}

function validateEmail(email: string): void {
  if (!email || email.length > 120 || !EMAIL_RE.test(email)) throw new ApiError(400, 'Correo invalido');
}

async function ownerEmailFor(reserva: { emailQr?: string | null; userId?: string | null }): Promise<string> {
  if (reserva.emailQr) return '';
  return findUserEmailById(reserva.userId);
}

async function reservaEmailFor(reserva: Parameters<typeof reservaEmail>[0]): Promise<string> {
  return reservaEmail(reserva, await ownerEmailFor(reserva));
}

async function maskedReservaEmailFor(reserva: Parameters<typeof maskedReservaEmail>[0]): Promise<string> {
  return maskedReservaEmail(reserva, await ownerEmailFor(reserva));
}

export async function getPublicEstado() {
  const repo = getParqueoRepository();
  return { tarifa: TARIFA_HORA, espacios: await repo.publicEstado() };
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

function requireParkingAdmin(actor: Actor): void {
  if (actor.parkingRole !== 'admin') throw new ApiError(403, 'Solo administradores pueden editar el croquis');
}

function validPoint(x: unknown, y: unknown): { x: number; y: number } {
  const px = Number(x);
  const py = Number(y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) throw new ApiError(400, 'Coordenadas invalidas');
  return { x: clamp01(px), y: clamp01(py) };
}

async function parqueoForFloor(piso: number): Promise<Parqueo> {
  const parqueo = (await getParqueoRepository().listParqueos()).find((p) => p.piso === piso);
  if (!parqueo) throw new ApiError(400, 'Piso invalido');
  return parqueo;
}

async function validFloor(piso: unknown): Promise<number> {
  const p = Number(piso);
  await parqueoForFloor(p);
  return p;
}

async function planForFloor(piso: number): Promise<string> {
  return (await parqueoForFloor(piso)).slug;
}

function validRotation(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ApiError(400, 'Rotacion invalida');
  return Math.round(n * 10) / 10;
}

function validArrowKind(value: unknown): FlowArrowKind {
  const kind = String(value || 'straight').trim();
  if (!FLOW_ARROW_KINDS.includes(kind as FlowArrowKind)) throw new ApiError(400, 'Tipo de flecha invalido');
  return kind as FlowArrowKind;
}

function validRoadPoints(value: unknown): { x: number; y: number }[] {
  if (!Array.isArray(value)) throw new ApiError(400, 'Ruta invalida');
  const points = value.slice(0, 400).map((p) => validPoint((p as any)?.x, (p as any)?.y));
  if (points.length < 2) throw new ApiError(400, 'La ruta necesita al menos 2 puntos');
  return points;
}

function validNullableDimension(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0.006 || n > 0.12) throw new ApiError(400, `${label} invalido`);
  return n;
}

function validSpotName(value: unknown): string | null {
  const name = String(value || '').trim();
  if (!name) return null;
  if (name.length > 32) throw new ApiError(400, 'Nombre demasiado largo');
  return name;
}

function validSpaceIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new ApiError(400, 'Seleccion invalida');
  const ids = Array.from(new Set(value.map((id) => String(id || '').trim()).filter(Boolean)));
  if (!ids.length) throw new ApiError(400, 'Selecciona al menos un espacio');
  if (ids.length > 300) throw new ApiError(400, 'Seleccion demasiado grande');
  if (ids.some((id) => id.length > 40)) throw new ApiError(400, 'Seleccion invalida');
  return ids;
}

function validBatchSpaceStatus(value: unknown): ParkingSpaceStatus {
  const estado = String(value || '').trim();
  if (estado === 'disponible' || estado === 'ocupado' || estado === 'no_disponible') return estado;
  throw new ApiError(400, 'Estado invalido');
}

export async function getCroquis() {
  const repo = getParqueoRepository();
  const [parqueos, dots, arrows, roads, visibility] = await Promise.all([repo.listParqueos(), repo.croquisDots(), repo.flowArrows(), repo.roads(), repo.planVisibility()]);
  const floors = parqueos.map((m) => ({
    piso: m.piso,
    plan: m.slug,
    parqueoId: m.id,
    nombre: m.nombre,
    croquisUrl: m.croquisUrl,
    precioCrc: m.precioCrc,
    modoCobro: m.modoCobro,
    estado: m.estado,
    aspect: m.aspect,
    showPlan: visibility[m.slug] !== false,
    arrows: arrows.filter((a) => a.plan === m.slug).map((a) => ({
      id: a.id,
      x: a.x,
      y: a.y,
      r: a.r,
      kind: a.kind,
    })),
    roads: roads.filter((r) => r.plan === m.slug).map((r) => ({
      id: r.id,
      points: r.points,
    })),
    stalls: dots.filter((d) => d.piso === m.piso).map((d) => ({
      id: d.id,
      x: d.x,
      y: d.y,
      zona: d.zona,
      num: d.num,
      utilizado: d.utilizado,
      estado: d.estado,
      reservaId: d.reservaId,
      nombre: d.nombre,
      tipo: d.tipo,
      ancho: d.ancho,
      alto: d.alto,
      discapacitado: d.discapacitado,
      etiquetas: d.etiquetas,
    })),
  }));
  return { floors, etiquetasCatalogo: ETIQUETAS_PLAZA };
}

export async function addEspacio(body: { piso: unknown; x: unknown; y: unknown; zona?: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const piso = await validFloor(body.piso);
  const { x, y } = validPoint(body.x, body.y);
  const zona = String(body.zona || 'A').trim().slice(0, 12) || 'A';
  const espacio = await getParqueoRepository().addEspacio({ piso, zona, x, y });
  return { espacio };
}

export async function moveEspacio(id: string, body: { x: unknown; y: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const { x, y } = validPoint(body.x, body.y);
  await getParqueoRepository().moveEspacio(id, x, y);
  return { id, x, y };
}

export async function moveFlecha(id: string, body: { x: unknown; y: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const { x, y } = validPoint(body.x, body.y);
  await getParqueoRepository().moveFlowArrow(id, x, y);
  return { id, x, y };
}

export async function addFlecha(body: { piso: unknown; x: unknown; y: unknown; r?: unknown; kind?: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const piso = await validFloor(body.piso);
  const { x, y } = validPoint(body.x, body.y);
  const flecha = await getParqueoRepository().addFlowArrow({
    plan: await planForFloor(piso),
    x,
    y,
    r: validRotation(body.r),
    kind: validArrowKind(body.kind),
  });
  return { flecha };
}

export async function updateFlecha(id: string, body: { x?: unknown; y?: unknown; r?: unknown; kind?: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const patch: { x?: number; y?: number; r?: number; kind?: FlowArrowKind } = {};
  if (body.x !== undefined || body.y !== undefined) Object.assign(patch, validPoint(body.x, body.y));
  if (body.r !== undefined) patch.r = validRotation(body.r);
  if (body.kind !== undefined) patch.kind = validArrowKind(body.kind);
  const flecha = await getParqueoRepository().updateFlowArrow(id, patch);
  return { flecha };
}

export async function removeFlecha(id: string, actor: Actor) {
  requireParkingAdmin(actor);
  await getParqueoRepository().removeFlowArrow(id);
  return { id };
}

export async function addRuta(body: { piso: unknown; points: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const piso = await validFloor(body.piso);
  const ruta = await getParqueoRepository().addRoad({
    plan: await planForFloor(piso),
    points: validRoadPoints(body.points),
  });
  return { ruta };
}

export async function removeRuta(id: string, actor: Actor) {
  requireParkingAdmin(actor);
  await getParqueoRepository().removeRoad(id);
  return { id };
}

export async function setPlanVisibilidad(body: { piso: unknown; showPlan: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const piso = await validFloor(body.piso);
  const show = body.showPlan !== false && String(body.showPlan).toLowerCase() !== 'false';
  await getParqueoRepository().setPlanVisibility(await planForFloor(piso), show);
  return { piso, showPlan: show };
}

// Sólo se aceptan etiquetas del catálogo; el resto se descarta en silencio.
function validEtiquetas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((e) => String(e).trim()))].filter((e) => ETIQUETA_IDS.includes(e));
}

export async function updateEspacio(
  id: string,
  body: { nombre?: unknown; discapacitado?: unknown; ancho?: unknown; alto?: unknown; etiquetas?: unknown },
  actor: Actor,
) {
  requireParkingAdmin(actor);
  // 'discapacitado' y la etiqueta homónima son la misma cosa: se sincronizan
  // para no romper a quien siga mandando solo el booleano.
  const etiquetas = validEtiquetas(body.etiquetas);
  const discapacitado = body.etiquetas !== undefined
    ? etiquetas.includes('discapacitado')
    : body.discapacitado === true || String(body.discapacitado).toLowerCase() === 'true';
  if (discapacitado && !etiquetas.includes('discapacitado')) etiquetas.push('discapacitado');
  const espacio = await getParqueoRepository().updateEspacio(id, {
    nombre: validSpotName(body.nombre),
    tipo: discapacitado ? 'discapacitado' : 'regular',
    ancho: validNullableDimension(body.ancho, 'Ancho'),
    alto: validNullableDimension(body.alto, 'Alto'),
    discapacitado,
    etiquetas,
  });
  return { espacio };
}

export async function removeEspacio(id: string, actor: Actor) {
  requireParkingAdmin(actor);
  await getParqueoRepository().removeEspacio(id);
  return { id };
}

export async function batchEspacios(body: { ids?: unknown; action?: unknown; estado?: unknown; etiqueta?: unknown; activar?: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const ids = validSpaceIds(body.ids);
  const action = String(body.action || '').trim();
  const repo = getParqueoRepository();
  if (action === 'delete') {
    const count = await repo.removeEspacios(ids);
    return { count };
  }
  if (action === 'status') {
    const estado = validBatchSpaceStatus(body.estado);
    const count = await repo.updateEspaciosEstado(ids, estado, { id: actor.id, name: actor.name });
    return { count, estado };
  }
  if (action === 'etiqueta') {
    const etiqueta = String(body.etiqueta || '').trim();
    if (!ETIQUETA_IDS.includes(etiqueta)) throw new ApiError(400, 'Etiqueta invalida');
    const activar = body.activar !== false && String(body.activar).toLowerCase() !== 'false';
    const count = await repo.setEtiquetaEspacios(ids, etiqueta, activar);
    return { count, etiqueta, activar };
  }
  throw new ApiError(400, 'Accion invalida');
}

export async function clearCroquis(actor: Actor) {
  requireParkingAdmin(actor);
  await getParqueoRepository().clearEspacios();
  return getCroquis();
}

// ---- Administración de parqueos (croquis + precio) ----
function validParqueoNombre(value: unknown): string {
  const nombre = String(value || '').trim();
  if (nombre.length < 2 || nombre.length > 60) throw new ApiError(400, 'El nombre debe tener entre 2 y 60 caracteres');
  return nombre;
}

function validPrecio(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new ApiError(400, 'Precio invalido');
  return n;
}

function validModoCobro(value: unknown): 'hora' | 'fijo' {
  const modo = String(value || 'hora').trim();
  if (modo !== 'hora' && modo !== 'fijo') throw new ApiError(400, 'Modo de cobro invalido');
  return modo;
}

export async function listParqueos() {
  return { parqueos: await getParqueoRepository().listParqueos() };
}

export async function crearParqueo(body: { nombre?: unknown; precioCrc?: unknown; modoCobro?: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const parqueo = await getParqueoRepository().createParqueo({
    nombre: validParqueoNombre(body.nombre),
    precioCrc: validPrecio(body.precioCrc),
    modoCobro: validModoCobro(body.modoCobro),
  });
  return { parqueo };
}

export async function actualizarParqueo(id: string, body: { nombre?: unknown; precioCrc?: unknown; modoCobro?: unknown; estado?: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const patch: { nombre?: string; precioCrc?: number; modoCobro?: 'hora' | 'fijo'; estado?: 'activo' | 'inactivo' } = {};
  if (body.nombre !== undefined) patch.nombre = validParqueoNombre(body.nombre);
  if (body.precioCrc !== undefined) patch.precioCrc = validPrecio(body.precioCrc);
  if (body.modoCobro !== undefined) patch.modoCobro = validModoCobro(body.modoCobro);
  if (body.estado !== undefined) {
    const estado = String(body.estado).trim();
    if (estado !== 'activo' && estado !== 'inactivo') throw new ApiError(400, 'Estado invalido');
    patch.estado = estado;
  }
  const parqueo = await getParqueoRepository().updateParqueo(id, patch);
  return { parqueo };
}

export async function eliminarParqueo(id: string, actor: Actor) {
  requireParkingAdmin(actor);
  await getParqueoRepository().deleteParqueo(id);
  return { id };
}

export async function getParqueoById(id: string, actor: Actor) {
  requireParkingAdmin(actor);
  return getParqueoRepository().getParqueoById(id);
}

export async function setParqueoCroquis(id: string, croquisUrl: string, aspect: number, actor: Actor) {
  requireParkingAdmin(actor);
  const a = Number.isFinite(aspect) && aspect > 0.2 && aspect < 5 ? aspect : 1.5;
  const parqueo = await getParqueoRepository().setParqueoCroquis(id, croquisUrl, a);
  return { parqueo };
}

export async function consultaPublica(rawPlate: unknown) {
  const plate = normalizePlate(rawPlate);
  if (!plate || plate.length > 12) throw new ApiError(400, 'Ingresa una placa valida');
  const repo = getParqueoRepository();
  const reserva = await repo.getActiveReservationByPlate(plate);
  if (!reserva) throw new ApiError(404, 'No hay parqueo activo para esa placa');
  const parqueo = await repo.getParqueoForEspacio(reserva.espacioId);
  const precio = parqueo?.precioCrc ?? TARIFA_HORA;
  const modo = parqueo?.modoCobro ?? 'hora';
  const { horas, monto } = montoDe(reserva, precio, modo);
  const correo = await maskedReservaEmailFor(reserva);
  return {
    espacioId: reserva.espacioId,
    placa: reserva.placa,
    estado: reserva.estado,
    inicio: reserva.inicio,
    fin: reserva.fin,
    correo,
    horas,
    monto,
    tarifa: precio,
    modoCobro: modo,
  };
}

export async function occupyPublic(body: { espacioId: string; placa: unknown; email: unknown; duracion: unknown }) {
  const plate = normalizePlate(body.placa);
  const email = String(body.email || '').trim().toLowerCase();
  const duracion = Number(body.duracion);
  validatePlate(plate);
  validateEmail(email);
  validateDuration(duracion);
  const repo = getParqueoRepository();
  const reserva = await repo.occupyPublic({ espacioId: body.espacioId, placa: plate, email, duracion });
  let emailSent = false;
  let emailError = '';
  try {
    await sendParkingQrEmail({ to: email, reserva });
    emailSent = true;
  } catch (err) {
    emailError = (err as Error).message;
    console.error(`[mail] Error enviando QR a ${email}: ${emailError}`);
  }
  return {
    reservaId: reserva.id,
    espacioId: reserva.espacioId,
    placa: reserva.placa,
    inicio: reserva.inicio,
    fin: reserva.fin,
    codigo: reserva.codigo,
    qrData: reserva.qrData,
    correo: maskedReservaEmail(reserva),
    emailSent,
    emailError,
  };
}

export async function reenviarPublico(rawPlate: unknown) {
  const plate = normalizePlate(rawPlate);
  const repo = getParqueoRepository();
  const reserva = await repo.getActiveReservationByPlate(plate);
  if (!reserva) throw new ApiError(404, 'No hay parqueo activo para esa placa');
  const email = await reservaEmailFor(reserva);
  if (!email) throw new ApiError(409, 'La reserva no tiene correo asociado');
  await sendParkingQrEmail({ to: email, reserva });
  const correo = await maskedReservaEmailFor(reserva);
  await repo.logEvento('envio', { espacioId: reserva.espacioId, user: { id: null, name: 'Consulta publica' }, placa: reserva.placa, notas: `Reenvio solicitado a ${correo}` });
  return { correo };
}

export async function pagarPublico(body: { placa: unknown; pago?: any }): Promise<Recibo> {
  const plate = normalizePlate(body.placa);
  const repo = getParqueoRepository();
  const reserva = await repo.getActiveReservationByPlate(plate);
  if (!reserva) throw new ApiError(404, 'No hay parqueo activo para esa placa');
  const email = await reservaEmailFor(reserva);
  if (!email) throw new ApiError(409, 'La reserva no tiene correo asociado para enviar el recibo');
  const pago = body.pago || {};
  const cardNumber = String(pago.cardNumber || '').replace(/\D/g, '');
  if (String(pago.name || '').trim().length < 3) throw new ApiError(400, 'Ingresa el nombre del tarjetahabiente');
  if (cardNumber.length < 13 || cardNumber.length > 19) throw new ApiError(400, 'Numero de tarjeta invalido');
  if (!/^\d{2}\/\d{2}$/.test(String(pago.exp || '').trim())) throw new ApiError(400, 'Fecha de expiracion invalida');
  if (String(pago.cvv || '').replace(/\D/g, '').length < 3) throw new ApiError(400, 'CVV invalido');
  if (cardNumber.endsWith('0000')) throw new ApiError(402, 'La transaccion fue rechazada por el emisor');
  const parqueo = await repo.getParqueoForEspacio(reserva.espacioId);
  const { horas, monto } = montoDe(reserva, parqueo?.precioCrc ?? TARIFA_HORA, parqueo?.modoCobro ?? 'hora');
  const recibo: Recibo = { espacioId: reserva.espacioId, placa: reserva.placa, horas, monto, transaccion: `CSH-PAY-${Date.now().toString(36).toUpperCase()}`, correo: await maskedReservaEmailFor(reserva) };
  await sendPaymentReceiptEmail({ to: email, reserva, recibo });
  const payment: PaymentRecord = { transaccion: recibo.transaccion, monto, horas, timestamp: new Date().toISOString(), metodo: `****${cardNumber.slice(-4)}` };
  await repo.finalizePayment(reserva, payment, recibo);
  return recibo;
}

export async function adminEstado() {
  const repo = getParqueoRepository();
  return repo.adminEstado();
}

export async function adminEventos(opts: { limit: number; offset: number; plate?: string }) {
  const repo = getParqueoRepository();
  return repo.listEventos(opts);
}

export async function adminReservar(body: { espacioId: string; placa: unknown; duracion: unknown }, user: Actor) {
  const plate = normalizePlate(body.placa);
  const duracion = Number(body.duracion);
  validatePlate(plate);
  validateDuration(duracion);
  const repo = getParqueoRepository();
  return repo.reservar({ espacioId: body.espacioId, placa: plate, duracion, user });
}

export async function adminOcupar(reservaId: string, actor: Actor) {
  const repo = getParqueoRepository();
  await repo.ocupar(reservaId, actor);
}

export async function adminLiberar(espacioId: string, actor: Actor) {
  const repo = getParqueoRepository();
  await repo.liberar(espacioId, actor);
}

export async function adminExtender(reservaId: string, rawMinutos: unknown, actor: Actor) {
  const minutos = Number(rawMinutos);
  if (!Number.isFinite(minutos) || minutos < 5 || minutos > 720) throw new ApiError(400, 'Minutos invalidos (5-720)');
  const repo = getParqueoRepository();
  await repo.extender(reservaId, minutos, actor);
}

export async function adminCancelar(id: string, actor: Actor) {
  const repo = getParqueoRepository();
  await repo.cancelar(id, actor);
}

export async function adminEnviarQr(reservaId: string, rawEmail: unknown, actor: Actor) {
  const repo = getParqueoRepository();
  const reserva = await repo.getActiveReservationById(reservaId);
  if (!reserva) throw new ApiError(404, 'Reserva no activa');
  if (reserva.userId !== actor.id && actor.parkingRole !== 'admin') throw new ApiError(403, 'Sin permiso sobre esta reserva');
  const email = String(rawEmail || '').trim().toLowerCase();
  if (email.length > 120 || !EMAIL_RE.test(email)) throw new ApiError(400, 'Correo invalido');
  await sendParkingQrEmail({ to: email, reserva });
  await repo.setReservationEmail(reserva.id, email);
  await repo.logEvento('envio', { espacioId: reserva.espacioId, user: actor, placa: reserva.placa, notas: `QR a ${email}` });
  return { email };
}
