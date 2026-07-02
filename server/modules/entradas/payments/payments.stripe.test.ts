import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock del SDK de Stripe: capturamos las llamadas reales que hace nuestro código.
const { constructEvent, sessionsCreate } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  sessionsCreate: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: class {
    webhooks = { constructEvent };
    checkout = { sessions: { create: sessionsCreate } };
    constructor(_key: string) { /* noop */ }
  },
}));

import {
  StripeGateway,
  toStripeMinorUnit,
  fromStripeMinorUnit,
  buildStripeLineItems,
} from './payments.stripe';

beforeEach(() => {
  constructEvent.mockReset();
  sessionsCreate.mockReset();
});

describe('conversión de moneda Stripe', () => {
  it('CRC usa subunidad ×100', () => {
    expect(toStripeMinorUnit(8000, 'crc')).toBe(800000);
    expect(fromStripeMinorUnit(800000, 'crc')).toBe(8000);
  });

  it('monedas sin decimales (JPY) no multiplican', () => {
    expect(toStripeMinorUnit(8000, 'jpy')).toBe(8000);
    expect(fromStripeMinorUnit(8000, 'jpy')).toBe(8000);
  });
});

describe('buildStripeLineItems', () => {
  it('arma line_items con unit_amount en subunidad', () => {
    const items = buildStripeLineItems([{ nombre: 'Sol Norte', montoUnitarioCrc: 8000, cantidad: 2 }], 'crc');
    expect(items).toEqual([
      { quantity: 2, price_data: { currency: 'crc', unit_amount: 800000, product_data: { name: 'Sol Norte' } } },
    ]);
  });
});

describe('StripeGateway.createCheckout', () => {
  it('crea la sesión con metadata.ordenId y devuelve url + ref', async () => {
    sessionsCreate.mockResolvedValue({ id: 'cs_123', url: 'https://checkout.stripe/cs_123' });
    const gw = new StripeGateway('sk_test_x', 'whsec_x', 'crc');
    const res = await gw.createCheckout({
      ordenId: 'ORD-1',
      lineas: [{ nombre: 'Sol', montoUnitarioCrc: 8000, cantidad: 1 }],
      comprador: { nombre: 'Ana', email: 'ana@example.com' },
      successUrl: 'https://app/ok',
      cancelUrl: 'https://app/cancel',
    });
    expect(res).toEqual({ url: 'https://checkout.stripe/cs_123', providerRef: 'cs_123' });
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.mode).toBe('payment');
    expect(arg.metadata.ordenId).toBe('ORD-1');
    expect(arg.line_items[0].price_data.unit_amount).toBe(800000);
    expect(arg.customer_email).toBe('ana@example.com');
  });
});

describe('StripeGateway.parseWebhook', () => {
  const gw = new StripeGateway('sk_test_x', 'whsec_x', 'crc');

  it('mapea checkout.session.completed pagado → paid', () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { payment_status: 'paid', metadata: { ordenId: 'ORD-1' }, id: 'cs_1', amount_total: 800000, payment_intent: 'pi_1' } },
    });
    const evt = gw.parseWebhook(Buffer.from('{}'), 'sig');
    expect(evt.type).toBe('paid');
    expect(evt.ordenId).toBe('ORD-1');
    expect(evt.providerRef).toBe('cs_1');
    expect(evt.pago?.monto).toBe(8000);
    expect(evt.pago?.transaccion).toBe('pi_1');
  });

  it('completed sin pagar → ignored', () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { payment_status: 'unpaid', metadata: {}, id: 'cs_2' } },
    });
    expect(gw.parseWebhook(Buffer.from('{}'), 'sig').type).toBe('ignored');
  });

  it('mapea checkout.session.expired → expired', () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.expired',
      data: { object: { metadata: { ordenId: 'ORD-9' }, id: 'cs_9' } },
    });
    const evt = gw.parseWebhook(Buffer.from('{}'), 'sig');
    expect(evt.type).toBe('expired');
    expect(evt.ordenId).toBe('ORD-9');
  });

  it('otros eventos → ignored', () => {
    constructEvent.mockReturnValue({ type: 'payment_intent.created', data: { object: {} } });
    expect(gw.parseWebhook(Buffer.from('{}'), 'sig').type).toBe('ignored');
  });

  it('firma inválida → lanza', () => {
    constructEvent.mockImplementation(() => { throw new Error('Invalid signature'); });
    expect(() => gw.parseWebhook(Buffer.from('{}'), 'bad')).toThrow('Invalid signature');
  });
});
