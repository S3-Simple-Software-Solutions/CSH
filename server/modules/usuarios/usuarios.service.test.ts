import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from './usuarios.data';
import { hashPassword } from './usuarios.passwords';

const db = vi.hoisted(() => ({
  query: vi.fn(),
  poolQuery: vi.fn(),
}));

vi.mock('../../core/db', () => ({
  query: db.query,
  pool: { query: db.poolQuery },
}));

import { canManageCoupons, canManageEvents, canOperateGate, canViewSales, findAdminUser, isPasswordManagedByEnv } from './usuarios.service';

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u-test',
    name: 'Usuario Test',
    username: 'test',
    email: 'test@herediano.com',
    role: 'Socio',
    area: 'Pruebas',
    status: 'Activo',
    parkingRole: 'socio',
    couponRole: 'socio',
    eventsRole: 'ninguno',
    restaurantRole: 'ninguno',
    ...overrides,
  };
}

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'demo-operador',
    username: 'operador',
    email: 'operador@herediano.com',
    password_hash: hashPassword('operador1921'),
    full_name: 'Operador de Puerta',
    display_role: 'Operador',
    area: 'Entradas',
    status: 'Demo',
    sponsor: null,
    password_managed_by: 'database',
    role_ids: ['events:operador'],
    ...overrides,
  };
}

describe('usuarios service permissions', () => {
  beforeEach(() => {
    db.query.mockReset();
    db.poolQuery.mockReset();
  });

  it('finds admin users by username or email with matching password', async () => {
    db.query.mockResolvedValueOnce([userRow()]);
    await expect(findAdminUser('operador', 'operador1921')).resolves.toMatchObject({ id: 'demo-operador', eventsRole: 'operador' });

    db.query.mockResolvedValueOnce([userRow({ email: 'comercial@herediano.com', role_ids: ['events:comercial'] })]);
    await expect(findAdminUser('COMERCIAL@HEREDIANO.COM', 'operador1921')).resolves.toMatchObject({ eventsRole: 'comercial' });

    db.query.mockResolvedValueOnce([userRow()]);
    await expect(findAdminUser('operador', 'wrong-password')).resolves.toBeNull();
  });

  it('checks coupon permissions by role', () => {
    expect(canManageCoupons(user({ couponRole: 'admin' }))).toBe(true);
    expect(canManageCoupons(user({ couponRole: 'patrocinador' }))).toBe(true);
    expect(canManageCoupons(user({ couponRole: 'socio' }))).toBe(false);
    expect(canManageCoupons(null)).toBe(false);
  });

  it('checks event permissions by role', () => {
    expect(canManageEvents(user({ eventsRole: 'admin' }))).toBe(true);
    expect(canManageEvents(user({ eventsRole: 'operador' }))).toBe(false);
    expect(canOperateGate(user({ eventsRole: 'operador' }))).toBe(true);
    expect(canOperateGate(user({ eventsRole: 'comercial' }))).toBe(false);
    expect(canViewSales(user({ eventsRole: 'comercial' }))).toBe(true);
    expect(canViewSales(user({ eventsRole: 'ninguno' }))).toBe(false);
  });

  it('keeps the primary admin password controlled by environment variables', () => {
    expect(isPasswordManagedByEnv(user({ id: 'u-001' }))).toBe(true);
    expect(isPasswordManagedByEnv(user({ id: 'demo-operador', passwordManagedByEnv: false }))).toBe(false);
    expect(isPasswordManagedByEnv(user({ id: 'demo-admin', passwordManagedByEnv: true }))).toBe(true);
  });
});
