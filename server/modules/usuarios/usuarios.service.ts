import { pool, query } from '../../core/db';
import { ApiError } from '../../core/errors';
import { AdminUser, ENV_ADMIN_USER_ID, UserProfile } from './usuarios.data';
import { hashPassword, verifyPassword } from './usuarios.passwords';

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  display_role: string;
  area: string;
  status: string;
  sponsor: string | null;
  password_managed_by: 'env' | 'database';
  profile: UserProfile | null;
  role_ids: string[] | null;
}

function hasRole(roles: string[], roleId: string): boolean {
  return roles.includes(roleId);
}

function roleIds(row: UserRow): string[] {
  return Array.isArray(row.role_ids) ? row.role_ids.filter(Boolean) : [];
}

function parkingRole(roles: string[]): AdminUser['parkingRole'] {
  if (hasRole(roles, 'parking:admin')) return 'admin';
  if (hasRole(roles, 'parking:invitado')) return 'invitado';
  return 'socio';
}

function couponRole(roles: string[]): AdminUser['couponRole'] {
  if (hasRole(roles, 'coupon:admin')) return 'admin';
  if (hasRole(roles, 'coupon:patrocinador')) return 'patrocinador';
  return 'socio';
}

function eventsRole(roles: string[]): AdminUser['eventsRole'] {
  if (hasRole(roles, 'events:admin')) return 'admin';
  if (hasRole(roles, 'events:operador')) return 'operador';
  if (hasRole(roles, 'events:comercial')) return 'comercial';
  return 'ninguno';
}

function restaurantRole(roles: string[]): AdminUser['restaurantRole'] {
  if (hasRole(roles, 'restaurant:admin')) return 'admin';
  if (hasRole(roles, 'restaurant:owner')) return 'owner';
  return 'ninguno';
}

function toAdminUser(row: UserRow): AdminUser {
  const roles = roleIds(row);
  return {
    id: row.id,
    name: row.full_name,
    username: row.username,
    email: row.email,
    role: row.display_role,
    area: row.area,
    status: row.status,
    parkingRole: parkingRole(roles),
    couponRole: couponRole(roles),
    eventsRole: eventsRole(roles),
    restaurantRole: restaurantRole(roles),
    sponsor: row.sponsor || undefined,
    passwordManagedByEnv: row.password_managed_by === 'env',
    isSuperAdmin: hasRole(roles, 'system:admin'),
  };
}

function isLoginAllowed(user: AdminUser): boolean {
  return !['suspendido', 'suspended', 'inactivo', 'inactive'].includes(user.status.trim().toLowerCase());
}

async function userRows(whereSql = '', params: unknown[] = [], orderSql = ''): Promise<UserRow[]> {
  return query<UserRow>(
    `select
       u.id,
       u.username,
       u.email,
       u.password_hash,
       u.full_name,
       u.display_role,
       u.area,
       u.status,
       u.sponsor,
       u.password_managed_by,
       u.profile,
       coalesce(array_remove(array_agg(ur.role_id order by ur.role_id), null), '{}'::text[]) as role_ids
     from app_users u
     left join app_user_roles ur on ur.user_id = u.id
     ${whereSql}
     group by u.id, u.username, u.email, u.password_hash, u.full_name, u.display_role, u.area, u.status, u.sponsor, u.password_managed_by
     ${orderSql}`,
    params,
  );
}

export async function findAdminUser(login: unknown, password: unknown): Promise<AdminUser | null> {
  const needle = String(login || '').trim().toLowerCase();
  if (!needle) return null;

  const rows = await userRows('where lower(u.username) = $1 or lower(u.email) = $1', [needle]);
  const row = rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) return null;

  const user = toAdminUser(row);
  return isLoginAllowed(user) ? user : null;
}

export async function findUserById(id: string | null | undefined): Promise<AdminUser | null> {
  const userId = String(id || '').trim();
  if (!userId) return null;
  const rows = await userRows('where u.id = $1', [userId]);
  return rows[0] ? toAdminUser(rows[0]) : null;
}

export async function findUserEmailById(id: string | null | undefined): Promise<string> {
  const userId = String(id || '').trim();
  if (!userId) return '';
  const rows = await query<{ email: string }>('select email from app_users where id = $1', [userId]);
  return String(rows[0]?.email || '').trim().toLowerCase();
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

// Administra TODOS los restaurantes y pedidos (staff del club / superadmin).
export function isRestaurantAdmin(user: AdminUser | null | undefined): boolean {
  return Boolean(user && (user.isSuperAdmin || user.restaurantRole === 'admin'));
}

// Puede entrar al modulo de restaurantes: admin del club o dueno de su(s) local(es).
export function canManageRestaurantes(user: AdminUser | null | undefined): boolean {
  return Boolean(user && (isRestaurantAdmin(user) || user.restaurantRole === 'owner'));
}

export function isPasswordManagedByEnv(user: AdminUser | null | undefined): boolean {
  return Boolean(user && (user.passwordManagedByEnv || user.id === ENV_ADMIN_USER_ID));
}

export async function setAdminUserPassword(userId: string, password: string): Promise<AdminUser> {
  const user = await findUserById(userId);
  if (!user) throw new ApiError(404, 'Usuario no encontrado');
  if (isPasswordManagedByEnv(user)) {
    throw new ApiError(400, 'La clave del administrador principal se gestiona por variables de entorno');
  }

  await pool.query('update app_users set password_hash = $2, password_managed_by = $3, updated_at = now() where id = $1', [
    user.id,
    hashPassword(password),
    'database',
  ]);

  return { ...user, passwordManagedByEnv: false };
}

export async function listUsers() {
  const rows = await userRows('', [], 'order by u.area, u.full_name');
  return rows.map((row) => {
    const user = toAdminUser(row);
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      area: user.area,
      status: user.status,
      parkingRole: user.parkingRole,
      couponRole: user.couponRole,
      eventsRole: user.eventsRole,
      restaurantRole: user.restaurantRole,
      sponsor: user.sponsor,
      passwordManagedByEnv: isPasswordManagedByEnv(user),
      category: row.profile?.category ?? 'staff',
      profile: row.profile ?? null,
    };
  });
}
