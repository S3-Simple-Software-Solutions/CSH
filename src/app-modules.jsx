import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Accessibility, Activity, BadgePercent, BarChart3, CalendarDays, Car, Check, Clock, Eye, EyeOff, Gift, Globe, LayoutGrid, Lock, Mail, Map as MapIcon, MessageSquare, Moon, Newspaper, Pencil, Plus, QrCode, RotateCw, Route, ScanLine, Search, Send, Shield, ShoppingBag, Sparkles, Sun, Ticket, ToggleLeft, ToggleRight, Trash2, TrendingUp, Trophy, Truck, Users, Users2, UtensilsCrossed, X } from 'lucide-react';
import AdminTopBar from './layout/AdminTopBar.jsx';
import { StadiumMapEditor } from './pages/entradas/StadiumMapEditor.jsx';
import { StadiumMap } from './pages/entradas/StadiumMap.jsx';
import { isErcVectorLayout, ERC_SECTORES, ERC_ZONE_META, GRAMILLA_ZONE_META, GRAMILLA_SECTORES, nombreToZoneKey } from './pages/entradas/stadiumErc.js';
import { gramillaKeysForTemplate } from './pages/entradas/stadiumFieldGeometry.js';
import AdminJugadores from './pages/admin/AdminJugadores.jsx';
import AdminNoticias from './pages/admin/AdminNoticias.jsx';
import AdminPartidos from './pages/admin/AdminPartidos.jsx';
import AdminSponsors from './pages/admin/AdminSponsors.jsx';
import AdminMensajes from './pages/admin/AdminMensajes.jsx';
import QRCode from 'qrcode';
import { useEscClose } from './utils/useEscClose.js';
import sotano1Img from './croquis/sotano-1.png';
import sotano2Img from './croquis/sotano-2.png';
import './styles.css';

const PLAN_IMG = { 'sotano-1': sotano1Img, 'sotano-2': sotano2Img };
const FLOW_ARROW_TYPES = [
  { id: 'straight', label: 'Recta' },
  { id: 'turn-left', label: 'Doblar izquierda' },
  { id: 'turn-right', label: 'Doblar derecha' },
  { id: 'split-up-right', label: 'Recta + derecha' },
  { id: 'split-left-right', label: 'Doble salida' },
  { id: 'u-turn-right', label: 'Retorno' },
];
const FLOW_ARROW_TYPE_IDS = new Set(FLOW_ARROW_TYPES.map((type) => type.id));
const FLOW_ARROW_LABELS = Object.fromEntries(FLOW_ARROW_TYPES.map((type) => [type.id, type.label]));
const FLOW_TURN_FLIP = { 'turn-left': 'turn-right', 'turn-right': 'turn-left' };
const FLOW_ARROW_SIZE = {
  straight: { w: 0.070, h: 0.020 },
  'turn-left': { w: 0.060, h: 0.060 },
  'turn-right': { w: 0.060, h: 0.060 },
  'split-up-right': { w: 0.052, h: 0.058 },
  'split-left-right': { w: 0.060, h: 0.052 },
  'u-turn-right': { w: 0.052, h: 0.060 },
};
const FLOW_ARROW_CAPS = {
  straight: [{ x: 8, y: 50, edge: 'vertical' }, { x: 88, y: 50, edge: 'vertical' }],
  'turn-left': [{ x: 78, y: 88, edge: 'horizontal' }, { x: 12, y: 26, edge: 'vertical' }],
  'turn-right': [{ x: 22, y: 88, edge: 'horizontal' }, { x: 88, y: 26, edge: 'vertical' }],
  'split-up-right': [{ x: 28, y: 86, edge: 'horizontal' }, { x: 28, y: 22, edge: 'horizontal' }, { x: 80, y: 40, edge: 'vertical' }],
  'split-left-right': [{ x: 50, y: 86, edge: 'horizontal' }, { x: 16, y: 40, edge: 'vertical' }, { x: 84, y: 40, edge: 'vertical' }],
  'u-turn-right': [{ x: 20, y: 86, edge: 'horizontal' }, { x: 82, y: 78, edge: 'horizontal' }],
};
const FLOW_ROAD_HALF_WIDTH_PX = 8.5;
const FLOW_ARROW_SNAP_PX = 18;
const FLOW_DIRECTION_ARROW = { w: 0.024, h: 0.034 };

function flowArrowKind(kind) {
  return FLOW_ARROW_TYPE_IDS.has(kind) ? kind : 'straight';
}

function isTurnArrowKind(kind) {
  return Boolean(FLOW_TURN_FLIP[flowArrowKind(kind)]);
}

function flowArrowSize(kind) {
  return FLOW_ARROW_SIZE[flowArrowKind(kind)] || FLOW_ARROW_SIZE.straight;
}

function flowArrowRoadSize(arrow, arrows = [], aspect = 1.5) {
  const base = flowArrowSize(arrow.kind);
  if (flowArrowKind(arrow.kind) !== 'straight') return base;
  const angle = (Number(arrow.r || 0) * Math.PI) / 180;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const here = { x: Number(arrow.x || 0), y: Number(arrow.y || 0) / aspect };
  const laneTolerance = Math.max(base.h / aspect, 0.012);
  const connectedLength = arrows
    .filter((other) => other.id !== arrow.id && flowArrowKind(other.kind) === 'straight')
    .map((other) => {
      const there = { x: Number(other.x || 0), y: Number(other.y || 0) / aspect };
      const dx = there.x - here.x;
      const dy = there.y - here.y;
      const along = Math.abs(dx * dir.x + dy * dir.y);
      const across = Math.abs(dx * -dir.y + dy * dir.x);
      return across <= laneTolerance ? along : 0;
    })
    .filter((length) => length > base.w * 0.55)
    .sort((a, b) => a - b)[0];
  if (!connectedLength) return base;
  return { ...base, w: clamp(connectedLength, base.w, 0.16) };
}

function normalizeRotation(value) {
  const n = Number(value) || 0;
  const mod = ((n % 360) + 360) % 360;
  return mod > 180 ? mod - 360 : mod;
}

function flowArrowCapMarkers(kind) {
  const safeKind = flowArrowKind(kind);
  const markerHalf = safeKind === 'straight' ? 38 : 16;
  return (FLOW_ARROW_CAPS[safeKind] || FLOW_ARROW_CAPS.straight).flatMap((cap) => {
    if (cap.edge === 'vertical') {
      return [{ x: cap.x, y: cap.y - markerHalf }, { x: cap.x, y: cap.y + markerHalf }];
    }
    return [{ x: cap.x - markerHalf, y: cap.y }, { x: cap.x + markerHalf, y: cap.y }];
  });
}

function FlowArrowControlSvg({ kind, editable }) {
  const safeKind = flowArrowKind(kind);
  const connectors = flowArrowCapMarkers(safeKind);
  return (
    <svg className="flow-arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g className="flow-road-ports">
        {connectors.map((pt, idx) => (
          <circle key={`${idx}-${pt.x}-${pt.y}-port`} className="flow-road-port" cx={pt.x} cy={pt.y} r="5.4" />
        ))}
      </g>
      {editable && connectors.map((pt, idx) => (
        <circle key={`${idx}-${pt.x}-${pt.y}`} className="flow-connector" cx={pt.x} cy={pt.y} r="3.8" />
      ))}
    </svg>
  );
}

function DirectionArrowIcon() {
  return (
    <svg className="flow-direction-svg" viewBox="0 0 120 100" aria-hidden="true" focusable="false">
      <path className="flow-direction-outline" d="M113 50 L17 9 Q9 6 6 14 L27 50 L6 86 Q9 94 17 91 Z" />
      <path className="flow-direction-left" d="M101 50 L20 16 L40 50 Z" />
      <path className="flow-direction-right" d="M101 50 L20 84 L40 50 Z" />
    </svg>
  );
}

const money = (value) => `₡${Number(value || 0).toLocaleString('es-CR')}`;
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtFullDate = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDur = (ms) => {
  const neg = ms < 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  return `${neg ? '-' : ''}${pad(h)}:${pad(m)}:${pad(s)}`;
};
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const json = await response.json().catch(() => ({ ok: false, error: 'Respuesta invalida' }));
  if (!response.ok && json.ok !== false) json.error = 'Error de servidor';
  return json;
}

const THEME_KEY = 'csh-theme';
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}
function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  useEffect(() => { applyTheme(theme); }, [theme]);
  return (
    <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}


