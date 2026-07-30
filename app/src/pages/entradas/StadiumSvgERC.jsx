/**
 * StadiumSvgERC v2 — mapa vectorial detallado del Estadio Eladio Rosabal Cordero.
 * Soporta modo partido (6 tribunas) y modo espectáculo (tribunas + gramilla).
 */
import { useRef, useState } from 'react';
import { ERC_ZONE_KEYS, ERC_ZONE_META, GRAMILLA_ZONE_META } from './stadiumErc.js';
import {
  BOWL_INNER_RIM,
  BOWL_OUTER,
  ERC_ZONE_PATHS_V2,
  FIELD_PATH,
  TRACK_PATH,
  ZONE_SEAT_BOUNDS,
} from './stadiumSvgGeometry.js';
import { buildFieldZonePaths, buildFieldZoneLabelPositions } from './stadiumFieldGeometry.js';

export const ERC_ZONE_PATHS = ERC_ZONE_PATHS_V2;

function zoneGradientId(key) {
  return `zone-grad-${key}`;
}

function formatZonePrice(tipo) {
  if (!tipo) return 'Sin precio';
  return `₡${Number(tipo.precioVigente ?? tipo.precioCrc ?? 0).toLocaleString('es-CR')}`;
}

function zoneStateText(tipo) {
  if (!tipo) return 'Sin configurar';
  if (tipo.estado === 'inactivo') return 'Fuera de venta';
  if (tipo.disponibles <= 0) return 'Agotada';
  return 'A la venta';
}

function FieldMarkings() {
  // Área de juego, inset respecto al borde del césped (172..828 / 198..522).
  const X1 = 180, X2 = 820, Y1 = 206, Y2 = 514;
  const CX = 500, CY = 360;
  const LINE = 'var(--erc-field-line)';
  const W = 2.2;
  // Proporciones reglamentarias (relativas al largo/alto del campo).
  const PA_D = 100, PA_H = 184;   // área penal (grande)
  const GA_D = 34, GA_H = 84;     // área de meta (chica)
  const SPOT = 66;                // penal a ~11 m de la línea de meta
  const R = 56;                   // radio del círculo central y arcos penales
  const ARC_DY = 45;              // semicuerda del arco penal en el frente del área
  const paTop = CY - PA_H / 2;
  const gaTop = CY - GA_H / 2;
  const GOAL_H = 34, GOAL_D = 7;  // porterías
  return (
    <g className="stadium-field-marks" pointerEvents="none">
      <defs>
        <clipPath id="erc-field-clip"><path d={FIELD_PATH} /></clipPath>
      </defs>

      {/* Rayas de césped (patrón de corte), recortadas a la forma del campo */}
      <g clipPath="url(#erc-field-clip)">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect
            key={`stripe-${i}`}
            x={172 + i * 82}
            y={198}
            width={82}
            height={324}
            fill={i % 2 === 0 ? 'var(--erc-field-stripe-light)' : 'var(--erc-field-stripe-dark)'}
          />
        ))}
      </g>

      <g fill="none" stroke={LINE} strokeWidth={W} strokeLinejoin="round">
        {/* Perímetro (líneas de banda y de meta) */}
        <rect x={X1} y={Y1} width={X2 - X1} height={Y2 - Y1} />
        {/* Línea de medio campo */}
        <line x1={CX} y1={Y1} x2={CX} y2={Y2} />
        {/* Círculo central */}
        <circle cx={CX} cy={CY} r={R} />

        {/* Áreas penales */}
        <rect x={X1} y={paTop} width={PA_D} height={PA_H} />
        <rect x={X2 - PA_D} y={paTop} width={PA_D} height={PA_H} />
        {/* Áreas de meta */}
        <rect x={X1} y={gaTop} width={GA_D} height={GA_H} />
        <rect x={X2 - GA_D} y={gaTop} width={GA_D} height={GA_H} />

        {/* Arcos del área penal (solo la parte fuera del área) */}
        <path d={`M ${X1 + PA_D} ${CY - ARC_DY} A ${R} ${R} 0 0 1 ${X1 + PA_D} ${CY + ARC_DY}`} />
        <path d={`M ${X2 - PA_D} ${CY - ARC_DY} A ${R} ${R} 0 0 0 ${X2 - PA_D} ${CY + ARC_DY}`} />

        {/* Arcos de esquina */}
        <path d={`M ${X1 + 9} ${Y1} A 9 9 0 0 1 ${X1} ${Y1 + 9}`} />
        <path d={`M ${X2 - 9} ${Y1} A 9 9 0 0 0 ${X2} ${Y1 + 9}`} />
        <path d={`M ${X2 - 9} ${Y2} A 9 9 0 0 1 ${X2} ${Y2 - 9}`} />
        <path d={`M ${X1 + 9} ${Y2} A 9 9 0 0 0 ${X1} ${Y2 - 9}`} />

        {/* Porterías */}
        <rect x={X1 - GOAL_D} y={CY - GOAL_H / 2} width={GOAL_D} height={GOAL_H} strokeWidth={W * 0.8} />
        <rect x={X2} y={CY - GOAL_H / 2} width={GOAL_D} height={GOAL_H} strokeWidth={W * 0.8} />
      </g>

      {/* Puntos: central y penales */}
      <g fill="var(--erc-field-line-dot)">
        <circle cx={CX} cy={CY} r="2.8" />
        <circle cx={X1 + SPOT} cy={CY} r="2.4" />
        <circle cx={X2 - SPOT} cy={CY} r="2.4" />
      </g>
    </g>
  );
}

/**
 * Rango de gradas por tribuna sobre el eje de filas y de qué lado queda la
 * cancha (`fieldAt`), para sombrear más oscuro hacia afuera (más altura).
 */
const ZONE_GRADA_RANGE = {
  'sol-norte':     { from: 66,  to: 164, axis: 'h', fieldAt: 'to',   defaultSteps: 7 },
  'sol-sur':       { from: 524, to: 670, axis: 'h', fieldAt: 'from', defaultSteps: 9 },
  'lateral-este':  { from: 828, to: 920, axis: 'v', fieldAt: 'from', defaultSteps: 8 },
  'lateral-oeste': { from: 80,  to: 172, axis: 'v', fieldAt: 'to',   defaultSteps: 8 },
};
const ZONE_AISLE_FRACTIONS = [0.25, 0.5, 0.75];
const ZONE_AISLE_WIDTH = 12;
const ERC_VIEW_W = 1000;
const ERC_VIEW_H = 720;
const SPECIAL_MIN_W = 0.04;
const SPECIAL_MIN_H = 0.04;
const SPECIAL_MAX_W = 0.66;
const SPECIAL_MAX_H = 0.45;

