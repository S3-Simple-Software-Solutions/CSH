import { describe, expect, it } from 'vitest';
import { canManageCoupons, canManageEvents, canOperateGate, canViewSales, findAdminUser } from './usuarios.service';
import { findUserById } from './usuarios.data';

describe('usuarios service permissions', () => {
  it('finds admin users by username or email with exact password match', () => {
    expect(findAdminUser('operaciones', 'operaciones1921')?.id).toBe('u-002');
    expect(findAdminUser('COMERCIAL@HEREDIANO.COM', 'comercial1921')?.id).toBe('u-003');
    expect(findAdminUser('operaciones', 'wrong-password')).toBeNull();
  });

  it('checks coupon permissions by role', () => {
    expect(canManageCoupons(findUserById('u-001'))).toBe(true);
    expect(canManageCoupons(findUserById('u-003'))).toBe(true);
    expect(canManageCoupons(findUserById('u-004'))).toBe(false);
    expect(canManageCoupons(null)).toBe(false);
  });

  it('checks event permissions by role', () => {
    expect(canManageEvents(findUserById('u-006'))).toBe(true);
    expect(canManageEvents(findUserById('u-002'))).toBe(false);
    expect(canOperateGate(findUserById('u-002'))).toBe(true);
    expect(canOperateGate(findUserById('u-003'))).toBe(false);
    expect(canViewSales(findUserById('u-003'))).toBe(true);
    expect(canViewSales(findUserById('u-004'))).toBe(false);
  });
});
