import QRCodeNode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { env } from '../../config/env';
import { escapeHtml } from '../../core/http';
import { makeMailTransport, emailShell, commonMailAttachments, fmtMailDate, MailAttachment } from '../../core/mailer';
import { Boleto, Evento } from './entradas.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Genera un boleto imprimible en PDF (A5 vertical) con el QR y los datos del evento.
async function buildTicketPdf({ evento, boleto, qrPng }: { evento: Evento; boleto: Boleto; qrPng: Buffer }): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.788, 0.663, 0.38);
  const dark = rgb(0.04, 0.035, 0.03);
  const paper = rgb(0.97, 0.945, 0.875);
  const muted = rgb(0.667, 0.616, 0.518);

  page.drawRectangle({ x: 0, y: 0, width, height, color: dark });

  const center = (text: string, y: number, size: number, f = font, color = paper) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font: f, color });
  };

  center('CLUB SPORT HEREDIANO', height - 52, 13, bold, gold);
  center((boleto.tipoNombre || 'Entrada').toUpperCase(), height - 80, 11, bold, muted);

  // Lámina blanca + QR centrado.
  const qrSize = 230;
  const pad = 16;
  const qrX = (width - qrSize) / 2;
  const qrY = height - 130 - qrSize;
  page.drawRectangle({ x: qrX - pad, y: qrY - pad, width: qrSize + pad * 2, height: qrSize + pad * 2, color: rgb(1, 1, 1) });
  const qrImg = await pdf.embedPng(qrPng);
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  let y = qrY - pad - 36;
  center(evento.nombre, y, 16, bold, paper);
  y -= 24;
  center(`${evento.venue} · ${fmtMailDate(evento.fecha)}`, y, 11, font, muted);
  y -= 30;
  center(`Código ${boleto.codigo}`, y, 13, bold, gold);
  y -= 22;
  center('Válido para un único ingreso. Presentá este QR en el acceso.', y, 9, font, muted);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export async function sendEntradasEmail({ to, evento, boletos }: { to: string; evento: Evento; boletos: Boleto[] }): Promise<void> {
  if (!to || !EMAIL_RE.test(to)) throw new Error('Correo invalido');

  const qrAttachments: MailAttachment[] = [];
  const pdfAttachments: MailAttachment[] = [];
  const cards: string[] = [];
  for (let i = 0; i < boletos.length; i++) {
    const b = boletos[i];
    const cid = `entrada-qr-${i}`;
    const png = await QRCodeNode.toBuffer(b.qrData, { type: 'png', width: 320, margin: 2, errorCorrectionLevel: 'M' });
    qrAttachments.push({ filename: `${b.codigo}.png`, content: png, contentType: 'image/png', cid, contentDisposition: 'inline' });
    const pdf = await buildTicketPdf({ evento, boleto: b, qrPng: png });
    pdfAttachments.push({ filename: `entrada-${b.codigo}.pdf`, content: pdf, contentType: 'application/pdf', contentDisposition: 'attachment' });
    cards.push(
      `<div style="margin:0 0 16px;padding:16px;border:1px solid rgba(201,169,97,.45);border-radius:6px;text-align:center">
        <img src="cid:${cid}" width="200" alt="QR ${escapeHtml(b.codigo)}" style="display:inline-block;background:#fff;border:8px solid #fff;border-radius:6px">
        <p style="margin:12px 0 2px;color:#c9a961;font-weight:800;font-size:16px;letter-spacing:.05em">${escapeHtml(b.tipoNombre || 'Entrada')}</p>
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
    attachments: [...qrAttachments, ...pdfAttachments, ...(await commonMailAttachments())],
  });
}
