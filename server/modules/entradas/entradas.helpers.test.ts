import { describe, expect, it, vi } from 'vitest';
import { boletoCodigo, calcularTotales, diasAntesToFecha, extractCodigo, fechaToDiasAntes, filaLabel, normalizeCodigo, qrData, slugify, tandaActiva } from './entradas.helpers';

describe('entradas helpers', () => {
  it('creates short slugs for event URLs', () => {
    expect(slugify('Final Nacional: Herediano vs Saprissa')).toBe('final-nacional-herediano-vs-saprissa');
    expect(slugify('áéíóú ü ñ')).toBe('aeiou-u-n');
    expect(slugify('x'.repeat(100))).toHaveLength(60);
  });

  it('formats ticket QR payloads', () => {
    expect(qrData('ENT-ABC123', 'evt-1', 'vip', 'fan@example.com')).toBe('ENT-ABC123|evt-1|vip|fan@example.com');
  });

  it('extracts the ticket code from a full QR payload or manual input', () => {
    expect(extractCodigo(' ent-abc123 |evt-1|vip|fan@example.com')).toBe('ENT-ABC123');
    expect(extractCodigo('ent-def456')).toBe('ENT-DEF456');
    expect(extractCodigo(null)).toBe('');
  });

  it('generates readable ticket codes', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    expect(boletoCodigo()).toMatch(/^ENT-[A-Z0-9]{6}$/);
    vi.restoreAllMocks();
  });

  it('normalizes user-entered codes', () => {
    expect(normalizeCodigo(' promo 2026! ')).toBe('PROMO2026');
    expect(normalizeCodigo('early-bird')).toBe('EARLY-BIRD');
    expect(normalizeCodigo(null)).toBe('');
  });
});

describe('calcularTotales', () => {
  it('devuelve el subtotal cuando no hay fee ni descuento', () => {
    expect(calcularTotales(10000, null, null)).toEqual({ subtotal: 10000, descuento: 0, fee: 0, total: 10000 });
  });

  it('aplica descuento porcentual y fija el fee sobre subtotal − descuento', () => {
    // subtotal 10000, 10% off = 9000, fee 5% de 9000 = 450 → total 9450
    expect(calcularTotales(10000, { tipo: 'pct', valor: 5 }, { tipo: 'pct', valor: 10 })).toEqual({
      subtotal: 10000,
      descuento: 1000,
      fee: 450,
      total: 9450,
    });
  });

  it('aplica descuento y fee de monto fijo', () => {
    expect(calcularTotales(10000, { tipo: 'crc', valor: 500 }, { tipo: 'monto', valor: 2000 })).toEqual({
      subtotal: 10000,
      descuento: 2000,
      fee: 500,
      total: 8500,
    });
  });

  it('el descuento nunca supera el subtotal', () => {
    const r = calcularTotales(1000, null, { tipo: 'monto', valor: 5000 });
    expect(r.descuento).toBe(1000);
    expect(r.total).toBe(0);
  });

  it('ignora fee y descuento en subtotal cero', () => {
    expect(calcularTotales(0, { tipo: 'pct', valor: 10 }, { tipo: 'pct', valor: 50 })).toEqual({ subtotal: 0, descuento: 0, fee: 0, total: 0 });
  });
});

describe('offsets de tandas para templates', () => {
  const evento = '2026-08-15T20:00:00.000Z';

  it('convierte fechas absolutas a días antes del evento', () => {
    expect(fechaToDiasAntes(evento, '2026-08-01T20:00:00.000Z')).toBe(14);
    expect(fechaToDiasAntes(evento, evento)).toBe(0);
    expect(fechaToDiasAntes(evento, null)).toBeNull();
  });

  it('reconstruye fechas desde los offsets para una nueva fecha de evento', () => {
    const nuevaFecha = '2026-09-10T20:00:00.000Z';
    expect(diasAntesToFecha(nuevaFecha, 14)).toBe('2026-08-27T20:00:00.000Z');
    expect(diasAntesToFecha(nuevaFecha, null)).toBeNull();
  });

  it('ida y vuelta preserva la distancia al evento', () => {
    const dias = fechaToDiasAntes(evento, '2026-07-30T20:00:00.000Z');
    expect(diasAntesToFecha(evento, dias)).toBe('2026-07-30T20:00:00.000Z');
  });
});

describe('filaLabel', () => {
  it('genera etiquetas estilo hoja de cálculo', () => {
    expect(filaLabel(0)).toBe('A');
    expect(filaLabel(25)).toBe('Z');
    expect(filaLabel(26)).toBe('AA');
    expect(filaLabel(27)).toBe('AB');
    expect(filaLabel(51)).toBe('AZ');
    expect(filaLabel(52)).toBe('BA');
  });
});

describe('tandaActiva', () => {
  const base = { ventaDesde: null, ventaHasta: null, cupo: null, vendidos: 0 };
  const now = new Date('2026-07-03T12:00:00Z');

  it('devuelve null sin tandas', () => {
    expect(tandaActiva([], now)).toBeNull();
  });

  it('elige la primera tanda vigente por orden', () => {
    const preventa = { ...base, nombre: 'Preventa', precioCrc: 8000, orden: 0 };
    const general = { ...base, nombre: 'General', precioCrc: 10000, orden: 1 };
    expect(tandaActiva([general, preventa], now)?.nombre).toBe('Preventa');
  });

  it('salta tandas fuera de ventana de fechas', () => {
    const pasada = { ...base, nombre: 'Early', precioCrc: 7000, orden: 0, ventaHasta: '2026-07-01T00:00:00Z' };
    const futura = { ...base, nombre: 'Puerta', precioCrc: 12000, orden: 2, ventaDesde: '2026-08-01T00:00:00Z' };
    const vigente = { ...base, nombre: 'Preventa 2', precioCrc: 9000, orden: 1 };
    expect(tandaActiva([pasada, vigente, futura], now)?.nombre).toBe('Preventa 2');
  });

  it('salta tandas con cupo agotado', () => {
    const agotada = { ...base, nombre: 'Early', precioCrc: 7000, orden: 0, cupo: 100, vendidos: 100 };
    const abierta = { ...base, nombre: 'General', precioCrc: 10000, orden: 1 };
    expect(tandaActiva([agotada, abierta], now)?.nombre).toBe('General');
  });

  it('devuelve null si ninguna aplica (cae al precio base del tipo)', () => {
    const cerrada = { ...base, nombre: 'Early', precioCrc: 7000, orden: 0, ventaHasta: '2026-07-01T00:00:00Z' };
    expect(tandaActiva([cerrada], now)).toBeNull();
  });
});
