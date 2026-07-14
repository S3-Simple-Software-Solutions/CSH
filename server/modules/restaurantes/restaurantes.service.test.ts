import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock del repositorio y del gateway para probar el service sin BD ni red.
const repo = vi.hoisted(() => ({
  confirmarOrden: vi.fn(),
  expirarOrden: vi.fn(),
}));
const gateway = vi.hoisted(() => ({ parseWebhook: vi.fn() }));

vi.mock('./restaurantes.repository', () => repo);
vi.mock('./restaurantes.payments', () => ({ getRestaurantesPaymentGateway: () => gateway }));
vi.mock('./restaurantes.mail', () => ({ trySendConfirmacion: vi.fn() }));

import { calcularTotales, puedeTransicionar, procesarWebhook } from './restaurantes.service';

describe('calcularTotales', () => {
  it('suma fee al subtotal cuando hay productos', () => {
    expect(calcularTotales(5000, 1000)).toEqual({ subtotalCrc: 5000, feeCrc: 1000, totalCrc: 6000 });
  });
  it('no cobra fee si el subtotal es 0', () => {
    expect(calcularTotales(0, 1000)).toEqual({ subtotalCrc: 0, feeCrc: 0, totalCrc: 0 });
  });
  it('redondea y nunca deja negativos', () => {
    expect(calcularTotales(-10, -5)).toEqual({ subtotalCrc: 0, feeCrc: 0, totalCrc: 0 });
  });
});

describe('puedeTransicionar (máquina de estados)', () => {
  it('permite el flujo normal', () => {
    expect(puedeTransicionar('pendiente', 'en_preparacion')).toBe(true);
    expect(puedeTransicionar('en_preparacion', 'listo')).toBe(true);
    expect(puedeTransicionar('listo', 'entregada')).toBe(true);
  });
  it('permite rechazar desde pendiente o en_preparacion', () => {
    expect(puedeTransicionar('pendiente', 'rechazada')).toBe(true);
    expect(puedeTransicionar('en_preparacion', 'rechazada')).toBe(true);
  });
  it('rechaza transiciones inválidas', () => {
    expect(puedeTransicionar('pendiente', 'entregada')).toBe(false);
    expect(puedeTransicionar('entregada', 'pendiente')).toBe(false);
    expect(puedeTransicionar('pendiente_pago', 'pendiente')).toBe(false); // solo por webhook
  });
});

describe('procesarWebhook', () => {
  beforeEach(() => {
    repo.confirmarOrden.mockReset();
    repo.expirarOrden.mockReset();
  });

  it('ignora órdenes que no son de restaurantes (prefijo distinto de ROR-)', async () => {
    gateway.parseWebhook.mockReturnValue({ type: 'paid', ordenId: 'ORD-entrada123', pago: { transaccion: 'x', monto: 1, timestamp: '', metodo: 'stripe' } });
    await procesarWebhook(Buffer.from(''), 'sig');
    expect(repo.confirmarOrden).not.toHaveBeenCalled();
  });

  it('confirma la orden propia al recibir paid', async () => {
    repo.confirmarOrden.mockResolvedValue(null);
    gateway.parseWebhook.mockReturnValue({ type: 'paid', ordenId: 'ROR-abc', pago: { transaccion: 'pi_1', monto: 6000, timestamp: '', metodo: 'stripe' } });
    await procesarWebhook(Buffer.from(''), 'sig');
    expect(repo.confirmarOrden).toHaveBeenCalledWith('ROR-abc', expect.objectContaining({ transaccion: 'pi_1' }));
  });

  it('expira la orden propia al recibir expired', async () => {
    gateway.parseWebhook.mockReturnValue({ type: 'expired', ordenId: 'ROR-xyz' });
    await procesarWebhook(Buffer.from(''), 'sig');
    expect(repo.expirarOrden).toHaveBeenCalledWith('ROR-xyz');
  });
});
