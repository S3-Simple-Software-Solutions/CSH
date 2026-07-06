import QRCodeNode from 'qrcode';
import { env } from '../../config/env';
import { escapeHtml } from '../../core/http';
import { makeMailTransport, emailShell, commonMailAttachments, fmtMailDate, MailAttachment } from '../../core/mailer';
import { Boleto, Evento } from './entradas.types';

function isValidEmailAddress(value: string): boolean {
  if (!value || value.length > 254) return false;
  for (const char of value) {
    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') return false;
  }
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@')) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

export async function sendEntradasEmail({ to, evento, boletos }: { to: string; evento: Evento; boletos: Boleto[] }): Promise<void> {
  if (!isValidEmailAddress(to)) throw new Error('Correo invalido');

  const qrAttachments: MailAttachment[] = [];
  const cards: string[] = [];
  for (let i = 0; i < boletos.length; i++) {
    const b = boletos[i];
    const cid = `entrada-qr-${i}`;
    const png = await QRCodeNode.toBuffer(b.qrData, { type: 'png', width: 320, margin: 2, errorCorrectionLevel: 'M' });
    qrAttachments.push({ filename: `${b.codigo}.png`, content: png, contentType: 'image/png', cid, contentDisposition: 'inline' });
    cards.push(
      `<div style="margin:0 0 16px;padding:16px;border:1px solid rgba(201,169,97,.45);border-radius:6px;text-align:center">
        <img src="cid:${cid}" width="200" alt="QR ${escapeHtml(b.codigo)}" style="display:inline-block;background:#fff;border:8px solid #fff;border-radius:6px">
        <p style="margin:12px 0 2px;color:#c9a961;font-weight:800;font-size:16px;letter-spacing:.05em">${escapeHtml(b.tipoNombre || 'Entrada')}</p>
        ${b.asientoLabel ? `<p style="margin:0 0 2px;color:#f7f1df;font-size:14px;font-weight:700">${escapeHtml(b.asientoLabel)}</p>` : ''}
        <p style="margin:0;color:#f7f1df;font-size:13px">Codigo <b>${escapeHtml(b.codigo)}</b></p>
      </div>`,
    );
  }

  const body = `<p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#d8cdb6">Gracias por tu compra. Presenta cada codigo QR en el acceso del estadio. Cada boleto es valido para un unico ingreso.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 22px;color:#f7f1df">
      <tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Evento</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(evento.nombre)}</td></tr>
      <tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Lugar</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(evento.venue)}</td></tr>
      <tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Fecha</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(fmtMailDate(evento.fecha))}</td></tr>
      <tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Boletos</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${boletos.length}</td></tr>
    </table>
    ${cards.join('')}
    <p style="font-size:12px;color:#aa9d84;margin:18px 0 0;text-align:center">Modulo de entradas: <a href="${env.MAIL_APP_URL}/entradas" style="color:#c9a961">${env.MAIL_APP_URL}/entradas</a></p>`;

  await makeMailTransport().sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `Entradas ${evento.nombre} - Club Sport Herediano`,
    html: emailShell('Herediano', 'Tus entradas', body),
    attachments: [...qrAttachments, ...(await commonMailAttachments())],
  });
}
