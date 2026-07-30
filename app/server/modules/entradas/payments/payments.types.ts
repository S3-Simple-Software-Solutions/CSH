import type { PagoEntrada } from '../entradas.types';

// Abstracción de pasarela de pagos. Hoy solo existe Stripe, pero toda la lógica
// de entradas depende de esta interfaz — agregar otra pasarela (dLocal, Onvo,
// PayPal…) es implementar esta interfaz y registrarla en payments.factory.ts.

export interface CheckoutLineItem {
  nombre: string;
  montoUnitarioCrc: number;
  cantidad: number;
}

export interface CreateCheckoutInput {
  ordenId: string;
  lineas: CheckoutLineItem[];
  comprador: { nombre: string; email: string };
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResult {
  url: string;
  providerRef: string;
}

export type PaymentEventType = 'paid' | 'expired' | 'ignored';

export interface PaymentEvent {
  type: PaymentEventType;
  ordenId?: string;
  providerRef?: string;
  pago?: PagoEntrada;
}

export interface PaymentGateway {
  readonly id: string;
  // Crea una sesión de pago hospedada y devuelve la URL a la que redirigir.
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  // Verifica la firma del webhook y normaliza el evento del proveedor.
  parseWebhook(rawBody: Buffer, signature: string | undefined): PaymentEvent;
}
