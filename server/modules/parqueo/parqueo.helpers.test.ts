import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureReservaQrData, maskedReservaEmail, montoDe, reservaEmail } from './parqueo.helpers';
import type { Reservation } from './parqueo.types';

function reservation(patch: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res-1',
    espacioId: 'A-01',
    userId: 'u-003',
    userName: 'Comercial CSH',
    placa: 'ABC123',
    rol: 'socio',
    estado: 'reservado',
    inicio: '2026-06-17T10:00:00.000Z',
    fin: '2026-06-17T11:00:00.000Z',
    codigo: '',
    qrData: '',
    emailQr: null,
    pago: null,
    ...patch,
  };
}

describe('parqueo helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefers the reservation QR email and normalizes casing', () => {
    expect(reservaEmail(reservation({ emailQr: ' FAN@Example.COM ' }))).toBe('fan@example.com');
  });

  it('falls back to the admin user email when no reservation email exists', () => {
    expect(reservaEmail(reservation({ emailQr: null, userId: 'u-003' }))).toBe('comercial@herediano.com');
  });

  it('masks usable email addresses and labels missing ones', () => {
    expect(maskedReservaEmail(reservation({ emailQr: 'fan@example.com' }))).toBe('fan***@example.com');
    expect(maskedReservaEmail(reservation({ emailQr: 'x@example.com' }))).toBe('x***@example.com');
    expect(maskedReservaEmail(reservation({ emailQr: null, userId: null }))).toBe('Sin correo asociado');
  });

  it('rounds parking charges up to the next hour with a one-hour minimum', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-17T12:01:00.000Z'));
    expect(montoDe(reservation({ inicio: '2026-06-17T10:00:00.000Z' }))).toEqual({ horas: 3, monto: 3000 });
    expect(montoDe(reservation({ inicio: '2026-06-17T12:00:30.000Z' }))).toEqual({ horas: 1, monto: 1000 });
  });

  it('creates stable QR data when missing and preserves existing QR data', () => {
    const missing = reservation();
    expect(ensureReservaQrData(missing)).toBe('CSH-res-1|A-01|ABC123|2026-06-17T11:00:00.000Z');
    expect(missing.codigo).toBe('CSH-res-1');

    const existing = reservation({ codigo: 'CSH-CUSTOM', qrData: 'already-built' });
    expect(ensureReservaQrData(existing)).toBe('already-built');
  });
});
