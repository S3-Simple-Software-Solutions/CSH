/**
 * Geometría del mapa ERC v2 — tribunas con curvas y esquinas redondeadas.
 * viewBox 1000×720
 */
export const BOWL_OUTER =
  'M 95 68 Q 500 28 905 68 L 925 195 Q 935 360 925 525 L 905 652 Q 500 692 95 652 L 75 525 Q 65 360 75 195 Z';

export const BOWL_INNER_RIM =
  'M 115 88 Q 500 52 885 88 L 900 200 Q 908 360 900 520 L 885 632 Q 500 668 115 632 L 100 520 Q 92 360 100 200 Z';

export const TRACK_PATH =
  'M 155 172 L 845 172 Q 878 172 878 205 L 878 515 Q 878 548 845 548 L 155 548 Q 122 548 122 515 L 122 205 Q 122 172 155 172 Z';

export const FIELD_PATH =
  'M 195 198 L 805 198 Q 828 198 828 218 L 828 502 Q 828 522 805 522 L 195 522 Q 172 522 172 502 L 172 218 Q 172 198 195 198 Z';

/** Paths por zona (orden: fondo → frente en pintado). */
export const ERC_ZONE_PATHS_V2 = {
  'sol-norte': [
    'M 168 72 Q 500 54 832 72 L 818 162 Q 500 148 182 162 L 168 72 Z',
  ],
  'sol-sur': [
    'M 182 518 Q 500 538 818 518 L 832 648 Q 500 668 168 648 L 182 518 Z',
  ],
  'lateral-este': [
    'M 818 162 L 908 178 L 918 358 L 908 518 L 818 518 L 818 162 Z',
  ],
  'lateral-oeste': [
    'M 182 162 L 92 178 L 82 358 L 92 518 L 182 518 L 182 162 Z',
  ],
};

/**
 * Rectángulos de referencia para renderizar dots de butacas por zona.
 * axis 'h' = horizontal (filas→y, nums→x); 'v' = vertical (filas→x, nums→y).
 */
export const ZONE_SEAT_BOUNDS = {
  'sol-norte':     { x1: 210, y1: 85,  x2: 790, y2: 148, axis: 'h' },
  'sol-sur':       { x1: 210, y1: 528, x2: 790, y2: 638, axis: 'h' },
  'lateral-este':  { x1: 822, y1: 178, x2: 898, y2: 504, axis: 'v' },
  'lateral-oeste': { x1: 102, y1: 178, x2: 178, y2: 504, axis: 'v' },
};
