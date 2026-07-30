import { describe, expect, it } from 'vitest';
import { pickBestSeats } from './SeatPicker.jsx';

function seat(fila, numero, estado = 'disponible') {
  return { id: `${fila}-${numero}`, fila, numero, estado };
}

describe('pickBestSeats — auto-elección de butacas contiguas', () => {
  it('elige N contiguas en la fila más cercana a la cancha (A), centradas', () => {
    const asientos = [
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => seat('A', n)),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => seat('B', n)),
    ];
    const picks = pickBestSeats(asientos, 2);
    expect(picks.map((a) => a.fila)).toEqual(['A', 'A']);
    // centradas: en 1..8 el centro es 4.5 → 4 y 5
    expect(picks.map((a) => a.numero).sort((x, y) => x - y)).toEqual([4, 5]);
  });

  it('salta a la siguiente fila si la primera no tiene N contiguas', () => {
    const asientos = [
      seat('A', 1), seat('A', 2, 'vendido'), seat('A', 3),
      seat('B', 1), seat('B', 2), seat('B', 3),
    ];
    const picks = pickBestSeats(asientos, 3);
    expect(picks.map((a) => a.fila)).toEqual(['B', 'B', 'B']);
  });

  it('respeta huecos: vendidas/bloqueadas cortan la contigüidad', () => {
    const asientos = [
      seat('A', 1), seat('A', 2), seat('A', 3, 'bloqueado'), seat('A', 4), seat('A', 5),
    ];
    const picks = pickBestSeats(asientos, 2);
    const nums = picks.map((a) => a.numero).sort((x, y) => x - y);
    expect([[1, 2], [4, 5]]).toContainEqual(nums);
  });

  it('excluye las ya seleccionadas', () => {
    const asientos = [seat('A', 1), seat('A', 2), seat('A', 3)];
    const picks = pickBestSeats(asientos, 2, new Set(['A-2']));
    expect(picks.map((a) => a.id)).not.toContain('A-2');
  });

  it('fallback: sin N contiguas devuelve las más cercanas disponibles', () => {
    const asientos = [seat('A', 1), seat('A', 3), seat('A', 5)];
    const picks = pickBestSeats(asientos, 3);
    expect(picks).toHaveLength(3);
  });

  it('ordena filas naturalmente (Z antes que AA)', () => {
    const asientos = [seat('AA', 1), seat('AA', 2), seat('Z', 1), seat('Z', 2)];
    const picks = pickBestSeats(asientos, 2);
    expect(picks.every((a) => a.fila === 'Z')).toBe(true);
  });
});
