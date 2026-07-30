import fs from 'fs';
import path from 'path';
import { Router, raw } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env';
import { PUBLIC_DIR } from '../../config/constants';
import { escapeHtml } from '../../core/http';
import { IMG_EXT } from '../../core/id';
import { ApiError } from '../../core/errors';
import { makeMailTransport, emailShell, commonMailAttachments } from '../../core/mailer';
import { requireAdmin } from '../auth/auth.middleware';
import * as venues from './venues.service';
import { deleteSalon, findSalonById, insertSalon, updateSalon } from './venues.repository';

export const venuesRouter = Router();

const imgUpload = raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], limit: '8mb' });
// La subida escribe a disco; aunque exige admin, se limita por IP (CodeQL js/missing-rate-limiting).
const imgRateLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
// El formulario público es anónimo: se limita para que no se use como spam.
const solicitudRateLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const SALON_IMG_DIR = path.join(PUBLIC_DIR, 'brand', 'salones');

const str = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);
const num = (v: unknown, max: number): number => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

function amenidadesDe(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => str(a, 60)).filter(Boolean).slice(0, 20);
}

// ── Pública ───────────────────────────────────────────────────────────────────

venuesRouter.get('/api/venues/salones', async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await venues.getSalonesPublicos()) });
  } catch (err) { next(err); }
});

venuesRouter.post('/api/venues/solicitudes', solicitudRateLimit, async (req, res, next) => {
  try {
    const { reserva, salon, ocupado } = await venues.crearSolicitudPublica(req.body);

    // El correo es un aviso: si el SMTP falla, la solicitud ya quedó guardada.
    try {
      const row = (label: string, value: string) =>
        `<tr><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12);color:#c9a961;font-weight:bold">${label}</td><td style="padding:10px;border-bottom:1px solid rgba(247,241,223,.12)">${escapeHtml(value)}</td></tr>`;
      const body =
        `<p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#d8cdb6">Nueva solicitud de alquiler de salón desde el sitio.</p>` +
        `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 18px;color:#f7f1df">` +
        row('Código', reserva.codigo) +
        row('Salón', salon.nombre) +
        row('Fecha', `${reserva.fecha} · ${reserva.horaInicio} a ${reserva.horaFin}`) +
        row('Personas', String(reserva.personas)) +
        row('Tipo de evento', reserva.tipoEvento || '—') +
        row('Cliente', reserva.clienteNombre) +
        row('Correo', reserva.clienteEmail) +
        (reserva.clienteTelefono ? row('Teléfono', reserva.clienteTelefono) : '') +
        (ocupado ? row('Atención', 'Ya hay una reserva confirmada en ese horario') : '') +
        `</table>` +
        (reserva.notas ? `<p style="font-size:14px;line-height:1.6;white-space:pre-wrap;color:#f7f1df">${escapeHtml(reserva.notas)}</p>` : '');
      await makeMailTransport().sendMail({
        from: env.MAIL_FROM,
        to: env.CONTACT_EMAIL,
        replyTo: reserva.clienteEmail,
        subject: `Alquiler de salón: ${salon.nombre} (${reserva.fecha})`,
        html: emailShell('Herediano', 'Solicitud de alquiler', body),
        attachments: await commonMailAttachments(),
      });
    } catch (mailErr) {
      console.error('No se pudo enviar el aviso de solicitud de salón:', mailErr);
    }

    res.json({ ok: true, codigo: reserva.codigo, ocupado });
  } catch (err) { next(err); }
});

// ── Admin ─────────────────────────────────────────────────────────────────────

venuesRouter.get('/admin/api/venues', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await venues.getAdminVenues({ estado: str(req.query.estado, 20), salonId: str(req.query.salonId, 40) })) });
  } catch (err) { next(err); }
});

