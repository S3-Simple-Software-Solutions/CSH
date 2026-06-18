import crypto from 'crypto';
import { SECRET, SESSION_HOURS, ADMIN_SESSION_HOURS } from '../../config/constants';
import { AdminUser } from '../usuarios/usuarios.data';
import { findUserById } from '../usuarios/usuarios.service';

function sign(exp: number): string {
  return crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex');
}

export function makeToken(): string {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  return `${exp}.${sign(exp)}`;
}

export function validToken(tok: string | undefined): boolean {
  if (!tok || !tok.includes('.')) return false;
  const [expStr, mac] = tok.split('.');
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return false;
  const good = sign(exp);
  return mac.length === good.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good));
}

function adminSign(exp: number, userId: string): string {
  return crypto.createHmac('sha256', SECRET).update(`admin:${exp}:${userId}`).digest('hex');
}

export function makeAdminToken(user: AdminUser): string {
  const exp = Date.now() + ADMIN_SESSION_HOURS * 3600 * 1000;
  return `${exp}.${user.id}.${adminSign(exp, user.id)}`;
}

export async function validAdminToken(tok: string | undefined): Promise<AdminUser | null> {
  if (!tok || tok.split('.').length !== 3) return null;
  const [expStr, userId, mac] = tok.split('.');
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return null;
  const good = adminSign(exp, userId);
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  return findUserById(userId);
}
