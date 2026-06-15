import crypto from 'crypto';
import { SECRET, SESSION_HOURS, ADMIN_SESSION_HOURS } from '../../config/constants';
import { ADMIN_USERS, AdminUser } from '../usuarios/usuarios.data';

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

export function validAdminToken(tok: string | undefined): AdminUser | null {
  if (!tok || tok.split('.').length !== 3) return null;
  const [expStr, userId, mac] = tok.split('.');
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return null;
  const user = ADMIN_USERS.find((u) => u.id === userId);
  if (!user) return null;
  const good = adminSign(exp, userId);
  return mac.length === good.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good)) ? user : null;
}
