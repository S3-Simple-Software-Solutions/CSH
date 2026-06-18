import { describe, expect, it, vi } from 'vitest';
import { boletoCodigo, extractCodigo, qrData, slugify } from './entradas.helpers';

describe('entradas helpers', () => {
  it('creates short slugs for event URLs', () => {
    expect(slugify('Final Nacional: Herediano vs Saprissa')).toBe('final-nacional-herediano-vs-saprissa');
    expect(slugify('áéíóú ü ñ')).toBe('aeiou-u-n');
    expect(slugify('x'.repeat(100))).toHaveLength(60);
  });

  it('formats ticket QR payloads', () => {
    expect(qrData('ENT-ABC123', 'evt-1', 'vip', 'fan@example.com')).toBe('ENT-ABC123|evt-1|vip|fan@example.com');
  });

  it('extracts the ticket code from a full QR payload or manual input', () => {
    expect(extractCodigo(' ent-abc123 |evt-1|vip|fan@example.com')).toBe('ENT-ABC123');
    expect(extractCodigo('ent-def456')).toBe('ENT-DEF456');
    expect(extractCodigo(null)).toBe('');
  });

  it('generates readable ticket codes', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    expect(boletoCodigo()).toMatch(/^ENT-[A-Z0-9]{6}$/);
    vi.restoreAllMocks();
  });
});
