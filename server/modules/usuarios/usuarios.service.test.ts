import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from './usuarios.data';
import { hashPassword } from './usuarios.passwords';
import { ApiError } from '../../core/errors';

const db = vi.hoisted(() => ({
  query: vi.fn(),
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  clientRelease: vi.fn(),
  poolConnect: vi.fn(),
}));

vi.mock('../../core/db', () => ({
  query: db.query,
  pool: {
    query: db.poolQuery,
    connect: db.poolConnect,
  },
}));

import {
  canManageCoupons,
  canManageEvents,
  canOperateGate,
  canViewSales,
  findAdminUser,
  getUserProfile,
  isPasswordManagedByEnv,
  registerAficionado,
} from './usuarios.service';

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
    db.clientQuery.mockReset();
    db.clientRelease.mockReset();
    db.poolConnect.mockReset();
    db.poolConnect.mockResolvedValue({
      query: db.clientQuery,
      release: db.clientRelease,
    });
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

function fanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fan-test-1',
    username: 'nuevofan',
    email: 'nuevo.fan@gmail.com',
    password_hash: hashPassword('password123'),
    full_name: 'Nuevo Fan',
    display_role: 'Aficionado',
    area: 'Aficionados',
    status: 'Activo',
    sponsor: null,
    password_managed_by: 'database',
    profile: { category: 'aficionado' },
    role_ids: ['site:authenticated', 'parking:invitado', 'coupon:socio'],
    ...overrides,
  };
}

describe('registerAficionado', () => {
  beforeEach(() => {
    db.query.mockReset();
    db.clientQuery.mockReset();
    db.clientRelease.mockReset();
    db.poolConnect.mockReset();
    db.poolConnect.mockResolvedValue({
      query: db.clientQuery,
      release: db.clientRelease,
    });
    db.clientQuery.mockResolvedValue([]);
  });

  it('creates an aficionado account with default roles', async () => {
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([fanRow()]);

    const created = await registerAficionado({
      nombre: 'Nuevo Fan',
      email: 'nuevo.fan@gmail.com',
      username: 'nuevofan',
      clave: 'password123',
    });

    expect(created).toMatchObject({
      id: 'fan-test-1',
      role: 'Aficionado',
      parkingRole: 'invitado',
      couponRole: 'socio',
      eventsRole: 'ninguno',
    });
    expect(db.clientQuery).toHaveBeenCalledWith('begin');
    expect(db.clientQuery).toHaveBeenCalledWith('commit');
  });

  it('rejects duplicate email', async () => {
    db.query.mockResolvedValueOnce([{ id: 'existing' }]);

    await expect(
      registerAficionado({
        nombre: 'Nuevo Fan',
        email: 'nuevo.fan@gmail.com',
        username: 'nuevofan',
        clave: 'password123',
      }),
    ).rejects.toMatchObject({ status: 409, message: 'Ya existe una cuenta con ese correo' });
  });

  it('rejects duplicate username', async () => {
    db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'existing' }]);

    await expect(
      registerAficionado({
        nombre: 'Nuevo Fan',
        email: 'nuevo.fan@gmail.com',
        username: 'nuevofan',
        clave: 'password123',
      }),
    ).rejects.toMatchObject({ status: 409, message: 'Ese nombre de usuario ya esta en uso' });
  });

  it('rejects short passwords', async () => {
    await expect(
      registerAficionado({
        nombre: 'Nuevo Fan',
        email: 'nuevo.fan@gmail.com',
        username: 'nuevofan',
        clave: 'short',
      }),
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      registerAficionado({
        nombre: 'Nuevo Fan',
        email: 'nuevo.fan@gmail.com',
        username: 'nuevofan',
        clave: 'short',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('getUserProfile', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it('returns username and profile for an aficionado', async () => {
    db.query.mockResolvedValueOnce([
      fanRow({
        id: 'fan-mariana',
        username: 'msolis',
        email: 'mariana.solis@gmail.com',
        full_name: 'Mariana Solis Campos',
        profile: {
          category: 'aficionado',
          personal: { telefono: '+506 8456-7012', cedula: '1-1788-0420', nacimiento: '2000-02-14', provincia: 'San Jose', genero: 'Femenino' },
          app: { registrado: '2025-02-20', ultimoAcceso: '2026-06-17', plataforma: 'Android', notificaciones: true, sesiones30d: 34 },
          metricas: { antiguedadMeses: 16, partidosAsistidos: 12, entradasCompradas: 14, gastoTotalCrc: 138000, cuponesUsados: 6, reservasParqueo: 2, puntosFidelidad: 980, asistenciaPct: 48 },
        },
      }),
    ]);

    await expect(getUserProfile('fan-mariana')).resolves.toMatchObject({
      username: 'msolis',
      email: 'mariana.solis@gmail.com',
      category: 'aficionado',
      profile: { category: 'aficionado', metricas: { puntosFidelidad: 980 } },
    });
  });

  it('throws when user id does not exist', async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(getUserProfile('missing-user')).rejects.toMatchObject({ status: 404 });
  });
});
