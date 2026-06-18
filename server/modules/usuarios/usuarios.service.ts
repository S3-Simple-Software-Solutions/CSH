import { pool } from '../../core/db';
import { ApiError } from '../../core/errors';
import { safeEqual } from '../../core/http';
import { ADMIN_USERS, AdminUser, ENV_ADMIN_USER_ID } from './usuarios.data';

export function findAdminUser(login: unknown, password: unknown): AdminUser | null {
  const needle = String(login || '').trim().toLowerCase();
  return (
    ADMIN_USERS.find(
      (u) => (u.username.toLowerCase() === needle || u.email.toLowerCase() === needle) && safeEqual(password, u.password),
    ) || null
  );
}

export function canManageCoupons(user: AdminUser | null | undefined): boolean {
  return Boolean(user && (user.couponRole === 'admin' || user.couponRole === 'patrocinador'));
}

export function canManageEvents(user: AdminUser | null | undefined): boolean {
  return Boolean(user && user.eventsRole === 'admin');
}

export function canOperateGate(user: AdminUser | null | undefined): boolean {
  return Boolean(user && (user.eventsRole === 'admin' || user.eventsRole === 'operador'));
}

export function canViewSales(user: AdminUser | null | undefined): boolean {
  return Boolean(user && (user.eventsRole === 'admin' || user.eventsRole === 'operador' || user.eventsRole === 'comercial'));
}

export function isPasswordManagedByEnv(user: AdminUser | null | undefined): boolean {
  return Boolean(user && user.id === ENV_ADMIN_USER_ID);
}

export async function setAdminUserPassword(userId: string, password: string): Promise<void> {
  if (userId === ENV_ADMIN_USER_ID) {
    throw new ApiError(400, 'La clave del administrador principal se gestiona por variables de entorno');
  }

  await pool.query(
    `insert into admin_passwords (user_id, password, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update set password = excluded.password, updated_at = now()`,
    [userId, password],
  );
  const user = ADMIN_USERS.find((u) => u.id === userId);
  if (user) user.password = password;
}

export function listUsers() {
  return ADMIN_USERS.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role,
    area: u.area,
    status: u.status,
    parkingRole: u.parkingRole,
    couponRole: u.couponRole,
    eventsRole: u.eventsRole,
    sponsor: u.sponsor,
    passwordManagedByEnv: isPasswordManagedByEnv(u),
  }));
}
