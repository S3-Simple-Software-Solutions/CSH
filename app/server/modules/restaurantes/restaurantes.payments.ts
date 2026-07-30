import { env } from '../../config/env';
import type { PaymentGateway } from '../entradas/payments/payments.types';
import { StripeGateway } from '../entradas/payments/payments.stripe';

// Reusa la pasarela genérica de entradas con una instancia propia: usa su
// PROPIO webhook secret para que el endpoint /api/restaurantes/webhook verifique
// firmas de su endpoint de Stripe (registrado por separado). Ver plan §3.
let instance: PaymentGateway | null = null;

export function getRestaurantesPaymentGateway(): PaymentGateway {
  if (instance) return instance;
  switch (env.PAYMENTS_PROVIDER) {
    case 'stripe':
      instance = new StripeGateway(env.STRIPE_SECRET_KEY, env.RESTAURANTES_STRIPE_WEBHOOK_SECRET, env.STRIPE_CURRENCY);
      break;
    default:
      throw new Error(`Pasarela de pagos no soportada: ${env.PAYMENTS_PROVIDER}`);
  }
  return instance;
}

// Sólo para tests.
export function resetRestaurantesPaymentGateway(): void {
  instance = null;
}
