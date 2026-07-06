// Notificación de entradas por WhatsApp (Twilio).
// Envía un mensaje por boleto con el QR como imagen adjunta.
// El QR se sirve desde api.qrserver.com (URL pública que Twilio puede buscar).
// Envío best-effort: fallos se loguean pero nunca afectan la compra ni el correo.

import { isWhatsAppEnabled, normalizePhone, sendWhatsAppMessage } from '../../core/whatsapp';
import { fmtMailDate } from '../../core/mailer';
import type { Boleto, Evento } from './entradas.types';

function qrImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=400x400&margin=10`;
}

export async function sendEntradasWhatsApp({
  to,
  evento,
  boletos,
}: {
  to: string;
  evento: Evento;
  boletos: Boleto[];
}): Promise<void> {
  if (!isWhatsAppEnabled()) return;
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Teléfono inválido para WhatsApp');

  for (const b of boletos) {
    const sector = b.asientoLabel
      ? `${b.tipoNombre || 'Entrada'} · ${b.asientoLabel}`
      : (b.tipoNombre || 'Entrada');

    const body = [
      `✅ *${evento.nombre}*`,
      '',
      `📅 ${fmtMailDate(evento.fecha)} · ${evento.venue}`,
      `🎟️ ${sector}`,
      `🔑 Código: *${b.codigo}*`,
      '',
      'Presentá el QR adjunto en el ingreso. ¡Nos vemos!',
    ].join('\n');

    await sendWhatsAppMessage({ to: phone, body, mediaUrl: qrImageUrl(b.qrData) });
  }
}