function CouponCard({ cupon, admin = false, onToggle }) {
  const pct = Math.min(100, Math.round((Number(cupon.usos || 0) / Math.max(1, Number(cupon.limite || 1))) * 100));
  return (
    <article className={`coupon ${cupon.estado}`}>
      <div className="coupon-stub">
        <img src={cupon.logo} alt={cupon.proveedor} />
        <span>{cupon.categoria}</span>
      </div>
      <div className="coupon-body">
        <div className="coupon-top">
          <span className="coupon-provider">{cupon.proveedor}</span>
          <b className={`coupon-status ${cupon.estado}`}>{cupon.estado}</b>
        </div>
        <h2>{cupon.titulo}</h2>
        <p>{cupon.descripcion}</p>
        <div className="coupon-code"><span>Codigo</span><strong>{cupon.codigo}</strong></div>
        <div className="coupon-usage">
          <div className="coupon-meter"><i className={pct >= 85 ? 'high' : ''} style={{ width: `${pct}%` }} /></div>
          <small>{cupon.usos}/{cupon.limite} usos</small>
        </div>
        <div className="coupon-foot">
          <small>Vence {fmtFullDate(cupon.vigencia)}</small>
          {admin && (
            <button className="coupon-toggle" onClick={() => onToggle?.(cupon)} title={cupon.estado === 'habilitado' ? 'Retirar cupon' : 'Habilitar cupon'}>
              {cupon.estado === 'habilitado' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {cupon.estado === 'habilitado' ? 'Retirar' : 'Habilitar'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function PublicCoupons() {
  const [state, setState] = useState({ cupones: [], stats: null });
  useEffect(() => { api('/api/cuponera/publico').then((data) => data.ok && setState({ cupones: data.cupones, stats: data.stats })); }, []);
  return (
    <>
      
      <main className="page">
        <p className="eyebrow">Modulo de cuponera</p>
        <h1>Beneficios para socios</h1>
        <p className="sub">Cupones activos de patrocinadores oficiales. Presenta el codigo en el comercio participante para aplicar el descuento.</p>
        <section className="coupon-stats">
          <div><span>Disponibles</span><b>{state.stats?.habilitados || state.cupones.length}</b></div>
          <div><span>Usos registrados</span><b>{state.stats?.usos || 0}</b></div>
          <div><span>Proveedores</span><b>{new Set(state.cupones.map((c) => c.proveedor)).size}</b></div>
        </section>
        <section className="coupon-list">
          {state.cupones.map((cupon) => <CouponCard key={cupon.id} cupon={cupon} />)}
        </section>
      </main>
    </>
  );
}

function ExpirationBar({ start, end }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const total = Math.max(1, new Date(end).getTime() - new Date(start).getTime());
  const left = new Date(end).getTime() - now;
  const pct = Math.max(0, Math.min(1, left / total));
  const cls = left <= 0 ? 'vencido' : pct <= 0.2 ? 'bajo' : pct <= 0.5 ? 'medio' : '';
  return <span className="exp"><i className={cls} style={{ width: `${pct * 100}%` }} /></span>;
}

const STALL_LONG_RATIO = 2.22;
const STALL_SHORT_W = 0.0145;
const LEGACY_STALL_SIZES = [
  { w: 0.012, h: 0.0415 },
  { w: 0.0285, h: 0.0175 },
];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function uniformSpotSize(vertical, aspect = 1.5) {
  const shortH = STALL_SHORT_W * aspect;
  return vertical
    ? { w: STALL_SHORT_W, h: shortH * STALL_LONG_RATIO }
    : { w: STALL_SHORT_W * STALL_LONG_RATIO, h: shortH };
}

function isLegacySpotSize(w, h) {
  return LEGACY_STALL_SIZES.some((size) => Math.abs(Number(w) - size.w) < 0.000001 && Math.abs(Number(h) - size.h) < 0.000001);
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clusterAxis(stalls, axis, threshold) {
  const clusters = [];
  stalls
    .slice()
    .sort((a, b) => a[axis] - b[axis])
    .forEach((st) => {
      const last = clusters[clusters.length - 1];
      if (!last || Math.abs(st[axis] - last.center) > threshold) {
        clusters.push({ center: st[axis], items: [st] });
        return;
      }
      last.items.push(st);
      last.center = median(last.items.map((item) => item[axis]));
    });
  return clusters;
}

function buildSpotLayout(stalls, aspect = 1.5) {
  const visible = stalls.filter((s) => s.utilizado !== false);
  const rowClusters = clusterAxis(visible, 'y', 0.019);
  const colClusters = clusterAxis(visible, 'x', 0.026);
  const rowById = new Map();
  const colById = new Map();
  rowClusters.forEach((cluster) => cluster.items.forEach((st) => rowById.set(st.id, cluster)));
  colClusters.forEach((cluster) => cluster.items.forEach((st) => colById.set(st.id, cluster)));
  const oriented = visible.map((st) => {
    const rowScore = rowById.get(st.id)?.items.length || 0;
    const colScore = colById.get(st.id)?.items.length || 0;
    let vertical = rowScore >= colScore;
    if (rowScore < 4 && colScore < 4) {
      const rowPitch = visible
        .filter((o) => o.id !== st.id && Math.abs(o.y - st.y) < 0.017)
        .map((o) => Math.abs(o.x - st.x))
        .filter((d) => d > 0.004)
        .sort((a, b) => a - b)[0] || Infinity;
      const colPitch = visible
        .filter((o) => o.id !== st.id && Math.abs(o.x - st.x) < 0.023)
        .map((o) => Math.abs(o.y - st.y))
        .filter((d) => d > 0.004)
        .sort((a, b) => a - b)[0] || Infinity;
      vertical = rowPitch < colPitch;
    }
    return { ...st, vertical };
  });
  const byId = new Map(oriented.map((st) => [st.id, { ...st }]));
  rowClusters.forEach((cluster) => {
    const items = cluster.items.filter((st) => byId.get(st.id)?.vertical);
    if (items.length < 2) return;
    const y = median(items.map((st) => st.y));
    items.forEach((st) => { byId.get(st.id).y = y; });
  });
  colClusters.forEach((cluster) => {
    const items = cluster.items.filter((st) => !byId.get(st.id)?.vertical);
    if (items.length < 2) return;
    const x = median(items.map((st) => st.x));
    items.forEach((st) => { byId.get(st.id).x = x; });
  });
  byId.forEach((spot) => {
    const autoSize = uniformSpotSize(spot.vertical, aspect);
    if (spot.ancho && spot.alto && !isLegacySpotSize(spot.ancho, spot.alto)) {
      spot.w = spot.ancho;
      spot.h = spot.alto;
    } else if (spot.vertical) {
      spot.w = autoSize.w;
      spot.h = autoSize.h;
    } else {
      spot.w = autoSize.w;
      spot.h = autoSize.h;
    }
  });
  return byId;
}

function spotStyle(st, layout) {
  const g = layout.get(st.id) || { x: st.x, y: st.y, w: 0.032, h: 0.022 };
  return { left: `${g.x * 100}%`, top: `${g.y * 100}%`, width: `${g.w * 100}%`, height: `${g.h * 100}%` };
}

function selectionRect(a, b) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function spotTouchesSelection(st, layout, rect) {
  const g = layout.get(st.id) || { x: st.x, y: st.y, w: 0.032, h: 0.022 };
  const spot = { left: g.x - g.w / 2, right: g.x + g.w / 2, top: g.y - g.h / 2, bottom: g.y + g.h / 2 };
  return spot.left <= rect.right && spot.right >= rect.left && spot.top <= rect.bottom && spot.bottom >= rect.top;
}

function flowArrowsForFloor(fl) {
  if (!fl) return [];
  const arrows = Array.isArray(fl.arrows) ? fl.arrows : [];
  return arrows.map((arrow, idx) => ({
    id: arrow.id || `${fl.plan}-arrow-${String(idx + 1).padStart(2, '0')}`,
    x: arrow.x,
    y: arrow.y,
    r: arrow.r || 0,
    kind: flowArrowKind(arrow.kind),
  }));
}

function flowArrowCapOffsetGroupsPx(arrow, bounds, arrows = [], aspect = 1.5) {
  const kind = flowArrowKind(arrow.kind);
  const size = flowArrowRoadSize(arrow, arrows, aspect);
  const width = bounds.width * size.w;
  const height = bounds.height * size.h;
  const rotation = (Number(arrow.r || 0) * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return (FLOW_ARROW_CAPS[kind] || FLOW_ARROW_CAPS.straight).map((cap) => {
    const localX = ((cap.x - 50) / 100) * width;
    const localY = ((cap.y - 50) / 100) * height;
    const corners = cap.edge === 'vertical'
      ? [{ x: localX, y: localY - FLOW_ROAD_HALF_WIDTH_PX }, { x: localX, y: localY + FLOW_ROAD_HALF_WIDTH_PX }]
      : [{ x: localX - FLOW_ROAD_HALF_WIDTH_PX, y: localY }, { x: localX + FLOW_ROAD_HALF_WIDTH_PX, y: localY }];
    return corners.map((pt) => ({
      x: pt.x * cos - pt.y * sin,
      y: pt.x * sin + pt.y * cos,
    }));
  });
}

function flowArrowCapPointGroupsPx(arrow, bounds, x = arrow.x, y = arrow.y, arrows = [], aspect = 1.5) {
  const center = { x: Number(x) * bounds.width, y: Number(y) * bounds.height };
  return flowArrowCapOffsetGroupsPx(arrow, bounds, arrows, aspect).map((group) => group.map((offset) => ({ x: center.x + offset.x, y: center.y + offset.y })));
}

function midpoint(points) {
  return {
    x: points.reduce((sum, pt) => sum + pt.x, 0) / points.length,
    y: points.reduce((sum, pt) => sum + pt.y, 0) / points.length,
  };
}

function snapFlowArrow(arrow, x, y, arrows, bounds, aspect = 1.5) {
  const movingArrow = { ...arrow, x, y };
  const movingArrows = arrows.map((item) => (item.id === arrow.id ? movingArrow : item));
  const offsetGroups = flowArrowCapOffsetGroupsPx(movingArrow, bounds, movingArrows, aspect);
  let best = null;
  movingArrows
    .filter((other) => other.id !== arrow.id)
    .forEach((other) => {
      flowArrowCapPointGroupsPx(other, bounds, other.x, other.y, movingArrows, aspect).forEach((targetGroup) => {
        offsetGroups.forEach((offsetGroup) => {
          const sourceGroup = offsetGroup.map((offset) => ({ x: x * bounds.width + offset.x, y: y * bounds.height + offset.y }));
          [targetGroup, targetGroup.slice().reverse()].forEach((orderedTargetGroup) => {
            const distances = sourceGroup.map((source, idx) => Math.hypot(source.x - orderedTargetGroup[idx].x, source.y - orderedTargetGroup[idx].y));
            const maxDist = Math.max(...distances);
            const score = distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
            if (maxDist <= FLOW_ARROW_SNAP_PX && (!best || score < best.score)) {
              best = { score, target: midpoint(orderedTargetGroup), offset: midpoint(offsetGroup) };
            }
          });
        });
      });
    });
  if (!best) return { x, y };
  return {
    x: clamp((best.target.x - best.offset.x) / bounds.width, 0, 1),
    y: clamp((best.target.y - best.offset.y) / bounds.height, 0, 1),
  };
}

// ───────── Rutas / carreteras dibujables sobre el croquis ─────────
// Engancha un punto al eje respecto al vértice anterior: el tramo queda
// horizontal o vertical (ángulos 0/90/180/270), nunca en diagonal.
function snapToAxis(prev, p) {
  if (!prev) return p;
  const dx = Math.abs(p.x - prev.x);
  const dy = Math.abs(p.y - prev.y);
  return dx >= dy ? { x: p.x, y: prev.y } : { x: prev.x, y: p.y };
}

// Path SVG en espacio 0..100 (preserveAspectRatio="none"): tramos rectos entre
// vértices y, en cada intersección, una curva suave (Bézier cuadrática) que
// recorta la esquina con un radio fijo — así nunca queda en punta.
const ROAD_CORNER_R = 5; // radio de redondeo en unidades de viewBox (0..100)
function roadPathD(points) {
  if (!points || points.length < 2) return '';
  const P = points.map((p) => ({ x: p.x * 100, y: p.y * 100 }));
  const fmt = (p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  if (P.length === 2) return `M ${fmt(P[0])} L ${fmt(P[1])}`;
  let d = `M ${fmt(P[0])}`;
  for (let i = 1; i < P.length - 1; i += 1) {
    const prev = P[i - 1];
    const cur = P[i];
    const next = P[i + 1];
    const lenIn = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1;
    const lenOut = Math.hypot(next.x - cur.x, next.y - cur.y) || 1;
    const rIn = Math.min(ROAD_CORNER_R, lenIn / 2);
    const rOut = Math.min(ROAD_CORNER_R, lenOut / 2);
    const enter = { x: cur.x - ((cur.x - prev.x) / lenIn) * rIn, y: cur.y - ((cur.y - prev.y) / lenIn) * rIn };
    const exit = { x: cur.x + ((next.x - cur.x) / lenOut) * rOut, y: cur.y + ((next.y - cur.y) / lenOut) * rOut };
    d += ` L ${fmt(enter)} Q ${fmt(cur)} ${fmt(exit)}`;
  }
  d += ` L ${fmt(P[P.length - 1])}`;
  return d;
}

// Capa SVG de carreteras: trazo de asfalto + raya amarilla central (dos carriles).
// `draft` = { points, vertices }: points incluye el cursor (preview elástico);
// vertices son los puntos ya fijados con click (se marcan con un círculo).
function RoadsLayer({ roads = [], draft = null, editable = false, selected = null, onSelect }) {
  const draftPts = draft?.points || null;
  const items = draftPts && draftPts.length > 1 ? [...roads, { id: '__draft__', points: draftPts }] : roads;
  const draftVertices = draft?.vertices || [];
  if (!items.length && !draftVertices.length) return null;
  return (
    <svg className="roads-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {items.map((r) => {
        const d = roadPathD(r.points);
        if (!d) return null;
        const isDraft = r.id === '__draft__';
        const sel = editable && selected === r.id;
        return (
          <g key={r.id} className={`road${isDraft ? ' draft' : ''}${sel ? ' selected' : ''}`}>
            <path className="road-asphalt" d={d} fill="none" />
            <path className="road-center" d={d} fill="none" />
            {editable && !isDraft && (
              <path
                className="road-hit"
                d={d}
                fill="none"
                onPointerDown={(e) => { e.stopPropagation(); onSelect?.(r.id); }}
              />
            )}
          </g>
        );
      })}
      {draftVertices.map((p, i) => (
        <circle key={`v-${i}`} className="road-vertex" cx={p.x * 100} cy={p.y * 100} r="1.1" />
      ))}
    </svg>
  );
}

function FlowArrows({ arrows, editable = false, selected = null, onPointerDown, aspect = 1.5 }) {
  return (
    <>
      {arrows.map((arrow) => {
        const kind = flowArrowKind(arrow.kind);
        const size = flowArrowRoadSize(arrow, arrows, aspect);
        return (
          <React.Fragment key={arrow.id}>
            {editable && (
              <button
                type="button"
                className={`flow-arrow kind-${kind} editable${selected === arrow.id ? ' selected' : ''}`}
                style={{ left: `${arrow.x * 100}%`, top: `${arrow.y * 100}%`, width: `${size.w * 100}%`, height: `${size.h * 100}%`, '--rot': `${arrow.r}deg` }}
                title={`Mover flecha: ${FLOW_ARROW_LABELS[kind]}`}
                aria-label={`Mover flecha: ${FLOW_ARROW_LABELS[kind]}`}
                onPointerDown={(e) => onPointerDown?.(e, arrow)}
                onClick={(e) => e.stopPropagation()}
              >
                <FlowArrowControlSvg kind={kind} editable />
              </button>
            )}
            <span
              className="flow-direction-arrow"
              style={{ left: `${arrow.x * 100}%`, top: `${arrow.y * 100}%`, width: `${FLOW_DIRECTION_ARROW.w * 100}%`, height: `${FLOW_DIRECTION_ARROW.h * 100}%`, '--rot': `${arrow.r}deg` }}
              aria-hidden="true"
            >
              <DirectionArrowIcon />
            </span>
          </React.Fragment>
        );
      })}
    </>
  );
}

function PlanoCroquis({ spaces, floor, onSpace, admin = false, reservations = [], me, showFlow = true }) {
  const [floors, setFloors] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { api('/api/parqueo/croquis').then((d) => d.ok && setFloors(d.floors)); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(id); }, []);
  const fl = floors?.find((f) => f.piso === floor);
  const spaceById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);
  const resById = useMemo(() => new Map(reservations.map((r) => [r.id, r])), [reservations]);
  const visibleStalls = useMemo(() => (fl?.stalls || []).filter((st) => st.utilizado !== false), [fl]);
  const spotLayout = useMemo(() => buildSpotLayout(visibleStalls, fl?.aspect), [visibleStalls, fl?.aspect]);
  const flowArrows = useMemo(() => flowArrowsForFloor(fl), [fl]);
  if (!fl) return <div className="plano-loading">Cargando croquis del plano...</div>;
  return (
    <div className="plano-wrap">
      <div className={`plano${fl.showPlan === false ? ' no-plan' : ''}`} style={{ aspectRatio: String(fl.aspect) }}>
        {fl.showPlan !== false && <img src={PLAN_IMG[fl.plan]} alt={`Plano ${fl.plan}`} draggable="false" />}
        <div className="plano-overlay">
          {visibleStalls.map((st) => {
            const space = spaceById.get(st.id);
            const estado = space ? space.estado : 'disponible';
            const reservation = space ? resById.get(space.reservaId) : null;
            const session = reservation || space?.reserva;
            const expired = session && new Date(session.fin).getTime() <= now;
            const mine = reservation && reservation.userId === me?.id;
            const spotName = st.nombre || st.id;
            const label = admin && reservation
              ? `${spotName} · ${reservation.placa}${expired ? ' · vencido' : ''}`
              : `${spotName} · ${expired ? 'tiempo vencido' : estado}`;
            return (
              <button
                key={st.id}
                type="button"
                className={`pspot ${estado}${st.discapacitado ? ' accessible' : ''}${expired ? ' vencido' : ''}${mine ? ' mine' : ''}`}
                style={spotStyle(st, spotLayout)}
                title={label}
                onClick={() => space && onSpace?.(space, reservation)}
              />
            );
          })}
        </div>
        <RoadsLayer roads={fl.roads || []} />
      </div>
    </div>
  );
}

// Editor visual del croquis: permite marcar y mover plazas sobre el plano.
// Solo se monta para administradores de parqueo.
function PlanoEditor({ floor, onClose, onSaved, autoEdit = false }) {
  const [floors, setFloors] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedArrow, setSelectedArrow] = useState(null);
  const [arrowKind, setArrowKind] = useState('straight');
  const [addingArrow, setAddingArrow] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [editMode, setEditMode] = useState(autoEdit);
  const [confirmSave, setConfirmSave] = useState(false);
  const [showPlan, setShowPlan] = useState(true);
  const [drawingRoad, setDrawingRoad] = useState(false);
  const [draftRoad, setDraftRoad] = useState(null); // vértices ya fijados con click
  const [roadCursor, setRoadCursor] = useState(null); // posición del cursor (preview)
  const [selectedRoad, setSelectedRoad] = useState(null);
  const overlayRef = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const baseline = useRef(null);
  const tempSeq = useRef(0);

  const reload = () => api('/api/parqueo/croquis').then((d) => d.ok && setFloors(d.floors));
  useEffect(() => { reload(); }, []);

  // Modo edición diferido: todos los cambios se acumulan en estado local;
  // nada se persiste hasta apretar "Guardar".
  const nextTempId = (prefix) => `tmp-${prefix}-${(tempSeq.current += 1)}`;
  const isTempId = (id) => typeof id === 'string' && id.startsWith('tmp-');
  const snapshotFloor = (f) => ({
    piso: f.piso,
    stalls: (f.stalls || []).map((s) => ({ ...s })),
    arrows: flowArrowsForFloor(f).map((a) => ({ ...a })),
    roads: (f.roads || []).map((r) => ({ id: r.id, points: r.points.map((p) => ({ ...p })) })),
    showPlan: f.showPlan !== false,
  });
  function enterEditMode() {
    if (!fl) return;
    baseline.current = snapshotFloor(fl);
    setShowPlan(fl.showPlan !== false);
    setEditMode(true);
    setMsg(null);
  }
  function exitEditMode() {
    setEditMode(false);
    setSelectedIds([]);
    setSelectedArrow(null);
    setAddingArrow(false);
    setEditTarget(null);
    setDrawingRoad(false);
    setDraftRoad(null);
    setRoadCursor(null);
    setSelectedRoad(null);
    baseline.current = null;
  }
  // Cierra la edición: en modo embebido (autoEdit) vuelve a la vista del admin.
  function finishEditing() {
    if (autoEdit) onClose?.();
    else exitEditMode();
  }
  function cancelEditMode() {
    if (autoEdit) { onClose?.(); return; }
    // Restaura el piso al snapshot tomado al entrar y descarta los cambios locales.
    const snap = baseline.current;
    if (snap) {
      setShowPlan(snap.showPlan !== false);
      setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, stalls: snap.stalls.map((s) => ({ ...s })), arrows: snap.arrows.map((a) => ({ ...a })), roads: (snap.roads || []).map((r) => ({ id: r.id, points: r.points.map((p) => ({ ...p })) })) })));
    }
    exitEditMode();
    setMsg(null);
  }

  const fl = floors?.find((f) => f.piso === floor);
  const visibleStalls = useMemo(() => (fl?.stalls || []).filter((st) => st.utilizado !== false), [fl]);
  const spotLayout = useMemo(() => buildSpotLayout(visibleStalls, fl?.aspect), [visibleStalls, fl?.aspect]);
  const flowArrows = useMemo(() => flowArrowsForFloor(fl), [fl]);
  const roads = useMemo(() => fl?.roads || [], [fl]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selected = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedStall = visibleStalls.find((st) => st.id === selected) || null;
  const selectedArrowItem = flowArrows.find((arrow) => arrow.id === selectedArrow) || null;

  // Toma el snapshot al entrar a edición (incluido autoEdit) y al cambiar de piso.
  useEffect(() => {
    if (!editMode || !fl) return;
    if (!baseline.current || baseline.current.piso !== floor) {
      baseline.current = snapshotFloor(fl);
      setShowPlan(fl.showPlan !== false);
      setSelectedIds([]);
      setSelectedArrow(null);
      setEditTarget(null);
    }
  }, [editMode, fl, floor]);

  // Atajos de teclado en edición: Esc deselecciona, Backspace/Supr borra lo seleccionado.
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      if (editTarget || confirmSave) return;
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setSelectedArrow(null);
        setAddingArrow(false);
        setSelectedRoad(null);
        setDrawingRoad(false);
        setDraftRoad(null);
        setRoadCursor(null);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (!selectedIds.length && !selectedArrow && !selectedRoad) return;
        e.preventDefault();
        if (selectedIds.length) {
          const ids = new Set(selectedIds);
          setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, stalls: (f.stalls || []).filter((s) => !ids.has(s.id)) })));
          setSelectedIds([]);
          setEditTarget(null);
        } else if (selectedArrow) {
          setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, arrows: flowArrowsForFloor(f).filter((a) => a.id !== selectedArrow) })));
          setSelectedArrow(null);
        } else if (selectedRoad) {
          removeRoad(selectedRoad);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, selectedIds, selectedArrow, selectedRoad, editTarget, confirmSave, floor]);

  function frac(e) {
    const r = overlayRef.current.getBoundingClientRect();
    return { x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) };
  }

  // ── Dibujo de ruta por clicks: cada click fija un vértice; los tramos entre
  //    vértices son rectos y las esquinas se curvan suave al renderizar.
  //    Doble click (o desactivar la herramienta) finaliza la ruta.
  function addRoadPoint(e) {
    if (!drawingRoad || busy) return;
    const raw = frac(e);
    setSelectedRoad(null);
    setDraftRoad((prev) => {
      const pts = prev || [];
      const last = pts[pts.length - 1];
      const p = snapToAxis(last, raw); // tramo horizontal o vertical
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.005) return pts; // evita duplicado (doble click)
      return [...pts, p];
    });
  }
  function moveRoadCursor(e) {
    if (!drawingRoad) return;
    const raw = frac(e);
    const last = draftRoad?.[draftRoad.length - 1];
    setRoadCursor(snapToAxis(last, raw));
  }
  function commitRoad() {
    const pts = draftRoad || [];
    setDraftRoad(null);
    setRoadCursor(null);
    if (pts.length < 2) return; // necesita al menos 2 vértices
    const road = { id: nextTempId('road'), points: pts.map((p) => ({ ...p })) };
    setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, roads: [...(f.roads || []), road] })));
    setSelectedRoad(road.id);
  }
  function removeRoad(id) {
    setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, roads: (f.roads || []).filter((r) => r.id !== id) })));
    setSelectedRoad((cur) => (cur === id ? null : cur));
  }
  function toggleDrawRoad() {
    if (drawingRoad) {
      commitRoad(); // al apagar la herramienta, fija la ruta en curso
      setDrawingRoad(false);
      return;
    }
    setDraftRoad(null);
    setRoadCursor(null);
    setSelectedRoad(null);
    setSelectedIds([]);
    setSelectedArrow(null);
    setAddingArrow(false);
    setDrawingRoad(true);
  }
  // Refleja un cambio de posición en el estado local sin recargar todo el croquis.
  function patchDot(id, x, y) {
    setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, stalls: f.stalls.map((s) => (s.id === id ? { ...s, x, y } : s)) })));
  }

  function patchArrow(id, patch) {
    setFloors((prev) => prev.map((f) => {
      if (f.piso !== floor) return f;
      const arrows = flowArrowsForFloor(f);
      return { ...f, arrows: arrows.map((arrow) => (arrow.id === id ? { ...arrow, ...patch, kind: flowArrowKind(patch.kind ?? arrow.kind) } : arrow)) };
    }));
  }

  function selectSpaces(ids) {
    const nextIds = Array.from(new Set(ids));
    setSelectedIds(nextIds);
    if (nextIds.length) {
      setSelectedArrow(null);
      setEditTarget(null);
      setAddingArrow(false);
    }
  }

  function addDot(e) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (e.target !== overlayRef.current || busy) return;
    const { x, y } = frac(e);
    const id = nextTempId('sp');
    const espacio = { id, piso: floor, zona: 'A', x, y, utilizado: true, estado: 'disponible', reservaId: null, nombre: null, tipo: 'regular', ancho: null, alto: null, discapacitado: false };
    setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, stalls: [...(f.stalls || []), espacio] })));
    selectSpaces([id]);
    setSelectedArrow(null);
  }

  function addArrow(e) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (e.target !== overlayRef.current || busy) return;
    const { x, y } = frac(e);
    const id = nextTempId('ar');
    const flecha = { id, x, y, r: 0, kind: flowArrowKind(arrowKind) };
    setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, arrows: [...flowArrowsForFloor(f), flecha] })));
    setSelectedIds([]);
    setSelectedArrow(id);
    setArrowKind(flecha.kind);
    setAddingArrow(false);
  }

  function handleOverlayClick(e) {
    if (addingArrow) return addArrow(e);
    return addDot(e);
  }

  function startBoxSelect(e) {
    if (addingArrow || busy || e.target !== overlayRef.current) return;
    const start = frac(e);
    const startClient = { x: e.clientX, y: e.clientY };
    let moved = false;
    const idsInRect = (rect) => visibleStalls.filter((st) => spotTouchesSelection(st, spotLayout, rect)).map((st) => st.id);
    const onMove = (ev) => {
      const distance = Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y);
      if (distance < 5 && !moved) return;
      if (!moved) {
        setSelectedArrow(null);
        setEditTarget(null);
        setAddingArrow(false);
      }
      moved = true;
      const rect = selectionRect(start, frac(ev));
      setSelectionBox(rect);
      selectSpaces(idsInRect(rect));
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSelectionBox(null);
      if (!moved) return;
      suppressClick.current = true;
      const rect = selectionRect(start, frac(ev));
      const ids = idsInRect(rect);
      selectSpaces(ids);
      setMsg(ids.length ? null : { type: 'ok', text: 'No hay espacios dentro de la selección.' });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startDrag(e, st) {
    e.preventDefault();
    e.stopPropagation();
    selectSpaces([st.id]);
    setSelectedArrow(null);
    setAddingArrow(false);
    drag.current = { id: st.id, moved: false };
    const onMove = (ev) => {
      if (!drag.current) return;
      drag.current.moved = true;
      const { x, y } = frac(ev);
      patchDot(st.id, x, y);
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const moved = drag.current?.moved;
      drag.current = null;
      if (!moved) return;
      // El arrastre termina con un click; evitá que dispare un addDot.
      suppressClick.current = true;
      const { x, y } = frac(ev);
      patchDot(st.id, x, y);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startArrowDrag(e, arrow) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds([]);
    setEditTarget(null);
    setSelectedArrow(arrow.id);
    setArrowKind(flowArrowKind(arrow.kind));
    setAddingArrow(false);
    drag.current = { id: arrow.id, moved: false, x: arrow.x, y: arrow.y };
    const onMove = (ev) => {
      if (!drag.current) return;
      drag.current.moved = true;
      const bounds = overlayRef.current.getBoundingClientRect();
      const point = frac(ev);
      const snapped = snapFlowArrow(arrow, point.x, point.y, flowArrows, bounds, fl.aspect);
      drag.current.x = snapped.x;
      drag.current.y = snapped.y;
      patchArrow(arrow.id, { x: snapped.x, y: snapped.y });
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const moved = drag.current?.moved;
      const finalPoint = drag.current ? { x: drag.current.x, y: drag.current.y } : frac(ev);
      drag.current = null;
      if (!moved) return;
      suppressClick.current = true;
      patchArrow(arrow.id, finalPoint);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function saveArrowPatch(id, patch) {
    setMsg(null);
    patchArrow(id, patch);
    if (patch.kind !== undefined) setArrowKind(flowArrowKind(patch.kind));
  }

  function rotateArrow(delta) {
    if (!selectedArrowItem) return;
    saveArrowPatch(selectedArrowItem.id, { r: normalizeRotation(selectedArrowItem.r + delta) });
  }

  function changeArrowKind(kind) {
    if (!selectedArrowItem) return;
    const safeKind = flowArrowKind(kind);
    setArrowKind(safeKind);
    saveArrowPatch(selectedArrowItem.id, { kind: safeKind });
  }

  function flipTurnDirection() {
    if (!selectedArrowItem) return;
    const flippedKind = FLOW_TURN_FLIP[flowArrowKind(selectedArrowItem.kind)];
    if (!flippedKind) return;
    setArrowKind(flippedKind);
    saveArrowPatch(selectedArrowItem.id, { kind: flippedKind });
  }

  function removeArrow(id) {
    if (!window.confirm('¿Quitar esta flecha de circulación? Se aplicará al guardar.')) return;
    setMsg(null);
    setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, arrows: flowArrowsForFloor(f).filter((arrow) => arrow.id !== id) })));
    setSelectedArrow(null);
  }

  function removeDot(id) {
    setMsg(null);
    setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, stalls: (f.stalls || []).filter((s) => s.id !== id) })));
    setSelectedIds((ids) => ids.filter((item) => item !== id));
    setSelectedArrow(null);
    setAddingArrow(false);
    setEditTarget(null);
  }

  function applySpaceBatch(action, estado) {
    if (!selectedIds.length || busy) return;
    if (action === 'delete' && !window.confirm(`¿Quitar ${selectedIds.length} espacio${selectedIds.length === 1 ? '' : 's'}? Se aplicará al guardar.`)) return;
    setMsg(null);
    const ids = new Set(selectedIds);
    // Para discapacitado: si todas las seleccionadas ya lo son, lo quita; si no, lo pone.
    const turnOn = action === 'accessible' ? !visibleStalls.filter((s) => ids.has(s.id)).every((s) => s.discapacitado) : false;
    setFloors((prev) => prev.map((f) => {
      if (f.piso !== floor) return f;
      if (action === 'delete') return { ...f, stalls: (f.stalls || []).filter((s) => !ids.has(s.id)) };
      if (action === 'status') {
        const patch = (estado === 'disponible' || estado === 'no_disponible') ? { estado, reservaId: null } : { estado };
        return { ...f, stalls: (f.stalls || []).map((s) => (ids.has(s.id) ? { ...s, ...patch } : s)) };
      }
      if (action === 'accessible') {
        return { ...f, stalls: (f.stalls || []).map((s) => (ids.has(s.id) ? { ...s, discapacitado: turnOn, tipo: turnOn ? 'discapacitado' : 'regular' } : s)) };
      }
      return f;
    }));
    if (action === 'delete') { setSelectedIds([]); setEditTarget(null); }
  }

  function clearAll() {
    if (!window.confirm('¿Vaciar el plano? Se quitarán TODOS los espacios; se aplicará al guardar.')) return;
    setMsg(null);
    setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, stalls: [] })));
    setSelectedIds([]);
    setSelectedArrow(null);
    setAddingArrow(false);
    setEditTarget(null);
  }

  // Persiste todos los cambios locales contra el snapshot tomado al entrar a edición.
  async function guardarCambios() {
    const snap = baseline.current;
    setConfirmSave(false);
    if (!snap) { exitEditMode(); return; }
    setBusy(true);
    setMsg(null);
    const call = async (url, opts) => {
      const data = await api(url, opts);
      if (!data.ok) throw new Error(data.error || 'Error al guardar');
      return data;
    };
    try {
      const curStalls = visibleStalls;
      const curArrows = flowArrows;
      const baseStalls = (snap.stalls || []).filter((s) => s.utilizado !== false);
      const baseArrows = snap.arrows || [];
      const baseStallMap = new Map(baseStalls.map((s) => [s.id, s]));
      const baseArrowMap = new Map(baseArrows.map((a) => [a.id, a]));
      const curStallIds = new Set(curStalls.map((s) => s.id));
      const curArrowIds = new Set(curArrows.map((a) => a.id));
      const statusGroups = { disponible: [], ocupado: [], no_disponible: [] };

      // 1) Espacios eliminados
      const deletedSpaceIds = baseStalls.filter((s) => !curStallIds.has(s.id)).map((s) => s.id);
      if (deletedSpaceIds.length) {
        await call('/admin/api/parqueo/espacios/batch', { method: 'POST', body: JSON.stringify({ ids: deletedSpaceIds, action: 'delete' }) });
      }

      // 2) Espacios nuevos (id temporal)
      for (const s of curStalls) {
        if (!isTempId(s.id)) continue;
        const created = await call('/admin/api/parqueo/espacio', { method: 'POST', body: JSON.stringify({ piso: floor, x: s.x, y: s.y, zona: s.zona || 'A' }) });
        const realId = created.espacio.id;
        if (s.nombre || s.discapacitado || s.ancho != null || s.alto != null) {
          await call(`/admin/api/parqueo/espacio/${encodeURIComponent(realId)}`, { method: 'PUT', body: JSON.stringify({ nombre: s.nombre || '', discapacitado: !!s.discapacitado, ancho: s.ancho ?? null, alto: s.alto ?? null }) });
        }
        if (s.estado && s.estado !== 'disponible' && statusGroups[s.estado]) statusGroups[s.estado].push(realId);
      }

      // 3) Espacios existentes modificados (posición, props, estado)
      for (const s of curStalls) {
        if (isTempId(s.id)) continue;
        const b = baseStallMap.get(s.id);
        if (!b) continue;
        if (s.x !== b.x || s.y !== b.y) {
          await call(`/admin/api/parqueo/espacio/${encodeURIComponent(s.id)}/pos`, { method: 'PUT', body: JSON.stringify({ x: s.x, y: s.y }) });
        }
        if ((s.nombre || '') !== (b.nombre || '') || !!s.discapacitado !== !!b.discapacitado || (s.ancho ?? null) !== (b.ancho ?? null) || (s.alto ?? null) !== (b.alto ?? null)) {
          await call(`/admin/api/parqueo/espacio/${encodeURIComponent(s.id)}`, { method: 'PUT', body: JSON.stringify({ nombre: s.nombre || '', discapacitado: !!s.discapacitado, ancho: s.ancho ?? null, alto: s.alto ?? null }) });
        }
        if (s.estado && s.estado !== b.estado && statusGroups[s.estado]) statusGroups[s.estado].push(s.id);
      }

      // 4) Cambios de estado agrupados
      for (const estado of Object.keys(statusGroups)) {
        if (statusGroups[estado].length) {
          await call('/admin/api/parqueo/espacios/batch', { method: 'POST', body: JSON.stringify({ ids: statusGroups[estado], action: 'status', estado }) });
        }
      }

      // 5) Flechas eliminadas
      for (const a of baseArrows) {
        if (!curArrowIds.has(a.id)) await call(`/admin/api/parqueo/flecha/${encodeURIComponent(a.id)}`, { method: 'DELETE' });
      }

      // 6) Flechas nuevas (id temporal); el POST ya fija pos, rotación y tipo
      for (const a of curArrows) {
        if (!isTempId(a.id)) continue;
        await call('/admin/api/parqueo/flecha', { method: 'POST', body: JSON.stringify({ piso: floor, x: a.x, y: a.y, r: a.r || 0, kind: flowArrowKind(a.kind) }) });
      }

      // 7) Flechas existentes modificadas
      for (const a of curArrows) {
        if (isTempId(a.id)) continue;
        const b = baseArrowMap.get(a.id);
        if (!b) continue;
        if (a.x !== b.x || a.y !== b.y) await call(`/admin/api/parqueo/flecha/${encodeURIComponent(a.id)}/pos`, { method: 'PUT', body: JSON.stringify({ x: a.x, y: a.y }) });
        const patch = {};
        if ((a.r || 0) !== (b.r || 0)) patch.r = a.r || 0;
        if (flowArrowKind(a.kind) !== flowArrowKind(b.kind)) patch.kind = flowArrowKind(a.kind);
        if (Object.keys(patch).length) await call(`/admin/api/parqueo/flecha/${encodeURIComponent(a.id)}`, { method: 'PUT', body: JSON.stringify(patch) });
      }

      // 8) Rutas: las rutas no se editan, sólo se crean o borran.
      const curRoads = roads;
      const baseRoads = snap.roads || [];
      const curRoadIds = new Set(curRoads.map((r) => r.id));
      for (const r of baseRoads) {
        if (!curRoadIds.has(r.id)) await call(`/admin/api/parqueo/ruta/${encodeURIComponent(r.id)}`, { method: 'DELETE' });
      }
      for (const r of curRoads) {
        if (!isTempId(r.id)) continue;
        await call('/admin/api/parqueo/ruta', { method: 'POST', body: JSON.stringify({ piso: floor, points: r.points.map((p) => ({ x: p.x, y: p.y })) }) });
      }

      // 9) Visibilidad del plano de fondo (mostrar/ocultar croquis)
      if (showPlan !== (snap.showPlan !== false)) {
        await call('/admin/api/parqueo/plan-visibilidad', { method: 'POST', body: JSON.stringify({ piso: floor, showPlan }) });
        setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, showPlan })));
      }

      onSaved?.();
      if (autoEdit) {
        finishEditing();
      } else {
        await reload();
        exitEditMode();
        setMsg({ type: 'ok', text: 'Cambios guardados.' });
      }
    } catch (err) {
      // Mantiene el estado local para que se pueda corregir y reintentar.
      setMsg({ type: 'error', text: err.message || 'No se pudieron guardar los cambios.' });
    } finally {
      setBusy(false);
    }
  }

  if (!fl) return <div className="plano-loading">Cargando croquis del plano...</div>;

  return (
    <div className="plano-editor">
      <div className="editor-bar">
        {editMode ? (
          <div className="editor-bar-title"><Pencil size={15} /><span>Editando croquis — Sótano -{floor}</span></div>
        ) : (
          <button type="button" className="btn ghost editar-toggle" onClick={enterEditMode} disabled={busy} title="Editar el croquis">
            <Pencil size={16} />Editar
          </button>
        )}
        <div className="editor-bar-end">
          {!editMode && <button className="btn ghost" onClick={onClose} disabled={busy}>Cerrar</button>}
        </div>
      </div>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <div className="plano-wrap">
        <div className={`plano${showPlan ? '' : ' no-plan'}`} style={{ aspectRatio: String(fl.aspect) }}>
          {showPlan && <img src={PLAN_IMG[fl.plan]} alt={`Plano ${fl.plan}`} draggable="false" />}
          <div
            ref={overlayRef}
            className={`plano-overlay${editMode ? ' editing' : ''}${editMode && addingArrow ? ' adding-arrow' : ''}${editMode && drawingRoad ? ' drawing-road' : ''}`}
            onPointerDown={editMode && !drawingRoad ? startBoxSelect : undefined}
            onPointerMove={editMode && drawingRoad ? moveRoadCursor : undefined}
            onClick={editMode ? (drawingRoad ? addRoadPoint : handleOverlayClick) : undefined}
            onDoubleClick={editMode && drawingRoad ? commitRoad : undefined}
          >
            {visibleStalls.map((st) => (
              <button
                key={st.id}
                type="button"
                className={`pspot${editMode ? ' editable' : ''} ${st.estado || 'disponible'}${st.discapacitado ? ' accessible' : ''}${editMode && selectedSet.has(st.id) ? ' selected' : ''}`}
                style={spotStyle(st, spotLayout)}
                title={st.nombre || st.id}
                onPointerDown={editMode && !drawingRoad ? (e) => startDrag(e, st) : undefined}
                onClick={(e) => e.stopPropagation()}
              />
            ))}
            {selectionBox && (
              <div
                className="selection-marquee"
                style={{
                  left: `${selectionBox.left * 100}%`,
                  top: `${selectionBox.top * 100}%`,
                  width: `${selectionBox.width * 100}%`,
                  height: `${selectionBox.height * 100}%`,
                }}
              />
            )}
          </div>
          <RoadsLayer
            roads={roads}
            draft={drawingRoad && draftRoad ? { points: roadCursor ? [...draftRoad, roadCursor] : draftRoad, vertices: draftRoad } : null}
            editable={editMode && !drawingRoad}
            selected={selectedRoad}
            onSelect={setSelectedRoad}
          />
          {editMode && (
            <div className="plano-tools" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <span className={`sel-count${selectedIds.length ? ' on' : ''}`}>{selectedIds.length ? `${selectedIds.length} sel.` : 'Sin selección'}</span>
              <button className="btn ghost" onClick={() => setShowPlan((v) => !v)} disabled={busy} title={showPlan ? 'Ocultar el plano de fondo' : 'Mostrar el plano de fondo'}>{showPlan ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              <span className="plano-tools-sep" aria-hidden />
              <button className="btn ghost" onClick={() => selectedStall && setEditTarget(selectedStall)} disabled={busy || selectedIds.length !== 1} title={selectedIds.length === 1 ? 'Editar la plaza seleccionada' : 'Seleccioná una sola plaza'}><Pencil size={15} />Editar</button>
              <button className="btn ghost" onClick={() => applySpaceBatch('status', 'disponible')} disabled={busy || !selectedIds.length} title="Marcar como disponible"><Check size={15} />Disponible</button>
              <button className="btn ghost" onClick={() => applySpaceBatch('status', 'ocupado')} disabled={busy || !selectedIds.length} title="Marcar como ocupado"><Car size={15} />Ocupado</button>
              <button className="btn ghost" onClick={() => applySpaceBatch('status', 'no_disponible')} disabled={busy || !selectedIds.length} title="Marcar como no disponible"><EyeOff size={15} />No disp.</button>
              <button className="btn ghost" onClick={() => applySpaceBatch('accessible')} disabled={busy || !selectedIds.length} title="Marcar/desmarcar como plaza de discapacitados"><Accessibility size={15} />Discap.</button>
              <button className="btn ghost danger" onClick={() => (selectedIds.length === 1 ? removeDot(selectedIds[0]) : applySpaceBatch('delete'))} disabled={busy || !selectedIds.length} title="Quitar las plazas seleccionadas"><Trash2 size={15} />Borrar</button>
              <button className="btn ghost" onClick={() => setSelectedIds([])} disabled={busy || !selectedIds.length} title="Deseleccionar">Deselec.</button>
              <span className="plano-tools-sep" aria-hidden />
              <button className={`btn ghost${drawingRoad ? ' active' : ''}`} onClick={toggleDrawRoad} disabled={busy} title="Dibujar ruta: click para colocar cada punto, doble click (o este botón) para terminar"><Route size={15} />{drawingRoad ? 'Terminar ruta' : 'Ruta'}</button>
              <button className="btn ghost danger" onClick={() => selectedRoad && removeRoad(selectedRoad)} disabled={busy || !selectedRoad} title="Borrar la ruta seleccionada"><Trash2 size={15} />Borrar ruta</button>
              <span className="plano-tools-sep" aria-hidden />
              <button className="btn ghost" onClick={cancelEditMode} disabled={busy}>Cancelar</button>
              <button className="btn" onClick={() => setConfirmSave(true)} disabled={busy}><Check size={15} />{busy ? 'Guardando…' : 'Guardar'}</button>
            </div>
          )}
        </div>
      </div>
      {editTarget && (
        <EditSpaceModal
          stall={editTarget}
          layout={spotLayout}
          onClose={() => setEditTarget(null)}
          onApply={(patch) => {
            setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : {
              ...f,
              stalls: (f.stalls || []).map((s) => (s.id === editTarget.id ? {
                ...s,
                nombre: patch.nombre ? patch.nombre : null,
                discapacitado: !!patch.discapacitado,
                tipo: patch.discapacitado ? 'discapacitado' : 'regular',
                ancho: patch.ancho ?? null,
                alto: patch.alto ?? null,
              } : s)),
            })));
            setEditTarget(null);
          }}
        />
      )}
      {confirmSave && (
        <Modal title="Guardar cambios" onClose={() => !busy && setConfirmSave(false)}>
          <p className="muted">¿Querés guardar los cambios del croquis en Sótano -{floor}?</p>
          <div className="actions left">
            <button className="btn" onClick={guardarCambios} disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
            <button className="btn ghost" onClick={() => setConfirmSave(false)} disabled={busy}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function pctValue(value) {
  return String(Math.round(Number(value || 0) * 1000) / 10);
}

function EditSpaceModal({ stall, layout, onClose, onApply }) {
  const current = layout.get(stall.id) || { w: stall.ancho || 0.032, h: stall.alto || 0.022 };
  const [form, setForm] = useState({
    nombre: stall.nombre || '',
    discapacitado: Boolean(stall.discapacitado),
    ancho: pctValue(current.w),
    alto: pctValue(current.h),
  });
  const [msg, setMsg] = useState(null);
  function save() {
    setMsg(null);
    const ancho = Number(form.ancho) / 100;
    const alto = Number(form.alto) / 100;
    if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) return setMsg({ type: 'error', text: 'Ingresa un tamano valido.' });
    onApply({ nombre: form.nombre, discapacitado: form.discapacitado, ancho, alto });
  }
  function resetSize() {
    setMsg(null);
    onApply({ nombre: form.nombre, discapacitado: form.discapacitado, ancho: null, alto: null });
  }
  return (
    <Modal title={`Editar plaza ${stall.id}`} onClose={onClose}>
      <label>Nombre</label>
      <input value={form.nombre} maxLength={32} placeholder={stall.id} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      <label className="check-row"><input type="checkbox" checked={form.discapacitado} onChange={(e) => setForm({ ...form, discapacitado: e.target.checked })} /> Plaza de discapacitados</label>
      <div className="two">
        <div><label>Ancho (%)</label><input type="number" min="0.6" max="12" step="0.1" value={form.ancho} onChange={(e) => setForm({ ...form, ancho: e.target.value })} /></div>
        <div><label>Alto (%)</label><input type="number" min="0.6" max="12" step="0.1" value={form.alto} onChange={(e) => setForm({ ...form, alto: e.target.value })} /></div>
      </div>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <div className="actions left">
        <button className="btn" onClick={save}>Aplicar</button>
        <button className="btn ghost" onClick={resetSize}>Tamano automatico</button>
      </div>
    </Modal>
  );
}

function ParkingGrid({ spaces, floor, onSpace, admin = false, reservations = [], me }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const grouped = { A: [], B: [] };
  spaces.filter((s) => s.piso === floor).forEach((s) => grouped[s.zona]?.push(s));
  Object.values(grouped).forEach((list) => list.sort((a, b) => a.num - b.num));
  const reservationById = new Map(reservations.map((r) => [r.id, r]));
  const total = grouped.A.length + grouped.B.length;

  const stall = (space, open) => {
    const reservation = reservationById.get(space.reservaId);
    const session = reservation || space.reserva;
    const mine = reservation && reservation.userId === me?.id;
    const expired = session && new Date(session.fin).getTime() <= now;
    return (
      <button
        key={space.id}
        className={`stall ${space.estado} open-${open} ${expired ? 'vencido' : ''} ${mine ? 'mine' : ''}`}
        onClick={() => onSpace?.(space, reservation)}
        title={admin && reservation ? `${space.id} · ${reservation.placa}${expired ? ' · vencido' : ''}` : `${space.id} · ${expired ? 'tiempo vencido' : space.estado}`}
      >
        {space.estado === 'ocupado' && <Car size={11} aria-hidden />}
        <span>{space.num}</span>
        {session && <ExpirationBar start={session.inicio} end={session.fin} />}
      </button>
    );
  };
  const strip = (zone, from, to, open) => (
    <div className="stall-strip">{grouped[zone].slice(from, to).map((s) => stall(s, open))}</div>
  );
  const lane = (dir) => (
    <div className={`lane ${dir}`} aria-hidden>
      <span>{dir === 'left' ? '←' : '↓'}</span>
    </div>
  );

  return (
    <div className="lot-wrap">
      <div className="lot">
        <div className="lot-banner">Nivel {floor}</div>
        <div className="lot-head"><span>Zona A</span><span /><span>Zona B</span></div>
        <div className="lot-row">
          {strip('A', 0, 25, 'down')}
          <div className="lot-core stairs"><span>Gradas</span></div>
          {strip('B', 0, 25, 'down')}
        </div>
        {lane('right')}
        <div className="lot-row">
          <div className="bay-col">
            {strip('A', 25, 50, 'up')}
            <div className="bay-divider" />
            {strip('A', 50, 75, 'down')}
          </div>
          <div className="lot-core ramp"><span>Rampa<br />{floor === 1 ? '↑ N2' : '↓ N1'}</span></div>
          <div className="bay-col">
            {strip('B', 25, 50, 'up')}
            <div className="bay-divider" />
            {strip('B', 50, 75, 'down')}
          </div>
        </div>
        {lane('left')}
        <div className="lot-row">
          {strip('A', 75, 100, 'up')}
          <div className="lot-core entry"><span>Entrada ↓</span></div>
          {strip('B', 75, 100, 'up')}
        </div>
        <div className="lot-foot">Total nivel {floor}: {total} espacios</div>
      </div>
    </div>
  );
}

function PublicParking() {
  const [spaces, setSpaces] = useState([]);
  const [floor, setFloor] = useState(1);
  const [selected, setSelected] = useState(null);
  const [showFlow, setShowFlow] = useState(true);
  const [plate, setPlate] = useState('');
  const [lookup, setLookup] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [modal, setModal] = useState(null);

  const refresh = async () => {
    const data = await api('/api/parqueo/publico/estado');
    if (data.ok) setSpaces(data.espacios);
  };
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, []);

  const available = spaces.filter((s) => s.piso === floor && s.estado === 'disponible').length;
  const total = spaces.filter((s) => s.piso === floor).length;

  async function search() {
    setError('');
    setLookup(null);
    const value = plate.trim().toUpperCase();
    if (!value) return setError('Ingresa la placa del vehiculo.');
    const data = await api('/api/parqueo/publico/consulta', { method: 'POST', body: JSON.stringify({ placa: value }) });
    if (!data.ok) return setError(data.error);
    setLookup(data.info);
  }
  async function resend() {
    if (!lookup) return;
    const data = await api('/api/parqueo/publico/reenviar', { method: 'POST', body: JSON.stringify({ placa: lookup.placa }) });
    if (!data.ok) return setError(data.error);
    setLookup({ ...lookup, resendMessage: `Correo reenviado a ${data.correo}.` });
  }

  return (
    <>
      
      <main className="page">
        <p className="eyebrow">Modulo de parqueo</p>
        <h1>Parqueo del estadio</h1>
        <p className="sub">Consulta disponibilidad, toma un espacio como invitado y busca tu reserva por placa.</p>
        <div className="notice">Las reservas son exclusivas para socios y personal del club. <a href="/admin">Inicia sesion</a> si tienes una cuenta.</div>

        <section className="search-panel">
          <div>
            <h2>Buscar mi Carro</h2>
            <p>Ingresa la placa para confirmar la reserva y ver el correo asociado de forma segura.</p>
            <label>Placa del vehiculo</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={12} placeholder="ABC-123" />
            <button className="btn" onClick={search}>Buscar mi Carro</button>
            {error && <div className="error">{error}</div>}
          </div>
          <ReservationResult lookup={lookup} onResend={resend} onPay={() => setPaying(true)} />
        </section>

        <Toolbar floor={floor} setFloor={setFloor} stats={`${available}/${total} libres en Sótano -${floor}`} counts={legendCounts(spaces, floor)} />
        <PlanoCroquis spaces={spaces} floor={floor} showFlow={showFlow} onSpace={(space) => space.estado === 'disponible' && setSelected(space)} />
      </main>
      {selected && <TakeSpaceModal space={selected} onClose={() => setSelected(null)} onDone={(m) => { setModal(m); setSelected(null); refresh(); }} />}
      {paying && lookup && <PaymentModal info={lookup} onClose={() => setPaying(false)} onDone={(receipt) => { setLookup({ receipt }); setPaying(false); refresh(); }} />}
      {modal && <MessageModal title={modal.title} text={modal.text} onClose={() => setModal(null)} />}
    </>
  );
}

