import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '../usuarios/usuarios.data';

const analyticsClient = vi.hoisted(() => ({
  callMessages: vi.fn(),
}));

const analyticsTools = vi.hoisted(() => ({
  runTool: vi.fn(),
  TOOLS: [],
}));

vi.mock('./analytics.client', () => ({
  callMessages: analyticsClient.callMessages,
}));

vi.mock('./analytics.tools', () => ({
  TOOLS: analyticsTools.TOOLS,
  runTool: analyticsTools.runTool,
}));

import { env } from '../../config/env';
import { answerQuery } from './analytics.service';

function admin(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u-admin',
    name: 'Administrador',
    username: 'admin',
    email: 'admin@herediano.com',
    role: 'Administrador',
    area: 'Admin',
    status: 'Activo',
    parkingRole: 'admin',
    couponRole: 'admin',
    eventsRole: 'admin',
    restaurantRole: 'ninguno',
    isSuperAdmin: true,
    ...overrides,
  };
}

describe('analytics service fallback local', () => {
  beforeEach(() => {
    env.AGENTS_API_KEY = '';
    analyticsClient.callMessages.mockReset();
    analyticsTools.runTool.mockReset();
  });

  it('answers parking plate questions without an agents api key', async () => {
    analyticsTools.runTool.mockImplementation(async (name: string) => {
      expect(name).toBe('query_parqueo_eventos');
      return [
        { tipo: 'entrada', placa: 'ABC123', espacioId: 'P-001', timestamp: '2026-06-18T12:00:00.000Z' },
        { tipo: 'entrada', placa: 'XYZ789', espacioId: 'P-002', timestamp: '2026-06-18T12:05:00.000Z' },
        { tipo: 'salida', placa: 'OLD111', espacioId: 'P-003', timestamp: '2026-06-18T12:10:00.000Z' },
      ];
    });

    const result = await answerQuery('¿Qué placas entraron al parqueo recientemente?', admin());

    expect(result.model).toBe('analytics-local');
    expect(result.answer).toContain('ABC123');
    expect(result.answer).toContain('XYZ789');
    expect(result.answer).not.toContain('OLD111');
    expect(result.logs).toHaveLength(1);
    expect(analyticsClient.callMessages).not.toHaveBeenCalled();
  });

  it('answers user ranking questions without an agents api key', async () => {
    analyticsTools.runTool.mockImplementation(async (name: string) => {
      expect(name).toBe('query_usuarios');
      return [
        { name: 'Socio Bajo', profile: { category: 'socio', metricas: { puntosFidelidad: 120, gastoTotalCrc: 5000 } } },
        { name: 'Socio Alto', profile: { category: 'socio', metricas: { puntosFidelidad: 980, gastoTotalCrc: 9000 } } },
      ];
    });

    const result = await answerQuery('¿Qué socio tiene más puntos de fidelidad?', admin());

    expect(result.model).toBe('analytics-local');
    expect(result.answer).toContain('Socio Alto');
    expect(result.answer).toContain('980');
    expect(analyticsClient.callMessages).not.toHaveBeenCalled();
  });
});
