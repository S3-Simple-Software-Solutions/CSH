import crypto from 'crypto';
import type { Request } from 'express';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function safeEqual(a: unknown, b: unknown): boolean {
  const left = String(a ?? '');
  const right = String(b ?? '');
  return left.length === right.length && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function isHttps(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https' || req.secure;
}

export function cookieAttrs(req: Request, name: string, value: string, maxAge: number, pathValue: string): string {
  const attrs = [`${name}=${value}`, 'HttpOnly', `Path=${pathValue}`, 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (isHttps(req)) attrs.push('Secure');
  return attrs.join('; ');
}

export function safeNext(value: unknown, prefix = '/'): string {
  const next = String(value || prefix);
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\r\n]/.test(next)) return prefix;
  return next;
}