function ReservationResult({ lookup, onResend, onPay }) {
  if (!lookup) return <div className="result empty">Busca una placa para ver el resultado a la par.</div>;
  if (lookup.receipt) {
    return (
      <div className="result">
        <strong>Pago registrado</strong>
        <div className="total"><span>Transaccion<br /><small>{lookup.receipt.transaccion}</small></span><b>{money(lookup.receipt.monto)}</b></div>
        <p>El espacio quedo liberado y el recibo fue enviado a {lookup.receipt.correo}.</p>
      </div>
    );
  }
  return (
    <div className="result">
      <strong>Reserva encontrada</strong>
      <div className="facts">
        <div><span>Espacio</span>{lookup.espacioId}</div>
        <div><span>Estado</span>{lookup.estado.toUpperCase()}</div>
        <div><span>Placa</span>{lookup.placa}</div>
        <div><span>Correo</span>{lookup.correo}</div>
        <div><span>Desde</span>{fmtDate(lookup.inicio)}</div>
        <div><span>Hasta</span>{fmtDate(lookup.fin)}</div>
      </div>
      <div className="total"><span>Total a pagar<br /><small>{lookup.horas}h a {money(lookup.tarifa)}/h</small></span><b>{money(lookup.monto)}</b></div>
      <div className="actions">
        <button className="btn" onClick={onPay}>Pagar parqueo</button>
        <button className="btn ghost" onClick={onResend}><Mail size={16} />Reenviar correo</button>
      </div>
      {lookup.resendMessage && <p className="ok">{lookup.resendMessage}</p>}
      <p className="security">Por seguridad, el codigo de reserva y el QR solo se muestran dentro del area autenticada.</p>
    </div>
  );
}

