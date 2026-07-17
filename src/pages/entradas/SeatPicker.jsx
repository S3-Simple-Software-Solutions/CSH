/**
 * SeatPicker — selector de butacas estilo estadio (bowl orientado por tribuna).
 *
 * A diferencia de una grilla de cine (filas planas mirando una pantalla), cada
 * tribuna se dibuja como un segmento del tazón del estadio: la cancha queda del
 * lado que corresponde a la grada, las filas se abren en abanico hacia atrás y
 * curvan cóncavas hacia la cancha, y las butacas apuntan su respaldo hacia
 * afuera (uno se sienta mirando la cancha).
 *
 * `orientation` define de qué lado está la cancha:
 *   field-bottom (Sol Norte) · field-top (Sol Sur) ·
 *   field-left (Lateral Este) · field-right (Lateral Oeste)
 *
 * Gestos preservados: click marca/desmarca, arrastre selecciona en caja
 * (Shift/Ctrl suma), zoom con botones / ctrl+rueda / pinch.
 *
 * Solo frontend: consume los mismos asientos {id, fila, numero, estado}
 * y los mismos handlers que el sistema anterior.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** Orden natural de filas: A..Z antes que AA (longitud primero, luego alfabético). */
function filaSort(a, b) {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

function hexToRgba(hex, alpha) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return `rgba(201,169,97,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const CELL = 30;        // spacing lateral base (fila del frente)
const ROWGAP = 30;      // profundidad entre filas
const FAN = 0.07;       // cuánto se ensancha cada fila hacia atrás
const CURVE = 20;       // profundidad extra en los extremos (curva cóncava)
const FRONT = 34;       // separación cancha → fila A
const BANDW = 24;       // grosor de la banda de cancha
const LABEL = 30;       // espacio para etiquetas de fila
const PAD = 16;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.4;

// Vectores unitarios por orientación: dd = hacia el fondo (aumenta la fila),
// ld = a lo largo de la fila. La cancha queda en -dd. rot = giro del respaldo.
const ORIENT = {
  'field-bottom': { dd: [0, -1], ld: [1, 0], rot: 0, vertical: false },
  'field-top': { dd: [0, 1], ld: [1, 0], rot: 180, vertical: false },
  'field-left': { dd: [1, 0], ld: [0, 1], rot: 90, vertical: true },
  'field-right': { dd: [-1, 0], ld: [0, 1], rot: -90, vertical: true },
};

/**
 * Construye el layout del bowl para una orientación. Devuelve las butacas ya
 * en coordenadas de pantalla, más la banda de cancha y las etiquetas de fila.
 */
function buildBowlLayout(asientos, orientation) {
  const O = ORIENT[orientation] || ORIENT['field-bottom'];
  const [ddx, ddy] = O.dd;
  const [ldx, ldy] = O.ld;

  const filaMap = new Map();
  for (const a of asientos) {
    if (!filaMap.has(a.fila)) filaMap.set(a.fila, []);
    filaMap.get(a.fila).push(a);
  }
  const filas = [...filaMap.keys()].sort(filaSort);

  // Escaleras (pasillos verticales): parten las butacas en bloques cuando el
  // sector es ancho, como los vomitorios de una tribuna real. Se ubican por
  // número de asiento (misma columna en todas las filas) para que suban rectas.
  const maxNum = Math.max(1, ...asientos.map((a) => a.numero));
  const AISLE_GAP_COLS = 1.15;   // ancho del pasillo en unidades de columna
  const BLOCK = 11;              // butacas objetivo por bloque
  const aisleAfter = [];
  if (maxNum >= BLOCK * 2 - 2) {
    const blocks = Math.max(2, Math.round(maxNum / BLOCK));
    for (let k = 1; k < blocks; k++) aisleAfter.push(Math.round((k * maxNum) / blocks));
  }
  const effCol = (num) => (num - 1) + AISLE_GAP_COLS * aisleAfter.filter((t) => t < num).length;

  // Ancho de referencia (fila más ancha, con abanico y pasillos) para la curva.
  let uRef = 1;
  filas.forEach((fila, fi) => {
    const spacing = CELL * (1 + fi * FAN);
    const effs = filaMap.get(fila).map((a) => effCol(a.numero));
    const center = (Math.min(...effs) + Math.max(...effs)) / 2;
    uRef = Math.max(uRef, Math.max(...effs.map((e) => Math.abs(e - center))) * spacing);
  });

  // Butacas en coords canónicas (u lateral, v profundidad desde la cancha).
  const raw = [];
  const rowEnds = [];
  filas.forEach((fila, fi) => {
    const cols = [...filaMap.get(fila)].sort((x, y) => x.numero - y.numero);
    const spacing = CELL * (1 + fi * FAN);
    const vbase = FRONT + fi * ROWGAP;
    const effs = cols.map((a) => effCol(a.numero));
    const center = (Math.min(...effs) + Math.max(...effs)) / 2;
    let uMin = Infinity;
    let uMax = -Infinity;
    cols.forEach((a) => {
      const u = (effCol(a.numero) - center) * spacing;
      const v = vbase + CURVE * (u / uRef) * (u / uRef);
      raw.push({ a, u, v });
      uMin = Math.min(uMin, u);
      uMax = Math.max(uMax, u);
    });
    rowEnds.push({ fila, vbase, uMin, uMax, spacing, center });
  });

  // Geometría canónica de cada escalera: centro y ancho por fila (fanea).
  const aislesCanon = aisleAfter.map((t) => {
    const aisleCenterEff = (effCol(t) + effCol(t + 1)) / 2;
    return rowEnds.map(({ vbase, spacing, center }) => ({
      vbase,
      uc: (aisleCenterEff - center) * spacing,
      uw: AISLE_GAP_COLS * spacing * 0.8,
    }));
  });

  // Proyección canónica → pantalla (ejes alineados, dd/ld son unitarios de eje).
  const proj = (u, v) => ({ x: ddx * v + ldx * u, y: ddy * v + ldy * u });
  const seats = raw.map(({ a, u, v }) => ({ a, ...proj(u, v) }));

  // Banda de cancha: en v=0, extendida hacia -dd un grosor BANDW.
  const allU = raw.map((r) => r.u);
  const Uband = Math.max(...allU.map(Math.abs)) + CELL * 0.5;
  const bandCorners = [
    proj(-Uband, 0), proj(Uband, 0),
    proj(-Uband, -BANDW), proj(Uband, -BANDW),
  ];

  // Etiquetas de fila: en ambos extremos, apenas más allá de la última butaca.
  const labels = [];
  for (const { fila, vbase, uMin, uMax } of rowEnds) {
    labels.push({ fila, ...proj(uMin - LABEL * 0.55, vbase) });
    labels.push({ fila, ...proj(uMax + LABEL * 0.55, vbase) });
  }

  // Gradas: un escalón (tarima) por fila detrás de las butacas. En abanico
  // (más ancho hacia atrás) y con el labio del escalón del lado de la cancha.
  const STEP_HALF = ROWGAP * 0.46;
  const steps = rowEnds.map(({ vbase, uMin, uMax }, fi) => {
    const uHalf = Math.max(Math.abs(uMin), Math.abs(uMax)) + CELL * 0.3;
    return {
      fi,
      a: proj(-uHalf, vbase - STEP_HALF),      // esquina frente-izq
      b: proj(uHalf, vbase + STEP_HALF),       // esquina fondo-der
      lipA: proj(-uHalf, vbase - STEP_HALF),   // labio (lado de la cancha)
      lipB: proj(uHalf, vbase - STEP_HALF),
    };
  });

  // Bounding box con margen de butaca + padding.
  const seatHalf = CELL * 0.5;
  const stepPts = steps.flatMap((s) => [s.a, s.b]);
  const xs = [...seats.map((s) => s.x), ...bandCorners.map((c) => c.x), ...labels.map((l) => l.x), ...stepPts.map((p) => p.x)];
  const ys = [...seats.map((s) => s.y), ...bandCorners.map((c) => c.y), ...labels.map((l) => l.y), ...stepPts.map((p) => p.y)];
  const minX = Math.min(...xs) - seatHalf;
  const minY = Math.min(...ys) - seatHalf;
  const maxX = Math.max(...xs) + seatHalf;
  const maxY = Math.max(...ys) + seatHalf;
  const offX = PAD - minX;
  const offY = PAD - minY;
  const width = maxX - minX + PAD * 2;
  const height = maxY - minY + PAD * 2;

  const shift = (p) => ({ x: p.x + offX, y: p.y + offY });
  const outSeats = seats.map((s) => ({ a: s.a, ...shift(s) }));
  const outLabels = labels.map((l) => ({ fila: l.fila, ...shift(l) }));
  const bc = bandCorners.map(shift);
  const bx = Math.min(...bc.map((c) => c.x));
  const by = Math.min(...bc.map((c) => c.y));
  const band = {
    x: bx,
    y: by,
    w: Math.max(...bc.map((c) => c.x)) - bx,
    h: Math.max(...bc.map((c) => c.y)) - by,
    vertical: O.vertical,
  };

  const nSteps = steps.length;
  const outSteps = steps.map((s) => {
    const a = shift(s.a);
    const b = shift(s.b);
    const la = shift(s.lipA);
    const lb = shift(s.lipB);
    return {
      fi: s.fi,
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
      lip: { x1: la.x, y1: la.y, x2: lb.x, y2: lb.y },
    };
  });

  // Escaleras: polígono del pasillo (fanea) + peldaños (uno por escalón).
  const outAisles = aislesCanon.map((perRow) => {
    const first = perRow[0];
    const last = perRow[perRow.length - 1];
    const corners = [
      proj(first.uc - first.uw / 2, first.vbase - STEP_HALF),
      proj(first.uc + first.uw / 2, first.vbase - STEP_HALF),
      proj(last.uc + last.uw / 2, last.vbase + STEP_HALF),
      proj(last.uc - last.uw / 2, last.vbase + STEP_HALF),
    ].map(shift);
    const treads = perRow.map(({ uc, uw, vbase }) => {
      const p1 = shift(proj(uc - uw / 2, vbase - STEP_HALF));
      const p2 = shift(proj(uc + uw / 2, vbase - STEP_HALF));
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    });
    return { points: corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), treads };
  });

  return { seats: outSeats, labels: outLabels, steps: outSteps, nSteps, aisles: outAisles, band, width, height, seatRot: O.rot };
}

function seatVisual(estado, selected, accent) {
  // Estados con colores de HUE distinto para máxima legibilidad de un vistazo:
  // seleccionada = verde vívido, vendida = rojo oscuro apagado, disponible =
  // tinte del color de zona (dorado/acento), en proceso = ámbar.
  if (selected) return { fill: '#22c55e', stroke: '#eafff0', strokeWidth: 1.8, num: '#052e14', cls: 'sp-seat--selected' };
  if (estado === 'vendido') return { fill: '#5b2b2b', stroke: '#3a1c1c', strokeWidth: 1, num: '#d99', cls: 'sp-seat--vendido' };
  if (estado === 'bloqueado') return { fill: 'url(#sp-hatch)', stroke: '#4a4a4a', strokeWidth: 1, num: '#888', cls: 'sp-seat--bloqueado' };
  if (estado === 'reservado') return { fill: 'rgba(245,158,11,.35)', stroke: '#f59e0b', strokeWidth: 1.3, num: '#ffd98a', cls: 'sp-seat--reservado' };
  return { fill: hexToRgba(accent, 0.24), stroke: hexToRgba(accent, 0.95), strokeWidth: 1.3, num: hexToRgba(accent, 0.98), cls: 'sp-seat--libre' };
}

const ZOOM_STEP = 1.25;
const TAP_MOVE = 8;          // px de tolerancia para distinguir tap de arrastre
const HIT_R = CELL * 0.78;   // radio de hit-test al tocar una butaca

/** Dibuja una butaca (respaldo + cojín + número/×). Sin eventos: la selección
 *  se resuelve por hit-test a nivel del lienzo, mucho más liviano que 900 handlers. */
function seatEls(a, x, y, selected, accentColor, seatRot, showNums) {
  const v = seatVisual(a.estado, selected, accentColor);
  const seatW = CELL * 0.72, seatH = CELL * 0.58, backH = CELL * 0.16;
  const unrot = seatRot ? `rotate(${-seatRot} ${x} ${y})` : undefined;
  return (
    <g key={a.id} className={`sp-seat sp-seat--${a.estado}${selected ? ' sp-seat--selected' : ''}`}
      transform={seatRot ? `rotate(${seatRot} ${x} ${y})` : undefined}
      filter={selected ? 'url(#sp-sel-shadow)' : undefined}>
      <rect x={x - seatW / 2} y={y - seatH / 2 - backH + 1.5} width={seatW} height={backH} rx={backH / 2}
        fill={v.fill === 'url(#sp-hatch)' ? '#3a3a3a' : v.fill} stroke={v.stroke} strokeWidth={v.strokeWidth * 0.8} opacity={0.9} />
      <rect x={x - seatW / 2} y={y - seatH / 2 + 2.5} width={seatW} height={seatH} rx={3.4}
        fill={v.fill} stroke={v.stroke} strokeWidth={v.strokeWidth} />
      {a.estado === 'vendido' && !selected && (
        <text x={x} y={y + 5.4} textAnchor="middle" className="sp-seat-x" transform={unrot}>×</text>
      )}
      {showNums && a.estado !== 'vendido' && (
        <text x={x} y={y + 5.2} textAnchor="middle" className="sp-seat-num" fill={v.num} transform={unrot}>{a.numero}</text>
      )}
    </g>
  );
}

/**
 * Lienzo SVG de butacas con zoom propio (fit-to-view), pan táctil de un dedo,
 * tap para seleccionar, pinch de dos dedos y —en desktop— arrastre-selección.
 * Render optimizado: capa base memoizada (no se redibuja al seleccionar) + capa
 * de seleccionados encima; sin handlers ni <title> por butaca.
 */
export function SeatCanvas({
  asientos,
  accentColor = '#c9a961',
  orientation = 'field-bottom',
  selectedIds = null,
  onSeatClick = null,
  onBoxSelect = null,          // arrastre-selección: solo mouse (desktop)
  clickableStates = ['disponible'],
  showField = true,
  fieldLabel = 'CANCHA',
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const scrollRef = useRef(null);
  const gRef = useRef(null);          // gesto en curso
  const hoverIdRef = useRef(null);
  const [zoom, setZoom] = useState(null);  // null hasta calcular el fit inicial
  const [marquee, setMarquee] = useState(null);
  const [hover, setHover] = useState(null);

  const empty = !asientos || asientos.length === 0;
  const layout = useMemo(() => buildBowlLayout(asientos || [], orientation), [asientos, orientation]);
  const { seats, labels, steps, nSteps, aisles, band, width, height, seatRot } = layout;

  const z = zoom ?? 1;
  const zRef = useRef(z);
  zRef.current = z;

  // Fit: el sector entra completo al abrir/cambiar de sector; luego se hace zoom.
  function fitZoom() {
    const el = scrollRef.current;
    if (!el || empty) return;
    const fit = Math.min(el.clientWidth / width, el.clientHeight / height);
    setZoom(Math.min(1.15, Math.max(MIN_ZOOM, fit)));
    requestAnimationFrame(() => { if (scrollRef.current) { scrollRef.current.scrollLeft = 0; scrollRef.current.scrollTop = 0; } });
  }
  useLayoutEffect(() => { fitZoom(); }, [width, height, empty]); // eslint-disable-line react-hooks/exhaustive-deps

  function svgCoords(clientX, clientY) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function localCoords(clientX, clientY) {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }
  function hitTest(clientX, clientY) {
    const p = svgCoords(clientX, clientY);
    let best = null, bestD = HIT_R * HIT_R;
    for (const s of seats) {
      const dx = s.x - p.x, dy = s.y - p.y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }
  function selectAt(clientX, clientY) {
    const s = hitTest(clientX, clientY);
    if (!s || !onSeatClick) return;
    if (selectedIds?.has(s.a.id) || clickableStates.includes(s.a.estado)) onSeatClick(s.a);
  }

  // Zoom anclado a un punto (cursor / centro del pinch / centro del viewport).
  function zoomAround(nz, clientX, clientY) {
    const s = scrollRef.current;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nz));
    if (!s) { setZoom(clamped); return; }
    const rect = s.getBoundingClientRect();
    const lx = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const ly = (clientY ?? rect.top + rect.height / 2) - rect.top;
    const oldZ = zRef.current;
    const cx = (s.scrollLeft + lx) / oldZ;
    const cy = (s.scrollTop + ly) / oldZ;
    setZoom(clamped);
    requestAnimationFrame(() => {
      const s2 = scrollRef.current;
      if (!s2) return;
      s2.scrollLeft = cx * clamped - lx;
      s2.scrollTop = cy * clamped - ly;
    });
  }

  // ctrl/⌘ + rueda = zoom al cursor; rueda normal = scroll nativo del contenedor.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomAround(zRef.current * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gestos con pointer capture (el svg recibe todos los eventos del puntero) ──
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { svgRef.current.setPointerCapture(e.pointerId); } catch { /* noop */ }
    const g = gRef.current || (gRef.current = { pts: new Map(), mode: 'none' });
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'touch') {
      if (g.pts.size === 2) {
        const [p1, p2] = [...g.pts.values()];
        g.mode = 'pinch';
        g.startDist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
        g.startZoom = zRef.current;
        g.center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        setMarquee(null);
      } else if (g.pts.size === 1) {
        g.mode = 'pending';
        g.start = { x: e.clientX, y: e.clientY };
        g.startScroll = { x: scrollRef.current.scrollLeft, y: scrollRef.current.scrollTop };
        g.t0 = Date.now();
      }
    } else {
      g.mode = 'mouse-down';
      g.start = { x: e.clientX, y: e.clientY };
    }
  }
  function onPointerMove(e) {
    const g = gRef.current;
    if (!g || g.mode === 'none') {
      if (e.pointerType === 'mouse') {
        const s = hitTest(e.clientX, e.clientY);
        const id = s?.a.id ?? null;
        if (id !== hoverIdRef.current) {
          hoverIdRef.current = id;
          setHover(s ? { a: s.a, ...localCoords(e.clientX, e.clientY) } : null);
        } else if (s) {
          const lc = localCoords(e.clientX, e.clientY);
          setHover((h) => (h ? { ...h, x: lc.x, y: lc.y } : h));
        }
      }
      return;
    }
    if (g.pts.has(e.pointerId)) g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.mode === 'pinch' && g.pts.size >= 2) {
      const [p1, p2] = [...g.pts.values()];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      zoomAround(g.startZoom * (dist / g.startDist), g.center.x, g.center.y);
      return;
    }
    if (g.mode === 'pending' || g.mode === 'pan') {
      const dx = e.clientX - g.start.x, dy = e.clientY - g.start.y;
      if (g.mode === 'pending' && Math.hypot(dx, dy) < TAP_MOVE) return;
      g.mode = 'pan';
      const s = scrollRef.current;
      if (s) { s.scrollLeft = g.startScroll.x - dx; s.scrollTop = g.startScroll.y - dy; }
      return;
    }
    if (g.mode === 'mouse-down' || g.mode === 'marquee') {
      const dx = e.clientX - g.start.x, dy = e.clientY - g.start.y;
      if (g.mode === 'mouse-down' && Math.hypot(dx, dy) < 6) return;
      if (!onBoxSelect) { g.mode = 'mouse-drag'; return; }
      g.mode = 'marquee';
      const a = svgCoords(g.start.x, g.start.y), b = svgCoords(e.clientX, e.clientY);
      setMarquee({ x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) });
    }
  }
  function onPointerUp(e) {
    const g = gRef.current;
    if (!g) return;
    g.pts.delete(e.pointerId);
    const mode = g.mode;
    if (mode === 'pinch') { g.mode = g.pts.size >= 1 ? 'locked' : 'none'; }
    else if (mode === 'pending') { if (Date.now() - g.t0 < 500) selectAt(e.clientX, e.clientY); g.mode = 'none'; }
    else if (mode === 'mouse-down') { selectAt(e.clientX, e.clientY); g.mode = 'none'; }
    else if (mode === 'marquee') {
      const a = svgCoords(g.start.x, g.start.y), b = svgCoords(e.clientX, e.clientY);
      const r = { x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) };
      const hits = seats.filter(({ x, y }) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2).map((s) => s.a);
      if (onBoxSelect) onBoxSelect(hits, e.shiftKey || e.ctrlKey);
      setMarquee(null);
      g.mode = 'none';
    }
    if (g.pts.size === 0) { gRef.current = null; setMarquee(null); }
  }

  const showNums = CELL * z >= 19;

  // "CANCHA" repetido a lo largo de la banda para que siempre quede a la vista.
  const fieldLabels = useMemo(() => {
    if (!showField) return [];
    const SPACING = 180;
    const len = band.vertical ? band.h : band.w;
    const count = Math.max(1, Math.round(len / SPACING));
    return Array.from({ length: count }, (_, i) => {
      const t = (i + 0.5) / count;
      return {
        cx: band.vertical ? band.x + band.w / 2 : band.x + t * band.w,
        cy: band.vertical ? band.y + t * band.h : band.y + band.h / 2,
      };
    });
  }, [band, showField]);

  // Capa estática (gradas, escaleras, cancha, filas y butacas base): memoizada,
  // NO se redibuja al seleccionar (solo cambia la capa de seleccionados encima).
  const staticLayer = useMemo(() => (
    <>
      <g className="sp-steps" pointerEvents="none">
        {steps.map((s) => {
          const t = nSteps > 1 ? s.fi / (nSteps - 1) : 0;
          const fill = 0.075 - 0.055 * t;
          return (
            <g key={`step-${s.fi}`}>
              <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="4" fill={`rgba(255,255,255,${fill.toFixed(3)})`} />
              <line x1={s.lip.x1} y1={s.lip.y1} x2={s.lip.x2} y2={s.lip.y2} stroke={hexToRgba(accentColor, 0.22)} strokeWidth="1" />
            </g>
          );
        })}
      </g>
      <g className="sp-aisles" pointerEvents="none">
        {aisles.map((al, i) => (
          <g key={`aisle-${i}`}>
            <polygon points={al.points} fill="rgba(255,255,255,0.05)" />
            {al.treads.map((t, j) => (
              <line key={j} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="rgba(255,255,255,0.26)" strokeWidth="1.3" strokeLinecap="round" />
            ))}
          </g>
        ))}
      </g>
      {showField && (
        <g pointerEvents="none">
          <rect x={band.x} y={band.y} width={band.w} height={band.h} rx="6" fill="url(#sp-field-band)" stroke={hexToRgba(accentColor, 0.4)} strokeWidth="1" />
          {fieldLabels.map((f, i) => (
            <text key={i} x={f.cx} y={f.cy} textAnchor="middle" dominantBaseline="central" className="sp-field-label"
              transform={band.vertical ? `rotate(-90 ${f.cx} ${f.cy})` : undefined}>{fieldLabel}</text>
          ))}
        </g>
      )}
      <g pointerEvents="none">
        {labels.map((l, i) => (
          <text key={`${l.fila}-${i}`} x={l.x} y={l.y + 3.4} textAnchor="middle" className="sp-row-label">{l.fila}</text>
        ))}
      </g>
      <g className="sp-seats" pointerEvents="none">
        {seats.map((s) => seatEls(s.a, s.x, s.y, false, accentColor, seatRot, showNums))}
      </g>
    </>
  ), [steps, aisles, labels, seats, band, nSteps, seatRot, accentColor, showNums, showField, fieldLabel, fieldLabels]);

  if (empty) return null;

  return (
    <div className="sp-canvas-wrap" ref={wrapRef}>
      <div className="sp-zoom-overlay" role="group" aria-label="Zoom">
        <button type="button" onClick={() => zoomAround(zRef.current / ZOOM_STEP)} aria-label="Alejar">−</button>
        <button type="button" onClick={fitZoom} aria-label="Ajustar a la vista" title="Ajustar">⤢</button>
        <button type="button" onClick={() => zoomAround(zRef.current * ZOOM_STEP)} aria-label="Acercar">+</button>
      </div>
      <div className="sp-canvas-scroll" ref={scrollRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: width * z, height: height * z, display: 'block', margin: '0 auto' }}
          className="sp-canvas"
          role="img"
          aria-label="Mapa de butacas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse' && (!gRef.current || gRef.current.mode === 'none')) { hoverIdRef.current = null; setHover(null); } }}
        >
          <defs>
            <pattern id="sp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#2e2e2e" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#4a4a4a" strokeWidth="2.2" />
            </pattern>
            <linearGradient id="sp-field-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(68,158,88,.6)" />
              <stop offset="100%" stopColor="rgba(42,110,58,.18)" />
            </linearGradient>
            <filter id="sp-sel-shadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1.4" stdDeviation="2.2" floodColor="#c9a961" floodOpacity="0.55" />
            </filter>
          </defs>

          {/* Fondo captor de eventos: el resto del SVG es pointer-events:none,
              así que este rect recibe los gestos (pan/tap/pinch/marquee). */}
          <rect x={0} y={0} width={width} height={height} fill="none" pointerEvents="all" />

          {staticLayer}

          {/* Capa de seleccionados (encima): lo unico que se redibuja al elegir */}
          <g className="sp-selected" pointerEvents="none">
            {seats.filter((s) => selectedIds?.has(s.a.id)).map((s) => seatEls(s.a, s.x, s.y, true, accentColor, seatRot, showNums))}
          </g>

          {marquee && (
            <rect
              x={marquee.x1} y={marquee.y1}
              width={marquee.x2 - marquee.x1} height={marquee.y2 - marquee.y1}
              className="sp-marquee" pointerEvents="none"
            />
          )}
        </svg>
      </div>

      {hover && (
        <div className="sp-tooltip" style={{ left: hover.x + 14, top: hover.y - 10 }} role="status">
          <b>Fila {hover.a.fila} · Asiento {hover.a.numero}</b>
          <span className={`sp-tooltip-estado sp-tooltip-estado--${hover.a.estado}`}>
            {hover.a.estado === 'disponible' ? 'Disponible' : hover.a.estado === 'vendido' ? 'Vendida' : hover.a.estado === 'reservado' ? 'Reservada' : 'Bloqueada'}
          </span>
        </div>
      )}
    </div>
  );
}

/** Mejores N contiguas: fila más cercana a la cancha, centradas. */
export function pickBestSeats(asientos, n, excludeIds = null) {
  const filaMap = new Map();
  for (const a of asientos) {
    if (a.estado !== 'disponible' || excludeIds?.has(a.id)) continue;
    if (!filaMap.has(a.fila)) filaMap.set(a.fila, []);
    filaMap.get(a.fila).push(a);
  }
  const filas = [...filaMap.keys()].sort(filaSort);
  for (const fila of filas) {
    const libres = filaMap.get(fila).sort((x, y) => x.numero - y.numero);
    const maxNum = Math.max(...libres.map((a) => a.numero));
    let best = null;
    for (let i = 0; i <= libres.length - n; i++) {
      const run = libres.slice(i, i + n);
      const ok = run.every((a, k) => k === 0 || a.numero === run[k - 1].numero + 1);
      if (!ok) continue;
      const center = (run[0].numero + run[n - 1].numero) / 2;
      const dist = Math.abs(center - (maxNum + 1) / 2);
      if (!best || dist < best.dist) best = { run, dist };
    }
    if (best) return best.run;
  }
  const all = filas.flatMap((f) => filaMap.get(f).sort((x, y) => x.numero - y.numero));
  return all.slice(0, n);
}


/** Panel público del selector: encabezado, zoom, lienzo, leyenda, auto y bandeja. */
export function SeatPickerPanel({
  tipo,
  asientos,
  selectedIds,
  onSeatToggle,
  onBoxSelect = null,
  orientation = 'field-bottom',
  maxSeats = 10,
  accentColor = null,
  fieldLabel = 'CANCHA',
  compact = false,
}) {
  const [autoN, setAutoN] = useState(2);
  const selSet = useMemo(
    () => (selectedIds instanceof Set ? selectedIds : new Set(selectedIds || [])),
    [selectedIds],
  );
  const propios = useMemo(() => asientos.filter((a) => selSet.has(a.id)), [asientos, selSet]);
  const precio = tipo ? (tipo.precioVigente ?? tipo.precioCrc ?? 0) : 0;
  const accent = accentColor ?? tipo?.mapa?.color ?? '#c9a961';
  const libres = asientos.filter((a) => a.estado === 'disponible').length;
  const pctLibre = asientos.length > 0 ? Math.round((libres / asientos.length) * 100) : 0;

  function autoPick() {
    const room = maxSeats - propios.length;
    const n = Math.min(autoN, room);
    if (n <= 0) return;
    const picks = pickBestSeats(asientos, n, selSet);
    if (picks.length === 0) return;
    if (onBoxSelect) onBoxSelect(picks, true);
    else picks.forEach((a) => onSeatToggle(a));
  }
  function vaciar() { propios.forEach((a) => onSeatToggle(a)); }

  return (
    <div className={`seatpicker${compact ? ' seatpicker--compact' : ''}`}>
      <div className="seatpicker-head">
        <div className="seatpicker-title">
          {tipo && (
            <span className="seatpicker-zone">
              <i className="seatpicker-zone-dot" style={{ background: accent }} />
              <b>{tipo.nombre}</b>
            </span>
          )}
          <span className="seatpicker-price" style={{ borderColor: hexToRgba(accent, 0.5) }}>
            ₡{Number(precio).toLocaleString('es-CR')} <small>/ butaca</small>
          </span>
          <span className="seatpicker-occupancy" title={`${libres.toLocaleString('es-CR')} de ${asientos.length.toLocaleString('es-CR')} libres`}>
            <i><b style={{ width: `${pctLibre}%`, background: accent }} /></i>
            {pctLibre}% libre
          </span>
        </div>
      </div>

      <SeatCanvas
        asientos={asientos}
        accentColor={accent}
        orientation={orientation}
        selectedIds={selSet}
        onSeatClick={onSeatToggle}
        onBoxSelect={onBoxSelect}
        fieldLabel={fieldLabel}
      />

      <div className="seatpicker-foot">
        <div className="seatpicker-legend" aria-hidden="true">
          <span><i className="sp-lg" style={{ borderColor: accent, background: hexToRgba(accent, 0.24) }} /> Disponible</span>
          <span><i className="sp-lg sp-lg--sel" /> Tu selección</span>
          <span><i className="sp-lg sp-lg--reservada" /> En proceso</span>
          <span><i className="sp-lg sp-lg--vendida" /> Vendida</span>
          <span><i className="sp-lg sp-lg--bloq" /> No disponible</span>
        </div>
        <div className="seatpicker-auto">
          <label htmlFor={`sp-auto-${tipo?.id ?? 'x'}`}>Auto-elegir</label>
          <select id={`sp-auto-${tipo?.id ?? 'x'}`} value={autoN} onChange={(e) => setAutoN(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button type="button" className="btn ghost" onClick={autoPick} disabled={propios.length >= maxSeats || libres === 0}>
            Mejores juntas
          </button>
        </div>
      </div>

      {propios.length > 0 && (
        <div className="seatpicker-tray">
          <div className="seatpicker-tray-chips">
            {propios
              .slice()
              .sort((x, y) => filaSort(x.fila, y.fila) || x.numero - y.numero)
              .map((a) => (
                <button key={a.id} type="button" className="seatpicker-chip" onClick={() => onSeatToggle(a)} title={`Quitar fila ${a.fila} asiento ${a.numero}`}>
                  {a.fila}-{a.numero} <span aria-hidden="true">×</span>
                </button>
              ))}
          </div>
          <div className="seatpicker-tray-total">
            <button type="button" className="seatpicker-tray-clear" onClick={vaciar}>Vaciar</button>
            <span>{propios.length} de {maxSeats} máx.</span>
            <b>₡{(propios.length * precio).toLocaleString('es-CR')}</b>
          </div>
        </div>
      )}
    </div>
  );
}

/** Panel admin: estadísticas por estado + lienzo con selección en bloque. */
export function SeatAdminPanel({
  titulo = null,
  asientos,
  selectedIds,
  onSeatToggle,
  onBoxSelect,
  orientation = 'field-bottom',
  accentColor = '#c9a961',
  hint = 'Tocá o arrastrá para seleccionar butacas · Shift suma a la selección',
}) {
  const selSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const stats = useMemo(
    () => asientos.reduce((s, a) => ({ ...s, [a.estado]: (s[a.estado] || 0) + 1 }), {}),
    [asientos],
  );
  return (
    <div className="seatpicker seatpicker--admin">
      <div className="seatpicker-head">
        <div className="seatpicker-title">
          {titulo && (
            <span className="seatpicker-zone">
              <i className="seatpicker-zone-dot" style={{ background: accentColor }} />
              <b>{titulo}</b>
            </span>
          )}
          <span className="sp-stat sp-stat--libre">{stats.disponible || 0} disp.</span>
          <span className="sp-stat sp-stat--vendida">{stats.vendido || 0} vend.</span>
          <span className="sp-stat sp-stat--bloq">{stats.bloqueado || 0} bloq.</span>
          {(stats.reservado || 0) > 0 && <span className="sp-stat sp-stat--reservada">{stats.reservado} reserv.</span>}
        </div>
      </div>
      <SeatCanvas
        asientos={asientos}
        accentColor={accentColor}
        orientation={orientation}
        selectedIds={selSet}
        onSeatClick={onSeatToggle}
        onBoxSelect={onBoxSelect}
        clickableStates={['disponible', 'bloqueado', 'reservado']}
      />
      <p className="seatpicker-hint">{hint}</p>
    </div>
  );
}
