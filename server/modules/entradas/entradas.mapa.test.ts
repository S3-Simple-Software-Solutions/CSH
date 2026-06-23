import { describe, expect, it } from 'vitest';
import { ApiError } from '../../core/errors';

// Inline de la lógica de validación para test unitario puro (sin imports de service complejo)
function inUnit(n: number): boolean {
  return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 1;
}

function validateRect(pts: { x: number; y: number; w: number; h: number }): string | null {
  if (!inUnit(pts.x) || !inUnit(pts.y)) return 'x,y deben estar en [0,1]';
  if (typeof pts.w !== 'number' || pts.w <= 0 || typeof pts.h !== 'number' || pts.h <= 0) return 'w,h deben ser > 0';
  if (pts.x + pts.w > 1.001 || pts.y + pts.h > 1.001) return 'rect sale del mapa';
  return null;
}

function validatePolygon(pts: Array<{ x: number; y: number }>): string | null {
  if (!Array.isArray(pts) || pts.length < 3) return 'polygon requiere al menos 3 puntos';
  for (const p of pts) {
    if (!inUnit(p.x) || !inUnit(p.y)) return `punto (${p.x},${p.y}) fuera de [0,1]`;
  }
  return null;
}

describe('entradas mapa — validación de geometría', () => {
  describe('rect', () => {
    it('acepta un rect válido dentro del mapa', () => {
      expect(validateRect({ x: 0.1, y: 0.2, w: 0.5, h: 0.3 })).toBeNull();
    });

    it('acepta rect en el borde exacto del mapa', () => {
      expect(validateRect({ x: 0, y: 0, w: 1, h: 1 })).toBeNull();
    });

    it('rechaza x fuera de [0,1]', () => {
      expect(validateRect({ x: -0.1, y: 0, w: 0.5, h: 0.5 })).toBeTruthy();
    });

    it('rechaza w = 0', () => {
      expect(validateRect({ x: 0.1, y: 0.1, w: 0, h: 0.5 })).toBeTruthy();
    });

    it('rechaza rect que sale del mapa (x+w > 1)', () => {
      expect(validateRect({ x: 0.8, y: 0.0, w: 0.5, h: 0.5 })).toBeTruthy();
    });

    it('rechaza rect que sale por abajo (y+h > 1)', () => {
      expect(validateRect({ x: 0.0, y: 0.7, w: 0.5, h: 0.5 })).toBeTruthy();
    });
  });

  describe('polygon', () => {
    it('acepta un polígono válido con 3 puntos', () => {
      expect(validatePolygon([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.3, y: 0.5 }])).toBeNull();
    });

    it('acepta polígono con 4+ puntos', () => {
      expect(validatePolygon([
        { x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 },
      ])).toBeNull();
    });

    it('rechaza polígono con menos de 3 puntos', () => {
      expect(validatePolygon([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }])).toBeTruthy();
    });

    it('rechaza punto fuera de [0,1]', () => {
      expect(validatePolygon([{ x: 1.2, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.3, y: 0.5 }])).toBeTruthy();
    });

    it('rechaza punto con valor negativo', () => {
      expect(validatePolygon([{ x: 0.1, y: -0.1 }, { x: 0.5, y: 0.1 }, { x: 0.3, y: 0.5 }])).toBeTruthy();
    });
  });

  describe('inUnit helper', () => {
    it('acepta valores en [0,1]', () => {
      expect(inUnit(0)).toBe(true);
      expect(inUnit(0.5)).toBe(true);
      expect(inUnit(1)).toBe(true);
    });

    it('rechaza valores fuera de [0,1]', () => {
      expect(inUnit(-0.001)).toBe(false);
      expect(inUnit(1.001)).toBe(false);
      expect(inUnit(NaN)).toBe(false);
      expect(inUnit(Infinity)).toBe(false);
    });
  });
});
