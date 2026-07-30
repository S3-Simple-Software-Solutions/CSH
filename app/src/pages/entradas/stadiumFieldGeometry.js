/**
 * Geometría de la gramilla dividida en zonas para eventos espectáculo.
 * El campo del SVG del ERC ocupa aprox. x: 172–828, y: 198–522 (viewBox 1000×720).
 * Esquinas redondeadas con rx≈26, ry≈20.
 */

const FIELD = { x: 172, y: 198, w: 656, h: 324, rx: 26, ry: 20 };

/**
 * Devuelve el path SVG de un rect redondeado dentro del campo,
 * recortado por la geometría real del FIELD_PATH.
 */
function fieldRectPath(x, y, w, h) {
  const rx = Math.min(FIELD.rx, w / 2);
  const ry = Math.min(FIELD.ry, h / 2);
  return (
    `M ${x + rx} ${y}` +
    ` L ${x + w - rx} ${y}` +
    ` Q ${x + w} ${y} ${x + w} ${y + ry}` +
    ` L ${x + w} ${y + h - ry}` +
    ` Q ${x + w} ${y + h} ${x + w - rx} ${y + h}` +
    ` L ${x + rx} ${y + h}` +
    ` Q ${x} ${y + h} ${x} ${y + h - ry}` +
    ` L ${x} ${y + ry}` +
    ` Q ${x} ${y} ${x + rx} ${y}` +
    ` Z`
  );
}

/**
 * Construye los paths SVG de las zonas de gramilla según plantilla y splits.
 *
 * @param {string} template  - '2' | '3' | '4'
 * @param {number[]} splits  - Ratios en (0,1):
 *   - template '2': [splitX] (default [0.5])
 *   - template '3': [splitX1, splitX2] (default [0.333, 0.667])
 *   - template '4': [splitX, splitY]  (default [0.5, 0.5])
 * @returns {{ [key: string]: string[] }} paths por key 'gramilla-N'
 */
export function buildFieldZonePaths(template, splits) {
  const { x, y, w, h } = FIELD;

  if (template === '2') {
    const sx = splits?.[0] ?? 0.5;
    const clamp = Math.max(0.1, Math.min(0.9, sx));
    const w1 = w * clamp;
    const w2 = w - w1;
    return {
      'gramilla-1': [fieldRectPath(x, y, w1, h)],
      'gramilla-2': [fieldRectPath(x + w1, y, w2, h)],
    };
  }

  if (template === '3') {
    const sx1 = Math.max(0.05, Math.min(0.9, splits?.[0] ?? 1 / 3));
    const sx2 = Math.max(sx1 + 0.05, Math.min(0.95, splits?.[1] ?? 2 / 3));
    const w1 = w * sx1;
    const w2 = w * (sx2 - sx1);
    const w3 = w - w * sx2;
    return {
      'gramilla-1': [fieldRectPath(x, y, w1, h)],
      'gramilla-2': [fieldRectPath(x + w * sx1, y, w2, h)],
      'gramilla-3': [fieldRectPath(x + w * sx2, y, w3, h)],
    };
  }

  if (template === '4') {
    const sx = Math.max(0.1, Math.min(0.9, splits?.[0] ?? 0.5));
    const sy = Math.max(0.1, Math.min(0.9, splits?.[1] ?? 0.5));
    const w1 = w * sx;
    const w2 = w - w1;
    const h1 = h * sy;
    const h2 = h - h1;
    return {
      'gramilla-1': [fieldRectPath(x, y, w1, h1)],
      'gramilla-2': [fieldRectPath(x + w1, y, w2, h1)],
      'gramilla-3': [fieldRectPath(x, y + h1, w1, h2)],
      'gramilla-4': [fieldRectPath(x + w1, y + h1, w2, h2)],
    };
  }

  return {};
}

/**
 * Devuelve el punto central de cada zona gramilla para mostrar el label.
 *
 * @param {string} template
 * @param {number[]} splits
 * @returns {{ [key: string]: { x: number; y: number } }}
 */
export function buildFieldZoneLabelPositions(template, splits) {
  const { x, y, w, h } = FIELD;

  if (template === '2') {
    const sx = Math.max(0.1, Math.min(0.9, splits?.[0] ?? 0.5));
    return {
      'gramilla-1': { x: x + w * sx / 2, y: y + h / 2 },
      'gramilla-2': { x: x + w * sx + w * (1 - sx) / 2, y: y + h / 2 },
    };
  }

  if (template === '3') {
    const sx1 = Math.max(0.05, Math.min(0.9, splits?.[0] ?? 1 / 3));
    const sx2 = Math.max(sx1 + 0.05, Math.min(0.95, splits?.[1] ?? 2 / 3));
    return {
      'gramilla-1': { x: x + w * sx1 / 2, y: y + h / 2 },
      'gramilla-2': { x: x + w * (sx1 + sx2) / 2, y: y + h / 2 },
      'gramilla-3': { x: x + w * (sx2 + 1) / 2, y: y + h / 2 },
    };
  }

  if (template === '4') {
    const sx = Math.max(0.1, Math.min(0.9, splits?.[0] ?? 0.5));
    const sy = Math.max(0.1, Math.min(0.9, splits?.[1] ?? 0.5));
    return {
      'gramilla-1': { x: x + w * sx / 2, y: y + h * sy / 2 },
      'gramilla-2': { x: x + w * sx + w * (1 - sx) / 2, y: y + h * sy / 2 },
      'gramilla-3': { x: x + w * sx / 2, y: y + h * sy + h * (1 - sy) / 2 },
      'gramilla-4': { x: x + w * sx + w * (1 - sx) / 2, y: y + h * sy + h * (1 - sy) / 2 },
    };
  }

  return {};
}

/** Devuelve las líneas de división del campo (para el editor de mapa). */
export function buildFieldSplitLines(template, splits) {
  const { x, y, w, h } = FIELD;
  const lines = [];

  if (template === '2') {
    const sx = Math.max(0.1, Math.min(0.9, splits?.[0] ?? 0.5));
    lines.push({ x1: x + w * sx, y1: y, x2: x + w * sx, y2: y + h, axis: 'x', index: 0 });
  } else if (template === '3') {
    const sx1 = Math.max(0.05, Math.min(0.9, splits?.[0] ?? 1 / 3));
    const sx2 = Math.max(sx1 + 0.05, Math.min(0.95, splits?.[1] ?? 2 / 3));
    lines.push({ x1: x + w * sx1, y1: y, x2: x + w * sx1, y2: y + h, axis: 'x', index: 0 });
    lines.push({ x1: x + w * sx2, y1: y, x2: x + w * sx2, y2: y + h, axis: 'x', index: 1 });
  } else if (template === '4') {
    const sx = Math.max(0.1, Math.min(0.9, splits?.[0] ?? 0.5));
    const sy = Math.max(0.1, Math.min(0.9, splits?.[1] ?? 0.5));
    lines.push({ x1: x + w * sx, y1: y, x2: x + w * sx, y2: y + h, axis: 'x', index: 0 });
    lines.push({ x1: x, y1: y + h * sy, x2: x + w, y2: y + h * sy, axis: 'y', index: 1 });
  }

  return lines;
}

/** Cuántas zonas genera cada plantilla. */
export const TEMPLATE_ZONE_COUNT = { '2': 2, '3': 3, '4': 4 };

/** Keys de gramilla activas según plantilla. */
export function gramillaKeysForTemplate(template) {
  const n = TEMPLATE_ZONE_COUNT[template] ?? 0;
  return Array.from({ length: n }, (_, i) => `gramilla-${i + 1}`);
}
