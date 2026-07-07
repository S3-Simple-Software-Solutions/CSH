/**
 * SeatPicker — selector de butacas estilo ticketera profesional.
 *
 * Reemplaza la grilla plana de círculos por butacas con forma de asiento,
 * filas curvadas hacia la cancha, zoom (botones / ctrl+rueda / pinch),
 * tooltip flotante, leyenda, bandeja de seleccionados y auto-elección de
 * butacas contiguas. Mantiene los mismos gestos del sistema anterior:
 * click marca/desmarca y el arrastre selecciona en caja (Shift/Ctrl suma).
 *
 * Solo frontend: consume los mismos asientos {id, fila, numero, estado}
 * y los mismos handlers que usaba ZoneSeatGrid/SeatGrid.
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

const BASE_CELL = 30;          // px lógicos por butaca (antes de zoom)
const CURVE_DEPTH = 0.55;      // curvatura de fila (× CELL) hacia los extremos
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.4;

/** Layout: posiciones lógicas de cada butaca con curvatura de estadio. */
function buildLayout(asientos) {
  const filaMap = new Map();
  for (const a of asientos) {
    if (!filaMap.has(a.fila)) filaMap.set(a.fila, []);
    filaMap.get(a.fila).push(a);
  }
  const filas = [...filaMap.keys()].sort(filaSort);
  const maxCols = Math.max(1, ...filas.map((f) => filaMap.get(f).length));

  const CELL = BASE_CELL;
  const LABEL_W = 38;
  const TOP_PAD = 44;          // espacio para el arco "CANCHA"
  const BOTTOM_PAD = 14;
  const curveMax = CELL * CURVE_DEPTH;

  const width = LABEL_W * 2 + maxCols * CELL;
  const height = TOP_PAD + filas.length * CELL + curveMax + BOTTOM_PAD;

  const seats = [];
  const rowLabels = [];
  filas.forEach((fila, fi) => {
    const cols = [...filaMap.get(fila)].sort((x, y) => x.numero - y.numero);
    const nCols = cols.length;
    const rowY = TOP_PAD + (fi + 0.5) * CELL;
    let edgeDy = 0;
    cols.forEach((a, ci) => {
      // Curvatura: el centro de la fila queda más cerca de la cancha (arriba).
      const t = nCols > 1 ? (2 * ci) / (nCols - 1) - 1 : 0; // -1..1
      const dy = curveMax * t * t;
      edgeDy = Math.max(edgeDy, dy);
      seats.push({
        a,
        cx: LABEL_W + (maxCols - nCols) * CELL / 2 + (ci + 0.5) * CELL,
        cy: rowY + dy,
      });
    });
    rowLabels.push({ fila, y: rowY + edgeDy });
  });

  return { seats, rowLabels, width, height, CELL, LABEL_W, maxCols, filas, filaMap };
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
 * `clickableStates` define qué estados admiten click además de las seleccionadas
 * (público: ['disponible']; admin: ['disponible','bloqueado']).
 */
export function SeatCanvas({
  asientos,
  accentColor = '#c9a961',
  selectedIds = null,          // Set de ids seleccionadas
  onSeatClick = null,          // (asiento) =>
  onBoxSelect = null,          // (hits[], additive) =>
  clickableStates = ['disponible'],
  zoom = 1,
  onZoomChange = null,
  showFieldArc = true,
  fieldLabel = 'CANCHA',
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const pinchRef = useRef(null);
  const [marquee, setMarquee] = useState(null);
  const [hover, setHover] = useState(null); // { a, x, y } coords locales del wrap

  const layout = useMemo(() => buildLayout(asientos || []), [asientos]);

  // ctrl+rueda (y pinch de trackpad, que llega como wheel con ctrlKey) = zoom.
  // Listener nativo porque React registra onWheel como passive.
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
  const { seats, rowLabels, width, height, CELL, LABEL_W } = layout;

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

  // Pinch con dos punteros táctiles.
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
      x1: Math.min(start.x, cur.x),
      y1: Math.min(start.y, cur.y),
      x2: Math.max(start.x, cur.x),
      y2: Math.max(start.y, cur.y),
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
        .filter(({ cx, cy }) => cx >= rect.x1 && cx <= rect.x2 && cy >= rect.y1 && cy <= rect.y2)
        .map(({ a }) => a);
      onBoxSelect(hits, ev.shiftKey || ev.ctrlKey);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const seatW = CELL * 0.74;
  const seatH = CELL * 0.6;
  const backH = CELL * 0.16;
  const showNums = CELL * zoom >= 19;

  return (
    <div className="sp-canvas-wrap" ref={wrapRef}>
      <div className="sp-canvas-scroll">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: width * zoom, height: height * zoom, display: 'block' }}
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
            <linearGradient id="sp-arc-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={hexToRgba(accentColor, 0)} />
              <stop offset="50%" stopColor={hexToRgba(accentColor, 0.75)} />
              <stop offset="100%" stopColor={hexToRgba(accentColor, 0)} />
            </linearGradient>
          </defs>

          {/* Referencia de orientación: la fila A es la más cercana a la cancha */}
          {showFieldArc && (
            <g pointerEvents="none">
              <path
                d={`M ${LABEL_W} 30 Q ${width / 2} 6 ${width - LABEL_W} 30`}
                fill="none"
                stroke="url(#sp-arc-fade)"
                strokeWidth="2.5"
              />
              <text x={width / 2} y="20" textAnchor="middle" className="sp-field-label">{fieldLabel}</text>
            </g>
          )}

          {/* Etiquetas de fila a ambos lados */}
          {rowLabels.map(({ fila, y }) => (
            <g key={`rl-${fila}`} pointerEvents="none">
              <text x={LABEL_W - 14} y={y + 3.5} textAnchor="end" className="sp-row-label">{fila}</text>
              <text x={width - LABEL_W + 14} y={y + 3.5} textAnchor="start" className="sp-row-label">{fila}</text>
            </g>
          ))}

          {/* Butacas */}
          {seats.map(({ a, cx, cy }) => {
            const selected = selectedIds?.has(a.id);
            const clickable = !!onSeatClick && (selected || clickableStates.includes(a.estado));
            const v = seatVisual(a.estado, selected, accentColor);
            return (
              <g
                key={a.id}
                className={`sp-seat ${v.cls}${clickable ? ' sp-seat--clickable' : ''}`}
                onClick={clickable ? (e) => { e.stopPropagation(); onSeatClick(a); } : undefined}
                onMouseEnter={(e) => setHover({ a, ...localCoords(e.clientX, e.clientY) })}
                onMouseMove={(e) => setHover({ a, ...localCoords(e.clientX, e.clientY) })}
                onMouseLeave={() => setHover(null)}
              >
                {/* respaldo */}
                <rect
                  x={cx - seatW / 2}
                  y={cy - seatH / 2 - backH + 1.5}
                  width={seatW}
                  height={backH}
                  rx={backH / 2}
                  fill={v.fill === 'url(#sp-hatch)' ? '#3a3a3a' : v.fill}
                  stroke={v.stroke}
                  strokeWidth={v.strokeWidth * 0.8}
                  opacity={0.9}
                />
                {/* cojín */}
                <rect
                  x={cx - seatW / 2}
                  y={cy - seatH / 2 + 2.5}
                  width={seatW}
                  height={seatH}
                  rx={3.4}
                  fill={v.fill}
                  stroke={v.stroke}
                  strokeWidth={v.strokeWidth}
                />
                {a.estado === 'vendido' && !selected && (
                  <text x={cx} y={cy + 5.4} textAnchor="middle" className="sp-seat-x" pointerEvents="none">×</text>
                )}
                {showNums && a.estado !== 'vendido' && (
                  <text x={cx} y={cy + 5.2} textAnchor="middle" pointerEvents="none" className="sp-seat-num" fill={v.num}>
                    {a.numero}
                  </text>
                )}
                <title>{`Fila ${a.fila} · Asiento ${a.numero} · ${a.estado}`}</title>
              </g>
            );
          })}

          {marquee && (
            <rect
              x={marquee.x1}
              y={marquee.y1}
              width={marquee.x2 - marquee.x1}
              height={marquee.y2 - marquee.y1}
              className="sp-marquee"
              pointerEvents="none"
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
    // Ventanas de n consecutivas dentro de la fila; gana la más centrada.
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
  // Sin n contiguas: junta las más cercanas a la cancha que haya.
  const all = filas.flatMap((f) => filaMap.get(f).sort((x, y) => x.numero - y.numero));
  return all.slice(0, n);
}

const ZOOM_STEP = 1.25;

/**
 * Panel completo del selector: encabezado con precio, controles de zoom,
 * lienzo, leyenda, auto-elección y bandeja de butacas seleccionadas.
 */
export function SeatPickerPanel({
  tipo,
  asientos,
  selectedIds,               // Set o array de ids seleccionadas (de este sector)
  onSeatToggle,              // (asiento) =>
  onBoxSelect = null,        // (hits[], additive) => — opcional
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

  function autoPick() {
    const room = maxSeats - propios.length;
    const n = Math.min(autoN, room);
    if (n <= 0) return;
    const picks = pickBestSeats(asientos, n, selSet);
    if (picks.length === 0) return;
    if (onBoxSelect) onBoxSelect(picks, true);
    else picks.forEach((a) => onSeatToggle(a));
  }

  return (
    <div className={`seatpicker${compact ? ' seatpicker--compact' : ''}`}>
      <div className="seatpicker-head">
        <div className="seatpicker-title">
          {tipo && <b>{tipo.nombre}</b>}
          <span className="seatpicker-price">₡{Number(precio).toLocaleString('es-CR')} / butaca</span>
          <span className="seatpicker-avail">{libres.toLocaleString('es-CR')} libres</span>
        </div>
        <div className="seatpicker-zoom" role="group" aria-label="Zoom">
          <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP))} aria-label="Alejar">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP))} aria-label="Acercar">+</button>
          <button type="button" className="seatpicker-zoom-reset" onClick={() => setZoom(1)} aria-label="Restablecer zoom">⤢</button>
        </div>
      </div>

      <SeatCanvas
        asientos={asientos}
        accentColor={accent}
        selectedIds={selSet}
        onSeatClick={onSeatToggle}
        onBoxSelect={onBoxSelect}
        zoom={zoom}
        onZoomChange={setZoom}
        fieldLabel={fieldLabel}
      />

      <div className="seatpicker-foot">
        <div className="seatpicker-legend" aria-hidden="true">
          <span><i className="sp-lg sp-lg--libre" style={{ borderColor: accent, background: hexToRgba(accent, 0.16) }} /> Disponible</span>
          <span><i className="sp-lg sp-lg--sel" /> Tu selección</span>
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
                <button
                  key={a.id}
                  type="button"
                  className="seatpicker-chip"
                  onClick={() => onSeatToggle(a)}
                  title={`Quitar fila ${a.fila} asiento ${a.numero}`}
                >
                  {a.fila}-{a.numero} <span aria-hidden="true">×</span>
                </button>
              ))}
          </div>
          <div className="seatpicker-tray-total">
            <span>{propios.length} de {maxSeats} máx.</span>
            <b>₡{(propios.length * precio).toLocaleString('es-CR')}</b>
          </div>
        </div>
      )}
    </div>
  );
}
