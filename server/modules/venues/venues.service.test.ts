import { describe, expect, it, vi } from 'vitest';

// Mock del repositorio: los helpers bajo prueba son puros, pero el módulo lo
// importa y no queremos tocar la BD.
vi.mock('./venues.repository', () => ({
  deleteReserva: vi.fn(),
  findOcupadas: vi.fn(),
  findReservaById: vi.fn(),
  findReservas: vi.fn(),
  findSalonById: vi.fn(),
  findSalones: vi.fn(),
  haySolape: vi.fn(),
  insertReserva: vi.fn(),
  updateReserva: vi.fn(),
}));

import { calcularPrecio, minutosDe, puedeTransicionar } from './venues.service';

describe('minutosDe', () => {
  it('convierte HH:MM a minutos', () => {
    expect(minutosDe('00:00')).toBe(0);
    expect(minutosDe('09:30')).toBe(570);
    expect(minutosDe('23:59')).toBe(1439);
  });
});

describe('calcularPrecio', () => {
  const salon = { tarifaHoraCrc: 45000, tarifaDiaCrc: 300000 };

  it('cobra por hora las reservas cortas', () => {
    expect(calcularPrecio(salon, '09:00', '13:00')).toBe(180000);
  });
  it('prorratea las medias horas', () => {
    expect(calcularPrecio(salon, '09:00', '10:30')).toBe(67500);
  });
  it('topa en la tarifa de día completo', () => {
    expect(calcularPrecio(salon, '08:00', '20:00')).toBe(300000);
  });
  it('devuelve 0 si el rango es inválido', () => {
    expect(calcularPrecio(salon, '12:00', '12:00')).toBe(0);
    expect(calcularPrecio(salon, '14:00', '12:00')).toBe(0);
  });
  it('sin tarifa de día no aplica tope', () => {
    expect(calcularPrecio({ tarifaHoraCrc: 10000, tarifaDiaCrc: 0 }, '08:00', '20:00')).toBe(120000);
  });
});

describe('puedeTransicionar (estados de reserva)', () => {
  it('permite el flujo normal', () => {
    expect(puedeTransicionar('solicitada', 'confirmada')).toBe(true);
    expect(puedeTransicionar('confirmada', 'completada')).toBe(true);
  });
  it('permite cancelar mientras esté viva', () => {
    expect(puedeTransicionar('solicitada', 'cancelada')).toBe(true);
    expect(puedeTransicionar('confirmada', 'cancelada')).toBe(true);
  });
  it('no revive estados terminales', () => {
    expect(puedeTransicionar('cancelada', 'confirmada')).toBe(false);
    expect(puedeTransicionar('completada', 'cancelada')).toBe(false);
  });
  it('no salta de solicitada a completada', () => {
    expect(puedeTransicionar('solicitada', 'completada')).toBe(false);
  });
});