venuesRouter.post('/admin/api/venues/salones', requireAdmin, async (req, res, next) => {
  try {
    const nombre = str(req.body?.nombre, 80);
    if (!nombre) throw new ApiError(400, 'El nombre es obligatorio');
    const salon = await insertSalon({
      nombre,
      descripcion: str(req.body?.descripcion, 1000),
      ubicacion: str(req.body?.ubicacion, 140),
      capacidad: num(req.body?.capacidad, 100000),
      tarifaHoraCrc: num(req.body?.tarifaHoraCrc, 100_000_000),
      tarifaDiaCrc: num(req.body?.tarifaDiaCrc, 100_000_000),
      amenidades: amenidadesDe(req.body?.amenidades),
    });
    res.status(201).json({ ok: true, salon });
  } catch (err) { next(err); }
});

venuesRouter.put('/admin/api/venues/salones/:id', requireAdmin, async (req, res, next) => {
  try {
    const actual = await findSalonById(String(req.params.id));
    if (!actual) throw new ApiError(404, 'Salón no encontrado');
    const patch: any = {};
    if (req.body?.nombre !== undefined) patch.nombre = str(req.body.nombre, 80) || actual.nombre;
    if (req.body?.descripcion !== undefined) patch.descripcion = str(req.body.descripcion, 1000);
    if (req.body?.ubicacion !== undefined) patch.ubicacion = str(req.body.ubicacion, 140);
    if (req.body?.capacidad !== undefined) patch.capacidad = num(req.body.capacidad, 100000);
    if (req.body?.tarifaHoraCrc !== undefined) patch.tarifaHoraCrc = num(req.body.tarifaHoraCrc, 100_000_000);
    if (req.body?.tarifaDiaCrc !== undefined) patch.tarifaDiaCrc = num(req.body.tarifaDiaCrc, 100_000_000);
    if (req.body?.activo !== undefined) patch.activo = Boolean(req.body.activo);
    if (req.body?.amenidades !== undefined) patch.amenidades = amenidadesDe(req.body.amenidades);
    res.json({ ok: true, salon: await updateSalon(actual.id, patch) });
  } catch (err) { next(err); }
});

venuesRouter.delete('/admin/api/venues/salones/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!(await deleteSalon(String(req.params.id)))) throw new ApiError(404, 'Salón no encontrado');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

venuesRouter.post('/admin/api/venues/salones/:id/imagen', imgRateLimit, requireAdmin, imgUpload, async (req, res, next) => {
  try {
    const salon = await findSalonById(String(req.params.id));
    if (!salon) throw new ApiError(404, 'Salón no encontrado');
    const ext = IMG_EXT[String(req.headers['content-type'] || '')];
    if (!ext) throw new ApiError(415, 'Formato no permitido. Usá JPG, PNG, WebP o AVIF');
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new ApiError(400, 'Enviá la imagen como cuerpo binario');
    fs.mkdirSync(SALON_IMG_DIR, { recursive: true });
    const filename = `${salon.slug}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(SALON_IMG_DIR, filename), req.body);
    const imagenUrl = `/brand/salones/${filename}`;
    // Borra la foto anterior para no acumular archivos huérfanos.
    const prev = salon.imagenUrl.split('?')[0];
    if (prev.startsWith('/brand/salones/') && prev !== imagenUrl) {
      fs.rmSync(path.join(SALON_IMG_DIR, path.basename(prev)), { force: true });
    }
    res.json({ ok: true, url: imagenUrl, salon: await updateSalon(salon.id, { imagenUrl }) });
  } catch (err) { next(err); }
});

// Disponibilidad: bloquear/liberar un conjunto de días del salón.
venuesRouter.put('/admin/api/venues/salones/:id/disponibilidad', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await venues.adminSetDisponibilidad(String(req.params.id), req.body)) });
  } catch (err) { next(err); }
});

venuesRouter.post('/admin/api/venues/reservas', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await venues.adminCrearReserva(req.body)) });
  } catch (err) { next(err); }
});

venuesRouter.put('/admin/api/venues/reservas/:id', requireAdmin, async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await venues.adminActualizarReserva(String(req.params.id), req.body)) });
  } catch (err) { next(err); }
});

venuesRouter.delete('/admin/api/venues/reservas/:id', requireAdmin, async (req, res, next) => {
  try {
    await venues.adminEliminarReserva(String(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});
