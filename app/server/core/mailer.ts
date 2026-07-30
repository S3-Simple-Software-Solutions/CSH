import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { OFFICIAL_SPONSORS, SITE_LOGO_PATH, ROOT_DIR } from '../config/constants';
import { escapeHtml } from './http';

const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const CT_BY_EXT: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
  contentDisposition: 'inline';
}

export function makeMailTransport() {
  const config: nodemailer.TransportOptions & Record<string, unknown> = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    tls: { rejectUnauthorized: false },
  };
  if (env.SMTP_USER || env.SMTP_PASS) config.auth = { user: env.SMTP_USER, pass: env.SMTP_PASS };
  return nodemailer.createTransport(config as nodemailer.TransportOptions);
}

export function fmtMailDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CR', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sponsorCard(s: { name: string; cid: string }): string {
  return `<div style="height:60px;line-height:60px;background:#f7f1df;border:1px solid rgba(201,169,97,.35);border-radius:6px;text-align:center"><img src="cid:${s.cid}" alt="${escapeHtml(s.name)}" style="display:inline-block;vertical-align:middle;max-width:78%;max-height:32px;width:auto;height:auto"></div>`;
}

function sponsorHtml(): string {
  // Rejilla fija de 2 columnas con tarjetas de tamaño idéntico: se ve pareja
  // en móvil (los clientes de correo renderizan tablas, no flex/inline-block).
  let rows = '';
  for (let i = 0; i < OFFICIAL_SPONSORS.length; i += 2) {
    const left = OFFICIAL_SPONSORS[i];
    const right = OFFICIAL_SPONSORS[i + 1];
    if (right) {
      rows += `<tr><td width="50%" valign="middle" style="padding:5px">${sponsorCard(left)}</td><td width="50%" valign="middle" style="padding:5px">${sponsorCard(right)}</td></tr>`;
    } else {
      // Último impar: centrado con el mismo ancho que una columna
      rows += `<tr><td colspan="2" align="center" valign="middle" style="padding:5px"><div style="max-width:50%;margin:0 auto">${sponsorCard(left)}</div></td></tr>`;
    }
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">${rows}</table>`;
}

export function emailShell(_title: string, kicker: string, body: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#0a0908;padding:24px;font-family:Inter,Manrope,Arial,sans-serif;color:#f7f1df"><div style="max-width:620px;margin:0 auto;background:#13100e;border:1px solid rgba(201,169,97,.45);border-radius:8px;overflow:hidden"><div style="background:#d62828;padding:24px 28px;text-align:center"><img src="cid:csh-shield" width="72" alt="Club Sport Herediano" style="display:block;margin:0 auto 12px"><h1 style="margin:0;color:#f7f1df;font-family:Impact,'Arial Black',Arial,sans-serif;font-size:32px;letter-spacing:.04em;text-transform:uppercase">Herediano</h1><p style="margin:6px 0 0;color:#ffe7e7;font-size:13px;letter-spacing:.16em;text-transform:uppercase">${kicker}</p></div><div style="padding:28px">${body}<div style="border-top:1px solid rgba(201,169,97,.35);padding-top:18px;text-align:center"><p style="margin:0 0 10px;color:#c9a961;font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:800">Patrocinadores oficiales</p><div>${sponsorHtml()}</div></div></div><div style="padding:14px 28px;background:#0a0908;color:#aa9d84;text-align:center;font-size:12px">Mensaje automatico. No respondas a este correo.</div></div></body></html>`;
}

function getInlineAssetAttachment({
  reqPath,
  cid,
  filename,
}: {
  reqPath: string;
  cid: string;
  filename: string;
}): MailAttachment | null {
  try {
    const filePath = path.join(PUBLIC_DIR, reqPath);
    const content = fs.readFileSync(filePath);
    return {
      filename,
      content,
      contentType: CT_BY_EXT[path.extname(filePath).toLowerCase()] || 'image/png',
      cid,
      contentDisposition: 'inline',
    };
  } catch (err) {
    console.error(`[mail] No se pudo cargar asset ${reqPath}: ${(err as Error).message}`);
    return null;
  }
}

export async function commonMailAttachments(): Promise<MailAttachment[]> {
  const shield = getInlineAssetAttachment({ reqPath: SITE_LOGO_PATH, cid: 'csh-shield', filename: 'escudo-herediano.png' });
  const sponsors = OFFICIAL_SPONSORS.map((s) => getInlineAssetAttachment({ reqPath: s.path, cid: s.cid, filename: `${s.cid}.png` }));
  return [shield, ...sponsors].filter((a): a is MailAttachment => Boolean(a));
}
