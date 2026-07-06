import { env } from '../../../config/env';
import type { PaymentGateway } from './payments.types';
import { StripeGateway } from './payments.stripe';

let instance: PaymentGateway | null = null;

// Selecciona la pasarela según env.PAYMENTS_PROVIDER. Para agregar otra pasarela,
// implementa PaymentGateway y añade un case aquí.
export function getPaymentGateway(): PaymentGateway {
  if (instance) return instance;
  switch (env.PAYMENTS_PROVIDER) {
    case 'stripe':
      instance = new StripeGateway(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CURRENCY);
      break;
    default:
      throw new Error(`Pasarela de pagos no soportada: ${env.PAYMENTS_PROVIDER}`);
  }
  return instance;
}

// Sólo para tests: descarta la instancia memorizada.
export function resetPaymentGateway(): void {
  instance = null;
}
