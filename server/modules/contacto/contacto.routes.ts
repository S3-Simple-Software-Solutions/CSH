import { Router } from 'express';
import { env } from '../../config/env';
import { escapeHtml } from '../../core/http';
import { makeMailTransport, emailShell, commonMailAttachments } from '../../core/mailer';

export const contactoRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

contactoRouter.post('/api/contacto', async (req, res, next) => {
  try {
    const nombre = str(req.body.nombre, 80);
    const apellido = str(req.body.apellido, 80);
    const email = str(req.body.email, 120);
    const telefono = str(req.body.telefono, 40);
    const asunto = str(req.body.asunto, 140) || 'Mensaje de contacto';
    const mensaje = str(req.body.mensaje, 4000);

    if (!nombre || !email || !mensaje) return res.status(400).json({ ok: false, error: 'Completá nombre, correo y mensaje.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'El correo no es válido.' });

    const row = (label: string, value: string) =>
      `<tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">${label}</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(value)}</td></tr>`;
    const body =
      `<p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#d8cdb6">Nuevo mensaje desde el formulario de contacto del sitio.</p>` +
      `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 18px;color:#f7f1df">` +
      row('Nombre', `${nombre} ${apellido}`.trim()) +
      row('Correo', email) +
      (telefono ? row('Teléfono', telefono) : '') +
      row('Asunto', asunto) +
      `</table>` +
      `<p style="font-size:14px;line-height:1.6;white-space:pre-wrap;color:#f7f1df">${escapeHtml(mensaje)}</p>`;

    await makeMailTransport().sendMail({
      from: env.MAIL_FROM,
      to: env.CONTACT_EMAIL,
      replyTo: email,
      subject: `Contacto web: ${asunto}`,
      html: emailShell('Herediano', 'Formulario de contacto', body),
      attachments: await commonMailAttachments(),
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