// Conteo por categoría del croquis, alineado con el color que se dibuja en cada plaza.
function legendCounts(spaces, floor, reservations = []) {
  const now = Date.now();
  const resById = new Map(reservations.map((r) => [r.id, r]));
  const counts = { disponible: 0, discapacitado: 0, reservado: 0, ocupado: 0, vencido: 0 };
  spaces.filter((s) => s.piso === floor).forEach((s) => {
    const session = resById.get(s.reservaId) || s.reserva;
    const expired = session && new Date(session.fin).getTime() <= now;
    if (expired) counts.vencido += 1;
    else if (s.estado === 'ocupado') counts.ocupado += 1;
    else if (s.estado === 'reservado') counts.reservado += 1;
    else if (s.estado === 'disponible') counts[s.discapacitado ? 'discapacitado' : 'disponible'] += 1;
  });
  return counts;
}

function Toolbar({ floor, setFloor, stats, counts, children }) {
  const n = (key) => (counts ? <b className="legend-count">{counts[key]}</b> : null);
  return (
    <div className="toolbar">
      <div className="tabs">
        {[1, 2].map((p) => <button key={p} className={floor === p ? 'active' : ''} onClick={() => setFloor(p)}>Sótano -{p}</button>)}
      </div>
      <div className="legend">
        <span><i className="green" />Disponible{n('disponible')}</span>
        <span><i className="blue" />Discapacitados{n('discapacitado')}</span>
        <span><i className="orange" />Reservado{n('reservado')}</span>
        <span><i className="red" />Ocupado{n('ocupado')}</span>
        <span><i className="wine" />Tiempo vencido{n('vencido')}</span>
        <span>{stats}</span>
      </div>
      {children && <div className="toolbar-extra">{children}</div>}
    </div>
  );
}

function FlowToggleButton({ showFlow, setShowFlow }) {
  return (
    <button
      type="button"
      className={`btn ghost${showFlow ? ' active' : ''}`}
      onClick={() => setShowFlow((value) => !value)}
      aria-pressed={showFlow}
      title={showFlow ? 'Ocultar flechas' : 'Mostrar flechas'}
    >
      {showFlow ? <EyeOff size={16} /> : <Eye size={16} />}
      {showFlow ? 'Ocultar flechas' : 'Mostrar flechas'}
    </button>
  );
}

function TakeSpaceModal({ space, onClose, onDone }) {
  const [form, setForm] = useState({ placa: '', duracion: '60', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit() {
    setError('');
    if (!form.placa.trim()) return setError('Ingresa la placa del vehiculo.');
    if (!form.email.trim()) return setError('Ingresa un correo para enviar el QR.');
    setLoading(true);
    const data = await api('/api/parqueo/publico/ocupar', { method: 'POST', body: JSON.stringify({ espacioId: space.id, placa: form.placa.trim().toUpperCase(), duracion: Number(form.duracion), email: form.email.trim() }) });
    setLoading(false);
    if (!data.ok) return setError(data.error);
    onDone({ title: 'Espacio tomado', text: data.sesion.emailSent ? `QR enviado a ${data.sesion.correo}.` : 'No se pudo enviar el correo ahora. La reserva quedo registrada.' });
  }
  return (
    <Modal title={space.id} onClose={onClose}>
      <p className="muted">Disponible · Piso {space.piso} · Zona {space.zona}</p>
      <label>Placa del vehiculo</label>
      <input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} maxLength={12} autoFocus />
      <label>Tiempo estimado</label>
      <select value={form.duracion} onChange={(e) => setForm({ ...form, duracion: e.target.value })}>
        <option value="30">30 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option><option value="240">4 horas</option><option value="480">8 horas</option>
      </select>
      <label>Correo para recibir el QR</label>
      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit} disabled={loading}>{loading ? 'Registrando...' : 'Tomar espacio'}</button>
    </Modal>
  );
}

