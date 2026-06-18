import { TARIFA_HORA } from '../../config/constants';
import { Reservation } from './parqueo.types';

export function reservaEmail(reserva: Reservation, ownerEmail = ''): string {
  return String(reserva.emailQr || ownerEmail || '').trim().toLowerCase();
}

export function maskedReservaEmail(reserva: Reservation, ownerEmail = ''): string {
  const email = reservaEmail(reserva, ownerEmail);
  const at = email.indexOf('@');
  if (at <= 0 || at === email.length - 1) return 'Sin correo asociado';
  return `${email.slice(0, Math.min(3, at))}***@${email.slice(at + 1)}`;
}

export function montoDe(reserva: Reservation): { horas: number; monto: number } {
  const ms = Date.now() - new Date(reserva.inicio).getTime();
  const horas = Math.max(1, Math.ceil(ms / 3600000));
  return { horas, monto: horas * TARIFA_HORA };
}

export function ensureReservaQrData(reserva: Reservation): string {
  if (!reserva.codigo) reserva.codigo = `CSH-${reserva.id}`;
  if (!reserva.qrData) reserva.qrData = `${reserva.codigo}|${reserva.espacioId}|${reserva.placa}|${reserva.fin}`;
  return reserva.qrData;
}
