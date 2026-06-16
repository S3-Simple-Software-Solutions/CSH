import { TARIFA_HORA } from '../../config/constants';
import { ApiError } from '../../core/errors';
import { getParqueoRepository } from './parqueo.repository';
import { sendParkingQrEmail, sendPaymentReceiptEmail } from './parqueo.mail';
import { maskedReservaEmail, montoDe, reservaEmail } from './parqueo.helpers';
import { floorPlanMeta } from './parqueo.layout';
import { PaymentRecord, Recibo } from './parqueo.types';

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

function validFloor(piso: unknown): number {
  const p = Number(piso);
  if (!floorPlanMeta().some((m) => m.piso === p)) throw new ApiError(400, 'Piso invalido');
  return p;
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

export async function getCroquis() {
  const repo = getParqueoRepository();
  const [dots, arrows] = await Promise.all([repo.croquisDots(), repo.flowArrows()]);
  const floors = floorPlanMeta().map((m) => ({
    piso: m.piso,
    plan: m.plan,
    aspect: m.aspect,
    arrows: arrows.filter((a) => a.plan === m.plan).map((a) => ({
      id: a.id,
      x: a.x,
      y: a.y,
      r: a.r,
    })),
    stalls: dots.filter((d) => d.piso === m.piso).map((d) => ({
      id: d.id,
      x: d.x,
      y: d.y,
      zona: d.zona,
      num: d.num,
      utilizado: d.utilizado,
      nombre: d.nombre,
      tipo: d.tipo,
      ancho: d.ancho,
      alto: d.alto,
      discapacitado: d.discapacitado,
    })),
  }));
  return { floors };
}

export async function addEspacio(body: { piso: unknown; x: unknown; y: unknown; zona?: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const piso = validFloor(body.piso);
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

export async function updateEspacio(id: string, body: { nombre?: unknown; discapacitado?: unknown; ancho?: unknown; alto?: unknown }, actor: Actor) {
  requireParkingAdmin(actor);
  const discapacitado = body.discapacitado === true || String(body.discapacitado).toLowerCase() === 'true';
  const espacio = await getParqueoRepository().updateEspacio(id, {
    nombre: validSpotName(body.nombre),
    tipo: discapacitado ? 'discapacitado' : 'regular',
    ancho: validNullableDimension(body.ancho, 'Ancho'),
    alto: validNullableDimension(body.alto, 'Alto'),
    discapacitado,
  });
  return { espacio };
}

export async function removeEspacio(id: string, actor: Actor) {
  requireParkingAdmin(actor);
  await getParqueoRepository().removeEspacio(id);
  return { id };
}

export async function clearCroquis(actor: Actor) {
  requireParkingAdmin(actor);
  await getParqueoRepository().clearEspacios();
  return getCroquis();
}

export async function consultaPublica(rawPlate: unknown) {
  const plate = normalizePlate(rawPlate);
  if (!plate || plate.length > 12) throw new ApiError(400, 'Ingresa una placa valida');
  const repo = getParqueoRepository();
  const reserva = await repo.getActiveReservationByPlate(plate);
  if (!reserva) throw new ApiError(404, 'No hay parqueo activo para esa placa');
  const { horas, monto } = montoDe(reserva);
  return {
    espacioId: reserva.espacioId,
    placa: reserva.placa,
    estado: reserva.estado,
    inicio: reserva.inicio,
    fin: reserva.fin,
    correo: maskedReservaEmail(reserva),
    horas,
    monto,
    tarifa: TARIFA_HORA,
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
  const email = reservaEmail(reserva);
  if (!email) throw new ApiError(409, 'La reserva no tiene correo asociado');
  await sendParkingQrEmail({ to: email, reserva });
  await repo.logEvento('envio', { espacioId: reserva.espacioId, user: { id: null, name: 'Consulta publica' }, placa: reserva.placa, notas: `Reenvio solicitado a ${maskedReservaEmail(reserva)}` });
  return { correo: maskedReservaEmail(reserva) };
}

export async function pagarPublico(body: { placa: unknown; pago?: any }): Promise<Recibo> {
  const plate = normalizePlate(body.placa);
  const repo = getParqueoRepository();
  const reserva = await repo.getActiveReservationByPlate(plate);
  if (!reserva) throw new ApiError(404, 'No hay parqueo activo para esa placa');
  const email = reservaEmail(reserva);
  if (!email) throw new ApiError(409, 'La reserva no tiene correo asociado para enviar el recibo');
  const pago = body.pago || {};
  const cardNumber = String(pago.cardNumber || '').replace(/\D/g, '');
  if (String(pago.name || '').trim().length < 3) throw new ApiError(400, 'Ingresa el nombre del tarjetahabiente');
  if (cardNumber.length < 13 || cardNumber.length > 19) throw new ApiError(400, 'Numero de tarjeta invalido');
  if (!/^\d{2}\/\d{2}$/.test(String(pago.exp || '').trim())) throw new ApiError(400, 'Fecha de expiracion invalida');
  if (String(pago.cvv || '').replace(/\D/g, '').length < 3) throw new ApiError(400, 'CVV invalido');
  if (cardNumber.endsWith('0000')) throw new ApiError(402, 'La transaccion fue rechazada por el emisor');
  const { horas, monto } = montoDe(reserva);
  const recibo: Recibo = { espacioId: reserva.espacioId, placa: reserva.placa, horas, monto, transaccion: `CSH-PAY-${Date.now().toString(36).toUpperCase()}`, correo: maskedReservaEmail(reserva) };
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