function PaymentModal({ info, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', cardNumber: '', exp: '', cvv: '' });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  async function pay() {
    setMessage(null);
    setLoading(true);
    const data = await api('/api/parqueo/publico/pagar', { method: 'POST', body: JSON.stringify({ placa: info.placa, pago: form }) });
    setLoading(false);
    if (!data.ok) return setMessage({ type: 'error', text: data.error || 'No se pudo realizar la transaccion.' });
    setMessage({ type: 'ok', text: `Pago exitoso. Recibo enviado a ${data.recibo.correo}.` });
    setTimeout(() => onDone(data.recibo), 850);
  }
  return (
    <Modal title="Pagar parqueo" onClose={onClose}>
      <div className="pay-summary">Espacio <b>{info.espacioId}</b> · Placa <b>{info.placa}</b><br />Tiempo cobrado: <b>{info.horas}h</b><br />Total: <b>{money(info.monto)}</b><br />Recibo a: <b>{info.correo}</b></div>
      <label>Nombre en la tarjeta</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <label>Numero de tarjeta</label><input inputMode="numeric" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} />
      <div className="two"><div><label>Expira</label><input placeholder="MM/AA" value={form.exp} onChange={(e) => setForm({ ...form, exp: e.target.value.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2') })} /></div><div><label>CVV</label><input inputMode="numeric" value={form.cvv} onChange={(e) => setForm({ ...form, cvv: e.target.value })} /></div></div>
      {message && <div className={message.type === 'ok' ? 'okbox' : 'error'}>{message.text}</div>}
      <button className="btn" onClick={pay} disabled={loading}>{loading ? 'Procesando...' : `Pagar ${money(info.monto)}`}</button>
    </Modal>
  );
}

const WIP_MODULES = {
  '/admin/restaurantes': {
    icon: UtensilsCrossed,
    title: 'Gestion de restaurantes',
    desc: 'Administracion de los puntos de comida del estadio: locales, menus, precios e inventario por evento.',
    items: ['Catalogo de locales y menus por partido', 'Control de inventario y precios', 'Reportes de ventas por evento'],
  },
  '/admin/proveedores': {
    icon: Truck,
    title: 'Gestion de proveedores',
    desc: 'Registro y seguimiento de proveedores del club: contratos, ordenes de compra y pagos.',
    items: ['Directorio de proveedores y contactos', 'Ordenes de compra y entregas', 'Historial de contratos y pagos'],
  },
};

function UnderConstruction({ modulo }) {
  const Icon = modulo.icon;
  return (
    <main className="page">
      <p className="eyebrow">Modulo en construccion</p>
      <h1>{modulo.title}</h1>
      <p className="sub">{modulo.desc}</p>
      <div className="wip-card">
        <Icon size={36} />
        <div>
          <span className="pill">En construccion</span>
          <p>Lo que incluira este modulo:</p>
          <ul>{modulo.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
    </main>
  );
}

// Un usuario tiene acceso al panel admin si tiene algún rol operativo elevado.
// Los socios (todos sus roles en 'socio'/'ninguno') solo navegan el sitio público autenticados.
function isAdminUser(user) {
  if (!user) return false;
  return (
    user.parkingRole === 'admin' ||
    user.couponRole === 'admin' ||
    user.couponRole === 'patrocinador' ||
    (user.eventsRole && user.eventsRole !== 'ninguno')
  );
}

function AdminApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    api('/api/session').then((data) => { setUser(data.user); setLoading(false); });
    const onPop = () => { setRoute(location.pathname); setMenuOpen(false); };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [menuOpen]);
  const navigate = (path) => { history.pushState(null, '', path); setRoute(path); setMenuOpen(false); };
  async function logout() { await api('/admin/logout', { method: 'POST', body: '{}' }); location.href = '/admin'; }
  if (loading) return <main className="page"><p>Cargando...</p></main>;
  if (!user) return <AdminLogin />;
  // Un socio autenticado no entra al panel: se le devuelve al sitio público ya logueado.
  if (!isAdminUser(user)) { location.replace('/'); return <main className="page"><p>Redirigiendo...</p></main>; }
  return (
    <div className={menuOpen ? 'admin-shell nav-open' : 'admin-shell'}>
      <button className="admin-nav-backdrop" aria-label="Cerrar menu" onClick={() => setMenuOpen(false)} />
      <aside aria-label="Menu administrativo">
            <div className="admin-nav-head">
              <a className="side-brand" onClick={() => navigate('/admin')}><img src="/brand/logo-shield.png" alt="" /><b>Herediano</b><span>Admin</span></a>
              <button className="admin-nav-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menu"><X size={18} /></button>
            </div>
            <button className={route === '/admin' ? 'active' : ''} onClick={() => navigate('/admin')}><Shield size={17} />Resumen</button>
            <button className={route === '/admin/parqueo' ? 'active' : ''} onClick={() => navigate('/admin/parqueo')}><Car size={17} />Gestion de parqueo</button>
            {user.eventsRole && user.eventsRole !== 'ninguno' && <button className={route === '/admin/entradas' ? 'active' : ''} onClick={() => navigate('/admin/entradas')}><CalendarDays size={17} />Gestion de entradas</button>}
            <button className={route === '/admin/cuponera' ? 'active' : ''} onClick={() => navigate('/admin/cuponera')}><Ticket size={17} />Cuponera</button>
            <button className={route === '/admin/usuarios' ? 'active' : ''} onClick={() => navigate('/admin/usuarios')}><Users size={17} />Gestion de usuarios</button>
            <button className={route === '/admin/web' ? 'active' : ''} onClick={() => navigate('/admin/web')}><Globe size={17} />Gestion de la pagina web</button>
            {Object.entries(WIP_MODULES).map(([path, mod]) => {
              const Icon = mod.icon;
              return <button key={path} className={route === path ? 'active' : ''} onClick={() => navigate(path)}><Icon size={17} />{mod.title}</button>;
            })}
            {user.isSuperAdmin && <button className={route === '/admin/analytics' ? 'active' : ''} onClick={() => navigate('/admin/analytics')}><Sparkles size={17} />Analytics</button>}
            <p className="side-section-label">Contenido del sitio</p>
            <button className={route === '/admin/jugadores' ? 'active' : ''} onClick={() => navigate('/admin/jugadores')}><Users2 size={17} />Jugadores</button>
            <button className={route === '/admin/noticias' ? 'active' : ''} onClick={() => navigate('/admin/noticias')}><Newspaper size={17} />Noticias</button>
            <button className={route === '/admin/partidos' ? 'active' : ''} onClick={() => navigate('/admin/partidos')}><Trophy size={17} />Partidos</button>
            <button className={route === '/admin/sponsors' ? 'active' : ''} onClick={() => navigate('/admin/sponsors')}><ShoppingBag size={17} />Sponsors</button>
            <button className={route === '/admin/mensajes' ? 'active' : ''} onClick={() => navigate('/admin/mensajes')}><MessageSquare size={17} />Mensajes</button>
      </aside>
      <section className="admin-main">
        <AdminTopBar user={user} onLogout={logout} onMenu={() => setMenuOpen(true)} />
        {route === '/admin/parqueo' ? <AdminParking user={user} /> : route === '/admin/entradas' ? <AdminEntradas user={user} /> : route === '/admin/cuponera' ? <AdminCoupons user={user} /> : route === '/admin/usuarios' ? <AdminUsers /> : route === '/admin/analytics' ? <AdminAnalytics user={user} /> : route === '/admin/web' ? <AdminWeb /> : route === '/admin/jugadores' ? <AdminJugadores /> : route === '/admin/noticias' ? <AdminNoticias /> : route === '/admin/partidos' ? <AdminPartidos /> : route === '/admin/sponsors' ? <AdminSponsors /> : route === '/admin/mensajes' ? <AdminMensajes /> : WIP_MODULES[route] ? <UnderConstruction modulo={WIP_MODULES[route]} /> : <AdminHome user={user} navigate={navigate} />}
      </section>
    </div>
  );
}

function AdminLogin() {
  const [form, setForm] = useState({ usuario: '', clave: '' });
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    const data = await api('/admin/sign-in', { method: 'POST', body: JSON.stringify(form) });
    if (!data.ok) return setError(data.error);
    // Admin → panel de administración; socio → de vuelta al sitio público, ya autenticado.
    location.href = isAdminUser(data.user) ? '/admin' : '/';
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <img src="/brand/logo-shield.png" alt="" />
        <h1>Club Sport Herediano</h1>
        <label>Usuario o correo</label><input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} autoFocus />
        <label>Contrasena</label><input type="password" value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} />
        {error && <div className="error">{error}</div>}
        <button className="btn">Entrar</button>
      </form>
    </main>
  );
}

function AdminHome({ user, navigate }) {
  return (
    <main className="page">
      <p className="eyebrow">Centro de mando</p>
      <h1>Administracion CSH</h1>
      <p className="sub">Sesion activa de {user.name}. Selecciona un modulo para operar.</p>
      <div className="module-grid">
        <button onClick={() => navigate('/admin/parqueo')}><Car />Gestion de parqueo</button>
        {user.eventsRole && user.eventsRole !== 'ninguno' && <button onClick={() => navigate('/admin/entradas')}><CalendarDays />Gestion de entradas</button>}
        <button onClick={() => navigate('/admin/cuponera')}><BadgePercent />Cuponera</button>
        <button onClick={() => navigate('/admin/usuarios')}><Users />Gestion de usuarios</button>
        <button onClick={() => navigate('/admin/web')}><Globe />Gestion de la pagina web</button>
        {Object.entries(WIP_MODULES).map(([path, mod]) => {
          const Icon = mod.icon;
          return <button key={path} className="wip" onClick={() => navigate(path)}><Icon /><span>{mod.title}<small>En construccion</small></span></button>;
        })}
        <button onClick={() => navigate('/admin/jugadores')}><Users2 />Jugadores</button>
        <button onClick={() => navigate('/admin/noticias')}><Newspaper />Noticias</button>
        <button onClick={() => navigate('/admin/partidos')}><Trophy />Partidos</button>
        <button onClick={() => navigate('/admin/sponsors')}><ShoppingBag />Sponsors</button>
        <button onClick={() => navigate('/admin/mensajes')}><MessageSquare />Mensajes</button>
      </div>
    </main>
  );
}

const HERO_ORIGINAL_IMG = '/brand/hero/champions-bw.jpg';

function AdminWeb() {
  const [config, setConfig] = useState(null);
  const [defaults, setDefaults] = useState({});
  const [form, setForm] = useState({ kicker: '', title: '', number: '', sub: '' });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await api('/admin/api/web');
    if (!data.ok) return setMsg({ type: 'error', text: data.error || 'No se pudo cargar la configuracion' });
    setConfig(data.config);
    setDefaults(data.defaults);
    setForm({
      kicker: data.config.kicker || data.defaults.kicker,
      title: data.config.title || data.defaults.title,
      number: data.config.number || data.defaults.number,
      sub: data.config.sub || data.defaults.sub,
    });
  };
  useEffect(() => { load(); }, []);

  async function saveTexts() {
    setMsg(null);
    setSaving(true);
    const data = await api('/admin/api/web', { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setConfig(data.config);
    setMsg({ type: 'ok', text: 'Textos del hero guardados. Ya estan visibles en el sitio.' });
  }
  async function uploadImage(file) {
    if (!file) return;
    setMsg(null);
    setSaving(true);
    const response = await fetch('/admin/api/web/hero-imagen', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    });
    const data = await response.json().catch(() => ({ ok: false, error: 'Respuesta invalida' }));
    setSaving(false);
    if (!response.ok || !data.ok) return setMsg({ type: 'error', text: data.error || `Error ${response.status}` });
    setConfig(data.config);
    setMsg({ type: 'ok', text: 'Imagen de fondo actualizada.' });
  }
  async function removeImage() {
    setMsg(null);
    const data = await api('/admin/api/web/hero-imagen', { method: 'DELETE' });
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setConfig(data.config);
    setMsg({ type: 'ok', text: 'Se restauro la imagen original del sitio.' });
  }
  function restoreTexts() { setForm({ ...defaults }); }

  if (!config) return <main className="page"><p>Cargando...</p></main>;
  const heroImg = config.imageVersion ? `/site-assets/hero?v=${config.imageVersion}` : HERO_ORIGINAL_IMG;
  return (
    <main className="page">
      <p className="eyebrow">Contenido del sitio publico</p>
      <h1>Gestion de la pagina web</h1>
      <p className="sub">Edita el hero de la portada (`/`): imagen de fondo y textos. Los cambios se aplican de inmediato en el sitio.</p>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <div className="web-editor">
        <section className="hero-preview" style={{ backgroundImage: `url(${heroImg})` }}>
          <div className="hero-preview-body">
            <span className="hero-kicker">{form.kicker}</span>
            <strong className="hero-title">{form.title}<b>{form.number}</b></strong>
            <em className="hero-sub">{form.sub}</em>
          </div>
          <span className="hero-tag">{config.imageVersion ? 'Imagen personalizada' : 'Imagen original'}</span>
        </section>
        <section className="web-form">
          <h2>Textos del hero</h2>
          <label>Linea superior</label>
          <input value={form.kicker} onChange={(e) => setForm({ ...form, kicker: e.target.value })} maxLength={120} />
          <div className="two">
            <div>
              <label>Titulo</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={40} />
            </div>
            <div>
              <label>Numero</label>
              <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} maxLength={10} />
            </div>
          </div>
          <label>Frase</label>
          <input value={form.sub} onChange={(e) => setForm({ ...form, sub: e.target.value })} maxLength={120} />
          <div className="actions left">
            <button className="btn" onClick={saveTexts} disabled={saving}>{saving ? 'Guardando...' : 'Guardar textos'}</button>
            <button className="btn ghost" onClick={restoreTexts}>Restaurar originales</button>
          </div>
          <h2 className="web-form-img">Imagen de fondo</h2>
          <p className="muted">PNG, JPG, WebP o AVIF · maximo 8 MB. Se recomienda una foto horizontal de al menos 1920px.</p>
          <div className="actions left">
            <label className="btn ghost file-btn">
              Subir imagen
              <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(e) => { uploadImage(e.target.files[0]); e.target.value = ''; }} />
            </label>
            {config.imageVersion && <button className="btn ghost" onClick={removeImage}>Quitar imagen personalizada</button>}
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [target, setTarget] = useState(null);
  const [detail, setDetail] = useState(null);
  useEffect(() => { api('/admin/api/users').then((data) => data.ok && setUsers(data.users)); }, []);
  return (
    <main className="page">
      <p className="eyebrow">Cuentas y permisos</p><h1>Gestion de usuarios</h1>
      <UsersAnalytics users={users} />
      <div className="table"><table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Area</th><th>Estado</th><th></th></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.id} className="clickable-row" onClick={() => setDetail(u)}>
            <td><button className="link-cell" onClick={(e) => { e.stopPropagation(); setDetail(u); }}>{u.name}</button></td>
            <td>{u.email}</td>
            <td>{u.role}</td>
            <td>{u.area}</td>
            <td><span className={`pill ${u.status.toLowerCase()}`}>{u.status}</span></td>
            <td className="row-actions" onClick={(e) => e.stopPropagation()}>{u.passwordManagedByEnv ? <span className="muted">Clave por entorno</span> : <button className="btn ghost" onClick={() => setTarget(u)}>Cambiar clave</button>}</td>
          </tr>
        ))}</tbody>
      </table></div>
      {detail && <UserDetailModal user={detail} onClose={() => setDetail(null)} onChangePassword={() => { setTarget(detail); setDetail(null); }} />}
      {target && <PasswordModal user={target} onClose={() => setTarget(null)} />}
    </main>
  );
}

function UsersAnalytics({ users }) {
  const miembros = users.filter((u) => u.profile?.metricas);
  if (!miembros.length) return null;
  const m = (u) => u.profile.metricas;
  const sum = (f) => miembros.reduce((acc, u) => acc + (f(u) || 0), 0);
  const avg = (f) => Math.round(sum(f) / miembros.length);
  const socios = miembros.filter((u) => u.profile.category === 'socio').length;
  const fans = miembros.filter((u) => u.profile.category === 'aficionado').length;
  return (
    <div className="user-stats">
      <div><span>Socios</span><b>{socios}</b></div>
      <div><span>Aficionados</span><b>{fans}</b></div>
      <div><span>Asistencia media</span><b>{avg((u) => m(u).asistenciaPct)}%</b></div>
      <div><span>Partidos prom.</span><b>{avg((u) => m(u).partidosAsistidos)}</b></div>
      <div><span>Gasto acumulado</span><b>{money(sum((u) => m(u).gastoTotalCrc))}</b></div>
      <div><span>Puntos fidelidad</span><b>{sum((u) => m(u).puntosFidelidad).toLocaleString('es-CR')}</b></div>
    </div>
  );
}

function UserDetailModal({ user, onClose, onChangePassword }) {
  const p = user.profile;
  const dl = (label, value) => <div><span>{label}</span><b>{value}</b></div>;
  const permisos = `parqueo:${user.parkingRole} · cupones:${user.couponRole}${user.eventsRole !== 'ninguno' ? ` · eventos:${user.eventsRole}` : ''}`;
  return (
    <Modal title={user.name} onClose={onClose} wide>
      <div className="user-detail-head">
        <span className={`pill ${user.status.toLowerCase()}`}>{user.status}</span>
        <span className="pill">{user.role}</span>
        <span className="muted">{user.area}</span>
      </div>
      {!p ? <p className="muted">Esta cuenta no tiene perfil ampliado.</p> : <>
        <h3 className="detail-section"><Users size={15} />Informacion personal</h3>
        <div className="detail-grid">
          {dl('Telefono', p.personal.telefono)}
          {dl('Cedula', p.personal.cedula)}
          {dl('Nacimiento', p.personal.nacimiento)}
          {dl('Provincia', p.personal.provincia)}
          {dl('Genero', p.personal.genero)}
        </div>
        <h3 className="detail-section"><Activity size={15} />Cuenta y app</h3>
        <div className="detail-grid">
          {dl('Correo', user.email)}
          {dl('Usuario', user.username)}
          {dl('Registrado', p.app.registrado)}
          {dl('Ultimo acceso', p.app.ultimoAcceso)}
          {dl('Plataforma', p.app.plataforma)}
          {dl('Notificaciones', p.app.notificaciones ? 'Activas' : 'Inactivas')}
          {dl('Sesiones (30d)', p.app.sesiones30d)}
          {dl('Permisos', permisos)}
        </div>
        {p.metricas && <>
          <h3 className="detail-section"><TrendingUp size={15} />Metricas {p.category === 'socio' ? 'del socio' : 'del aficionado'}</h3>
          <div className="detail-grid">
            {p.metricas.numeroMiembro && dl('No. miembro', p.metricas.numeroMiembro)}
            {p.metricas.membresia && dl('Membresia', p.metricas.membresia)}
            {dl('Antiguedad', `${p.metricas.antiguedadMeses} meses`)}
            {dl('Partidos asistidos', p.metricas.partidosAsistidos)}
            {dl('% asistencia', `${p.metricas.asistenciaPct}%`)}
            {dl('Entradas compradas', p.metricas.entradasCompradas)}
            {dl('Gasto total', money(p.metricas.gastoTotalCrc))}
            {dl('Cupones usados', p.metricas.cuponesUsados)}
            {dl('Reservas parqueo', p.metricas.reservasParqueo)}
            {dl('Puntos fidelidad', p.metricas.puntosFidelidad.toLocaleString('es-CR'))}
          </div>
        </>}
      </>}
      {!user.passwordManagedByEnv && <button className="btn ghost" style={{ marginTop: 22 }} onClick={onChangePassword}>Cambiar clave</button>}
    </Modal>
  );
}
function PasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  async function save() {
    if (password.length < 8) return setMsg({ type: 'error', text: 'La contrasena debe tener al menos 8 caracteres.' });
    if (password !== confirm) return setMsg({ type: 'error', text: 'Las contrasenas no coinciden.' });
    const data = await api('/admin/api/users/password', { method: 'POST', body: JSON.stringify({ userId: user.id, password }) });
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setMsg({ type: 'ok', text: `Clave actualizada para ${user.name}.` });
  }
  return <Modal title="Cambiar clave" onClose={onClose}><p className="muted">{user.email}</p><label>Nueva contrasena</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><label>Confirmar</label><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />{msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}<button className="btn" onClick={save}>Guardar clave</button></Modal>;
}

const ANALYTICS_LOG_LABELS = { query_usuarios: 'Usuarios', query_entradas_log: 'Log de entradas', query_parqueo_eventos: 'Eventos de parqueo' };

function AnalyticsLogBlock({ log }) {
  const rows = Array.isArray(log.rows) ? log.rows : [];
  const filtros = log.input && Object.keys(log.input).length ? JSON.stringify(log.input) : 'sin filtros';
  return (
    <div className="analytics-log">
      <div className="analytics-log-head">
        <span className="pill">{ANALYTICS_LOG_LABELS[log.tool] || log.tool}</span>
        <span className="muted">{filtros} · {rows.length} registro{rows.length === 1 ? '' : 's'}</span>
      </div>
      {rows.length === 0
        ? <p className="muted">Sin coincidencias.</p>
        : <pre className="analytics-log-rows">{rows.map((r) => JSON.stringify(r)).join('\n')}</pre>}
    </div>
  );
}

