// Notificación de entradas por WhatsApp (Meta Cloud API).
//
// Envía una plantilla aprobada por boleto, con el QR como imagen de header.
// La plantilla (env.WHATSAPP_TEMPLATE_ENTRADAS, default 'entrada_confirmacion')
// debe estar aprobada en Meta con este formato:
//   Header: IMAGE
//   Body:   {{1}} = evento · {{2}} = fecha y lugar · {{3}} = sector/asiento · {{4}} = código
//
// El envío es best-effort: los fallos se registran pero nunca afectan la compra
// ni el correo (mismo patrón no-fatal que sendEntradasEmail).

import QRCodeNode from 'qrcode';
import { isWhatsAppEnabled, normalizePhone, sendTemplate, uploadMedia } from '../../core/whatsapp';
import { env } from '../../config/env';
import { fmtMailDate } from '../../core/mailer';
import { Boleto, Evento } from './entradas.types';

export async function sendEntradasWhatsApp({ to, evento, boletos }: { to: string; evento: Evento; boletos: Boleto[] }): Promise<void> {
  if (!isWhatsAppEnabled()) return;
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Telefono invalido para WhatsApp');

  for (const b of boletos) {
    const png = await QRCodeNode.toBuffer(b.qrData, { type: 'png', width: 480, margin: 2, errorCorrectionLevel: 'M' });
    const mediaId = await uploadMedia(png, 'image/png', `${b.codigo}.png`);
    const sector = b.asientoLabel ? `${b.tipoNombre || 'Entrada'} · ${b.asientoLabel}` : (b.tipoNombre || 'Entrada');
    await sendTemplate({
      to: phone,
      template: env.WHATSAPP_TEMPLATE_ENTRADAS,
      headerImageMediaId: mediaId,
      bodyParams: [
        evento.nombre,
        `${fmtMailDate(evento.fecha)} · ${evento.venue}`,
        sector,
        b.codigo,
      ],
    });
  }
}
