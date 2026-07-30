import { Router, raw } from 'express';
import * as restaurantes from './restaurantes.service';

// Webhook de pagos del módulo de restaurantes. Se monta ANTES de express.json()
// en app.ts porque la verificación de firma necesita el body crudo (Buffer).
// Endpoint de Stripe separado del de entradas, con su propio signing secret.
export const restaurantesWebhookRouter = Router();

restaurantesWebhookRouter.post(
  '/api/restaurantes/webhook',
  raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      await restaurantes.procesarWebhook(req.body as Buffer, req.header('stripe-signature'));
      res.json({ received: true });
    } catch (err) {
      console.error(`[pagos] Webhook restaurantes rechazado: ${(err as Error).message}`);
      res.status(400).json({ ok: false, error: 'Webhook invalido' });
    }
  },
);