function AdminAnalytics() {
  const [pregunta, setPregunta] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function ask(e) {
    if (e && e.preventDefault) e.preventDefault();
    const q = pregunta.trim();
    if (!q || loading) return;
    setLoading(true); setError(null); setResult(null);
    const d = await api('/admin/api/analytics/query', { method: 'POST', body: JSON.stringify({ pregunta: q }) });
    setLoading(false);
    if (!d.ok) return setError(d.error || 'No se pudo procesar la consulta.');
    setResult(d);
  }

  const ejemplos = [
    '¿Qué socio tiene más puntos de fidelidad?',
    '¿Cuántas cortesías se emitieron y a quién?',
    '¿Qué placas entraron al parqueo recientemente?',
  ];

  return (
    <main className="page">
      <p className="eyebrow">Inteligencia de datos</p>
      <h1>Analytics</h1>
      <p className="sub">Preguntá en lenguaje natural sobre personas, entradas y parqueo. Analytics responde y muestra los registros que analizó.</p>

      <form className="analytics-prompt" onSubmit={ask}>
        <textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Ej: ¿Qué socio gastó más este año?"
          rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(e); } }}
        />
        <button className="btn" type="submit" disabled={loading}><Sparkles size={16} />{loading ? 'Analizando…' : 'Preguntar'}</button>
      </form>
      <div className="analytics-examples">
        {ejemplos.map((ej) => <button key={ej} type="button" className="chip chip-ghost" onClick={() => setPregunta(ej)}>{ej}</button>)}
      </div>

      {error && <div className="error" style={{ marginTop: 16 }}>{error}</div>}

      {result && (
        <>
          <section className="analytics-card" style={{ marginTop: 22 }}>
            <h3><Sparkles size={15} />Respuesta de Analytics</h3>
            <p className="analytics-answer">{result.answer}</p>
          </section>
          <section style={{ marginTop: 18 }}>
            <h3 className="detail-section"><BarChart3 size={15} />Logs analizados</h3>
            {(!result.logs || result.logs.length === 0)
              ? <p className="muted">Analytics respondió sin consultar registros.</p>
              : result.logs.map((log, i) => <AnalyticsLogBlock key={i} log={log} />)}
          </section>
        </>
      )}
    </main>
  );
}

function AdminParking({ user }) {
  const [state, setState] = useState({ espacios: [], reservas: [] });
  const [events, setEvents] = useState([]);
  const [floor, setFloor] = useState(1);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showFlow, setShowFlow] = useState(true);
  const canEdit = user.parkingRole === 'admin';
  const refresh = async () => {
    const data = await api('/admin/api/parqueo/estado');
    if (data.ok) setState({ espacios: data.espacios, reservas: data.reservas });
  };
  const loadEvents = async () => {
    const data = await api('/admin/api/parqueo/eventos?limit=50');
    if (data.ok) setEvents(data.eventos);
  };
  useEffect(() => { refresh(); loadEvents(); const id = setInterval(refresh, 60000); return () => clearInterval(id); }, []);
  const available = state.espacios.filter((s) => s.piso === floor && s.estado === 'disponible').length;
  const total = state.espacios.filter((s) => s.piso === floor).length;
  async function afterAction(promise) {
    const data = await promise;
    if (!data.ok) return setModal({ error: data.error });
    setModal(null); refresh(); loadEvents();
  }
  return (
    <main className="page">
      <p className="eyebrow">Zonas y reservas</p><h1>Gestion de parqueo</h1>
      <Toolbar floor={floor} setFloor={setFloor} stats={`${available}/${total} libres en Sótano -${floor}`} counts={legendCounts(state.espacios, floor, state.reservas)}>
        {canEdit && !editing && <button className="btn ghost" onClick={() => setEditing(true)}>Editar plazas</button>}
      </Toolbar>
      {editing
        ? <PlanoEditor floor={floor} autoEdit onClose={() => setEditing(false)} onSaved={refresh} />
        : <PlanoCroquis spaces={state.espacios} reservations={state.reservas} floor={floor} me={user} admin showFlow={showFlow} onSpace={(space, reservation) => setModal({ space, reservation })} />}
      <section className="events"><h2>Log de eventos</h2><div className="table"><table><thead><tr><th>Fecha/Hora</th><th>Tipo</th><th>Espacio</th><th>Placa</th><th>Usuario</th><th>Notas</th></tr></thead><tbody>{events.map((e) => <tr key={e.id}><td>{fmtFullDate(e.timestamp)}</td><td>{e.tipo}</td><td>{e.espacioId}</td><td>{e.placa}</td><td>{e.userName}</td><td>{e.notas}</td></tr>)}</tbody></table></div></section>
      {modal && <AdminSpaceModal modal={modal} user={user} onClose={() => setModal(null)} afterAction={afterAction} />}
    </main>
  );
}

