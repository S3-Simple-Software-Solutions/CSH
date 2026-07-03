// Cliente de bajo nivel para la Meta WhatsApp Cloud API (Graph API).
// Análogo a core/mailer.ts: infraestructura compartida; cada módulo compone
// sus propios mensajes (p.ej. entradas.whatsapp.ts).
//
// Requisitos operativos (fuera de código): número de WhatsApp Business
// verificado, token permanente y plantillas aprobadas en Meta Business Manager.
// Con WHATSAPP_ENABLED=false todo envío se omite silenciosamente.

import { env } from '../config/env';

export function isWhatsAppEnabled(): boolean {
  return env.WHATSAPP_ENABLED && Boolean(env.WHATSAPP_PHONE_ID) && Boolean(env.WHATSAPP_TOKEN);
}

function apiUrl(path: string): string {
  return `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_ID}/${path}`;
}

// Normaliza a formato internacional sin '+': números locales de CR (8 dígitos)
// reciben el prefijo 506. Devuelve '' si el número no es plausible.
export function normalizePhone(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 8) return `506${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return '';
}

async function post(path: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`WhatsApp API: ${detail}`);
  }
  return data;
}

// Sube un binario (p.ej. PNG del QR) y devuelve el media id para usarlo en mensajes.
export async function uploadMedia(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
  const res = await fetch(apiUrl('media'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
    body: form,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data?.id) {
    const detail = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`WhatsApp media: ${detail}`);
  }
  return data.id;
}

export interface TemplateParams {
  to: string; // formato internacional sin '+', p.ej. 50660522845
  template: string;
  lang?: string;
  // Variables {{1}}..{{n}} del cuerpo de la plantilla, en orden.
  bodyParams?: string[];
  // Media id para plantillas con header de imagen.
  headerImageMediaId?: string;
}

// Envía una plantilla aprobada (único mensaje permitido para conversaciones
// iniciadas por el negocio).
export async function sendTemplate({ to, template, lang, bodyParams, headerImageMediaId }: TemplateParams): Promise<void> {
  const components: any[] = [];
  if (headerImageMediaId) {
    components.push({ type: 'header', parameters: [{ type: 'image', image: { id: headerImageMediaId } }] });
  }
  if (bodyParams && bodyParams.length > 0) {
    components.push({ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) });
  }
  await post('messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: lang || env.WHATSAPP_TEMPLATE_LANG },
      ...(components.length > 0 ? { components } : {}),
    },
  });
}