/**
 * Inclinación de las tribunas: las filas siguen la silueta trapezoidal de la
 * zona. `h` = inset horizontal [primera fila, última fila]; `v` = cuánto baja
 * el inicio de la columna [primera fila, última fila].
 */
const ZONE_DOT_TAPER = {
  'sol-norte':     { h: [0, 10] },
  'sol-sur':       { h: [10, 0] },
  'lateral-este':  { v: [0, 12] },
  'lateral-oeste': { v: [12, 0] },
};

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function normalizeAngle(deg) {
  const n = Number.isFinite(deg) ? deg : 0;
  return Math.round((((n + 180) % 360) + 360) % 360 - 180);
}

function rotateAround(x, y, cx, cy, deg) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function unrotateAround(x, y, cx, cy, deg) {
  return rotateAround(x, y, cx, cy, -deg);
}

function normalizeSpecialRect(rect) {
  const w = clamp(Number(rect?.w) || 0.15, SPECIAL_MIN_W, SPECIAL_MAX_W);
  const h = clamp(Number(rect?.h) || 0.12, SPECIAL_MIN_H, SPECIAL_MAX_H);
  const x = clamp(Number(rect?.x) || 0, 0, 1 - w);
  const y = clamp(Number(rect?.y) || 0, 0, 1 - h);
  const rot = normalizeAngle(Number(rect?.rot) || 0);
  return {
    x: round4(x),
    y: round4(y),
    w: round4(w),
    h: round4(h),
    ...(rot ? { rot } : {}),
  };
}

function specialRectMetrics(rect) {
  const normalized = normalizeSpecialRect(rect);
  const x = normalized.x * ERC_VIEW_W;
  const y = normalized.y * ERC_VIEW_H;
  const w = normalized.w * ERC_VIEW_W;
  const h = normalized.h * ERC_VIEW_H;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rot = Number(normalized.rot) || 0;
  const corners = [
    { key: 'nw', ...rotateAround(x, y, cx, cy, rot) },
    { key: 'ne', ...rotateAround(x + w, y, cx, cy, rot) },
    { key: 'se', ...rotateAround(x + w, y + h, cx, cy, rot) },
    { key: 'sw', ...rotateAround(x, y + h, cx, cy, rot) },
  ];
  const top = rotateAround(cx, y, cx, cy, rot);
  const rotateHandle = rotateAround(cx, y - 34, cx, cy, rot);
  return { ...normalized, px: { x, y, w, h, cx, cy, rot, corners, top, rotateHandle } };
}

function zoneTaperAt(zoneKey, t) {
  const taper = ZONE_DOT_TAPER[zoneKey];
  const u = clamp01(t);
  return {
    insetX: taper?.h ? taper.h[0] + (taper.h[1] - taper.h[0]) * u : 0,
    dropY: taper?.v ? taper.v[0] + (taper.v[1] - taper.v[0]) * u : 0,
  };
}

function aisleGapForLength(length) {
  return Math.min(ZONE_AISLE_WIDTH, Math.max(0, length / 18));
}

function aisleGapOnAxis(index, start, length) {
  const gapCount = ZONE_AISLE_FRACTIONS.length;
  const gap = aisleGapForLength(length);
  const usable = Math.max(length - gap * gapCount, length * 0.65);
  const segment = usable / (gapCount + 1);
  const a = start + segment * (index + 1) + gap * index;
  return { a, b: a + gap };
}

function gradeBandPath(zoneKey, bounds, horiz, p0, p1) {
  const { x1, y1, x2, y2 } = bounds;
  if (horiz) {
    const t0 = (p0 - y1) / (y2 - y1);
    const t1 = (p1 - y1) / (y2 - y1);
    const top = zoneTaperAt(zoneKey, t0).insetX;
    const bottom = zoneTaperAt(zoneKey, t1).insetX;
    return `M ${x1 + top} ${p0} L ${x2 - top} ${p0} L ${x2 - bottom} ${p1} L ${x1 + bottom} ${p1} Z`;
  }
  const t0 = (p0 - x1) / (x2 - x1);
  const t1 = (p1 - x1) / (x2 - x1);
  const left = zoneTaperAt(zoneKey, t0).dropY;
  const right = zoneTaperAt(zoneKey, t1).dropY;
  return `M ${p0} ${y1 + left} L ${p1} ${y1 + right} L ${p1} ${y2} L ${p0} ${y2} Z`;
}

function gradeLinePath(zoneKey, bounds, horiz, p) {
  const { x1, y1, x2, y2 } = bounds;
  if (horiz) {
    const insetX = zoneTaperAt(zoneKey, (p - y1) / (y2 - y1)).insetX;
    return `M ${x1 + insetX} ${p} L ${x2 - insetX} ${p}`;
  }
  const dropY = zoneTaperAt(zoneKey, (p - x1) / (x2 - x1)).dropY;
  return `M ${p} ${y1 + dropY} L ${p} ${y2}`;
}

function gradeAislePath(zoneKey, bounds, horiz, index, from, to) {
  const { x1, y1, x2, y2 } = bounds;
  if (horiz) {
    const atY = (y) => {
      const insetX = zoneTaperAt(zoneKey, (y - y1) / (y2 - y1)).insetX;
      return aisleGapOnAxis(index, x1 + insetX, (x2 - x1) - insetX * 2);
    };
    const top = atY(from);
    const bottom = atY(to);
    return `M ${top.a} ${from} L ${top.b} ${from} L ${bottom.b} ${to} L ${bottom.a} ${to} Z`;
  }
  const atX = (x) => {
    const dropY = zoneTaperAt(zoneKey, (x - x1) / (x2 - x1)).dropY;
    return aisleGapOnAxis(index, y1 + dropY, (y2 - y1) - dropY);
  };
  const left = atX(from);
  const right = atX(to);
  return `M ${from} ${left.a} L ${to} ${right.a} L ${to} ${right.b} L ${from} ${left.b} Z`;
}

/**
 * Dibuja la tribuna como gradas escalonadas: bandas que se oscurecen hacia
 * afuera + canto iluminado por escalón + pasillos perpendiculares, todo
 * recortado a la silueta de la zona. Si la tribuna tiene butacas numeradas,
 * cada fila cae centrada sobre su propio escalón.
 */
