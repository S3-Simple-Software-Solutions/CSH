import Stripe from 'stripe';
import type { PagoEntrada } from '../entradas.types';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentEvent,
  PaymentGateway,
} from './payments.types';

// Monedas sin decimales en Stripe (el monto ya está en la unidad base).
// El resto (incl. CRC) usa la subunidad ×100. Ref: stripe.com/docs/currencies
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf',
  'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

// Convierte un monto en la moneda base (p.ej. colones) a la unidad mínima que
// espera Stripe. Pura y exportada para test unitario.
export function toStripeMinorUnit(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? Math.round(amount) : Math.round(amount * 100);
}

export function fromStripeMinorUnit(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? amount : Math.round(amount / 100);
}

// Construye los line_items de Stripe a partir de las líneas de la orden.
// Exportada para test unitario.
export function buildStripeLineItems(
  lineas: CreateCheckoutInput['lineas'],
  currency: string,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return lineas.map((l) => ({
    quantity: l.cantidad,
    price_data: {
      currency,
      unit_amount: toStripeMinorUnit(l.montoUnitarioCrc, currency),
      product_data: { name: l.nombre },
    },
  }));
}

export class StripeGateway implements PaymentGateway {
  readonly id = 'stripe';
  private readonly stripe: Stripe;
  private readonly currency: string;
  private readonly webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string, currency: string) {
    if (!secretKey) throw new Error('Falta HEREDIANO_STRIPE_SECRET_KEY para usar la pasarela Stripe');
    this.stripe = new Stripe(secretKey);
    this.webhookSecret = webhookSecret;
    this.currency = currency.toLowerCase();
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.comprador.email,
      line_items: buildStripeLineItems(input.lineas, this.currency),
      metadata: { ordenId: input.ordenId },
      payment_intent_data: { metadata: { ordenId: input.ordenId } },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    if (!session.url) throw new Error('Stripe no devolvió una URL de checkout');
    return { url: session.url, providerRef: session.id };
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): PaymentEvent {
    // Lanza si la firma es inválida o falta el secret → la ruta responde 400.
    const event = this.stripe.webhooks.constructEvent(rawBody, signature ?? '', this.webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== 'paid') return { type: 'ignored' };
      const pago: PagoEntrada = {
        transaccion: typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? session.id),
        monto: fromStripeMinorUnit(session.amount_total ?? 0, this.currency),
        timestamp: new Date().toISOString(),
        metodo: 'stripe',
      };
      return { type: 'paid', ordenId: session.metadata?.ordenId, providerRef: session.id, pago };
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      return { type: 'expired', ordenId: session.metadata?.ordenId, providerRef: session.id };
    }

    return { type: 'ignored' };
  }
}
