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
import { useEffect, useMemo, useRef, useState } from 'react';

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

  // Ancho de referencia (fila más ancha, ya con abanico) para normalizar la curva.
  let uRef = 1;
  filas.forEach((fila, fi) => {
    const n = filaMap.get(fila).length;
    const spacing = CELL * (1 + fi * FAN);
    uRef = Math.max(uRef, ((n - 1) / 2) * spacing);
  });

  // Butacas en coords canónicas (u lateral, v profundidad desde la cancha).
  const raw = [];
  const rowEnds = [];
  filas.forEach((fila, fi) => {
    const cols = [...filaMap.get(fila)].sort((x, y) => x.numero - y.numero);
    const n = cols.length;
    const spacing = CELL * (1 + fi * FAN);
    const vbase = FRONT + fi * ROWGAP;
    let uMin = Infinity;
    let uMax = -Infinity;
    cols.forEach((a, j) => {
      const u = (j - (n - 1) / 2) * spacing;
      const v = vbase + CURVE * (u / uRef) * (u / uRef);
      raw.push({ a, u, v });
      uMin = Math.min(uMin, u);
      uMax = Math.max(uMax, u);
    });
    rowEnds.push({ fila, vbase, uMin, uMax });
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

  // Bounding box con margen de butaca + padding.
  const seatHalf = CELL * 0.5;
  const xs = [...seats.map((s) => s.x), ...bandCorners.map((c) => c.x), ...labels.map((l) => l.x)];
  const ys = [...seats.map((s) => s.y), ...bandCorners.map((c) => c.y), ...labels.map((l) => l.y)];
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

  return { seats: outSeats, labels: outLabels, band, width, height, seatRot: O.rot };
}

function seatVisual(estado, selected, accent) {
  if (selected) return { fill: '#c9a961', stroke: '#fff', strokeWidth: 1.6, num: '#181205', cls: 'sp-seat--selected' };
  if (estado === 'vendido') return { fill: '#3c3230', stroke: '#2a2422', strokeWidth: 1, num: '#8a7570', cls: 'sp-seat--vendido' };
  if (estado === 'bloqueado') return { fill: 'url(#sp-hatch)', stroke: '#4a4a4a', strokeWidth: 1, num: '#888', cls: 'sp-seat--bloqueado' };
  if (estado === 'reservado') return { fill: 'rgba(212,168,75,.28)', stroke: '#d4a84b', strokeWidth: 1.2, num: '#e8c987', cls: 'sp-seat--reservado' };
  return { fill: hexToRgba(accent, 0.16), stroke: hexToRgba(accent, 0.85), strokeWidth: 1.2, num: hexToRgba(accent, 0.95), cls: 'sp-seat--libre' };
}

/**
 * Lienzo SVG de butacas: render + gestos (click, marquee, ctrl+rueda, pinch).
 * `clickableStates` define qué estados admiten click además de las seleccionadas.
 */
export function SeatCanvas({
  asientos,
  accentColor = '#c9a961',
  orientation = 'field-bottom',
  selectedIds = null,
  onSeatClick = null,
  onBoxSelect = null,
  clickableStates = ['disponible'],
  zoom = 1,
  onZoomChange = null,
  showField = true,
  fieldLabel = 'CANCHA',
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const pinchRef = useRef(null);
  const [marquee, setMarquee] = useState(null);
  const [hover, setHover] = useState(null);

  const layout = useMemo(() => buildBowlLayout(asientos || [], orientation), [asientos, orientation]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !onZoomChange) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      onZoomChange((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onZoomChange]);

  if (!asientos || asientos.length === 0) return null;
  const { seats, labels, band, width, height, seatRot } = layout;

  function svgCoords(clientX, clientY) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }
  function localCoords(clientX, clientY) {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function handlePointerDown(e) {
    if (e.pointerType === 'touch') {
      const p = pinchRef.current;
      if (p && p.pointers.size === 1 && onZoomChange) {
        p.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const pts = [...p.pointers.values()];
        p.startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        p.startZoom = zoom;
        p.pinching = true;
        setMarquee(null);
        return;
      }
      pinchRef.current = { pointers: new Map([[e.pointerId, { x: e.clientX, y: e.clientY }]]), pinching: false };
    }
    startMarquee(e);
  }
  function handlePointerMove(e) {
    const p = pinchRef.current;
    if (p?.pinching && p.pointers.has(e.pointerId)) {
      p.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...p.pointers.values()];
      if (pts.length === 2 && p.startDist > 0) {
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        onZoomChange?.(() => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, p.startZoom * (dist / p.startDist))));
      }
    }
  }
  function handlePointerUp(e) {
    const p = pinchRef.current;
    if (p) {
      p.pointers.delete(e.pointerId);
      if (p.pointers.size === 0) pinchRef.current = null;
    }
  }

  function startMarquee(e) {
    if (!onBoxSelect || e.button !== 0) return;
    if (pinchRef.current?.pinching) return;
    const start = svgCoords(e.clientX, e.clientY);
    const startClient = { x: e.clientX, y: e.clientY };
    let moved = false;
    const rectFrom = (cur) => ({
      x1: Math.min(start.x, cur.x), y1: Math.min(start.y, cur.y),
      x2: Math.max(start.x, cur.x), y2: Math.max(start.y, cur.y),
    });
    const onMove = (ev) => {
      if (pinchRef.current?.pinching) { setMarquee(null); return; }
      if (!moved && Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) < 6) return;
      moved = true;
      setMarquee(rectFrom(svgCoords(ev.clientX, ev.clientY)));
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setMarquee(null);
      if (!moved || pinchRef.current?.pinching) return;
      const rect = rectFrom(svgCoords(ev.clientX, ev.clientY));
      const hits = seats
        .filter(({ x, y }) => x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2)
        .map(({ a }) => a);
      onBoxSelect(hits, ev.shiftKey || ev.ctrlKey);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const seatW = CELL * 0.72;
  const seatH = CELL * 0.58;
  const backH = CELL * 0.16;
  const showNums = CELL * zoom >= 19;

  return (
    <div className="sp-canvas-wrap" ref={wrapRef}>
      <div className="sp-canvas-scroll">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: width * zoom, height: height * zoom, display: 'block', margin: '0 auto' }}
          className="sp-canvas"
          role="img"
          aria-label="Mapa de butacas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
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

          {/* Banda de cancha del lado que corresponde a la tribuna */}
          {showField && (
            <g pointerEvents="none">
              <rect x={band.x} y={band.y} width={band.w} height={band.h} rx="6" fill="url(#sp-field-band)" stroke={hexToRgba(accentColor, 0.4)} strokeWidth="1" />
              <text
                x={band.x + band.w / 2}
                y={band.y + band.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="sp-field-label"
                transform={band.vertical ? `rotate(-90 ${band.x + band.w / 2} ${band.y + band.h / 2})` : undefined}
              >
                {fieldLabel}
              </text>
            </g>
          )}

          {/* Etiquetas de fila */}
          {labels.map((l, i) => (
            <text key={`${l.fila}-${i}`} x={l.x} y={l.y + 3.4} textAnchor="middle" className="sp-row-label" pointerEvents="none">
              {l.fila}
            </text>
          ))}

          {/* Butacas */}
          {seats.map(({ a, x, y }) => {
            const selected = selectedIds?.has(a.id);
            const clickable = !!onSeatClick && (selected || clickableStates.includes(a.estado));
            const v = seatVisual(a.estado, selected, accentColor);
            return (
              <g
                key={a.id}
                className={`sp-seat ${v.cls}${clickable ? ' sp-seat--clickable' : ''}`}
                transform={seatRot ? `rotate(${seatRot} ${x} ${y})` : undefined}
                filter={selected ? 'url(#sp-sel-shadow)' : undefined}
                onClick={clickable ? (e) => { e.stopPropagation(); onSeatClick(a); } : undefined}
                onMouseEnter={(e) => setHover({ a, ...localCoords(e.clientX, e.clientY) })}
                onMouseMove={(e) => setHover({ a, ...localCoords(e.clientX, e.clientY) })}
                onMouseLeave={() => setHover(null)}
              >
                <rect
                  x={x - seatW / 2} y={y - seatH / 2 - backH + 1.5}
                  width={seatW} height={backH} rx={backH / 2}
                  fill={v.fill === 'url(#sp-hatch)' ? '#3a3a3a' : v.fill}
                  stroke={v.stroke} strokeWidth={v.strokeWidth * 0.8} opacity={0.9}
                />
                <rect
                  x={x - seatW / 2} y={y - seatH / 2 + 2.5}
                  width={seatW} height={seatH} rx={3.4}
                  fill={v.fill} stroke={v.stroke} strokeWidth={v.strokeWidth}
                />
                {a.estado === 'vendido' && !selected && (
                  <text x={x} y={y + 5.4} textAnchor="middle" className="sp-seat-x" pointerEvents="none"
                    transform={seatRot ? `rotate(${-seatRot} ${x} ${y})` : undefined}>×</text>
                )}
                {showNums && a.estado !== 'vendido' && (
                  <text x={x} y={y + 5.2} textAnchor="middle" pointerEvents="none" className="sp-seat-num" fill={v.num}
                    transform={seatRot ? `rotate(${-seatRot} ${x} ${y})` : undefined}>{a.numero}</text>
                )}
                <title>{`Fila ${a.fila} · Asiento ${a.numero} · ${a.estado}`}</title>
              </g>
            );
          })}

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

const ZOOM_STEP = 1.25;

function ZoomControls({ zoom, setZoom }) {
  return (
    <div className="seatpicker-zoom" role="group" aria-label="Zoom">
      <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP))} aria-label="Alejar">−</button>
      <span>{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP))} aria-label="Acercar">+</button>
      <button type="button" className="seatpicker-zoom-reset" onClick={() => setZoom(1)} aria-label="Restablecer zoom" title="Restablecer">⤢</button>
    </div>
  );
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
  const [zoom, setZoom] = useState(1);
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
        <ZoomControls zoom={zoom} setZoom={setZoom} />
      </div>

      <SeatCanvas
        asientos={asientos}
        accentColor={accent}
        orientation={orientation}
        selectedIds={selSet}
        onSeatClick={onSeatToggle}
        onBoxSelect={onBoxSelect}
        zoom={zoom}
        onZoomChange={setZoom}
        fieldLabel={fieldLabel}
      />

      <div className="seatpicker-foot">
        <div className="seatpicker-legend" aria-hidden="true">
          <span><i className="sp-lg" style={{ borderColor: accent, background: hexToRgba(accent, 0.16) }} /> Disponible</span>
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
  const [zoom, setZoom] = useState(1);
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
        <ZoomControls zoom={zoom} setZoom={setZoom} />
      </div>
      <SeatCanvas
        asientos={asientos}
        accentColor={accentColor}
        orientation={orientation}
        selectedIds={selSet}
        onSeatClick={onSeatToggle}
        onBoxSelect={onBoxSelect}
        clickableStates={['disponible', 'bloqueado', 'reservado']}
        zoom={zoom}
        onZoomChange={setZoom}
      />
      <p className="seatpicker-hint">{hint}</p>
    </div>
  );
}
