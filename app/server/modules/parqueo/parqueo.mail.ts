import QRCodeNode from 'qrcode';
import { env } from '../../config/env';
import { escapeHtml } from '../../core/http';
import { makeMailTransport, emailShell, commonMailAttachments, fmtMailDate } from '../../core/mailer';
import { ensureReservaQrData } from './parqueo.helpers';
import { Reservation, Recibo } from './parqueo.types';

export async function sendParkingQrEmail({ to, reserva }: { to: string; reserva: Reservation }): Promise<void> {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Correo invalido');
  const qrPng = await QRCodeNode.toBuffer(ensureReservaQrData(reserva), { type: 'png', width: 360, margin: 2, errorCorrectionLevel: 'M' });
  const body = `<p style="font-size:15px;line-height:1.55;margin:0 0 20px;color:#d8cdb6">Presenta este codigo QR en el acceso del parqueo. Guarda este correo hasta finalizar tu visita.</p><div style="text-align:center;margin:18px 0 22px"><img src="cid:parking-qr" width="220" alt="QR de parqueo" style="display:inline-block;background:#fff;border:8px solid #fff;border-radius:6px"></div><table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 22px;color:#f7f1df"><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Espacio</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(reserva.espacioId)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Placa</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(reserva.placa)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Desde</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(fmtMailDate(reserva.inicio))}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Hasta</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(fmtMailDate(reserva.fin))}</td></tr></table><p style="font-size:12px;color:#aa9d84;margin:20px 0 0;text-align:center">Modulo de parqueo: <a href="${env.MAIL_APP_URL}/parqueo" style="color:#c9a961">${env.MAIL_APP_URL}/parqueo</a></p>`;
  await makeMailTransport().sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `QR de parqueo ${reserva.espacioId} - Club Sport Herediano`,
    html: emailShell('Herediano', 'QR de parqueo', body),
    attachments: [
      { filename: `QR-${reserva.codigo || reserva.espacioId}.png`, content: qrPng, contentType: 'image/png', cid: 'parking-qr', contentDisposition: 'inline' },
      ...(await commonMailAttachments()),
    ],
  });
}

export async function sendPaymentReceiptEmail({ to, reserva, recibo }: { to: string; reserva: Reservation; recibo: Recibo }): Promise<void> {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Correo invalido');
  const body = `<p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#d8cdb6">Tu pago fue registrado correctamente. Gracias por visitar al Team.</p><div style="margin:0 0 18px;padding:18px;border:1px solid rgba(201,169,97,.45);border-radius:6px;text-align:center"><p style="margin:0;color:#aa9d84;font-size:12px;letter-spacing:.14em;text-transform:uppercase">Total pagado</p><p style="margin:6px 0 0;color:#c9a961;font-size:32px;font-weight:900">CRC ${recibo.monto}</p></div><table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 22px;color:#f7f1df"><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Transaccion</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(recibo.transaccion)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Espacio</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(reserva.espacioId)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Placa</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(reserva.placa)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">Tiempo cobrado</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${recibo.horas}h</td></tr></table><p style="font-size:12px;color:#aa9d84;margin:20px 0 0;text-align:center">El espacio quedo liberado despues del pago.</p>`;
  await makeMailTransport().sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `Recibo de parqueo ${reserva.espacioId} - Club Sport Herediano`,
    html: emailShell('Herediano', 'Recibo de parqueo', body),
    attachments: await commonMailAttachments(),
  });
}
