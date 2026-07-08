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
  const LINE = 'rgba(255,255,255,0.72)';
  const W = 2.2;
  // Proporciones reglamentarias (relativas al largo/alto del campo).
  const PA_D = 100, PA_H = 184;   // área penal (grande)
  const GA_D = 34, GA_H = 84;     // área de meta (chica)
  const SPOT = 66;                // penal a ~11 m de la línea de meta
  const R = 56;                   // radio del círculo central y arcos penales
  const ARC_DY = 45;              // semicuerda del arco penal en el frente del área
  const paTop = CY - PA_H / 2, paBot = CY + PA_H / 2;
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
            fill={i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
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
      <g fill="rgba(255,255,255,0.82)">
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
  'sol-sur':       { from: 516, to: 670, axis: 'h', fieldAt: 'from', defaultSteps: 9 },
  'lateral-este':  { from: 816, to: 920, axis: 'v', fieldAt: 'from', defaultSteps: 8 },
  'lateral-oeste': { from: 80,  to: 184, axis: 'v', fieldAt: 'to',   defaultSteps: 8 },
};

/**
 * Dibuja la tribuna como gradas escalonadas: bandas que se oscurecen hacia
 * afuera + canto iluminado por escalón + pasillos perpendiculares, todo
 * recortado a la silueta de la zona. Si la tribuna tiene butacas numeradas,
 * cada fila cae centrada sobre su propio escalón.
 */
function ZoneGradas({ zoneKey, status, filas = 0 }) {
  const cfg = ZONE_GRADA_RANGE[zoneKey];
  const paths = ERC_ZONE_PATHS_V2[zoneKey];
  if (!cfg || !paths?.length || status === 'inactive') return null;

  const bounds = ZONE_SEAT_BOUNDS[zoneKey];
  let { from, to } = cfg;
  let n = cfg.defaultSteps;
  if (filas > 0 && bounds) {
    // Alinea los escalones con las filas de butacas (media grada extra por lado).
    const b1 = cfg.axis === 'h' ? bounds.y1 : bounds.x1;
    const b2 = cfg.axis === 'h' ? bounds.y2 : bounds.x2;
    const paso = (b2 - b1) / filas;
    from = b1 - paso / 2;
    to = b2 + paso / 2;
    n = filas + 1;
  }
  const step = (to - from) / n;
  const span = to - from;
  const horiz = cfg.axis === 'h';
  const clipId = `erc-gradas-${zoneKey}`;

  const bands = Array.from({ length: n }, (_, i) => {
    const p0 = from + i * step;
    const centro = p0 + step / 2;
    const tOut = cfg.fieldAt === 'from' ? (centro - from) / span : (to - centro) / span;
    return { p0, opacity: 0.05 + 0.3 * tOut };
  });

  // Pasillos que separan bloques de butacas (perpendiculares a las filas).
  const zx1 = bounds ? bounds.x1 : 0;
  const zx2 = bounds ? bounds.x2 : 0;
  const zy1 = bounds ? bounds.y1 : 0;
  const zy2 = bounds ? bounds.y2 : 0;
  const aisles = bounds
    ? [0.25, 0.5, 0.75].map((f) => (horiz ? zx1 + f * (zx2 - zx1) : zy1 + f * (zy2 - zy1)))
    : [];

  return (
    <g pointerEvents="none">
      <clipPath id={clipId}>
        {paths.map((d, i) => <path key={i} d={d} />)}
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {bands.map(({ p0, opacity }) => (
          <rect
            key={p0}
            x={horiz ? 40 : p0}
            y={horiz ? p0 : 40}
            width={horiz ? 920 : step}
            height={horiz ? step : 640}
            fill={`rgba(0,0,0,${opacity.toFixed(3)})`}
          />
        ))}
        {bands.slice(1).map(({ p0 }) => (
          horiz
            ? <line key={`l-${p0}`} x1="40" y1={p0} x2="960" y2={p0} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
            : <line key={`l-${p0}`} x1={p0} y1="40" x2={p0} y2="680" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
        ))}
        {aisles.map((p) => (
          horiz
            ? <rect key={`a-${p}`} x={p - 5} y={from} width="10" height={span} fill="rgba(0,0,0,0.32)" />
            : <rect key={`a-${p}`} x={from} y={p - 5} width={span} height="10" fill="rgba(0,0,0,0.32)" />
        ))}
      </g>
    </g>
  );
}

