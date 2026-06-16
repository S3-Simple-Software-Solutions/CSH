import { Router } from 'express';
import { env } from '../../config/env';
import { escapeHtml } from '../../core/http';
import { genId } from '../../core/id';
import { ApiError } from '../../core/errors';
import { makeMailTransport, emailShell, commonMailAttachments } from '../../core/mailer';
import { requireAdmin } from '../auth/auth.middleware';
import { insertMessage, findAllMessages, findMessageById, updateMessageEstado, deleteMessage } from './contacto.repository';
import type { EstadoMensaje } from './contacto.types';

export const contactoRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);
const ESTADOS_VALIDOS: EstadoMensaje[] = ['nuevo', 'leido', 'respondido', 'archivado'];

// ── Pública: recibir mensaje ──────────────────────────────────────────────────

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

    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim() || null;

    await insertMessage({ id: genId('MSG'), nombre, apellido, email, telefono, asunto, mensaje, ip });

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

// ── Admin: ver y gestionar mensajes ──────────────────────────────────────────

contactoRouter.get('/admin/api/contacto', requireAdmin, async (_req, res, next) => {
  try {
    const mensajes = await findAllMessages();
    res.json({ ok: true, mensajes });
  } catch (err) { next(err); }
});

contactoRouter.patch('/admin/api/contacto/:id/estado', requireAdmin, async (req, res, next) => {
  try {
    const { estado } = req.body;
    if (!ESTADOS_VALIDOS.includes(estado)) throw new ApiError(400, `Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}`);
    const mensaje = await findMessageById(String(req.params.id));
    if (!mensaje) throw new ApiError(404, 'Mensaje no encontrado');
    const updated = await updateMessageEstado(mensaje.id, estado);
    res.json({ ok: true, mensaje: updated });
  } catch (err) { next(err); }
});

contactoRouter.delete('/admin/api/contacto/:id', requireAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteMessage(String(req.params.id));
    if (!deleted) throw new ApiError(404, 'Mensaje no encontrado');
    res.json({ ok: true });
  } catch (err) { next(err); }
});
