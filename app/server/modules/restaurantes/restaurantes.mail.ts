import QRCodeNode from 'qrcode';
import { env } from '../../config/env';
import { escapeHtml } from '../../core/http';
import { makeMailTransport, emailShell, commonMailAttachments, MailAttachment } from '../../core/mailer';
import type { OrdenRestaurante } from './restaurantes.types';

function money(crc: number): string {
  return `₡${Math.round(crc).toLocaleString('es-CR')}`;
}

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

// Correo de confirmación de pedido pagado, con el código de la orden en QR.
export async function sendConfirmacionEmail(orden: OrdenRestaurante): Promise<void> {
  const to = orden.clienteEmail;
  if (!isValidEmailAddress(to)) throw new Error('Correo invalido');

  const qrPng = await QRCodeNode.toBuffer(orden.codigo, { type: 'png', width: 320, margin: 2, errorCorrectionLevel: 'M' });
  const qrAttachment: MailAttachment = {
    filename: `${orden.codigo}.png`, content: qrPng, contentType: 'image/png', cid: 'orden-qr', contentDisposition: 'inline',
  };

  const entregaHtml = orden.entrega.tipo === 'asiento'
    ? `<p style="margin:0;color:#f7f1df;font-size:14px">Te lo llevamos a: <b>Sección ${escapeHtml(orden.entrega.seccion)}, Fila ${escapeHtml(orden.entrega.fila)}, Asiento ${escapeHtml(orden.entrega.asiento)}</b></p>`
    : `<p style="margin:0;color:#f7f1df;font-size:14px">Retiralo en <b>${escapeHtml(orden.restauranteNombre)}</b> mostrando este código QR.</p>`;

  const lineasHtml = orden.lineas.map((l) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid rgba(247,241,223,.12)">${l.cantidad}× ${escapeHtml(l.nombre)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid rgba(247,241,223,.12);text-align:right">${money(l.precioCrc * l.cantidad)}</td></tr>`,
  ).join('');

  const body = `<p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#d8cdb6">¡Gracias por tu pedido! Ya está confirmado. Tiempo estimado de preparación ~${orden.lineas.length ? '15' : '15'} min.</p>
    <div style="margin:0 0 18px;padding:16px;border:1px solid rgba(201,169,97,.45);border-radius:6px;text-align:center">
      <img src="cid:orden-qr" width="200" alt="QR ${escapeHtml(orden.codigo)}" style="display:inline-block;background:#fff;border:8px solid #fff;border-radius:6px">
      <p style="margin:12px 0 2px;color:#c9a961;font-weight:800;font-size:20px;letter-spacing:.05em">${escapeHtml(orden.codigo)}</p>
      ${entregaHtml}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 6px;color:#f7f1df">${lineasHtml}
      <tr><td style="padding:6px 10px;text-align:right;color:#c9a961">Subtotal</td><td style="padding:6px 10px;text-align:right">${money(orden.subtotalCrc)}</td></tr>
      <tr><td style="padding:6px 10px;text-align:right;color:#c9a961">Cargo por servicio</td><td style="padding:6px 10px;text-align:right">${money(orden.feeCrc)}</td></tr>
      <tr><td style="padding:6px 10px;text-align:right;color:#c9a961;font-weight:bold">Total</td><td style="padding:6px 10px;text-align:right;font-weight:bold">${money(orden.totalCrc)}</td></tr>
    </table>
    <p style="font-size:12px;color:#aa9d84;margin:18px 0 0;text-align:center">Seguí tu pedido en <a href="${env.MAIL_APP_URL}/comida" style="color:#c9a961">${env.MAIL_APP_URL}/comida</a></p>`;

  await makeMailTransport().sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `Pedido ${orden.codigo} confirmado - ${orden.restauranteNombre}`,
    html: emailShell('Herediano', 'Tu pedido', body),
    attachments: [qrAttachment, ...(await commonMailAttachments())],
  });
}

// Envío best-effort: un fallo de correo nunca debe romper el pago.
export async function trySendConfirmacion(orden: OrdenRestaurante): Promise<void> {
  try {
    await sendConfirmacionEmail(orden);
  } catch (err) {
    console.error(`[mail] Error enviando confirmación de pedido ${orden.codigo}: ${(err as Error).message}`);
  }
}
