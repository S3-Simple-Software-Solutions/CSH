// Cliente WhatsApp vía Twilio (sandbox o producción).
// Sandbox: número +14155238886, sin plantillas aprobadas.
// El usuario debe mandar "join <palabra>" al número sandbox una vez para activar la ventana.

import twilio from 'twilio';
import { env } from '../config/env';

export function isWhatsAppEnabled(): boolean {
  return env.WHATSAPP_ENABLED && Boolean(env.TWILIO_ACCOUNT_SID) && Boolean(env.TWILIO_AUTH_TOKEN);
}

// Normaliza a formato internacional sin '+': números CR de 8 dígitos reciben prefijo 506.
export function normalizePhone(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 8) return `506${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return '';
}

export async function sendWhatsAppMessage({
  to,
  body,
  mediaUrl,
}: {
  to: string;
  body: string;
  mediaUrl?: string;
}): Promise<void> {
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  const params: Parameters<typeof client.messages.create>[0] = {
    from: env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:+${to}`,
    body,
  };
  if (mediaUrl) params.mediaUrl = [mediaUrl];
  await client.messages.create(params);
}