function ZoneGradas({ zoneKey, status, filas = 0, layer = 'base' }) {
  const cfg = ZONE_GRADA_RANGE[zoneKey];
  const paths = ERC_ZONE_PATHS_V2[zoneKey];
  if (!cfg || !paths?.length || status === 'inactive') return null;

  const bounds = ZONE_SEAT_BOUNDS[zoneKey];
  let { from, to } = cfg;
  let n = cfg.defaultSteps;
  if (filas > 0 && bounds) {
    // Alinea las butacas al centro de cada escalón, con las líneas entre filas.
    const b1 = cfg.axis === 'h' ? bounds.y1 : bounds.x1;
    const b2 = cfg.axis === 'h' ? bounds.y2 : bounds.x2;
    from = b1;
    to = b2;
    n = filas;
  }
  const step = (to - from) / n;
  const span = to - from;
  const horiz = cfg.axis === 'h';
  const clipId = `erc-zone-clip-${zoneKey}`;
  const tapered = !!bounds && filas > 0;

  const bands = Array.from({ length: n }, (_, i) => {
    const p0 = from + i * step;
    const centro = p0 + step / 2;
    const tOut = cfg.fieldAt === 'from' ? (centro - from) / span : (to - centro) / span;
    return { p0, opacity: 0.05 + 0.3 * tOut };
  });

  // Pasillos que separan bloques de butacas (perpendiculares a las filas).
  const aisles = bounds
    ? ZONE_AISLE_FRACTIONS.map((f, i) => ({
        i,
        p: horiz ? bounds.x1 + f * (bounds.x2 - bounds.x1) : bounds.y1 + f * (bounds.y2 - bounds.y1),
      }))
    : [];

  return (
    <g pointerEvents="none">
      <g clipPath={`url(#${clipId})`}>
        {layer === 'base' && (
          <>
            {bands.map(({ p0, opacity }) => (
              tapered
                ? (
                  <path
                    key={p0}
                    d={gradeBandPath(zoneKey, bounds, horiz, p0, p0 + step)}
                    fill={`rgb(var(--erc-step-shade-rgb) / ${opacity.toFixed(3)})`}
                  />
                )
                : (
                  <rect
                    key={p0}
                    x={horiz ? 40 : p0}
                    y={horiz ? p0 : 40}
                    width={horiz ? 920 : step}
                    height={horiz ? step : 640}
                    fill={`rgb(var(--erc-step-shade-rgb) / ${opacity.toFixed(3)})`}
                  />
                )
            ))}
          </>
        )}
        {layer === 'overlay' && (
          <>
            {bands.slice(1).map(({ p0 }) => (
              tapered
                ? <path key={`l-${p0}`} d={gradeLinePath(zoneKey, bounds, horiz, p0)} stroke="rgb(var(--erc-step-line-rgb) / .32)" strokeWidth="1" fill="none" />
                : (horiz
                    ? <line key={`l-${p0}`} x1="40" y1={p0} x2="960" y2={p0} stroke="rgb(var(--erc-step-line-rgb) / .28)" strokeWidth="1" />
                    : <line key={`l-${p0}`} x1={p0} y1="40" x2={p0} y2="680" stroke="rgb(var(--erc-step-line-rgb) / .28)" strokeWidth="1" />
                  )
            ))}
            {aisles.map(({ i, p }) => (
              tapered
                ? <path key={`a-${i}`} d={gradeAislePath(zoneKey, bounds, horiz, i, from, to)} fill="rgb(var(--erc-aisle-rgb) / .58)" />
                : (horiz
                    ? <rect key={`a-${p}`} x={p - ZONE_AISLE_WIDTH / 2} y={from} width={ZONE_AISLE_WIDTH} height={span} fill="rgb(var(--erc-aisle-rgb) / .58)" />
                    : <rect key={`a-${p}`} x={from} y={p - ZONE_AISLE_WIDTH / 2} width={span} height={ZONE_AISLE_WIDTH} fill="rgb(var(--erc-aisle-rgb) / .58)" />
                  )
            ))}
          </>
        )}
      </g>
    </g>
  );
}

function NorthMarker() {
  return (
    <g className="stadium-north" pointerEvents="none" transform="translate(500, 46)">
      <circle r="14" fill="var(--erc-compass-bg)" stroke="var(--erc-compass-stroke)" strokeWidth="1" />
      {/* El Norte del estadio queda hacia la izquierda del mapa: la flecha apunta allí. */}
      <path d="M 0 -7 L 0 5 M 0 -7 L -4 0 M 0 -7 L 4 0" transform="rotate(-90)" stroke="var(--erc-compass-stroke)" strokeWidth="1.5" fill="none" />
      <text x="6" y="3" textAnchor="middle" className="stadium-north-label">N</text>
    </g>
  );
}

function VenueTitle({ venue }) {
  const label = (venue || '').trim();
  if (!label) return null;
  const upper = label.toUpperCase();
  if (upper.length <= 42) {
    return (
      <text x="500" y="28" textAnchor="middle" className="stadium-erc-title" pointerEvents="none">
        {upper}
      </text>
    );
  }
  const mid = Math.floor(upper.length / 2);
  let split = upper.lastIndexOf(' ', mid);
  if (split < 10) split = upper.indexOf(' ', mid);
  if (split < 0) split = mid;
  const line1 = upper.slice(0, split).trim();
  const line2 = upper.slice(split).trim();
  return (
    <text x="500" y="22" textAnchor="middle" className="stadium-erc-title" pointerEvents="none">
      <tspan x="500" dy="0">{line1}</tspan>
      <tspan x="500" dy="12">{line2}</tspan>
    </text>
  );
}

/**
 * Zonas de gramilla como overlay semitransparente sobre el campo.
 * Solo se render cuando `fieldTemplate` está definido.
 */
