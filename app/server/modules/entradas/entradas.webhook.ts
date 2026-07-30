import { Router, raw } from 'express';
import * as entradas from './entradas.service';

// Router del webhook de pagos. Se monta ANTES de express.json() en app.ts porque
// la verificación de firma necesita el body crudo (Buffer), no el JSON parseado.
export const entradasWebhookRouter = Router();

entradasWebhookRouter.post(
  '/api/entradas/webhook',
  raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      await entradas.procesarWebhook(req.body as Buffer, req.header('stripe-signature'));
      res.json({ received: true });
    } catch (err) {
      // Firma inválida o error de parseo → 400 para que la pasarela reintente.
      console.error(`[pagos] Webhook rechazado: ${(err as Error).message}`);
      res.status(400).json({ ok: false, error: 'Webhook invalido' });
    }
  },
);
