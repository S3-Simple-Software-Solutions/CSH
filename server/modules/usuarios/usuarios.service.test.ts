import { describe, expect, it } from 'vitest';
import { canManageCoupons, canManageEvents, canOperateGate, canViewSales, findAdminUser, isPasswordManagedByEnv } from './usuarios.service';
import { ADMIN_USERS, findUserById } from './usuarios.data';
import { applyPasswordOverrideRows } from './usuarios.schema';

describe('usuarios service permissions', () => {
  it('finds admin users by username or email with exact password match', () => {
    expect(findAdminUser('operador', 'operador1921')?.id).toBe('demo-operador');
    expect(findAdminUser('COMERCIAL@HEREDIANO.COM', 'comercial1921')?.id).toBe('demo-comercial');
    expect(findAdminUser('operador', 'wrong-password')).toBeNull();
  });

  it('checks coupon permissions by role', () => {
    expect(canManageCoupons(findUserById('u-001'))).toBe(true);
    expect(canManageCoupons(findUserById('demo-patrocinador'))).toBe(true);
    expect(canManageCoupons(findUserById('demo-socio'))).toBe(false);
    expect(canManageCoupons(null)).toBe(false);
  });

  it('checks event permissions by role', () => {
    expect(canManageEvents(findUserById('demo-entradas'))).toBe(true);
    expect(canManageEvents(findUserById('demo-operador'))).toBe(false);
    expect(canOperateGate(findUserById('demo-operador'))).toBe(true);
    expect(canOperateGate(findUserById('demo-comercial'))).toBe(false);
    expect(canViewSales(findUserById('demo-comercial'))).toBe(true);
    expect(canViewSales(findUserById('demo-socio'))).toBe(false);
  });

  it('keeps the primary admin password controlled by environment variables', () => {
    const users = ADMIN_USERS.map((user) => ({ ...user }));
    const admin = users.find((user) => user.id === 'u-001')!;
    const originalAdminPassword = admin.password;

    applyPasswordOverrideRows([
      { user_id: 'u-001', password: 'stale-database-password' },
      { user_id: 'demo-operador', password: 'operator-override' },
    ], users);

    expect(admin.password).toBe(originalAdminPassword);
    expect(users.find((user) => user.id === 'demo-operador')?.password).toBe('operator-override');
    expect(isPasswordManagedByEnv(admin)).toBe(true);
    expect(isPasswordManagedByEnv(users.find((user) => user.id === 'demo-operador'))).toBe(false);
  });
});