function GramillaZones({
  fieldTemplate,
  fieldSplits,
  tiposByKey,
  hoveredKey,
  selectedKey,
  onZoneClick,
  onZoneHover,
  interactive,
  showLabels,
  zoneStatus,
  zoneOpacity,
  zoneStroke,
  zoneFilter,
  zoneFillProps,
  showInactive,
  showZoneDetails,
}) {
  if (!fieldTemplate) return null;

  const paths = buildFieldZonePaths(fieldTemplate, fieldSplits);
  const labelPos = buildFieldZoneLabelPositions(fieldTemplate, fieldSplits);

  return Object.entries(paths).map(([key, pathArr]) => {
    const status = zoneStatus(key);
    if (status === 'inactive' && !showInactive) return null;
    const t = tiposByKey?.[key];
    const canInteract = interactive && (t || showInactive);
    const fillProps = zoneFillProps(key, status, true);
    const handlers = canInteract
      ? {
          onClick: (e) => { e.stopPropagation(); onZoneClick?.(key, t); },
          onMouseEnter: () => onZoneHover?.(key),
          onMouseLeave: () => onZoneHover?.(null),
          onFocus: () => onZoneHover?.(key),
          onBlur: () => onZoneHover?.(null),
        }
      : {};
    const pos = labelPos[key];
    const meta = GRAMILLA_ZONE_META[key];
    const showFull = hoveredKey === key || selectedKey === key;

    return (
      <g
        key={key}
        className={`stadium-zone-group stadium-zone--${status}`}
        style={{ cursor: canInteract ? 'pointer' : 'default' }}
        tabIndex={canInteract ? 0 : -1}
        role={canInteract ? 'button' : undefined}
        aria-label={canInteract ? `${meta?.label ?? key} · ${formatZonePrice(t)} · ${zoneStateText(t)}` : undefined}
        {...handlers}
      >
        {pathArr.map((d, i) => (
          <path
            key={i}
            d={d}
            {...fillProps}
            stroke={zoneStroke(status, key)}
            strokeWidth={status === 'selected' ? 3 : status === 'hover' ? 2 : 1.5}
            className="stadium-zone stadium-zone--gramilla"
            style={{ transition: 'fill-opacity 0.2s ease, stroke 0.2s ease' }}
            filter={zoneFilter(status)}
            pointerEvents="all"
          />
        ))}
        {showLabels && pos && (
          <text
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`stadium-zone-label stadium-zone-label--gramilla${showFull ? ' stadium-zone-label--full' : ''}`}
            pointerEvents="none"
          >
            <tspan x={pos.x} dy={showZoneDetails ? -9 : 0}>{showFull ? (meta?.label ?? key) : (meta?.short ?? key)}</tspan>
            {showZoneDetails && (
              <>
                {/* Fuera de venta: sin precio visible */}
                {status !== 'inactive' && (
                  <tspan x={pos.x} dy="15" className="stadium-zone-label-price">{formatZonePrice(t)}</tspan>
                )}
                <tspan x={pos.x} dy={status === 'inactive' ? 15 : 13} className={`stadium-zone-label-status${status === 'inactive' ? ' inactive' : ''}`}>{zoneStateText(t)}</tspan>
              </>
            )}
          </text>
        )}
      </g>
    );
  });
}