function CouponModal({ cupon, categorias, sponsors, lockedProveedor, onClose, onSaved }) {
  const isEdit = Boolean(cupon?.id);
  const defaultVigencia = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    proveedor: lockedProveedor || cupon?.proveedor || (sponsors[0]?.nombre || ''),
    titulo: cupon?.titulo || '',
    descripcion: cupon?.descripcion || '',
    codigo: cupon?.codigo || '',
    categoria: cupon?.categoria || categorias[0] || 'Otros',
    descuento: cupon?.descuento ?? 10,
    vigencia: cupon?.vigencia ? cupon.vigencia.slice(0, 10) : defaultVigencia(),
    limite: cupon?.limite ?? 100,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (!form.proveedor || !form.titulo.trim() || !form.codigo.trim()) {
      return setError('Proveedor, titulo y codigo son obligatorios.');
    }
    setBusy(true);
    const body = {
      ...form,
      titulo: form.titulo.trim(),
      codigo: form.codigo.trim().toUpperCase(),
      descuento: Number(form.descuento),
      limite: Number(form.limite),
      vigencia: new Date(`${form.vigencia}T23:59:59`).toISOString(),
    };
    const data = isEdit
      ? await api(`/admin/api/cuponera/${cupon.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/admin/api/cuponera', { method: 'POST', body: JSON.stringify(body) });
    setBusy(false);
    if (!data.ok) return setError(data.error || 'No se pudo guardar');
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar cupon' : 'Nuevo cupon'} onClose={onClose}>
      <label>Proveedor</label>
      {lockedProveedor ? (
        <input value={form.proveedor} readOnly />
      ) : (
        <select value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })}>
          {sponsors.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
        </select>
      )}
      <label>Titulo</label>
      <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
      <label>Descripcion</label>
      <textarea rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
      <label>Codigo</label>
      <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
      <div className="two">
        <div>
          <label>Categoria</label>
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label>Descuento %</label>
          <input type="number" min="0" max="100" value={form.descuento} onChange={(e) => setForm({ ...form, descuento: e.target.value })} />
        </div>
      </div>
      <div className="two">
        <div>
          <label>Vigencia</label>
          <input type="date" value={form.vigencia} onChange={(e) => setForm({ ...form, vigencia: e.target.value })} />
        </div>
        <div>
          <label>Limite usos</label>
          <input type="number" min="1" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} />
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando...' : 'Guardar'}</button>
    </Modal>
  );
}

function AdminCoupons({ user }) {
  const [state, setState] = useState({ cupones: [], eventos: [], stats: {}, role: 'socio', sponsor: '', categorias: [] });
  const [sponsors, setSponsors] = useState([]);
  const [message, setMessage] = useState(null);
  const [modal, setModal] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const refresh = async () => {
    const data = await api('/admin/api/cuponera');
    if (data.ok) setState(data);
  };
  useEffect(() => {
    refresh();
    api('/admin/api/sponsors').then((d) => d.ok && setSponsors(d.sponsors.filter((s) => s.activo && !s.esApparel)));
  }, []);
  async function toggle(cupon) {
    setMessage(null);
    const estado = cupon.estado === 'habilitado' ? 'retirado' : 'habilitado';
    const data = await api(`/admin/api/cuponera/${cupon.id}/estado`, { method: 'POST', body: JSON.stringify({ estado }) });
    if (!data.ok) return setMessage({ type: 'error', text: data.error });
    setMessage({ type: 'ok', text: `${cupon.proveedor}: cupon ${estado}.` });
    refresh();
  }
  async function confirmDelete() {
    const data = await api(`/admin/api/cuponera/${delTarget.id}`, { method: 'DELETE' });
    if (!data.ok) return setMessage({ type: 'error', text: data.error });
    setMessage({ type: 'ok', text: 'Cupon eliminado.' });
    setDelTarget(null);
    refresh();
  }
  const canManage = state.role === 'admin' || state.role === 'patrocinador';
  const lockedProveedor = state.role === 'patrocinador' ? state.sponsor : '';
  return (
    <main className="page">
      <p className="eyebrow">Beneficios y proveedores</p><h1>Cuponera</h1>
      <p className="sub">{state.role === 'patrocinador' ? `Panel de patrocinador para ${state.sponsor}.` : 'Panel administrativo para gestionar cupones de descuento.'}</p>
      {canManage && <button className="btn" onClick={() => setModal({})}><Plus size={16} />Nuevo cupon</button>}
      <section className="coupon-stats">
        <div><span>Total</span><b>{state.stats.total || 0}</b></div>
        <div><span>Habilitados</span><b>{state.stats.habilitados || 0}</b></div>
        <div><span>Retirados</span><b>{state.stats.retirados || 0}</b></div>
      </section>
      {message && <div className={message.type === 'ok' ? 'okbox' : 'error'}>{message.text}</div>}
      <section className="coupon-list admin-coupons">
        {state.cupones.map((cupon) => (
          <div key={cupon.id} className="coupon-admin-wrap">
            <CouponCard cupon={cupon} admin={canManage} onToggle={toggle} />
            {canManage && (
              <div className="coupon-admin-actions">
                <button className="icon-text ghost" onClick={() => setModal(cupon)}><Pencil size={14} />Editar</button>
                {state.role === 'admin' && <button className="icon-text ghost" onClick={() => setDelTarget(cupon)}><Trash2 size={14} />Eliminar</button>}
              </div>
            )}
          </div>
        ))}
      </section>
      <section className="events"><h2>Actividad de cupones</h2><div className="table"><table><thead><tr><th>Fecha/Hora</th><th>Proveedor</th><th>Cupon</th><th>Estado</th><th>Usuario</th></tr></thead><tbody>{state.eventos.map((e) => <tr key={e.id}><td>{fmtFullDate(e.timestamp)}</td><td>{e.proveedor}</td><td>{e.cuponId}</td><td>{e.estado}</td><td>{e.userName}</td></tr>)}</tbody></table></div></section>
      {modal !== null && (
        <CouponModal
          cupon={modal?.id ? modal : null}
          categorias={state.categorias?.length ? state.categorias : ['Otros']}
          sponsors={sponsors}
          lockedProveedor={lockedProveedor}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setMessage({ type: 'ok', text: 'Cupon guardado.' }); refresh(); }}
        />
      )}
      {delTarget && (
        <Modal title="Eliminar cupon" onClose={() => setDelTarget(null)}>
          <p>¿Eliminar el cupon de <strong>{delTarget.proveedor}</strong> ({delTarget.codigo})?</p>
          <button className="btn" onClick={confirmDelete}>Eliminar</button>
        </Modal>
      )}
    </main>
  );
}

function AdminSpaceModal({ modal, user, onClose, afterAction }) {
  const { space, reservation } = modal;
  const [plate, setPlate] = useState('');
  const [duration, setDuration] = useState('60');
  const [email, setEmail] = useState('');
  if (modal.error) return <MessageModal title="Error" text={modal.error} onClose={onClose} />;
  if (space.estado === 'disponible') {
    return <Modal title={space.id} onClose={onClose}><p className="muted">Disponible · Piso {space.piso} · Zona {space.zona}</p><label>Placa</label><input value={plate} onChange={(e) => setPlate(e.target.value)} /><label>Duracion</label><select value={duration} onChange={(e) => setDuration(e.target.value)}><option value="30">30 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option><option value="240">4 horas</option></select><button className="btn" onClick={() => afterAction(api('/admin/api/parqueo/reservar', { method: 'POST', body: JSON.stringify({ espacioId: space.id, placa: plate.trim().toUpperCase(), duracion: Number(duration) }) }))}>Reservar</button></Modal>;
  }
  if (!reservation) {
    return (
      <Modal title={space.id} onClose={onClose}>
        <p className="muted">Estado manual: {String(space.estado).replace('_', ' ')}</p>
        {user.parkingRole === 'admin' && (
          <div className="actions">
            <button className="btn ghost" onClick={() => afterAction(api('/admin/api/parqueo/espacios/batch', { method: 'POST', body: JSON.stringify({ ids: [space.id], action: 'status', estado: 'disponible' }) }))}><Check size={16} />Disponible</button>
            <button className="btn ghost" onClick={() => afterAction(api('/admin/api/parqueo/espacios/batch', { method: 'POST', body: JSON.stringify({ ids: [space.id], action: 'status', estado: 'no_disponible' }) }))}><EyeOff size={16} />No disponible</button>
          </div>
        )}
      </Modal>
    );
  }
  return (
    <Modal title={space.id} onClose={onClose}>
      <div className="facts single"><div><span>Estado</span>{reservation?.estado?.toUpperCase()}</div><div><span>Placa</span>{reservation?.placa}</div><div><span>Usuario</span>{reservation?.userName}</div><div><span>Codigo</span>{reservation?.codigo}</div><div><span>Desde</span>{reservation && fmtFullDate(reservation.inicio)}</div><div><span>Hasta</span>{reservation && fmtFullDate(reservation.fin)}</div></div>
      <div className="actions">
        {user.parkingRole === 'admin' && reservation?.estado === 'reservado' && <button className="btn" onClick={() => afterAction(api('/admin/api/parqueo/ocupar', { method: 'POST', body: JSON.stringify({ reservaId: reservation.id }) }))}>Marcar ocupado</button>}
        <button className="btn ghost" onClick={() => afterAction(api('/admin/api/parqueo/extender', { method: 'POST', body: JSON.stringify({ reservaId: reservation.id, minutos: 30 }) }))}><Clock size={16} />Extender +30</button>
        <button className="btn ghost" onClick={() => afterAction(api('/admin/api/parqueo/liberar', { method: 'POST', body: JSON.stringify({ espacioId: space.id }) }))}>Liberar</button>
      </div>
      <label>Correo para reenviar QR</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn ghost" onClick={() => afterAction(api('/admin/api/parqueo/enviar-qr', { method: 'POST', body: JSON.stringify({ reservaId: reservation.id, email }) }))}><Mail size={16} />Enviar QR</button>
    </Modal>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  useEscClose(onClose);
  return <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className={`modal${wide ? ' wide' : ''}`}><div className="modal-head"><h3>{title}</h3><button onClick={onClose}>×</button></div>{children}</section></div>;
}
function MessageModal({ title, text, onClose }) {
  return <Modal title={title} onClose={onClose}><p>{text}</p><button className="btn" onClick={onClose}>Listo</button></Modal>;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const mesCorto = (iso) => MESES[new Date(iso).getMonth()];

function QRImage({ data, size = 140 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(data, { width: size, margin: 1, errorCorrectionLevel: 'M' }).then((url) => { if (alive) setSrc(url); }).catch(() => {});
    return () => { alive = false; };
  }, [data, size]);
  return <img className="qr-img" src={src} width={size} height={size} alt="Codigo QR del boleto" />;
}

function PublicEntradas() {
  const path = location.pathname;
  const slug = path.startsWith('/entradas/') ? decodeURIComponent(path.slice(10).replace(/\/$/, '')) : '';
  return slug ? <PublicEventDetail slug={slug} /> : <PublicEntradasList />;
}

function PublicEntradasList() {
  const [eventos, setEventos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { api('/api/entradas/publico/eventos').then((d) => { if (d.ok) setEventos(d.eventos); setLoaded(true); }); }, []);
  return (
    <>
      
      <main className="page">
        <p className="eyebrow">Modulo de entradas</p>
        <h1>Entradas para el Team</h1>
        <p className="sub">Compra boletos para los proximos partidos. Recibis tu codigo QR al instante por correo.</p>
        <section className="event-list">
          {loaded && eventos.length === 0 && <div className="result empty">No hay eventos a la venta en este momento.</div>}
          {eventos.map((ev) => (
            <a key={ev.id} className="event-card" href={`/entradas/${ev.slug}`}>
              <div className="event-card-date"><b>{new Date(ev.fecha).getDate()}</b><span>{mesCorto(ev.fecha)}</span></div>
              <div className="event-card-body">
                <h2>{ev.nombre}</h2>
                <p>{ev.venue}</p>
                <small>{fmtFullDate(ev.fecha)}</small>
              </div>
              <span className="event-card-cta">Comprar <Ticket size={16} /></span>
            </a>
          ))}
        </section>
        <BoletoLookup />
      </main>
    </>
  );
}

function BoletoLookup() {
  const [form, setForm] = useState({ email: '', codigo: '' });
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  async function consultar() {
    setError(''); setMsg(''); setInfo(null);
    const d = await api('/api/entradas/publico/consulta', { method: 'POST', body: JSON.stringify(form) });
    if (!d.ok) return setError(d.error);
    setInfo(d.info);
  }
  async function reenviar() {
    setMsg(''); setError('');
    const d = await api('/api/entradas/publico/reenviar', { method: 'POST', body: JSON.stringify({ codigo: form.codigo }) });
    if (!d.ok) return setError(d.error);
    setMsg(`Boletos reenviados a ${d.correo}.`);
  }
  return (
    <section className="search-panel">
      <div>
        <h2>Consultar mi boleto</h2>
        <p>Ingresa el codigo del boleto y el correo de compra para ver su estado o reenviarlo.</p>
        <label>Codigo del boleto</label>
        <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="ENT-XXXXXX" />
        <label>Correo de compra</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <button className="btn" onClick={consultar}><Search size={16} />Consultar</button>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="result">
        {!info ? <span className="muted">El estado de tu boleto aparece aqui.</span> : (
          <>
            <strong>Boleto {info.codigo}</strong>
            <div className="facts single">
              <div><span>Evento</span>{info.eventoNombre}</div>
              <div><span>Sector</span>{info.tipoNombre}</div>
              <div><span>Estado</span>{info.estado.toUpperCase()}</div>
              {info.validadoAt && <div><span>Ingreso</span>{fmtFullDate(info.validadoAt)}</div>}
            </div>
            <button className="btn ghost" onClick={reenviar}><Mail size={16} />Reenviar al correo</button>
            {msg && <p className="ok">{msg}</p>}
          </>
        )}
      </div>
    </section>
  );
}

function PublicEventDetail({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState({});
  const [checkout, setCheckout] = useState(false);
  const [done, setDone] = useState(null);
  const [banner, setBanner] = useState(null); // { type, text }
  const [viewMode, setViewMode] = useState('lista'); // 'lista' | 'mapa'
  useEffect(() => {
    api(`/api/entradas/publico/eventos/${encodeURIComponent(slug)}`).then((d) => {
      if (d.ok) {
        setData(d);
        // Si hay zonas con mapa, mostrar mapa por defecto
        if (d.tipos?.some((t) => t.mapa) || isErcVectorLayout(d.evento)) setViewMode('mapa');
      } else {
        setError(d.error);
      }
    });
  }, [slug]);

  // Retorno desde la pasarela: ?ref=<ordenId> (pago hecho) o ?pago=cancelado.
  // El boleto lo emite el webhook, así que hacemos polling hasta que la orden
  // quede 'pagada' y entonces mostramos los QR.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (params.get('pago') === 'cancelado') {
      setBanner({ type: 'info', text: 'Pago cancelado. No se realizó ningún cobro.' });
      window.history.replaceState({}, '', `/entradas/${encodeURIComponent(slug)}`);
      return;
    }
    if (!ref) return;
    let stop = false;
    let tries = 0;
    setBanner({ type: 'info', text: 'Confirmando tu pago…' });
    const poll = async () => {
      tries += 1;
      const d = await api(`/api/entradas/publico/orden/${encodeURIComponent(ref)}`);
      if (stop) return;
      if (d.ok && d.estado === 'pagada') {
        setBanner(null);
        setDone({ boletos: d.boletos });
        window.history.replaceState({}, '', `/entradas/${encodeURIComponent(slug)}`);
        return;
      }
      if (d.ok && d.estado === 'cancelada') {
        setBanner({ type: 'error', text: 'La orden fue cancelada o expiró. No se realizó ningún cobro.' });
        window.history.replaceState({}, '', `/entradas/${encodeURIComponent(slug)}`);
        return;
      }
      if (tries >= 30) {
        setBanner({ type: 'info', text: 'Tu pago sigue procesándose. Te enviaremos los boletos por correo apenas se confirme.' });
        return;
      }
      setTimeout(poll, 2000);
    };
    poll();
    return () => { stop = true; };
  }, [slug]);
  if (error) return (<><main className="page"><p className="eyebrow">Entradas</p><h1>Evento no disponible</h1><p className="sub">{error}</p><a className="btn ghost" href="/entradas">Volver a eventos</a></main></>);
  if (!data) return (<><main className="page"><p>Cargando...</p></main></>);
  const { evento, tipos } = data;
  const setCantidad = (id, n, max) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, n)) }));
  const handleMapUpdate = (tipoId, delta) => {
    const t = tipos.find((t) => t.id === tipoId);
    if (!t) return;
    const cur = qty[tipoId] ?? 0;
    setCantidad(tipoId, cur + delta, Math.min(10, t.disponibles));
  };
  const lineas = tipos.filter((t) => qty[t.id] > 0).map((t) => ({ tipoId: t.id, cantidad: qty[t.id] }));
  const total = tipos.reduce((s, t) => s + t.precioCrc * (qty[t.id] || 0), 0);
  const count = lineas.reduce((s, l) => s + l.cantidad, 0);
  const hasMapa = isErcVectorLayout(evento) || tipos.some((t) => t.mapa);
  return (
    <>
      <main className="page">
        <a className="back-link" href="/entradas">‹ Eventos</a>
        <p className="eyebrow">{fmtFullDate(evento.fecha)} · {evento.venue}</p>
        <h1>{evento.nombre}</h1>
        <p className="sub">{evento.descripcion}</p>
        {banner && <div className={banner.type === 'error' ? 'error' : 'okbox'}>{banner.text}</div>}

        {hasMapa && (
          <div className="view-toggle">
            <button className={`btn ghost${viewMode === 'mapa' ? ' active' : ''}`} onClick={() => setViewMode('mapa')}>Ver mapa</button>
            <button className={`btn ghost${viewMode === 'lista' ? ' active' : ''}`} onClick={() => setViewMode('lista')}>Ver lista</button>
          </div>
        )}

        {viewMode === 'mapa' && hasMapa
          ? <StadiumMap evento={evento} tipos={tipos} qty={qty} onUpdate={handleMapUpdate} />
          : (
            <section className="sector-list">
              {tipos.map((t) => (
                <div key={t.id} className={`sector ${t.disponibles === 0 ? 'agotado' : ''}`}>
                  <div className="sector-info"><b>{t.nombre}</b><span>{money(t.precioCrc)}</span></div>
                  <div className="sector-stock">{t.disponibles > 0 ? `${t.disponibles} disponibles` : 'Agotado'}</div>
                  <div className="stepper">
                    <button onClick={() => setCantidad(t.id, (qty[t.id] || 0) - 1, Math.min(10, t.disponibles))} disabled={!qty[t.id]}>−</button>
                    <span>{qty[t.id] || 0}</span>
                    <button onClick={() => setCantidad(t.id, (qty[t.id] || 0) + 1, Math.min(10, t.disponibles))} disabled={(qty[t.id] || 0) >= Math.min(10, t.disponibles)}>+</button>
                  </div>
                </div>
              ))}
            </section>
          )
        }

        <div className="checkout-bar">
          <div><span>{count} boleto(s)</span><b>{money(total)}</b></div>
          <button className="btn" disabled={count === 0} onClick={() => setCheckout(true)}>Continuar</button>
        </div>
      </main>
      {checkout && <CheckoutModal slug={slug} lineas={lineas} total={total} evento={evento} onClose={() => setCheckout(false)} />}
      {done && <TicketsModal result={done} onClose={() => { setDone(null); location.reload(); }} />}
    </>
  );
}

function CheckoutModal({ slug, lineas, total, evento, onClose }) {
  const [buyer, setBuyer] = useState({ nombre: '', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const count = lineas.reduce((s, l) => s + l.cantidad, 0);
  async function submit() {
    setError(''); setLoading(true);
    const body = { slug, lineas, comprador: buyer };
    const d = await api('/api/entradas/publico/checkout', { method: 'POST', body: JSON.stringify(body) });
    if (!d.ok) { setLoading(false); return setError(d.error); }
    // La tarjeta se cobra en la pasarela hospedada (Stripe Checkout): redirigimos.
    window.location.href = d.url;
  }
  return (
    <Modal title="Finalizar compra" onClose={onClose}>
      <div className="pay-summary">{evento.nombre}<br />{count} boleto(s) · Total <b>{money(total)}</b></div>
      <label>Nombre completo</label><input value={buyer.nombre} onChange={(e) => setBuyer({ ...buyer, nombre: e.target.value })} autoFocus />
      <label>Correo (recibis el QR aqui)</label><input type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} />
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>Te llevaremos a la pasarela segura para completar el pago. Tus datos de tarjeta nunca pasan por este sitio.</p>
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit} disabled={loading}>{loading ? 'Redirigiendo...' : `Pagar ${money(total)}`}</button>
    </Modal>
  );
}

function TicketsModal({ result, onClose }) {
  return (
    <Modal title="Compra exitosa" onClose={onClose}>
      <p className="muted">{result.emailSent === false ? 'Compra registrada. No se pudo enviar el correo ahora, guarda estos codigos.' : (result.correo ? `Enviamos tus boletos a ${result.correo}.` : 'Tus boletos estan listos. Tambien te los enviamos por correo.')}</p>
      <div className="tickets-grid">
        {result.boletos.map((b) => (
          <div key={b.codigo} className="ticket-qr">
            <QRImage data={b.qrData} size={130} />
            <b>{b.tipoNombre}</b>
            <span>{b.codigo}</span>
          </div>
        ))}
      </div>
      <button className="btn" onClick={onClose}>Listo</button>
    </Modal>
  );
}

function AdminEntradas({ user }) {
  const canManage = user.eventsRole === 'admin';
  const canGate = user.eventsRole === 'admin' || user.eventsRole === 'operador';
  const canSales = canManage || user.eventsRole === 'operador' || user.eventsRole === 'comercial';
  const [tab, setTab] = useState(canManage ? 'eventos' : canGate ? 'puerta' : 'ventas');
  return (
    <main className="page">
      <p className="eyebrow">Venta de boletos</p><h1>Gestion de entradas</h1>
      <div className="tabs">
        {canManage && <button className={tab === 'eventos' ? 'active' : ''} onClick={() => setTab('eventos')}>Eventos</button>}
        {canSales && <button className={tab === 'ventas' ? 'active' : ''} onClick={() => setTab('ventas')}>Ventas</button>}
        {canGate && <button className={tab === 'puerta' ? 'active' : ''} onClick={() => setTab('puerta')}><ScanLine size={15} />Puerta</button>}
      </div>
      {tab === 'eventos' && canManage && <AdminEventosTab />}
      {tab === 'ventas' && canSales && <AdminVentasTab />}
      {tab === 'puerta' && canGate && <AdminPuertaTab />}
    </main>
  );
}

function AdminEventosTab() {
  const [eventos, setEventos] = useState([]);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  const refresh = async () => { const d = await api('/admin/api/entradas/eventos'); if (d.ok) setEventos(d.eventos); };
  const refreshLog = () => setLogRefreshKey((key) => key + 1);
  useEffect(() => { refresh(); }, []);
  async function setEstado(ev, estado) {
    setMsg(null);
    const d = await api(`/admin/api/entradas/eventos/${ev.evento.id}/estado`, { method: 'POST', body: JSON.stringify({ estado }) });
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    setMsg({ type: 'ok', text: `${ev.evento.nombre}: ${estado}.` }); refresh(); refreshLog();
  }
  return (
    <>
      <div className="actions left"><button className="btn" onClick={() => setModal({ type: 'evento' })}><Plus size={16} />Nuevo evento</button></div>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <div className="table"><table><thead><tr><th>Evento</th><th>Fecha</th><th>Estado</th><th>Vendidos</th><th>Ingresos</th></tr></thead><tbody>
        {eventos.map((ev) => (
          <tr key={ev.evento.id} className="clickable-row" onClick={() => setModal({ type: 'detalle', evento: ev.evento, tipos: ev.tipos })}>
            <td><button className="link-cell" onClick={(e) => { e.stopPropagation(); setModal({ type: 'detalle', evento: ev.evento, tipos: ev.tipos }); }}>{ev.evento.nombre}</button></td>
            <td>{fmtFullDate(ev.evento.fecha)}</td>
            <td><span className={`pill ${ev.evento.estado}`}>{ev.evento.estado}</span></td>
            <td>{ev.boletosVendidos}</td>
            <td>{money(ev.ingresosCrc)}</td>
          </tr>
        ))}
      </tbody></table></div>
      <EntradasLogPanel eventos={eventos} refreshKey={logRefreshKey} />
      {modal?.type === 'detalle' && (
        <EventDetalleModal
          evento={modal.evento}
          tipos={modal.tipos}
          onClose={() => { setModal(null); refresh(); refreshLog(); }}
          onToggleEstado={() => { setEstado({ evento: modal.evento }, modal.evento.estado === 'publicado' ? 'finalizado' : 'publicado'); setModal(null); }}
          onChanged={() => { refresh(); refreshLog(); }}
        />
      )}
      {modal?.type === 'evento' && <EventFormModal onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); refreshLog(); }} />}
    </>
  );
}

const ENTRADAS_LOG_LABELS = {
  compra: 'Compra',
  cortesia: 'Cortesia',
  evento_actualizado: 'Evento actualizado',
  evento_creado: 'Evento creado',
  evento_estado: 'Cambio de estado',
  reenvio: 'Reenvio',
  sector_actualizado: 'Sector actualizado',
  sector_creado: 'Sector creado',
  validacion: 'Ingreso validado',
};

function entradaLogLabel(tipo) {
  return ENTRADAS_LOG_LABELS[tipo] || String(tipo || '').replace(/_/g, ' ');
}

function EntradasLogPanel({ eventos, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [eventoId, setEventoId] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const eventNames = useMemo(() => Object.fromEntries((eventos || []).map((ev) => [ev.evento.id, ev.evento.nombre])), [eventos]);

  async function loadLog(nextEventoId = eventoId) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: '50' });
    if (nextEventoId) params.set('eventoId', nextEventoId);
    const data = await api(`/admin/api/entradas/log?${params.toString()}`);
    setLoading(false);
    if (!data.ok) {
      setError(data.error || 'No se pudo cargar el log.');
      return;
    }
    setRows(data.eventos || []);
    setTotal(data.total || 0);
  }

  useEffect(() => { loadLog(eventoId); }, [eventoId, refreshKey]);

  return (
    <section className="events">
      <h2><Clock size={22} /> Log de eventos y entradas</h2>
      <div className="actions left">
        <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} aria-label="Filtrar log por evento">
          <option value="">Todos los eventos</option>
          {(eventos || []).map((ev) => <option key={ev.evento.id} value={ev.evento.id}>{ev.evento.nombre}</option>)}
        </select>
        <button className="btn ghost" onClick={() => loadLog()} disabled={loading}><RotateCw size={16} />{loading ? 'Cargando' : 'Refrescar'}</button>
        <span className="muted">{total} registros</span>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="table"><table><thead><tr><th>Fecha/Hora</th><th>Tipo</th><th>Evento</th><th>Boleto</th><th>Usuario</th><th>Notas</th></tr></thead><tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{fmtFullDate(row.timestamp)}</td>
            <td><span className="pill">{entradaLogLabel(row.tipo)}</span></td>
            <td>{eventNames[row.eventoId] || row.eventoId || 'General'}</td>
            <td>{row.boletoId || '-'}</td>
            <td>{row.userName || '-'}</td>
            <td>{row.notas || '-'}</td>
          </tr>
        ))}
        {!loading && rows.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>Sin registros para mostrar.</td></tr>}
        {loading && rows.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>Cargando log...</td></tr>}
      </tbody></table></div>
    </section>
  );
}

function EventFormModal({ onClose, onDone }) {
  const [form, setForm] = useState({ nombre: '', venue: 'Estadio Eladio Rosabal Cordero', fecha: '', descripcion: '', formato: 'partido' });
  const [error, setError] = useState('');
  async function submit() {
    setError('');
    const d = await api('/admin/api/entradas/eventos', { method: 'POST', body: JSON.stringify(form) });
    if (!d.ok) return setError(d.error);
    onDone();
  }
  return (
    <Modal title="Nuevo evento" onClose={onClose}>
      <label>Nombre</label>
      <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus placeholder="Herediano vs ..." />
      <label>Lugar</label>
      <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
      <label>Fecha y hora</label>
      <input type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
      <label>Descripcion</label>
      <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
      <label>Formato</label>
      <div className="evento-formato-opts">
        {[
          { value: 'partido', label: 'Partido', desc: '6 tribunas del estadio' },
          { value: 'espectaculo', label: 'Espectáculo', desc: 'Tribunas + zonas en la gramilla' },
        ].map(({ value, label, desc }) => (
          <label key={value} className={`evento-formato-opt${form.formato === value ? ' active' : ''}`}>
            <input
              type="radio"
              name="formato"
              value={value}
              checked={form.formato === value}
              onChange={() => setForm({ ...form, formato: value })}
            />
            <span className="evento-formato-opt-label">{label}</span>
            <span className="evento-formato-opt-desc">{desc}</span>
          </label>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit}>Crear evento</button>
    </Modal>
  );
}

function TiposModal({ evento, onClose, asPanel }) {
  const [tipos, setTipos] = useState([]);
  const [form, setForm] = useState({ sectorKey: '', precioCrc: '', stockTotal: '' });
  const [gramForm, setGramForm] = useState({ key: '', nombre: '', precioCrc: '', stockTotal: '' });
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const esEspectaculo = evento?.formato === 'espectaculo';
  const fieldTemplate = evento?.fieldTemplate ?? '2';

  const refresh = async () => {
    const d = await api(`/admin/api/entradas/eventos/${evento.id}`);
    if (d.ok) setTipos(d.tipos);
  };
  useEffect(() => { refresh(); }, []);

  const usedKeys = useMemo(() => {
    const keys = new Set();
    for (const t of tipos) {
      const k = t.mapa?.points?.key ?? nombreToZoneKey(t.nombre);
      if (k) keys.add(k);
    }
    return keys;
  }, [tipos]);

  const usedNombres = useMemo(
    () => new Set(tipos.map((t) => t.nombre.toLowerCase())),
    [tipos],
  );

  const availableSectores = useMemo(
    () => ERC_SECTORES.filter((s) => !usedKeys.has(s.key) && !usedNombres.has(s.nombre.toLowerCase())),
    [usedKeys, usedNombres],
  );

  // Slots gramilla disponibles según plantilla
  const gramillaSlots = useMemo(() => {
    if (!esEspectaculo) return [];
    return gramillaKeysForTemplate(fieldTemplate).filter((k) => !usedKeys.has(k));
  }, [esEspectaculo, fieldTemplate, usedKeys]);

  function pickSector(key) {
    const s = ERC_SECTORES.find((x) => x.key === key);
    if (!s) return setForm({ sectorKey: '', precioCrc: '', stockTotal: '' });
    setForm({ sectorKey: key, precioCrc: String(s.precio), stockTotal: String(s.stock) });
  }

  function pickGramillaSlot(key) {
    const meta = GRAMILLA_ZONE_META[key];
    const defaults = GRAMILLA_SECTORES.find((x) => x.key === key);
    setGramForm({ key, nombre: meta?.label ?? key, precioCrc: String(defaults?.precio ?? 15000), stockTotal: String(defaults?.stock ?? 300) });
  }

  async function createSector(payload) {
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/tipos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!d.ok) throw new Error(d.error || 'Error al crear sector');
    return d;
  }

  async function add() {
    setError('');
    const s = ERC_SECTORES.find((x) => x.key === form.sectorKey);
    if (!s) return setError('Selecciona un sector del listado');
    const precioCrc = Number(form.precioCrc);
    const stockTotal = Number(form.stockTotal);
    if (!Number.isFinite(precioCrc) || precioCrc < 0) return setError('Precio inválido');
    if (!Number.isFinite(stockTotal) || stockTotal < 0) return setError('Cupo inválido');
    setAdding(true);
    try {
      await createSector({ nombre: s.nombre, precioCrc, stockTotal, zoneKey: s.key });
      setForm({ sectorKey: '', precioCrc: '', stockTotal: '' });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function addAllMissing() {
    setError('');
    if (availableSectores.length === 0) return setError('Todos los sectores del catálogo ya están agregados');
    setAdding(true);
    try {
      for (const s of availableSectores) {
        await createSector({ nombre: s.nombre, precioCrc: s.precio, stockTotal: s.stock, zoneKey: s.key });
      }
      setForm({ sectorKey: '', precioCrc: '', stockTotal: '' });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function addGramilla() {
    setError('');
    if (!gramForm.key) return setError('Selecciona un slot de gramilla');
    const nombre = gramForm.nombre.trim() || GRAMILLA_ZONE_META[gramForm.key]?.label;
    const precioCrc = Number(gramForm.precioCrc);
    const stockTotal = Number(gramForm.stockTotal);
    if (nombre.length < 2) return setError('Nombre de zona muy corto');
    if (!Number.isFinite(precioCrc) || precioCrc < 0) return setError('Precio inválido');
    if (!Number.isFinite(stockTotal) || stockTotal < 0) return setError('Cupo inválido');
    setAdding(true);
    try {
      await createSector({ nombre, precioCrc, stockTotal, zoneKey: gramForm.key });
      setGramForm({ key: '', nombre: '', precioCrc: '', stockTotal: '' });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function toggle(t) {
    const d = await api(`/admin/api/entradas/tipos/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nombre: t.nombre,
        precioCrc: t.precioCrc,
        stockTotal: t.stockTotal,
        estado: t.estado === 'activo' ? 'inactivo' : 'activo',
      }),
    });
    if (d.ok) refresh(); else setError(d.error);
  }

  const selectedMeta = form.sectorKey ? ERC_ZONE_META[form.sectorKey] : null;

  // Separar tipos por categoría para mostrarlos agrupados
  const tiposTribuna = tipos.filter((t) => {
    const k = t.mapa?.points?.key;
    return !k || !k.startsWith('gramilla-');
  });
  const tiposGramilla = tipos.filter((t) => {
    const k = t.mapa?.points?.key;
    return k && k.startsWith('gramilla-');
  });

  const inner = (
    <>

      {/* Lista de sectores existentes */}
      {tipos.length > 0 && (
        <div className="tipos-list">
          {(esEspectaculo ? [...tiposTribuna, ...tiposGramilla] : tipos).map((t) => {
            const key = t.mapa?.points?.key ?? nombreToZoneKey(t.nombre);
            const meta = (key ? (ERC_ZONE_META[key] ?? GRAMILLA_ZONE_META[key]) : null);
            const tier = meta?.tier;
            const isGram = key?.startsWith('gramilla-');
            return (
              <div key={t.id} className={`tipo-row${isGram ? ' tipo-row--gramilla' : ''}`}>
                <div>
                  {meta && <span className="tipo-swatch" style={{ background: meta.color }} />}
                  <b>{t.nombre}</b>
                  {tier && <span className="tipo-tier">{tier}</span>}
                  <span>{money(t.precioCrc)} · {t.stockVendido}/{t.stockTotal} · {t.estado}</span>
                </div>
                <button className="btn ghost" onClick={() => toggle(t)}>{t.estado === 'activo' ? 'Desactivar' : 'Activar'}</button>
              </div>
            );
          })}
        </div>
      )}

      {/* === Bloque Tribunas === */}
      <div className="tipos-section">
        <h4 className="tipos-section-title">Tribunas</h4>
        <p className="toolbar-hint">Elige un sector del catálogo ERC; el nombre y la zona del mapa se asignan automáticamente.</p>
        {availableSectores.length > 0 && (
          <button type="button" className="btn ghost sector-add-all" onClick={addAllMissing} disabled={adding}>
            <Plus size={16} />Agregar todos los faltantes ({availableSectores.length})
          </button>
        )}
        <label>Sector tribuna</label>
        <select
          value={form.sectorKey}
          onChange={(e) => pickSector(e.target.value)}
          disabled={adding || availableSectores.length === 0}
        >
          <option value="">
            {availableSectores.length === 0 ? 'Todas las tribunas ya están' : 'Seleccionar tribuna…'}
          </option>
          {availableSectores.map((s) => {
            const meta = ERC_ZONE_META[s.key];
            return (
              <option key={s.key} value={s.key}>
                {s.nombre} · {meta?.tier ?? '—'} · ₡{s.precio.toLocaleString('es-CR')} · cupo {s.stock}
              </option>
            );
          })}
        </select>
        {selectedMeta && (
          <p className="sector-pick-hint">Zona en mapa: <strong>{selectedMeta.label}</strong> ({selectedMeta.tier})</p>
        )}
        <div className="two">
          <div>
            <label>Precio CRC</label>
            <input inputMode="numeric" value={form.precioCrc} onChange={(e) => setForm({ ...form, precioCrc: e.target.value.replace(/\D/g, '') })} disabled={!form.sectorKey || adding} />
          </div>
          <div>
            <label>Cupo</label>
            <input inputMode="numeric" value={form.stockTotal} onChange={(e) => setForm({ ...form, stockTotal: e.target.value.replace(/\D/g, '') })} disabled={!form.sectorKey || adding} />
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn" onClick={add} disabled={adding || !form.sectorKey}>
          <Plus size={16} />{adding ? 'Agregando…' : 'Agregar tribuna'}
        </button>
      </div>

      {/* === Bloque Gramilla (solo espectáculo) === */}
      {esEspectaculo && (
        <div className="tipos-section tipos-section--gramilla">
          <h4 className="tipos-section-title">Zonas de gramilla</h4>
          <p className="toolbar-hint">
            Plantilla activa: <strong>{fieldTemplate} partes</strong>. Agrega un sector por cada zona de la gramilla.
            Puedes cambiar la plantilla y los límites en el editor de mapa.
          </p>
          {gramillaSlots.length === 0 ? (
            <p className="muted">Todas las zonas de gramilla ya tienen sector.</p>
          ) : (
            <>
              <label>Zona de gramilla</label>
              <select
                value={gramForm.key}
                onChange={(e) => pickGramillaSlot(e.target.value)}
                disabled={adding}
              >
                <option value="">Seleccionar zona…</option>
                {gramillaSlots.map((k) => {
                  const meta = GRAMILLA_ZONE_META[k];
                  return <option key={k} value={k}>{meta?.label ?? k}</option>;
                })}
              </select>
              {gramForm.key && (
                <>
                  <label>Nombre visible</label>
                  <input value={gramForm.nombre} onChange={(e) => setGramForm({ ...gramForm, nombre: e.target.value })} disabled={adding} placeholder={GRAMILLA_ZONE_META[gramForm.key]?.label} />
                  <div className="two">
                    <div>
                      <label>Precio CRC</label>
                      <input inputMode="numeric" value={gramForm.precioCrc} onChange={(e) => setGramForm({ ...gramForm, precioCrc: e.target.value.replace(/\D/g, '') })} disabled={adding} />
                    </div>
                    <div>
                      <label>Cupo</label>
                      <input inputMode="numeric" value={gramForm.stockTotal} onChange={(e) => setGramForm({ ...gramForm, stockTotal: e.target.value.replace(/\D/g, '') })} disabled={adding} />
                    </div>
                  </div>
                  <button className="btn btn--green" onClick={addGramilla} disabled={adding}>
                    <Plus size={16} />{adding ? 'Agregando…' : 'Agregar zona gramilla'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
  return asPanel ? inner : <Modal title={`Sectores · ${evento.nombre}`} onClose={onClose}>{inner}</Modal>;
}

function CortesiaModal({ evento, tipos, onClose, asPanel }) {
  const [form, setForm] = useState({ tipoId: tipos?.[0]?.id || '', nombre: '', email: '' });
  const [msg, setMsg] = useState(null);
  async function submit() {
    setMsg(null);
    const d = await api('/admin/api/entradas/cortesia', { method: 'POST', body: JSON.stringify({ eventoId: evento.id, ...form }) });
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    setMsg({ type: 'ok', text: `Cortesia ${d.boleto.codigo} emitida${d.emailSent ? ' y enviada' : ''}.` });
  }
  const inner = (
    <>
      <p className="muted">{evento.nombre}</p>
      <label>Sector</label>
      <select value={form.tipoId} onChange={(e) => setForm({ ...form, tipoId: e.target.value })}>{(tipos || []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
      <label>Nombre del invitado</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      <label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <button className="btn" onClick={submit}>Emitir cortesia gratis</button>
    </>
  );
  return asPanel ? inner : <Modal title="Emitir cortesia" onClose={onClose}>{inner}</Modal>;
}

function AdminVentasTab() {
  const [eventos, setEventos] = useState([]);
  useEffect(() => { api('/admin/api/entradas/ventas').then((d) => d.ok && setEventos(d.eventos)); }, []);
  const totalIngresos = eventos.reduce((s, e) => s + e.ingresosCrc, 0);
  const totalVendidos = eventos.reduce((s, e) => s + e.boletosVendidos, 0);
  const totalUsados = eventos.reduce((s, e) => s + e.boletosUsados, 0);
  return (
    <>
      <section className="coupon-stats">
        <div><span>Ingresos</span><b>{money(totalIngresos)}</b></div>
        <div><span>Boletos vendidos</span><b>{totalVendidos}</b></div>
        <div><span>Ingresos validados</span><b>{totalUsados}</b></div>
      </section>
      <div className="table"><table><thead><tr><th>Evento</th><th>Estado</th><th>Vendidos</th><th>Ingresados</th><th>Ingresos</th></tr></thead><tbody>
        {eventos.map((e) => <tr key={e.evento.id}><td>{e.evento.nombre}</td><td><span className={`pill ${e.evento.estado}`}>{e.evento.estado}</span></td><td>{e.boletosVendidos}</td><td>{e.boletosUsados}</td><td>{money(e.ingresosCrc)}</td></tr>)}
      </tbody></table></div>
    </>
  );
}

function fmtDiaCorto(fecha) {
  // fecha = 'YYYY-MM-DD' -> "lun 9 jun"
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function BarRow({ label, value, max, display, sub }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar-row">
      <div className="bar-label" title={label}>{label}</div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
      <div className="bar-value">{display}{sub && <small>{sub}</small>}</div>
    </div>
  );
}

function EventDetalleModal({ evento, tipos, onClose, onToggleEstado, onChanged }) {
  const [tab, setTab] = useState('detalles');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (tab !== 'detalles') return undefined;
    let alive = true;
    setData(null); setError(null);
    api(`/admin/api/entradas/ventas/${evento.id}`)
      .then((d) => { if (!alive) return; if (d.ok) setData(d); else setError(d.error || 'No se pudo cargar el detalle'); })
      .catch(() => { if (alive) setError('No se pudo cargar el detalle'); });
    return () => { alive = false; };
  }, [evento.id, tab]);

  return (
    <Modal title={evento.nombre} onClose={onClose} wide>
      <div className="modal-toolbar">
        <button className={`btn ghost${tab === 'detalles' ? ' active' : ''}`} onClick={() => setTab('detalles')}><BarChart3 size={16} />Detalles</button>
        <button className={`btn ghost${tab === 'sectores' ? ' active' : ''}`} onClick={() => setTab('sectores')}><LayoutGrid size={16} />Sectores</button>
        <button className={`btn ghost${tab === 'mapa' ? ' active' : ''}`} onClick={() => setTab('mapa')}><MapIcon size={16} />Mapa</button>
        <button className={`btn ghost${tab === 'cortesia' ? ' active' : ''}`} onClick={() => setTab('cortesia')}><Gift size={16} />Cortesia</button>
        {onToggleEstado && (evento.estado === 'publicado'
          ? <button className="btn ghost" onClick={onToggleEstado}><Lock size={16} />Finalizar</button>
          : <button className="btn ghost" onClick={onToggleEstado}><Send size={16} />Publicar</button>)}
      </div>

      {tab === 'detalles' && <>
        {error && <div className="error">{error}</div>}
        {!error && !data && <p className="muted">Cargando detalle…</p>}
        {data && <EventDetalleContenido evento={evento} data={data} />}
      </>}
      {tab === 'sectores' && <TiposModal evento={evento} asPanel onClose={() => setTab('detalles')} />}
      {tab === 'mapa' && <StadiumMapEditor evento={evento} tipos={tipos} embedded onClose={() => setTab('detalles')} onSaved={onChanged} />}
      {tab === 'cortesia' && <CortesiaModal evento={evento} tipos={tipos} asPanel onClose={() => setTab('detalles')} />}

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

function EventDetalleContenido({ evento, data }) {
  const { tipos = [], ventasPorDia = [], boletosVendidos = 0, boletosUsados = 0, ingresosCrc = 0 } = data;
  const capacidad = tipos.reduce((s, t) => s + (t.stockTotal || 0), 0);
  const ocupacionPct = capacidad > 0 ? Math.round((boletosVendidos / capacidad) * 1000) / 10 : 0;
  const sinDatos = boletosVendidos === 0 && ingresosCrc === 0;
  const maxIngresoDia = Math.max(1, ...ventasPorDia.map((d) => d.ingresos));
  const sectores = tipos
    .map((t) => ({ nombre: t.nombre, vendido: t.stockVendido || 0, stock: t.stockTotal || 0, ingresos: (t.precioCrc || 0) * (t.stockVendido || 0), pct: t.stockTotal > 0 ? Math.round((t.stockVendido / t.stockTotal) * 1000) / 10 : 0 }))
    .sort((a, b) => b.ingresos - a.ingresos);
  const maxSector = Math.max(1, ...sectores.map((s) => s.ingresos));
  const mejorDia = ventasPorDia.reduce((best, d) => (!best || d.ingresos > best.ingresos ? d : best), null);

  return (
    <div className="event-detalle">
      <div className="event-meta">
        <span><CalendarDays size={14} /> {fmtFullDate(evento.fecha)}</span>
        {evento.venue && <span>📍 {evento.venue}</span>}
        <span className={`pill ${evento.estado}`}>{evento.estado}</span>
      </div>
      {evento.descripcion && <p className="muted event-desc">{evento.descripcion}</p>}

      <section className="coupon-stats analytics-kpis">
        <div><span>Ingresos</span><b>{money(ingresosCrc)}</b></div>
        <div><span>Boletos vendidos</span><b>{boletosVendidos}</b></div>
        <div><span>Validados en puerta</span><b>{boletosUsados}</b></div>
        <div><span>Ocupación</span><b>{ocupacionPct}%</b><small className="muted">{boletosVendidos}/{capacidad}</small></div>
        <div><span>Capacidad</span><b>{capacidad}</b></div>
      </section>

      {sinDatos && <div className="okbox">Este evento aún no tiene ventas. Los dashboards se llenarán con cada compra.</div>}

      {mejorDia && mejorDia.ingresos > 0 && (
        <div className="analytics-highlight"><TrendingUp size={18} /><span>Mejor día de ventas: <strong>{fmtDiaCorto(mejorDia.fecha)}</strong> con <strong>{money(mejorDia.ingresos)}</strong></span></div>
      )}

      <div className="analytics-grid">
        <section className="analytics-card">
          <h3><CalendarDays size={16} /> Ventas por día</h3>
          {ventasPorDia.length === 0 ? <p className="muted">Sin ventas todavía.</p> : (
            <div className="bar-chart">
              {ventasPorDia.map((d) => (
                <BarRow key={d.fecha} label={fmtDiaCorto(d.fecha)} value={d.ingresos} max={maxIngresoDia} display={money(d.ingresos)} sub={` · ${d.boletos} bol.`} />
              ))}
            </div>
          )}
        </section>

        <section className="analytics-card">
          <h3><Ticket size={16} /> Ingresos por sector</h3>
          {sectores.length === 0 ? <p className="muted">Sin sectores configurados.</p> : (
            <div className="bar-chart">
              {sectores.map((s) => (
                <BarRow key={s.nombre} label={s.nombre} value={s.ingresos} max={maxSector} display={money(s.ingresos)} sub={` · ${s.vendido} bol.`} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="analytics-card" style={{ marginTop: '1rem' }}>
        <h3><BarChart3 size={16} /> Ocupación por sector</h3>
        <div className="table"><table><thead><tr><th>Sector</th><th>Ocupación</th><th>Vendidos</th><th>Cupo</th><th>Ingresos</th></tr></thead><tbody>
          {sectores.map((s) => (
            <tr key={s.nombre}>
              <td>{s.nombre}</td>
              <td style={{ minWidth: 160 }}>
                <div className="occ-bar"><div className="occ-fill" style={{ width: `${Math.min(100, s.pct)}%` }} /></div>
                <small className="muted">{s.pct}%</small>
              </td>
              <td>{s.vendido}</td>
              <td>{s.stock}</td>
              <td>{money(s.ingresos)}</td>
            </tr>
          ))}
          {sectores.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>Sin sectores</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}

function AdminPuertaTab() {
  const [codigo, setCodigo] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  async function validar(e) {
    if (e) e.preventDefault();
    if (!codigo.trim()) return;
    setLoading(true);
    const d = await api('/admin/api/entradas/validar', { method: 'POST', body: JSON.stringify({ codigo: codigo.trim() }) });
    setLoading(false);
    setResult(d.ok ? { ok: true, boleto: d.boleto } : { ok: false, text: d.error });
    setCodigo('');
  }
  return (
    <section className="gate">
      <p className="sub">Escanea o digita el codigo del boleto para registrar el ingreso.</p>
      <form className="gate-input" onSubmit={validar}>
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ENT-XXXXXX o contenido del QR" autoFocus />
        <button className="btn" disabled={loading}><ScanLine size={16} />Validar</button>
      </form>
      {result && (
        <div className={`gate-result ${result.ok ? 'ok' : 'bad'}`}>
          {result.ok
            ? <><Check size={42} /><b>Ingreso autorizado</b><span>{result.boleto.tipoNombre} · {result.boleto.eventoNombre}</span><small>{result.boleto.codigo}</small></>
            : <><QrCode size={42} /><b>{result.text}</b></>}
        </div>
      )}
    </section>
  );
}

export { PublicParking, PublicCoupons, PublicEntradas, AdminApp, ThemeToggle, applyTheme, THEME_KEY, isAdminUser };
