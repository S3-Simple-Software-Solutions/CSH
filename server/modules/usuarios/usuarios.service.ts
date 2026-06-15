import { USE_DB, getPool } from '../../core/db';
import { safeEqual } from '../../core/http';
import { ADMIN_USERS, AdminUser } from './usuarios.data';

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

export async function setAdminUserPassword(userId: string, password: string): Promise<void> {
  if (!USE_DB) {
    const user = ADMIN_USERS.find((u) => u.id === userId);
    if (user) user.password = password;
    return;
  }
  await getPool().query(
    `
    insert into admin_passwords (user_id, password, updated_at)
    values ($1, $2, now())
    on conflict (user_id) do update set password = excluded.password, updated_at = now()
  `,
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
    sponsor: u.sponsor,
  }));
}