/** Orden natural de filas: A..Z antes que AA (longitud primero, luego alfabético). */
function filaSort(a, b) {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

function seatDotRadius(spacing) {
  return Math.min(5, Math.max(0.18, spacing * 0.34), spacing * 0.45);
}

function seatEdgePad(span, dotR) {
  return Math.min(Math.max(2, dotR + 1.1), Math.max(0, span * 0.18));
}

function seatAxisPosition(index, total, start, length, clearance = 0) {
  if (total <= 0 || length <= 0) return start;
  const gapCount = ZONE_AISLE_FRACTIONS.length;
  const gap = aisleGapForLength(length);
  const usable = Math.max(length - gap * gapCount, length * 0.65);
  const segmentCount = gapCount + 1;
  const segment = usable / segmentCount;
  const u = (index + 0.5) / total * usable;
  const segmentIndex = Math.min(gapCount, Math.floor(u / segment));
  const local = u - segment * segmentIndex;
  const pad = Math.min(Math.max(0, clearance), segment * 0.32);
  const inner = Math.max(segment - pad * 2, segment * 0.4);
  return start + segmentIndex * (segment + gap) + pad + (local / segment) * inner;
}

/** Posiciones (coords del viewBox) de los dots de butacas de una zona. */
export function seatDotLayout(zoneKey, asientos) {
  const bounds = ZONE_SEAT_BOUNDS[zoneKey];
  if (!bounds || !asientos || asientos.length === 0) return null;

  const { x1, y1, x2, y2, axis } = bounds;
  const w = x2 - x1;
  const h = y2 - y1;

  const filaMap = new Map();
  for (const a of asientos) {
    if (!filaMap.has(a.fila)) filaMap.set(a.fila, []);
    filaMap.get(a.fila).push(a);
  }
  const filas = [...filaMap.keys()].sort(filaSort);
  const nFilas = filas.length;
  if (nFilas === 0) return null;
  const maxCols = Math.max(...filas.map((f) => filaMap.get(f).length));

  const spacing = axis === 'h'
    ? Math.min(w / Math.max(maxCols, 1), h / Math.max(nFilas, 1))
    : Math.min(h / Math.max(maxCols, 1), w / Math.max(nFilas, 1));
  const dotR = seatDotRadius(spacing);
  const rowSpan = axis === 'h' ? h : w;
  const rowPad = seatEdgePad(rowSpan, dotR);
  const rowStart = axis === 'h' ? y1 + rowPad : x1 + rowPad;
  const rowLength = Math.max(1, rowSpan - rowPad * 2);
  const aisleClearance = Math.max(dotR + 0.7, 1);

  const dots = [];
  filas.forEach((fila, fi) => {
    const cols = filaMap.get(fila).sort((a, b) => a.numero - b.numero);
    const nCols = cols.length;
    const tf = nFilas > 1 ? fi / (nFilas - 1) : 0;
    // La fila se acomoda a la silueta inclinada de la tribuna.
    const { insetX, dropY } = zoneTaperAt(zoneKey, tf);
    const rowX = x1 + insetX;
    const rowW = w - insetX * 2;
    const colY = y1 + dropY;
    const colH = h - dropY;
    cols.forEach((a, ci) => {
      const cx = axis === 'h'
        ? seatAxisPosition(ci, nCols, rowX, rowW, aisleClearance)
        : rowStart + (fi + 0.5) / nFilas * rowLength;
      const cy = axis === 'h'
        ? rowStart + (fi + 0.5) / nFilas * rowLength
        : seatAxisPosition(ci, nCols, colY, colH, aisleClearance);
      dots.push({ a, cx, cy });
    });
  });
  return { dots, dotR };
}

function seatDotColor(estado) {
  if (estado === 'vendido') return '#e05555';
  if (estado === 'bloqueado') return '#888';
  if (estado === 'reservado') return '#d4a84b';
  return '#4fc96b';
}

function ZoneSeatDots({ zoneKey, asientos, selectedSeatIds = null, onSeatClick = null }) {
  const layout = seatDotLayout(zoneKey, asientos);
  if (!layout) return null;
  const { dots, dotR } = layout;

  return (
    <g pointerEvents="none" opacity={0.85} clipPath={ZONE_GRADA_RANGE[zoneKey] ? `url(#erc-zone-clip-${zoneKey})` : undefined}>
      {dots.map(({ a, cx, cy }) => {
        const selectable = !!onSeatClick && a.estado !== 'vendido';
        const selected = selectedSeatIds?.has(a.id);
        return (
          <circle
            key={`${a.fila}-${a.numero}`}
            cx={cx}
            cy={cy}
            r={selected ? dotR * 1.25 : dotR}
            fill={seatDotColor(a.estado)}
            stroke={selected ? '#fff' : 'none'}
            strokeWidth={selected ? Math.max(0.8, dotR * 0.5) : 0}
            pointerEvents={selectable ? 'all' : 'none'}
            style={selectable ? { cursor: 'pointer' } : undefined}
            onClick={selectable ? (e) => { e.stopPropagation(); onSeatClick(a); } : undefined}
          >
            <title>{`${a.fila}${a.numero} · ${a.estado}`}</title>
          </circle>
        );
      })}
    </g>
  );
}

/**
 * Grilla expandida de las butacas de UNA zona, para tocarlas cómodamente
 * (en el mapa completo los dots quedan demasiado densos). Mismos colores y
 * gestos que el mapa: click marca/desmarca y arrastre selecciona en caja.
 * Las butacas se dibujan a tamaño fijo; si la tribuna es muy ancha el
 * contenedor scrollea horizontal en vez de encoger los dots.
 */
export function ZoneSeatGrid({ asientos, selectedSeatIds = null, onSeatClick = null, onBoxSelect = null }) {
  const svgRef = useRef(null);
  const [marquee, setMarquee] = useState(null);
  if (!asientos || asientos.length === 0) return null;

  const filaMap = new Map();
  for (const a of asientos) {
    if (!filaMap.has(a.fila)) filaMap.set(a.fila, []);
    filaMap.get(a.fila).push(a);
  }
  const filas = [...filaMap.keys()].sort(filaSort);
  const maxCols = Math.max(...filas.map((f) => filaMap.get(f).length));
  const CELL = 24;
  const LABEL_W = 34;
  const PAD = 8;
  const width = LABEL_W + maxCols * CELL + PAD;
  const height = PAD * 2 + filas.length * CELL;

  const dots = [];
  filas.forEach((fila, fi) => {
    const cols = [...filaMap.get(fila)].sort((x, y) => x.numero - y.numero);
    cols.forEach((a, ci) => {
      dots.push({ a, cx: LABEL_W + (ci + 0.5) * CELL, cy: PAD + (fi + 0.5) * CELL });
    });
  });

  function svgCoords(clientX, clientY) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }

  function startMarquee(e) {
    if (!onBoxSelect || e.button !== 0) return;
    const start = svgCoords(e.clientX, e.clientY);
    const startClient = { x: e.clientX, y: e.clientY };
    let moved = false;
    const rectFrom = (cur) => ({
      x1: Math.min(start.x, cur.x),
      y1: Math.min(start.y, cur.y),
      x2: Math.max(start.x, cur.x),
      y2: Math.max(start.y, cur.y),
    });
    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) < 6) return;
      moved = true;
      setMarquee(rectFrom(svgCoords(ev.clientX, ev.clientY)));
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setMarquee(null);
      if (!moved) return;
      const rect = rectFrom(svgCoords(ev.clientX, ev.clientY));
      const hits = dots
        .filter(({ cx, cy }) => cx >= rect.x1 && cx <= rect.x2 && cy >= rect.y1 && cy <= rect.y2)
        .map(({ a }) => a);
      onBoxSelect(hits, ev.shiftKey || ev.ctrlKey);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Butacas de la zona seleccionada"
        onPointerDown={onBoxSelect ? startMarquee : undefined}
        style={{ display: 'block', background: '#11130c', borderRadius: 8, touchAction: onBoxSelect ? 'none' : undefined }}
      >
        {filas.map((fila, fi) => (
          <text
            key={fila}
            x={LABEL_W - 12}
            y={PAD + (fi + 0.5) * CELL + 3.5}
            textAnchor="end"
            fontSize="10"
            fill="rgba(255,255,255,.55)"
          >
            {fila}
          </text>
        ))}
        {dots.map(({ a, cx, cy }) => {
          const selectable = !!onSeatClick && a.estado !== 'vendido';
          const selected = selectedSeatIds?.has(a.id);
          return (
            <g key={a.id}>
              <circle
                cx={cx}
                cy={cy}
                r={9}
                fill={seatDotColor(a.estado)}
                stroke={selected ? '#fff' : 'rgba(0,0,0,.4)'}
                strokeWidth={selected ? 2.5 : 1}
                style={selectable ? { cursor: 'pointer' } : undefined}
                onClick={selectable ? (e) => { e.stopPropagation(); onSeatClick(a); } : undefined}
              >
                <title>{`${a.fila}${a.numero} · ${a.estado}`}</title>
              </circle>
              <text x={cx} y={cy + 3} textAnchor="middle" fontSize="8" fill="rgba(0,0,0,.7)" pointerEvents="none">
                {a.numero}
              </text>
            </g>
          );
        })}
        {marquee && (
          <rect
            x={marquee.x1}
            y={marquee.y1}
            width={marquee.x2 - marquee.x1}
            height={marquee.y2 - marquee.y1}
            fill="rgba(255,255,255,0.08)"
            stroke="#fff"
            strokeWidth="1.5"
            strokeDasharray="7 5"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}

export function StadiumSvgERC({
  tiposByKey,
  hoveredKey,
  selectedKey,
  onZoneClick,
  onZoneHover,
  interactive = true,
  showLabels = true,
  venue = '',
  fieldTemplate = null,
  fieldSplits = null,
  className = '',
  showInactive = false,
  showZoneDetails = false,
  seatsByZoneKey = {},
  selectedSeatIds = null,
  selectedSeatZoneKeys = null,
  onSeatClick = null,
  onSeatBoxSelect = null,
  specialZones = [],
  editableSpecialZones = false,
  onSpecialZoneChange = null,
}) {
  const svgRef = useRef(null);
  const suppressZoneClick = useRef(false);
  const [marquee, setMarquee] = useState(null);

  // Suprime el click de zona que dispara el navegador al soltar un arrastre.
  const zoneClick = onZoneClick
    ? (key, t) => { if (!suppressZoneClick.current) onZoneClick(key, t); }
    : undefined;

  function svgCoords(clientX, clientY) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }

  // Arrastre sobre el mapa = selección en caja de butacas (como el parqueo).
  function startSeatMarquee(e) {
    if (!onSeatBoxSelect || e.button !== 0) return;
    const start = svgCoords(e.clientX, e.clientY);
    const startClient = { x: e.clientX, y: e.clientY };
    let moved = false;
    const rectFrom = (cur) => ({
      x1: Math.min(start.x, cur.x),
      y1: Math.min(start.y, cur.y),
      x2: Math.max(start.x, cur.x),
      y2: Math.max(start.y, cur.y),
    });
    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) < 6) return;
      moved = true;
      setMarquee(rectFrom(svgCoords(ev.clientX, ev.clientY)));
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setMarquee(null);
      if (!moved) return;
      suppressZoneClick.current = true;
      setTimeout(() => { suppressZoneClick.current = false; }, 0);
      const rect = rectFrom(svgCoords(ev.clientX, ev.clientY));
      const hits = [];
      for (const [key, asientos] of Object.entries(seatsByZoneKey)) {
        const layout = seatDotLayout(key, asientos);
        if (!layout) continue;
        for (const { a, cx, cy } of layout.dots) {
          if (cx >= rect.x1 && cx <= rect.x2 && cy >= rect.y1 && cy <= rect.y2) hits.push(a);
        }
      }
      onSeatBoxSelect(hits, ev.shiftKey || ev.ctrlKey);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startSpecialZoneEdit(e, zone, mode) {
    if (!editableSpecialZones || !onSpecialZoneChange || !zone?.rect) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const start = svgCoords(e.clientX, e.clientY);
    const startRect = normalizeSpecialRect(zone.rect);
    const metrics = specialRectMetrics(startRect).px;
    let moved = false;

    const emit = (nextRect) => {
      onSpecialZoneChange(zone.key, normalizeSpecialRect(nextRect));
    };

    const onMove = (ev) => {
      const current = svgCoords(ev.clientX, ev.clientY);
      if (!moved && Math.hypot(current.x - start.x, current.y - start.y) < 2) return;
      moved = true;

      if (mode === 'move') {
        const dx = (current.x - start.x) / ERC_VIEW_W;
        const dy = (current.y - start.y) / ERC_VIEW_H;
        emit({ ...startRect, x: startRect.x + dx, y: startRect.y + dy });
        return;
      }

      if (mode === 'resize') {
        const local = unrotateAround(current.x, current.y, metrics.cx, metrics.cy, metrics.rot);
        const w = Math.abs(local.x - metrics.cx) * 2 / ERC_VIEW_W;
        const h = Math.abs(local.y - metrics.cy) * 2 / ERC_VIEW_H;
        const nextW = clamp(w, SPECIAL_MIN_W, SPECIAL_MAX_W);
        const nextH = clamp(h, SPECIAL_MIN_H, SPECIAL_MAX_H);
        emit({
          ...startRect,
          x: startRect.x + startRect.w / 2 - nextW / 2,
          y: startRect.y + startRect.h / 2 - nextH / 2,
          w: nextW,
          h: nextH,
        });
        return;
      }

      if (mode === 'rotate') {
        const angle = Math.atan2(current.y - metrics.cy, current.x - metrics.cx) * 180 / Math.PI + 90;
        // Las zonas especiales solo rotan en pasos de 90°.
        emit({ ...startRect, rot: normalizeAngle(Math.round(angle / 90) * 90) });
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!moved) return;
      suppressZoneClick.current = true;
      setTimeout(() => { suppressZoneClick.current = false; }, 0);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function zoneStatus(key) {
    const t = tiposByKey?.[key];
    if (!t || t.estado === 'inactivo') return 'inactive';
    // Una zona con butacas seleccionadas queda marcada aunque su panel esté
    // cerrado o ya no queden disponibles (las que tenés son tu selección).
    if (selectedKey === key || selectedSeatZoneKeys?.has(key)) return 'selected';
    if (t.disponibles <= 0) return 'agotado';
    if (hoveredKey === key) return 'hover';
    return 'available';
  }

  function zoneOpacity(status) {
    if (status === 'inactive') return 0.12;
    if (status === 'agotado') return 0.32;
    if (status === 'selected') return 0.95;
    if (status === 'hover') return 0.82;
    return 0.62;
  }

  function zoneStroke(status, key) {
    if (status === 'selected') return 'var(--erc-selected-stroke)';
    const meta = ERC_ZONE_META[key] ?? GRAMILLA_ZONE_META[key];
    if (status === 'hover') return meta?.color ?? '#f0d078';
    return 'var(--erc-zone-stroke)';
  }

  function zoneFilter(status) {
    if (status === 'selected') return 'url(#erc-glow)';
    if (status === 'hover') return 'url(#erc-glow-soft)';
    return undefined;
  }

  // isGramilla: gramilla usa fillOpacity mayor (más visible sobre el campo verde)
  function zoneFillProps(key, status, isGramilla = false) {
    if (status === 'inactive') return { fill: 'var(--erc-zone-inactive)', fillOpacity: zoneOpacity(status) };
    if (status === 'agotado') return { fill: 'var(--erc-zone-soldout)', fillOpacity: zoneOpacity(status) };
    const base = zoneOpacity(status);
    return { fill: `url(#${zoneGradientId(key)})`, fillOpacity: isGramilla ? Math.min(1, base + 0.2) : base };
  }

  const venueLabel = (venue || '').trim();
  const ariaLabel = venueLabel
    ? `Mapa del ${venueLabel}`
    : 'Mapa del estadio';
  const filasForZone = (key) => new Set((seatsByZoneKey[key] ?? []).map((a) => a.fila)).size;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 720"
      className={`stadium-svg-erc stadium-svg-erc--v2 ${className}`}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={onSeatBoxSelect ? startSeatMarquee : undefined}
      style={onSeatBoxSelect ? { touchAction: 'none' } : undefined}
    >
      <defs>
        <linearGradient id="erc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--erc-bg-top)" />
          <stop offset="55%" stopColor="var(--erc-bg-mid)" />
          <stop offset="100%" stopColor="var(--erc-bg-bottom)" />
        </linearGradient>
        <radialGradient id="erc-ambient" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="var(--erc-ambient-core)" />
          <stop offset="100%" stopColor="var(--erc-ambient-edge)" />
        </radialGradient>
        <linearGradient id="erc-field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--erc-field-top)" />
          <stop offset="100%" stopColor="var(--erc-field-bottom)" />
        </linearGradient>
        {[...ERC_ZONE_KEYS, 'gramilla-1', 'gramilla-2', 'gramilla-3', 'gramilla-4'].map((key) => {
          const color = ERC_ZONE_META[key]?.color ?? GRAMILLA_ZONE_META[key]?.color ?? '#c9a961';
          const isGramilla = key.startsWith('gramilla-');
          return (
            <linearGradient
              key={key}
              id={zoneGradientId(key)}
              x1="0"
              y1="0"
              x2={isGramilla ? '1' : '0'}
              y2={isGramilla ? '0' : '1'}
            >
              <stop offset="0%" stopColor={color} stopOpacity="0.9" />
              <stop offset="50%" stopColor={color} stopOpacity="0.7" />
              <stop offset="100%" stopColor={isGramilla ? 'var(--erc-gramilla-depth)' : 'var(--erc-stand-depth)'} stopOpacity="0.85" />
            </linearGradient>
          );
        })}
        <filter id="erc-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="erc-glow-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Silueta de cada tribuna: recorta gradas y dots a la zona */}
        {Object.entries(ERC_ZONE_PATHS_V2).map(([key, zonePaths]) => (
          <clipPath key={`zc-${key}`} id={`erc-zone-clip-${key}`}>
            {zonePaths.map((d, i) => <path key={i} d={d} />)}
          </clipPath>
        ))}
        {/* Las zonas de gramilla rodean a las especiales: se les recorta el hueco */}
        {specialZones.length > 0 && (
          <mask id="erc-specials-cut" maskUnits="userSpaceOnUse">
            <rect width="1000" height="720" fill="#fff" />
            {specialZones.map((z) => {
              if (!z?.rect) return null;
              const x = z.rect.x * 1000;
              const y = z.rect.y * 720;
              const w = z.rect.w * 1000;
              const h = z.rect.h * 720;
              const rot = Number(z.rect.rot) || 0;
              return (
                <rect
                  key={`cut-${z.key}`}
                  x={x - 5}
                  y={y - 5}
                  width={w + 10}
                  height={h + 10}
                  rx="14"
                  transform={rot ? `rotate(${rot} ${x + w / 2} ${y + h / 2})` : undefined}
                  fill="#000"
                />
              );
            })}
          </mask>
        )}
      </defs>

      <rect width="1000" height="720" fill="url(#erc-bg)" rx="14" />
      <rect width="1000" height="720" fill="url(#erc-ambient)" rx="14" pointerEvents="none" />

      {/* Bowl exterior + borde iluminado */}
      <path d={BOWL_OUTER} fill="var(--erc-bowl-fill)" stroke="var(--erc-bowl-stroke)" strokeWidth="2" pointerEvents="none" />
      <path d={BOWL_INNER_RIM} fill="none" stroke="var(--erc-rim-stroke)" strokeWidth="1.5" pointerEvents="none" />

      {/* Pista atlética */}
      <path d={TRACK_PATH} fill="var(--erc-track-fill)" fillOpacity="0.86" pointerEvents="none" />
      <path d={TRACK_PATH} fill="none" stroke="var(--erc-track-stroke)" strokeWidth="3" pointerEvents="none" />
      <path d={TRACK_PATH} fill="none" stroke="var(--erc-track-inner-stroke)" strokeWidth="1" transform="scale(0.98) translate(10 14)" pointerEvents="none" />

      {/* Zonas interactivas */}
      {Object.entries(ERC_ZONE_PATHS_V2).map(([key, paths]) => {
        const status = zoneStatus(key);
        if (status === 'inactive' && !showInactive) return null;
        const t = tiposByKey?.[key];
        const canInteract = interactive && (t || showInactive);
        const handlers = canInteract
          ? {
              onClick: (e) => { e.stopPropagation(); zoneClick?.(key, t); },
              onMouseEnter: () => onZoneHover?.(key),
              onMouseLeave: () => onZoneHover?.(null),
              onFocus: () => onZoneHover?.(key),
              onBlur: () => onZoneHover?.(null),
            }
          : {};

        const fillProps = zoneFillProps(key, status);

        return (
          <g
            key={key}
            className={`stadium-zone-group stadium-zone--${status}`}
            style={{ cursor: canInteract ? 'pointer' : 'default' }}
            tabIndex={canInteract && !showZoneDetails ? 0 : -1}
            role={canInteract && !showZoneDetails ? 'button' : undefined}
            aria-label={canInteract && !showZoneDetails ? `${ERC_ZONE_META[key]?.label ?? key} · ${formatZonePrice(t)} · ${zoneStateText(t)}` : undefined}
            {...handlers}
          >
            {paths.map((d, i) => (
              <path
                key={`${key}-${i}`}
                d={d}
                {...fillProps}
                stroke={zoneStroke(status, key)}
                strokeWidth={status === 'selected' ? 3 : status === 'hover' ? 2 : 1.5}
                className="stadium-zone"
                style={{ transition: 'fill-opacity 0.2s ease, stroke 0.2s ease' }}
                filter={zoneFilter(status)}
                pointerEvents="all"
              />
            ))}
            <ZoneGradas
              zoneKey={key}
              status={status}
              filas={filasForZone(key)}
            />
          </g>
        );
      })}

      {/* Dots de butacas numeradas (solo en admin: seatsByZoneKey se pasa desde VenueMapConfig) */}
      {Object.entries(seatsByZoneKey).map(([key, asientos]) => (
        <ZoneSeatDots
          key={`sd-${key}`}
          zoneKey={key}
          asientos={asientos}
          selectedSeatIds={selectedSeatIds}
          onSeatClick={onSeatClick}
        />
      ))}

      {/* Líneas de escalón y pasillos encima de las butacas para que no queden tapados. */}
      {Object.keys(ERC_ZONE_PATHS_V2).map((key) => (
        <ZoneGradas
          key={`go-${key}`}
          zoneKey={key}
          status={zoneStatus(key)}
          filas={filasForZone(key)}
          layer="overlay"
        />
      ))}

      {/* Campo: opaco normal; casi opaco en espectáculo para que las tribunas no se transparenten debajo */}
      <path
        d={FIELD_PATH}
        fill="url(#erc-field)"
        fillOpacity={fieldTemplate ? 0.9 : 1}
        pointerEvents="none"
      />
      {!fieldTemplate && <FieldMarkings />}

      {/* Zonas de gramilla (espectáculo) — encima del campo, rodeando las zonas especiales */}
      {fieldTemplate && (
        <g mask={specialZones.length > 0 ? 'url(#erc-specials-cut)' : undefined}>
        <GramillaZones
          fieldTemplate={fieldTemplate}
          fieldSplits={fieldSplits}
          tiposByKey={tiposByKey}
          hoveredKey={hoveredKey}
          selectedKey={selectedKey}
          onZoneClick={zoneClick}
          onZoneHover={onZoneHover}
          interactive={interactive}
          showLabels={showLabels}
          zoneStatus={zoneStatus}
          zoneOpacity={zoneOpacity}
          zoneStroke={zoneStroke}
          zoneFilter={zoneFilter}
          zoneFillProps={zoneFillProps}
          showInactive={showInactive}
          showZoneDetails={showZoneDetails}
        />
        </g>
      )}

      {/* Zonas especiales (DJ, patrocinador, etc.) — rectángulos sobre la cancha */}
      {specialZones.map((z) => {
        if (!z || !z.rect) return null;
        const inactive = z.estado === 'inactivo';
        const selected = selectedKey === z.key;
        const hovered = hoveredKey === z.key;
        const { x, y, w, h, cx, cy, rot, corners, top, rotateHandle } = specialRectMetrics(z.rect).px;
        const color = z.color || '#f59e0b';
        const canInteract = interactive && (showInactive || z.estado !== 'inactivo');
        const canEdit = editableSpecialZones && selected && Boolean(onSpecialZoneChange);
        const handlers = canInteract
          ? {
              onClick: (e) => { e.stopPropagation(); zoneClick?.(z.key, z.tipo); },
              onMouseEnter: () => onZoneHover?.(z.key),
              onMouseLeave: () => onZoneHover?.(null),
            }
          : {};
        return (
          <g
            key={z.key}
            className="stadium-special-group"
            style={{ cursor: canEdit ? 'move' : canInteract ? 'pointer' : 'default' }}
            {...handlers}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={12}
              ry={12}
              fill={color}
              fillOpacity={inactive ? 0.28 : selected ? 0.92 : hovered ? 0.8 : 0.62}
              stroke={selected ? 'var(--erc-selected-stroke)' : 'var(--erc-special-stroke)'}
              strokeWidth={selected ? 3 : 1.5}
              strokeDasharray="7 4"
              filter={selected ? 'url(#erc-glow)' : undefined}
              style={{ transition: 'fill-opacity .2s ease, stroke .2s ease' }}
              transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}
              onPointerDown={canEdit ? (e) => startSpecialZoneEdit(e, z, 'move') : undefined}
            />
            {showLabels && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="stadium-special-label"
                pointerEvents="none"
              >
                <tspan x={cx} dy={showZoneDetails ? -6 : 0}>{z.nombre}</tspan>
                {showZoneDetails && (
                  <>
                    {/* Fuera de venta: sin precio visible */}
                    {!inactive && (
                      <tspan x={cx} dy="15" className="stadium-zone-label-price">{formatZonePrice(z.tipo)}</tspan>
                    )}
                    <tspan x={cx} dy={inactive ? 15 : 13} className={`stadium-zone-label-status${inactive ? ' inactive' : ''}`}>
                      {zoneStateText(z.tipo)}
                    </tspan>
                  </>
                )}
                </text>
            )}
            {canEdit && (
              <g className="stadium-special-controls">
                <line
                  x1={top.x}
                  y1={top.y}
                  x2={rotateHandle.x}
                  y2={rotateHandle.y}
                  className="stadium-special-rotate-line"
                  pointerEvents="none"
                />
                <circle
                  cx={rotateHandle.x}
                  cy={rotateHandle.y}
                  r="9"
                  className="stadium-special-handle stadium-special-handle--rotate"
                  onPointerDown={(e) => startSpecialZoneEdit(e, z, 'rotate')}
                  onClick={(e) => e.stopPropagation()}
                />
                {corners.map((p) => (
                  <circle
                    key={p.key}
                    cx={p.x}
                    cy={p.y}
                    r="7.5"
                    className="stadium-special-handle stadium-special-handle--resize"
                    onPointerDown={(e) => startSpecialZoneEdit(e, z, 'resize')}
                    onClick={(e) => e.stopPropagation()}
                  />
                ))}
              </g>
            )}
          </g>
        );
      })}

      {/* Labels tribunas */}
      {showLabels && Object.entries(ERC_ZONE_META).map(([key, meta]) => {
        const status = zoneStatus(key);
        if (status === 'inactive' && !showInactive) return null;
        const showFull = hoveredKey === key || selectedKey === key;
        const tipo = tiposByKey?.[key];
        const canInteract = interactive && showZoneDetails && (tipo || showInactive);
        const activate = () => zoneClick?.(key, tipo);
        return (
          <text
            key={`lbl-${key}`}
            x={meta.labelX}
            y={meta.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`stadium-zone-label${showFull ? ' stadium-zone-label--full' : ''}`}
            pointerEvents={canInteract ? 'all' : 'none'}
            style={{
              cursor: canInteract ? 'pointer' : undefined,
              pointerEvents: canInteract ? 'all' : 'none',
            }}
            tabIndex={canInteract ? 0 : undefined}
            role={canInteract ? 'button' : undefined}
            aria-label={canInteract ? `${meta.label} · ${formatZonePrice(tipo)} · ${zoneStateText(tipo)}` : undefined}
            onClick={canInteract ? (event) => {
              event.stopPropagation();
              activate();
            } : undefined}
            onMouseEnter={canInteract ? () => onZoneHover?.(key) : undefined}
            onMouseLeave={canInteract ? () => onZoneHover?.(null) : undefined}
            onFocus={canInteract ? () => onZoneHover?.(key) : undefined}
            onBlur={canInteract ? () => onZoneHover?.(null) : undefined}
            onKeyDown={canInteract ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              activate();
            } : undefined}
          >
            <tspan x={meta.labelX} dy={showZoneDetails ? -9 : 0}>{showFull ? meta.label : meta.short}</tspan>
            {showZoneDetails && (
              <>
                {/* Fuera de venta: sin precio visible */}
                {status !== 'inactive' && (
                  <tspan x={meta.labelX} dy="17" className="stadium-zone-label-price">{formatZonePrice(tipo)}</tspan>
                )}
                <tspan x={meta.labelX} dy={status === 'inactive' ? 17 : 14} className={`stadium-zone-label-status${status === 'inactive' ? ' inactive' : ''}`}>{zoneStateText(tipo)}</tspan>
              </>
            )}
          </text>
        );
      })}

      <NorthMarker />
      <VenueTitle venue={venue} />

      {/* Rectángulo de selección en caja de butacas */}
      {marquee && (
        <rect
          x={marquee.x1}
          y={marquee.y1}
          width={marquee.x2 - marquee.x1}
          height={marquee.y2 - marquee.y1}
          fill="rgba(255,255,255,0.08)"
          stroke="#fff"
          strokeWidth="1.5"
          strokeDasharray="7 5"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