function NorthMarker() {
  return (
    <g className="stadium-north" pointerEvents="none" transform="translate(500, 46)">
      <circle r="14" fill="rgba(201,169,97,0.15)" stroke="rgba(201,169,97,0.45)" strokeWidth="1" />
      <path d="M 0 -7 L 0 5 M 0 -7 L -4 0 M 0 -7 L 4 0" stroke="#c9a961" strokeWidth="1.5" fill="none" />
      <text y="-1" textAnchor="middle" className="stadium-north-label">N</text>
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
                <tspan x={pos.x} dy="15" className="stadium-zone-label-price">{formatZonePrice(t)}</tspan>
                <tspan x={pos.x} dy="13" className={`stadium-zone-label-status${status === 'inactive' ? ' inactive' : ''}`}>{zoneStateText(t)}</tspan>
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
  const dotR = Math.max(1.5, Math.min(spacing * 0.38, 5));

  const dots = [];
  filas.forEach((fila, fi) => {
    const cols = filaMap.get(fila).sort((a, b) => a.numero - b.numero);
    const nCols = cols.length;
    cols.forEach((a, ci) => {
      const cx = axis === 'h'
        ? x1 + (ci + 0.5) / nCols * w
        : x1 + (fi + 0.5) / nFilas * w;
      const cy = axis === 'h'
        ? y1 + (fi + 0.5) / nFilas * h
        : y1 + (ci + 0.5) / nCols * h;
      dots.push({ a, cx, cy });
    });
  });
  return { dots, dotR };
}

function seatDotColor(estado) {
  if (estado === 'vendido') return '#e05555';
  if (estado === 'bloqueado') return '#888';
  if (estado === 'reservado') return '#d4a84b';
  return '#6de06d';
}

function ZoneSeatDots({ zoneKey, asientos, selectedSeatIds = null, onSeatClick = null }) {
  const layout = seatDotLayout(zoneKey, asientos);
  if (!layout) return null;
  const { dots, dotR } = layout;

  return (
    <g pointerEvents="none" opacity={0.82}>
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
    if (status === 'selected') return '#fff';
    const meta = ERC_ZONE_META[key] ?? GRAMILLA_ZONE_META[key];
    if (status === 'hover') return meta?.color ?? '#f0d078';
    return 'rgba(255,255,255,0.32)';
  }

  function zoneFilter(status) {
    if (status === 'selected') return 'url(#erc-glow)';
    if (status === 'hover') return 'url(#erc-glow-soft)';
    return undefined;
  }

  // isGramilla: gramilla usa fillOpacity mayor (más visible sobre el campo verde)
  function zoneFillProps(key, status, isGramilla = false) {
    if (status === 'inactive') return { fill: '#2a2a2a', fillOpacity: zoneOpacity(status) };
    if (status === 'agotado') return { fill: '#4a4a4a', fillOpacity: zoneOpacity(status) };
    const base = zoneOpacity(status);
    return { fill: `url(#${zoneGradientId(key)})`, fillOpacity: isGramilla ? Math.min(1, base + 0.2) : base };
  }

  const venueLabel = (venue || '').trim();
  const ariaLabel = venueLabel
    ? `Mapa del ${venueLabel}`
    : 'Mapa del estadio';

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
          <stop offset="0%" stopColor="#161616" />
          <stop offset="55%" stopColor="#0c0c0c" />
          <stop offset="100%" stopColor="#080808" />
        </linearGradient>
        <radialGradient id="erc-ambient" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="rgba(201,169,97,0.12)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <linearGradient id="erc-field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#449e58" />
          <stop offset="100%" stopColor="#2a6e3a" />
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
              <stop offset="100%" stopColor={isGramilla ? '#1a3020' : '#1a1408'} stopOpacity="0.85" />
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
      </defs>

      <rect width="1000" height="720" fill="url(#erc-bg)" rx="14" />
      <rect width="1000" height="720" fill="url(#erc-ambient)" rx="14" pointerEvents="none" />

      {/* Bowl exterior + borde iluminado */}
      <path d={BOWL_OUTER} fill="#141414" stroke="rgba(201,169,97,0.2)" strokeWidth="2" pointerEvents="none" />
      <path d={BOWL_INNER_RIM} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" pointerEvents="none" />

      {/* Pista atlética */}
      <path d={TRACK_PATH} fill="#252525" fillOpacity="0.7" pointerEvents="none" />
      <path d={TRACK_PATH} fill="none" stroke="#5a5a5a" strokeWidth="3" pointerEvents="none" />
      <path d={TRACK_PATH} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" transform="scale(0.98) translate(10 14)" pointerEvents="none" />

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
              filas={new Set((seatsByZoneKey[key] ?? []).map((a) => a.fila)).size}
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

      {/* Campo: opaco normal; semitransparente en espectáculo para ver zonas gramilla */}
      <path
        d={FIELD_PATH}
        fill="url(#erc-field)"
        fillOpacity={fieldTemplate ? 0.55 : 1}
        pointerEvents="none"
      />
      {!fieldTemplate && <FieldMarkings />}

      {/* Zonas de gramilla (espectáculo) — encima del campo */}
      {fieldTemplate && (
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
      )}

      {/* Zonas especiales (DJ, patrocinador, etc.) — rectángulos sobre la cancha */}
      {specialZones.map((z) => {
        if (!z || !z.rect) return null;
        const inactive = z.estado === 'inactivo';
        const selected = selectedKey === z.key;
        const hovered = hoveredKey === z.key;
        const x = z.rect.x * 1000;
        const y = z.rect.y * 720;
        const w = z.rect.w * 1000;
        const h = z.rect.h * 720;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const color = z.color || '#f59e0b';
        const canInteract = interactive;
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
            style={{ cursor: canInteract ? 'pointer' : 'default' }}
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
              stroke={selected ? '#ffffff' : 'rgba(255,255,255,0.55)'}
              strokeWidth={selected ? 3 : 1.5}
              strokeDasharray="7 4"
              filter={selected ? 'url(#erc-glow)' : undefined}
              style={{ transition: 'fill-opacity .2s ease, stroke .2s ease' }}
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
                    <tspan x={cx} dy="15" className="stadium-zone-label-price">{formatZonePrice(z.tipo)}</tspan>
                    <tspan x={cx} dy="13" className={`stadium-zone-label-status${inactive ? ' inactive' : ''}`}>
                      {zoneStateText(z.tipo)}
                    </tspan>
                  </>
                )}
              </text>
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
                <tspan x={meta.labelX} dy="17" className="stadium-zone-label-price">{formatZonePrice(tipo)}</tspan>
                <tspan x={meta.labelX} dy="14" className={`stadium-zone-label-status${status === 'inactive' ? ' inactive' : ''}`}>{zoneStateText(tipo)}</tspan>
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
