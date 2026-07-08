import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Accessibility, Activity, BadgePercent, BarChart3, CalendarDays, Car, Check, Clock, Eye, EyeOff, Gift, Globe, ImagePlus, LayoutGrid, Lock, Mail, Map as MapIcon, MapPin, MessageSquare, Moon, Newspaper, PanelLeftClose, PanelLeftOpen, Pencil, Plus, QrCode, RotateCw, Route, ScanLine, Search, Send, Shield, ShoppingBag, Sparkles, Sun, Ticket, ToggleLeft, ToggleRight, Trash2, TrendingUp, Trophy, Truck, Users, Users2, UtensilsCrossed, X } from 'lucide-react';
import AdminTopBar from './layout/AdminTopBar.jsx';
import DataTable from './components/DataTable.jsx';
import { StadiumMapEditor } from './pages/entradas/StadiumMapEditor.jsx';
import { StadiumMap, tiposByZoneKey, usesVectorMap } from './pages/entradas/StadiumMap.jsx';
import { StadiumSvgERC } from './pages/entradas/StadiumSvgERC.jsx';
import { SeatPickerPanel, SeatAdminPanel } from './pages/entradas/SeatPicker.jsx';
import { SeatAdminGrid } from './pages/entradas/SeatAdminGrid.jsx';
import { isErcVectorLayout, ERC_SECTORES, ERC_ZONE_META, GRAMILLA_ZONE_META, GRAMILLA_SECTORES, nombreToZoneKey, orientationForZone } from './pages/entradas/stadiumErc.js';
import { gramillaKeysForTemplate } from './pages/entradas/stadiumFieldGeometry.js';
import AdminJugadores from './pages/admin/AdminJugadores.jsx';
import AdminNoticias from './pages/admin/AdminNoticias.jsx';
import AdminPartidos from './pages/admin/AdminPartidos.jsx';
import AdminSponsors from './pages/admin/AdminSponsors.jsx';
import AdminMensajes from './pages/admin/AdminMensajes.jsx';
import { entradasFaq } from './data/entradasInfo.js';
import { contacto as clubContacto } from './data/club.js';
import QRCode from 'qrcode';
import { uploadFile } from './utils/api.js';
import { useEscClose } from './utils/useEscClose.js';
import { useConfirm } from './utils/confirm.jsx';
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
const round4 = (n) => Math.round(n * 10000) / 10000;
// Zonas especiales: rotación restringida a pasos de 90° (0, 90, 180, 270).
const normalizeRot90 = (deg) => {
  const n = Number.isFinite(Number(deg)) ? Number(deg) : 0;
  return ((Math.round(n / 90) * 90) % 360 + 360) % 360;
};

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
    user.isSuperAdmin ||
    user.role === 'admin' ||
    user.parkingRole === 'admin' ||
    user.couponRole === 'admin' ||
    user.couponRole === 'patrocinador' ||
    (user.eventsRole && user.eventsRole !== 'ninguno')
  );
}

function AdminNavButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      className={`side-nav-button${active ? ' active' : ''}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon size={17} />
      <span className="side-nav-label">{label}</span>
    </button>
  );
}

function AdminApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => localStorage.getItem('csh-admin-nav-collapsed') === 'true');
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
  const toggleNavCollapsed = () => setNavCollapsed((current) => {
    const next = !current;
    localStorage.setItem('csh-admin-nav-collapsed', String(next));
    return next;
  });
  async function logout() { await api('/admin/logout', { method: 'POST', body: '{}' }); location.href = '/'; }
  if (loading) return <main className="page"><p>Cargando...</p></main>;
  if (!user) return <AdminLogin />;
  // Un socio autenticado no entra al panel: se le devuelve al sitio público ya logueado.
  if (!isAdminUser(user)) { location.replace('/'); return <main className="page"><p>Redirigiendo...</p></main>; }
  return (
    <div className={`admin-shell${menuOpen ? ' nav-open' : ''}${navCollapsed ? ' nav-collapsed' : ''}`}>
      <button className="admin-nav-backdrop" aria-label="Cerrar menu" onClick={() => setMenuOpen(false)} />
      <aside aria-label="Menu administrativo">
            <div className="admin-nav-head">
              <a className="side-brand" onClick={() => navigate('/admin')} title="Herediano Admin"><img src="/brand/logo-shield.png" alt="" /><b>Herediano</b><span>Admin</span></a>
              <div className="admin-nav-head-actions">
                <button
                  className="admin-nav-collapse"
                  onClick={toggleNavCollapsed}
                  aria-label={navCollapsed ? 'Expandir menu' : 'Minimizar menu'}
                  title={navCollapsed ? 'Expandir menu' : 'Minimizar menu'}
                >
                  {navCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
              <button className="admin-nav-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menu"><X size={18} /></button>
              </div>
            </div>
            <AdminNavButton active={route === '/admin'} onClick={() => navigate('/admin')} icon={Shield} label="Resumen" />
            <AdminNavButton active={route === '/admin/parqueo'} onClick={() => navigate('/admin/parqueo')} icon={Car} label="Gestion de parqueo" />
            {user.eventsRole && user.eventsRole !== 'ninguno' && <AdminNavButton active={route.startsWith('/admin/entradas')} onClick={() => navigate('/admin/entradas')} icon={CalendarDays} label="Gestion de entradas" />}
            <AdminNavButton active={route === '/admin/cuponera'} onClick={() => navigate('/admin/cuponera')} icon={Ticket} label="Cuponera" />
            <AdminNavButton active={route === '/admin/usuarios'} onClick={() => navigate('/admin/usuarios')} icon={Users} label="Gestion de usuarios" />
            {Object.entries(WIP_MODULES).map(([path, mod]) => {
              const Icon = mod.icon;
              return <AdminNavButton key={path} active={route === path} onClick={() => navigate(path)} icon={Icon} label={mod.title} />;
            })}
            {user.isSuperAdmin && <AdminNavButton active={route === '/admin/analytics'} onClick={() => navigate('/admin/analytics')} icon={Sparkles} label="Analytics" />}
            <p className="side-section-label">Gestion del sitio</p>
            <AdminNavButton active={route === '/admin/web'} onClick={() => navigate('/admin/web')} icon={Globe} label="Gestion de la pagina web" />
            <AdminNavButton active={route === '/admin/jugadores'} onClick={() => navigate('/admin/jugadores')} icon={Users2} label="Jugadores" />
            <AdminNavButton active={route === '/admin/noticias'} onClick={() => navigate('/admin/noticias')} icon={Newspaper} label="Noticias" />
            <AdminNavButton active={route === '/admin/partidos'} onClick={() => navigate('/admin/partidos')} icon={Trophy} label="Partidos" />
            <AdminNavButton active={route === '/admin/sponsors'} onClick={() => navigate('/admin/sponsors')} icon={ShoppingBag} label="Sponsors" />
            <AdminNavButton active={route === '/admin/mensajes'} onClick={() => navigate('/admin/mensajes')} icon={MessageSquare} label="Mensajes" />
      </aside>
      <section className="admin-main">
        <AdminTopBar user={user} onLogout={logout} onMenu={() => setMenuOpen(true)} />
        {route === '/admin/parqueo' ? <AdminParking user={user} /> : route.startsWith('/admin/entradas') ? <AdminEntradas user={user} route={route} navigate={navigate} /> : route === '/admin/cuponera' ? <AdminCoupons user={user} /> : route === '/admin/usuarios' ? <AdminUsers /> : route === '/admin/analytics' ? <AdminAnalytics user={user} /> : route === '/admin/web' ? <AdminWeb /> : route === '/admin/jugadores' ? <AdminJugadores /> : route === '/admin/noticias' ? <AdminNoticias /> : route === '/admin/partidos' ? <AdminPartidos /> : route === '/admin/sponsors' ? <AdminSponsors /> : route === '/admin/mensajes' ? <AdminMensajes /> : WIP_MODULES[route] ? <UnderConstruction modulo={WIP_MODULES[route]} /> : <AdminHome user={user} navigate={navigate} />}
      </section>
    </div>
  );
}

// Input de contraseña con botón de mostrar/ocultar integrado y estilizado.
function PasswordInput({ value, onChange, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} {...rest} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
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
        <label>Contrasena</label><PasswordInput value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} />
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
      <DataTable
        id="usuarios"
        rows={users}
        rowProps={(u) => ({ className: 'clickable-row', onClick: () => setDetail(u) })}
        columns={[
          { key: 'name', label: 'Nombre', render: (u) => <button className="link-cell" onClick={(e) => { e.stopPropagation(); setDetail(u); }}>{u.name}</button> },
          { key: 'email', label: 'Correo' },
          { key: 'role', label: 'Rol' },
          { key: 'area', label: 'Area' },
          { key: 'status', label: 'Estado', render: (u) => <span className={`pill ${u.status.toLowerCase()}`}>{u.status}</span> },
          {
            key: 'acciones', label: '', menuLabel: 'Acciones', sortable: false,
            tdProps: () => ({ className: 'row-actions', onClick: (e) => e.stopPropagation() }),
            render: (u) => (u.passwordManagedByEnv ? <span className="muted">Clave por entorno</span> : <button className="btn ghost" onClick={() => setTarget(u)}>Cambiar clave</button>),
          },
        ]}
      />
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
  return <Modal title="Cambiar clave" onClose={onClose}><p className="muted">{user.email}</p><label>Nueva contrasena</label><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} /><label>Confirmar</label><PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} />{msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}<button className="btn" onClick={save}>Guardar clave</button></Modal>;
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
      <section className="events"><h2>Log de eventos</h2>
        <DataTable
          id="parqueo-log"
          rows={events}
          columns={[
            { key: 'timestamp', label: 'Fecha/Hora', render: (e) => fmtFullDate(e.timestamp), sortValue: (e) => new Date(e.timestamp).getTime() },
            { key: 'tipo', label: 'Tipo' },
            { key: 'espacioId', label: 'Espacio' },
            { key: 'placa', label: 'Placa' },
            { key: 'userName', label: 'Usuario' },
            { key: 'notas', label: 'Notas' },
          ]}
        />
      </section>
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
      <section className="events"><h2>Actividad de cupones</h2>
        <DataTable
          id="cupones-log"
          rows={state.eventos}
          columns={[
            { key: 'timestamp', label: 'Fecha/Hora', render: (e) => fmtFullDate(e.timestamp), sortValue: (e) => new Date(e.timestamp).getTime() },
            { key: 'proveedor', label: 'Proveedor' },
            { key: 'cuponId', label: 'Cupon' },
            { key: 'estado', label: 'Estado' },
            { key: 'userName', label: 'Usuario' },
          ]}
        />
      </section>
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
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const diaSemana = (iso) => DIAS_SEMANA[new Date(iso).getDay()];
const horaCorta = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function QRImage({ data, size = 140 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(data, { width: size, margin: 1, errorCorrectionLevel: 'M' }).then((url) => { if (alive) setSrc(url); }).catch(() => {});
    return () => { alive = false; };
  }, [data, size]);
  return <img className="qr-img" src={src} width={size} height={size} alt="Codigo QR del boleto" />;
}

// RRPP: persiste el código de promotor (?ref=CODIGO) para atribuir la compra.
function capturarRef() {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref) sessionStorage.setItem('entradas_ref', ref.trim().toUpperCase());
}

function refActual() {
  return sessionStorage.getItem('entradas_ref') || undefined;
}

function PublicEntradas() {
  useEffect(() => { capturarRef(); }, []);
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
              {ev.imagenUrl && <span className="event-card-glow" style={{ backgroundImage: `url("${ev.imagenUrl}")` }} aria-hidden="true" />}
              <span className="event-card-poster">
                {ev.imagenUrl
                  ? <img src={ev.imagenUrl} alt={`Afiche de ${ev.nombre}`} loading="lazy" />
                  : <span className="event-card-poster-empty"><Ticket size={24} /></span>}
              </span>
              <span className="event-card-date" aria-hidden="true">
                <em>{diaSemana(ev.fecha).slice(0, 3)}</em>
                <b>{pad(new Date(ev.fecha).getDate())}</b>
                <span>{mesCorto(ev.fecha)}</span>
              </span>
              <div className="event-card-body">
                <h2>{ev.nombre}</h2>
                <p className="event-card-meta"><MapPin size={13} />{ev.venue}</p>
                <p className="event-card-meta"><Clock size={13} />{diaSemana(ev.fecha)} {new Date(ev.fecha).getDate()} de {mesCorto(ev.fecha)} · {horaCorta(ev.fecha)}</p>
              </div>
              <span className="event-card-cta">Comprar <Ticket size={16} /></span>
            </a>
          ))}
        </section>
        <BoletoLookup />
        <EntradasInfo />
        <EntradasContacto />
      </main>
    </>
  );
}

// ── Más información (FAQ estático) ─────────────────────────────────
function EntradasInfo() {
  return (
    <section className="card" style={{ marginTop: 24 }}>
      <p className="eyebrow">Más información</p>
      <h2 style={{ marginTop: 4 }}>Preguntas frecuentes</h2>
      {entradasFaq.map((item) => (
        <details key={item.q} style={{ borderBottom: '1px solid rgba(255,255,255,.08)', padding: '10px 0' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{item.q}</summary>
          <p className="muted" style={{ margin: '8px 0 2px', lineHeight: 1.55 }}>{item.a}</p>
        </details>
      ))}
    </section>
  );
}

// ── Contáctenos (reutiliza el módulo contacto: llega al inbox admin) ──
function EntradasContacto() {
  const [form, setForm] = useState({ nombre: '', email: '', mensaje: '' });
  const [status, setStatus] = useState(null); // { type, text }
  const [loading, setLoading] = useState(false);
  const waNumber = String(clubContacto.general.whatsapp || '').replace(/\D/g, '');
  async function submit(e) {
    e.preventDefault();
    setStatus(null); setLoading(true);
    const d = await api('/api/contacto', { method: 'POST', body: JSON.stringify({ ...form, asunto: 'Entradas' }) });
    setLoading(false);
    if (!d.ok) return setStatus({ type: 'error', text: d.error });
    setStatus({ type: 'ok', text: 'Mensaje enviado. Te respondemos por correo.' });
    setForm({ nombre: '', email: '', mensaje: '' });
  }
  return (
    <section className="card" style={{ marginTop: 18 }}>
      <p className="eyebrow">Contáctenos</p>
      <h2 style={{ marginTop: 4 }}>¿Necesitás ayuda con tus entradas?</h2>
      <p className="muted">
        Escribinos por WhatsApp al{' '}
        <a href={`https://api.whatsapp.com/send/?phone=${encodeURIComponent(waNumber)}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
          {clubContacto.general.whatsapp}
        </a>{' '}
        ({clubContacto.general.horario}) o dejanos tu consulta:
      </p>
      <form onSubmit={submit}>
        <div className="two">
          <div><label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
          <div><label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        </div>
        <label>Mensaje</label>
        <textarea rows={4} value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} required style={{ width: '100%', resize: 'vertical' }} />
        {status && <div className={status.type === 'ok' ? 'okbox' : 'error'}>{status.text}</div>}
        <button className="btn" type="submit" disabled={loading || !form.nombre || !form.email || !form.mensaje}>
          <Send size={15} />{loading ? 'Enviando…' : 'Enviar consulta'}
        </button>
      </form>
    </section>
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

// Selector de butacas moderno (SeatPicker): mismo contrato que la grilla
// anterior — onToggle(tipoId, asientoId) — con zoom, tooltip, auto-elección
// y bandeja de seleccionadas. onBoxSelect habilita la selección por arrastre.
function SeatGrid({ tipo, asientos, selected, onToggle, onBoxSelect = null }) {
  const zoneKey = tipo.mapa?.points?.key ?? nombreToZoneKey(tipo.nombre);
  return (
    <div className="seat-grid" style={{ margin: '10px 0 4px' }}>
      <SeatPickerPanel
        tipo={tipo}
        asientos={asientos}
        selectedIds={selected}
        onSeatToggle={(a) => onToggle(tipo.id, a.id)}
        onBoxSelect={onBoxSelect}
        orientation={orientationForZone(zoneKey)}
        accentColor={tipo.mapa?.color}
        compact
      />
    </div>
  );
}

function PublicEventDetail({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState({});
  const [seats, setSeats] = useState({}); // tipoId → [asientoId]
  const [asientos, setAsientos] = useState([]);
  const [checkout, setCheckout] = useState(false);
  const [hold, setHold] = useState(null);
  const [seatError, setSeatError] = useState('');
  const [done, setDone] = useState(null);
  const [banner, setBanner] = useState(null); // { type, text }
  const [viewMode, setViewMode] = useState('lista'); // 'lista' | 'mapa'
  const [expandedSector, setExpandedSector] = useState(null); // tipoId del sector abierto en la lista
  const loadAsientos = () => api(`/api/entradas/publico/eventos/${encodeURIComponent(slug)}/asientos`).then((d) => { if (d.ok) setAsientos(d.asientos); });
  useEffect(() => {
    api(`/api/entradas/publico/eventos/${encodeURIComponent(slug)}`).then((d) => {
      if (d.ok) {
        setData(d);
        // Si hay zonas con mapa, mostrar mapa por defecto
        if (d.tipos?.some((t) => t.mapa) || isErcVectorLayout(d.evento)) setViewMode('mapa');
        if (d.tipos?.some((t) => t.estado === 'activo' && t.numerado)) loadAsientos();
        // Si hay un único sector numerado, abrilo por defecto en la lista.
        const nums = (d.tipos || []).filter((t) => t.estado === 'activo' && t.numerado && t.disponibles > 0);
        if (nums.length === 1) setExpandedSector(nums[0].id);
      } else {
        setError(d.error);
      }
    });
  }, [slug]);

  // Retorno desde la pasarela: ?orden=<ordenId> (pago hecho) o ?pago=cancelado.
  // (?ref= queda reservado para el código de promotor RRPP.) El boleto lo emite
  // el webhook, así que hacemos polling hasta que la orden quede 'pagada'.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('orden');
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
  const tiposCompra = tipos.filter((t) => t.estado === 'activo');
  const setCantidad = (id, n, max) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, n)) }));
  const handleMapUpdate = (tipoId, delta) => {
    const t = tiposCompra.find((t) => t.id === tipoId);
    if (!t || t.numerado) return; // numerado se elige por butaca, no por stepper
    const cur = qty[tipoId] ?? 0;
    setCantidad(tipoId, cur + delta, Math.min(10, t.disponibles));
  };
  const toggleSeat = (tipoId, asientoId) => {
    setSeats((s) => {
      const cur = s[tipoId] || [];
      if (cur.includes(asientoId)) return { ...s, [tipoId]: cur.filter((id) => id !== asientoId) };
      if (cur.length >= 10) return s;
      return { ...s, [tipoId]: [...cur, asientoId] };
    });
  };
  // Click en butaca del croquis: solo permite marcar disponibles (o desmarcar propias).
  const clickSeat = (a) => {
    const sel = seats[a.tipoId] || [];
    if (!sel.includes(a.id) && a.estado !== 'disponible') return;
    toggleSeat(a.tipoId, a.id);
  };
  const cantidadDe = (t) => (t.numerado ? (seats[t.id] || []).length : (qty[t.id] || 0));
  const lineas = tiposCompra
    .filter((t) => cantidadDe(t) > 0)
    .map((t) => (t.numerado ? { tipoId: t.id, cantidad: seats[t.id].length, asientos: seats[t.id] } : { tipoId: t.id, cantidad: qty[t.id] }));
  const total = tiposCompra.reduce((s, t) => s + (t.precioVigente ?? t.precioCrc) * cantidadDe(t), 0);
  const count = lineas.reduce((s, l) => s + l.cantidad, 0);
  const vectorMap = usesVectorMap(evento, tipos);
  const hasMapa = vectorMap || tipos.some((t) => t.mapa);
  const tiposNumerados = tiposCompra.filter((t) => t.numerado);
  const allSelectedSeats = tiposNumerados.flatMap((t) => seats[t.id] || []);
  async function continuar() {
    setSeatError('');
    if (allSelectedSeats.length === 0) return setCheckout(true);
    // Soft-lock: reserva las butacas 7 minutos mientras se completa el pago.
    const d = await api('/api/entradas/publico/reservar-asientos', { method: 'POST', body: JSON.stringify({ slug, asientos: allSelectedSeats }) });
    if (!d.ok) {
      setSeatError(d.error);
      setSeats({});
      loadAsientos();
      return;
    }
    setHold(d.holdId);
    setCheckout(true);
  }
  return (
    <>
      <main className="page">
        <a className="back-link" href="/entradas">‹ Eventos</a>
        <p className="eyebrow">{fmtFullDate(evento.fecha)} · {evento.venue}</p>
        <h1>{evento.nombre}</h1>
        <p className="sub">{evento.descripcion}</p>
        {evento.imagenUrl && <img className="event-detail-flyer" src={evento.imagenUrl} alt={`Flyer promocional de ${evento.nombre}`} />}
        {banner && <div className={banner.type === 'error' ? 'error' : 'okbox'}>{banner.text}</div>}

        {hasMapa && (
          <div className="view-toggle">
            <button className={`btn ghost${viewMode === 'mapa' ? ' active' : ''}`} onClick={() => setViewMode('mapa')}>Ver mapa</button>
            <button className={`btn ghost${viewMode === 'lista' ? ' active' : ''}`} onClick={() => setViewMode('lista')}>Ver lista</button>
          </div>
        )}

        {viewMode === 'mapa' && hasMapa
          ? (
            <StadiumMap
              evento={evento}
              tipos={tipos}
              qty={qty}
              onUpdate={handleMapUpdate}
              asientos={asientos}
              seats={seats}
              onSeatClick={clickSeat}
            />
          )
          : (
            <section className="sector-list sector-list--accordion">
              {tiposCompra.map((t) => {
                const precio = t.precioVigente ?? t.precioCrc;
                const agotado = t.disponibles === 0;
                const sel = t.numerado ? (seats[t.id]?.length || 0) : (qty[t.id] || 0);
                const expanded = expandedSector === t.id;
                const Meta = (
                  <span className="sector-card-meta">
                    {t.tandaNombre && t.precioVigente !== t.precioCrc && <s className="muted">{money(t.precioCrc)}</s>}
                    <span className="sector-card-price">{money(precio)}</span>
                    {t.tandaNombre && <em className="pill publicado sector-card-tanda">{t.tandaNombre}</em>}
                  </span>
                );
                const Right = (
                  <span className="sector-card-right">
                    {sel > 0 && <span className="sector-card-badge">{sel} · {money(sel * precio)}</span>}
                    <span className={`sector-card-avail${agotado ? ' agotado' : ''}`}>{agotado ? 'Agotado' : `${t.disponibles.toLocaleString('es-CR')} disp.`}</span>
                  </span>
                );
                return (
                  <div key={t.id} className={`sector-card${agotado ? ' agotado' : ''}${expanded ? ' expanded' : ''}`}>
                    {t.numerado ? (
                      <button
                        type="button"
                        className="sector-card-head"
                        onClick={() => !agotado && setExpandedSector(expanded ? null : t.id)}
                        disabled={agotado}
                        aria-expanded={expanded}
                      >
                        <span className="sector-card-main"><b className="sector-card-name">{t.nombre}</b>{Meta}</span>
                        {Right}
                        {!agotado && <span className={`sector-card-chevron${expanded ? ' open' : ''}`} aria-hidden="true">▾</span>}
                      </button>
                    ) : (
                      <div className="sector-card-head sector-card-head--static">
                        <span className="sector-card-main"><b className="sector-card-name">{t.nombre}</b>{Meta}</span>
                        {Right}
                        {!agotado && (
                          <div className="stepper">
                            <button onClick={() => setCantidad(t.id, (qty[t.id] || 0) - 1, Math.min(10, t.disponibles))} disabled={!qty[t.id]}>−</button>
                            <span>{qty[t.id] || 0}</span>
                            <button onClick={() => setCantidad(t.id, (qty[t.id] || 0) + 1, Math.min(10, t.disponibles))} disabled={(qty[t.id] || 0) >= Math.min(10, t.disponibles)}>+</button>
                          </div>
                        )}
                      </div>
                    )}
                    {t.numerado && expanded && !agotado && (
                      <div className="sector-card-body">
                        <SeatGrid tipo={t} asientos={asientos.filter((a) => a.tipoId === t.id)} selected={seats[t.id] || []} onToggle={toggleSeat} />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )
        }

        {/* Con croquis vectorial las butacas se eligen en el propio mapa; la
            grilla plana queda solo para eventos con mapa de foto. */}
        {viewMode === 'mapa' && !vectorMap && tiposNumerados.length > 0 && (
          <section className="sector-list" style={{ marginTop: 12 }}>
            {tiposNumerados.map((t) => (
              <div key={t.id} className="sector">
                <div className="sector-info"><b>{t.nombre}</b><span>{money(t.precioVigente ?? t.precioCrc)}</span></div>
                <SeatGrid tipo={t} asientos={asientos.filter((a) => a.tipoId === t.id)} selected={seats[t.id] || []} onToggle={toggleSeat} />
              </div>
            ))}
          </section>
        )}
        {seatError && <div className="error">{seatError}</div>}

        <div className={`checkout-bar${viewMode === 'mapa' && hasMapa ? ' checkout-bar--mapa' : ''}`}>
          <div><span>{count} boleto(s)</span><b>{money(total)}</b></div>
          <button className="btn" disabled={count === 0} onClick={continuar}>Continuar</button>
        </div>
      </main>
      {checkout && <CheckoutModal slug={slug} lineas={lineas} total={total} evento={evento} fee={data.fee} holdId={hold} onClose={() => setCheckout(false)} />}
      {done && <TicketsModal result={done} onClose={() => { setDone(null); location.reload(); }} />}
    </>
  );
}

function calcFeeCrc(base, fee) {
  if (!fee || fee.tipo === 'ninguno' || !fee.valor || base <= 0) return 0;
  return fee.tipo === 'pct' ? Math.round((base * fee.valor) / 100) : Math.round(fee.valor);
}

function CheckoutModal({ slug, lineas, total, evento, fee, holdId, onClose }) {
  const [buyer, setBuyer] = useState({ nombre: '', email: '', telefono: '', notifWhatsapp: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [aplicado, setAplicado] = useState(null); // { codigo, descuento }
  const [descMsg, setDescMsg] = useState('');
  const [descLoading, setDescLoading] = useState(false);
  const count = lineas.reduce((s, l) => s + l.cantidad, 0);

  const subtotal = total;
  const descuento = aplicado ? aplicado.descuento : 0;
  const base = Math.max(0, subtotal - descuento);
  const feeCrc = calcFeeCrc(base, fee);
  const grandTotal = base + feeCrc;

  async function aplicarCodigo() {
    setDescMsg(''); setDescLoading(true);
    const d = await api('/api/entradas/publico/validar-descuento', { method: 'POST', body: JSON.stringify({ slug, lineas, codigo }) });
    setDescLoading(false);
    if (!d.ok) { setAplicado(null); return setDescMsg(d.error); }
    setAplicado({ codigo: d.codigo, descuento: d.descuento });
    setDescMsg(d.descuento > 0 ? `Código ${d.codigo} aplicado` : `Código ${d.codigo} sin efecto en esta compra`);
  }
  function quitarCodigo() { setAplicado(null); setCodigo(''); setDescMsg(''); }

  async function submit() {
    setError(''); setLoading(true);
    const body = { slug, lineas, comprador: buyer, descuentoCodigo: aplicado ? aplicado.codigo : undefined, holdId: holdId || undefined, ref: refActual() };
    const d = await api('/api/entradas/publico/checkout', { method: 'POST', body: JSON.stringify(body) });
    if (!d.ok) { setLoading(false); return setError(d.error); }
    // La tarjeta se cobra en la pasarela hospedada (Stripe Checkout): redirigimos.
    window.location.href = d.url;
  }
  return (
    <Modal title="Finalizar compra" onClose={onClose}>
      <div className="pay-summary">{evento.nombre}<br />{count} boleto(s)</div>
      <label>Nombre completo</label><input value={buyer.nombre} onChange={(e) => setBuyer({ ...buyer, nombre: e.target.value })} autoFocus />
      <label>Correo (recibis el QR aqui)</label><input type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} />

      <label className="check" style={{ margin: '8px 0 4px' }}>
        <input type="checkbox" checked={buyer.notifWhatsapp} onChange={(e) => setBuyer({ ...buyer, notifWhatsapp: e.target.checked })} />
        {' '}Quiero recibir mis entradas también por WhatsApp
      </label>
      {buyer.notifWhatsapp && (
        <>
          <label>Teléfono (WhatsApp)</label>
          <input inputMode="tel" placeholder="8888 8888" value={buyer.telefono} onChange={(e) => setBuyer({ ...buyer, telefono: e.target.value })} />
        </>
      )}

      <label>¿Tenés un código de descuento?</label>
      {aplicado ? (
        <div className="two"><div><input value={aplicado.codigo} disabled /></div><div><button className="btn ghost" onClick={quitarCodigo}>Quitar</button></div></div>
      ) : (
        <div className="two"><div><input value={codigo} placeholder="CODIGO" onChange={(e) => setCodigo(e.target.value.toUpperCase())} /></div><div><button className="btn ghost" onClick={aplicarCodigo} disabled={descLoading || codigo.trim().length < 3}>{descLoading ? '...' : 'Aplicar'}</button></div></div>
      )}
      {descMsg && <div className="muted" style={{ fontSize: '.85rem' }}>{descMsg}</div>}

      <div className="checkout-desglose" style={{ margin: '12px 0', fontSize: '.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {descuento > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0a7d3a' }}><span>Descuento</span><span>−{money(descuento)}</span></div>}
        {feeCrc > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cargo por servicio</span><span>{money(feeCrc)}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #ddd', marginTop: 6, paddingTop: 6 }}><span>Total</span><span>{money(grandTotal)}</span></div>
      </div>

      <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>Te llevaremos a la pasarela segura para completar el pago. Tus datos de tarjeta nunca pasan por este sitio.</p>
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit} disabled={loading}>{loading ? 'Redirigiendo...' : `Pagar ${money(grandTotal)}`}</button>
    </Modal>
  );
}

function TicketsModal({ result, onClose }) {
  return (
    <Modal title="Compra exitosa" onClose={onClose}>
      <p className="muted">
        {result.emailSent === false ? 'Compra registrada. No se pudo enviar el correo ahora, guarda estos codigos.' : (result.correo ? `Enviamos tus boletos a ${result.correo}.` : 'Tus boletos estan listos. Tambien te los enviamos por correo.')}
        {result.whatsappSent ? ' También los enviamos por WhatsApp.' : ''}
      </p>
      <div className="tickets-grid">
        {result.boletos.map((b) => (
          <div key={b.codigo} className="ticket-qr">
            <QRImage data={b.qrData} size={130} />
            <b>{b.tipoNombre}</b>
            {b.asientoLabel && <span style={{ fontWeight: 700 }}>{b.asientoLabel}</span>}
            <span>{b.codigo}</span>
          </div>
        ))}
      </div>
      <button className="btn" onClick={onClose}>Listo</button>
    </Modal>
  );
}

function AdminEntradas({ user, route = '/admin/entradas', navigate }) {
  const canManage = user.eventsRole === 'admin';
  const canGate = user.eventsRole === 'admin' || user.eventsRole === 'operador';
  const canSales = canManage || user.eventsRole === 'operador' || user.eventsRole === 'comercial';
  const [tab, setTab] = useState(canManage ? 'eventos' : canGate ? 'puerta' : 'ventas');

  if (canManage && route === '/admin/entradas/nuevo') {
    return <EventCreateWorkspace navigate={navigate} />;
  }

  if (canManage && route.startsWith('/admin/entradas/')) {
    const eventId = decodeURIComponent(route.slice('/admin/entradas/'.length).replace(/\/$/, ''));
    return <EventWorkspace eventId={eventId} navigate={navigate} />;
  }

  return (
    <main className="page">
      <p className="eyebrow">Venta de boletos</p><h1>Gestion de entradas</h1>
      <div className="tabs">
        {canManage && <button className={tab === 'eventos' ? 'active' : ''} onClick={() => setTab('eventos')}>Eventos</button>}
        {canSales && <button className={tab === 'ventas' ? 'active' : ''} onClick={() => setTab('ventas')}>Ventas</button>}
        {canManage && <button className={tab === 'descuentos' ? 'active' : ''} onClick={() => setTab('descuentos')}>Descuentos</button>}
        {canSales && <button className={tab === 'promotores' ? 'active' : ''} onClick={() => setTab('promotores')}>Promotores</button>}
        {canGate && <button className={tab === 'puerta' ? 'active' : ''} onClick={() => setTab('puerta')}><ScanLine size={15} />Puerta</button>}
      </div>
      {tab === 'eventos' && canManage && (
        <AdminEventosTab
          onNew={() => navigate('/admin/entradas/nuevo')}
          onOpen={(eventId) => navigate(`/admin/entradas/${encodeURIComponent(eventId)}`)}
          onUseTemplate={(t) => {
            // El workspace de creación lo lee al montar y aplica la plantilla
            // al borrador auto-creado en vez de sembrar el estadio base.
            sessionStorage.setItem('entradas_new_event_template', JSON.stringify({ id: t.id, formato: t.formato || '' }));
            navigate('/admin/entradas/nuevo');
          }}
        />
      )}
      {tab === 'ventas' && canSales && <AdminVentasTab />}
      {tab === 'descuentos' && canManage && <AdminDescuentosTab />}
      {tab === 'promotores' && canSales && <AdminPromotoresTab canManage={canManage} />}
      {tab === 'puerta' && canGate && <AdminPuertaTab />}
    </main>
  );
}

function AdminPromotoresTab({ canManage }) {
  const [ranking, setRanking] = useState([]);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = async () => {
    const d = await api('/admin/api/entradas/promotores/ranking');
    if (d.ok) setRanking(d.ranking);
  };
  useEffect(() => { load(); }, []);
  async function copiarLink(p) {
    const link = `${location.origin}/entradas?ref=${encodeURIComponent(p.codigo)}`;
    try {
      await navigator.clipboard.writeText(link);
      setMsg({ type: 'ok', text: `Link de ${p.nombre} copiado: ${link}` });
    } catch {
      setMsg({ type: 'ok', text: link });
    }
  }
  async function del(p) {
    if (!window.confirm(`¿Eliminar al promotor "${p.nombre}"? Las ventas ya atribuidas se conservan.`)) return;
    const d = await api(`/admin/api/entradas/promotores/${p.id}`, { method: 'DELETE' });
    if (d.ok) load();
  }
  const comisionLabel = (p) => (p.comisionTipo === 'pct' ? `${p.comisionValor}% del subtotal` : `${money(p.comisionValor)} por orden`);
  return (
    <>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      {canManage && <div className="actions left"><button className="btn" onClick={() => setModal({})}><Plus size={16} />Nuevo promotor</button></div>}
      <DataTable
        id="promotores"
        rows={ranking}
        rowKey={(r) => r.promotor.id}
        empty="Sin promotores registrados."
        columns={[
          { key: 'nombre', label: 'Promotor', sortValue: (r) => r.promotor.nombre, render: (r) => <><b>{r.promotor.nombre}</b>{!r.promotor.activo && <span className="pill borrador" style={{ marginLeft: 6 }}>inactivo</span>}</> },
          { key: 'codigo', label: 'Código', sortValue: (r) => r.promotor.codigo, render: (r) => r.promotor.codigo },
          { key: 'comision', label: 'Comisión', sortValue: (r) => r.promotor.comisionValor, render: (r) => comisionLabel(r.promotor) },
          { key: 'ordenes', label: 'Órdenes' },
          { key: 'boletos', label: 'Boletos' },
          { key: 'ventasCrc', label: 'Ventas', render: (r) => money(r.ventasCrc) },
          { key: 'comisionCrc', label: 'Comisión ₡', render: (r) => money(r.comisionCrc) },
          {
            key: 'acciones', label: '', menuLabel: 'Acciones', sortable: false,
            tdProps: () => ({ className: 'row-actions' }),
            render: (r) => (
              <>
                <button className="link-cell" onClick={() => copiarLink(r.promotor)}>Copiar link</button>
                {canManage && <button className="link-cell" onClick={() => setModal(r.promotor)}>Editar</button>}
                {canManage && <button className="link-cell danger" onClick={() => del(r.promotor)}>Eliminar</button>}
              </>
            ),
          },
        ]}
      />
      {modal && <PromotorModal promotor={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </>
  );
}

function PromotorModal({ promotor, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre: promotor?.nombre || '',
    codigo: promotor?.codigo || '',
    comisionTipo: promotor?.comisionTipo || 'pct',
    comisionValor: promotor?.comisionValor ?? 10,
    activo: promotor?.activo ?? true,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit() {
    setError(''); setLoading(true);
    const url = promotor ? `/admin/api/entradas/promotores/${promotor.id}` : '/admin/api/entradas/promotores';
    const d = await api(url, { method: promotor ? 'PUT' : 'POST', body: JSON.stringify(form) });
    setLoading(false);
    if (!d.ok) return setError(d.error);
    onSaved();
  }
  return (
    <Modal title={promotor ? 'Editar promotor' : 'Nuevo promotor'} onClose={onClose}>
      <label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
      <label>Código (vacío = se genera automático)</label><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} placeholder="JUAN10" />
      <div className="two">
        <div><label>Tipo de comisión</label><select value={form.comisionTipo} onChange={(e) => setForm({ ...form, comisionTipo: e.target.value })}><option value="pct">% del subtotal</option><option value="crc">Monto fijo por orden</option></select></div>
        <div><label>Valor</label><input type="number" min="0" value={form.comisionValor} onChange={(e) => setForm({ ...form, comisionValor: Number(e.target.value) })} /></div>
      </div>
      <label className="check"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo</label>
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit} disabled={loading || form.nombre.trim().length < 3}>{loading ? 'Guardando...' : 'Guardar'}</button>
    </Modal>
  );
}

function AdminDescuentosTab() {
  const [descuentos, setDescuentos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const load = async () => {
    const d = await api('/admin/api/entradas/descuentos');
    if (d.ok) setDescuentos(d.descuentos);
    const e = await api('/admin/api/entradas/eventos');
    if (e.ok) setEventos(e.eventos.map((x) => x.evento));
  };
  useEffect(() => { load(); }, []);
  async function del(id) {
    if (!window.confirm('¿Eliminar este código de descuento?')) return;
    const d = await api(`/admin/api/entradas/descuentos/${id}`, { method: 'DELETE' });
    if (d.ok) load();
  }
  const feeLabel = (t, v) => (t === 'ninguno' || !t ? 'Sin cargo' : t === 'pct' ? `${v}%` : money(v));
  return (
    <>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <div className="actions left"><button className="btn" onClick={() => setModal({})}><Plus size={16} />Nuevo código</button></div>
      <DataTable
        id="descuentos"
        rows={descuentos}
        empty="Sin códigos de descuento."
        columns={[
          { key: 'codigo', label: 'Código', render: (d) => <b>{d.codigo}</b> },
          { key: 'valor', label: 'Descuento', render: (d) => feeLabel(d.tipo === 'monto' ? 'crc' : 'pct', d.valor) },
          { key: 'evento', label: 'Evento', sortValue: (d) => (d.eventoId ? (eventos.find((e) => e.id === d.eventoId)?.nombre || '—') : 'Todos'), render: (d) => (d.eventoId ? (eventos.find((e) => e.id === d.eventoId)?.nombre || '—') : 'Todos') },
          { key: 'usos', label: 'Usos', sortValue: (d) => d.usosActuales, render: (d) => <>{d.usosActuales}{d.usosMax != null ? ` / ${d.usosMax}` : ''}</> },
          { key: 'activo', label: 'Estado', sortValue: (d) => (d.activo ? 0 : 1), render: (d) => <span className={`pill ${d.activo ? 'publicado' : 'borrador'}`}>{d.activo ? 'activo' : 'inactivo'}</span> },
          {
            key: 'acciones', label: '', menuLabel: 'Acciones', sortable: false,
            tdProps: () => ({ className: 'row-actions' }),
            render: (d) => (
              <>
                <button className="link-cell" onClick={() => setModal(d)}>Editar</button>
                <button className="link-cell danger" onClick={() => del(d.id)}>Eliminar</button>
              </>
            ),
          },
        ]}
      />
      {modal && <DescuentoModal descuento={modal.id ? modal : null} eventos={eventos} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </>
  );
}

function DescuentoModal({ descuento, eventos, onClose, onSaved }) {
  const toLocal = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
  const [form, setForm] = useState({
    codigo: descuento?.codigo || '',
    tipo: descuento?.tipo || 'pct',
    valor: descuento?.valor || 10,
    eventoId: descuento?.eventoId || '',
    usosMax: descuento?.usosMax ?? '',
    vigenciaDesde: toLocal(descuento?.vigenciaDesde),
    vigenciaHasta: toLocal(descuento?.vigenciaHasta),
    activo: descuento?.activo ?? true,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit() {
    setError(''); setLoading(true);
    const body = { ...form, eventoId: form.eventoId || null, usosMax: form.usosMax === '' ? null : Number(form.usosMax) };
    const url = descuento ? `/admin/api/entradas/descuentos/${descuento.id}` : '/admin/api/entradas/descuentos';
    const d = await api(url, { method: descuento ? 'PUT' : 'POST', body: JSON.stringify(body) });
    setLoading(false);
    if (!d.ok) return setError(d.error);
    onSaved();
  }
  return (
    <Modal title={descuento ? 'Editar código' : 'Nuevo código'} onClose={onClose}>
      <label>Código</label><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} autoFocus />
      <div className="two">
        <div><label>Tipo</label><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="pct">Porcentaje (%)</option><option value="monto">Monto fijo (CRC)</option></select></div>
        <div><label>Valor</label><input type="number" min="1" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} /></div>
      </div>
      <label>Evento</label>
      <select value={form.eventoId} onChange={(e) => setForm({ ...form, eventoId: e.target.value })}>
        <option value="">Todos los eventos</option>
        {eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
      </select>
      <label>Límite de usos (opcional)</label><input type="number" min="1" value={form.usosMax} onChange={(e) => setForm({ ...form, usosMax: e.target.value })} placeholder="Sin límite" />
      <div className="two">
        <div><label>Vigente desde</label><input type="datetime-local" value={form.vigenciaDesde} onChange={(e) => setForm({ ...form, vigenciaDesde: e.target.value })} /></div>
        <div><label>Vigente hasta</label><input type="datetime-local" value={form.vigenciaHasta} onChange={(e) => setForm({ ...form, vigenciaHasta: e.target.value })} /></div>
      </div>
      <label className="check"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo</label>
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit} disabled={loading || form.codigo.trim().length < 3}>{loading ? 'Guardando...' : 'Guardar'}</button>
    </Modal>
  );
}

function AdminEventosTab({ onNew, onOpen, onUseTemplate }) {
  const [eventos, setEventos] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const refresh = async () => { const d = await api('/admin/api/entradas/eventos'); if (d.ok) setEventos(d.eventos); };
  useEffect(() => { refresh(); }, []);
  return (
    <>
      <div className="actions left">
        <button className="btn" onClick={onNew}><Plus size={16} />Nuevo evento</button>
        <button className={`btn ghost${showTemplates ? ' active' : ''}`} onClick={() => setShowTemplates((visible) => !visible)}><Sparkles size={16} />Templates</button>
      </div>
      {showTemplates && <TemplatesPanel onClose={() => setShowTemplates(false)} onUse={onUseTemplate} />}
      <DataTable
        id="eventos"
        rows={eventos}
        rowKey={(ev) => ev.evento.id}
        rowProps={(ev) => ({ className: 'clickable-row', onClick: () => onOpen(ev.evento.id) })}
        columns={[
          { key: 'nombre', label: 'Evento', sortValue: (ev) => ev.evento.nombre, render: (ev) => <button className="link-cell" onClick={(e) => { e.stopPropagation(); onOpen(ev.evento.id); }}>{ev.evento.nombre}</button> },
          { key: 'fecha', label: 'Fecha', sortValue: (ev) => new Date(ev.evento.fecha).getTime(), render: (ev) => fmtFullDate(ev.evento.fecha) },
          { key: 'estado', label: 'Estado', sortValue: (ev) => ev.evento.estado, render: (ev) => <span className={`pill ${ev.evento.estado}`}>{ev.evento.estado}</span> },
          { key: 'boletosVendidos', label: 'Vendidos' },
          { key: 'ingresosCrc', label: 'Ingresos', render: (ev) => money(ev.ingresosCrc) },
        ]}
      />
      <EntradasLogPanel eventos={eventos} refreshKey={0} />
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
      <DataTable
        id="entradas-log"
        rows={rows}
        empty={loading ? 'Cargando log...' : 'Sin registros para mostrar.'}
        columns={[
          { key: 'timestamp', label: 'Fecha/Hora', render: (row) => fmtFullDate(row.timestamp), sortValue: (row) => new Date(row.timestamp).getTime() },
          { key: 'tipo', label: 'Tipo', sortValue: (row) => entradaLogLabel(row.tipo), render: (row) => <span className="pill">{entradaLogLabel(row.tipo)}</span> },
          { key: 'evento', label: 'Evento', sortValue: (row) => eventNames[row.eventoId] || row.eventoId || 'General', render: (row) => eventNames[row.eventoId] || row.eventoId || 'General' },
          { key: 'boletoId', label: 'Boleto', render: (row) => row.boletoId || '-' },
          { key: 'userName', label: 'Usuario', render: (row) => row.userName || '-' },
          { key: 'notas', label: 'Notas', render: (row) => row.notas || '-' },
        ]}
      />
    </section>
  );
}

// Gestión de templates dentro de la página, sin diálogos nativos ni modales.
function TemplatesPanel({ onClose, onUse }) {
  const [templates, setTemplates] = useState([]);
  const [msg, setMsg] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const load = async () => {
    const d = await api('/admin/api/entradas/templates');
    if (d.ok) setTemplates(d.templates);
  };
  useEffect(() => { load(); }, []);

  function startRename(t) {
    setDeletingId(null);
    setEditingId(t.id);
    setEditingName(t.nombre);
    setMsg(null);
  }

  async function renombrar(t) {
    const nombre = editingName.trim();
    if (!nombre) return setMsg({ type: 'error', text: 'Escribí un nombre para el template.' });
    if (nombre === t.nombre) {
      setEditingId(null);
      return;
    }
    const d = await api(`/admin/api/entradas/templates/${t.id}`, { method: 'PUT', body: JSON.stringify({ nombre, descripcion: t.descripcion }) });
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    setEditingId(null);
    setMsg({ type: 'ok', text: `Template renombrado como "${nombre}".` });
    load();
  }

  async function eliminar(t) {
    const d = await api(`/admin/api/entradas/templates/${t.id}`, { method: 'DELETE' });
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    setDeletingId(null);
    setMsg({ type: 'ok', text: `Template "${t.nombre}" eliminado. Los eventos existentes no cambiaron.` });
    load();
  }

  return (
    <section className="templates-inline-panel" aria-label="Templates de evento">
      <header className="templates-inline-head">
        <div>
          <p className="eyebrow">Configuraciones reutilizables</p>
          <h2>Templates de evento</h2>
          <p className="muted">Guardan sectores, precios, estados y tandas de preventa.</p>
        </div>
        <button className="btn ghost" onClick={onClose}>Cerrar</button>
      </header>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <DataTable
        id="templates"
        rows={templates}
        empty="Sin templates guardados."
        columns={[
          {
            key: 'nombre', label: 'Template',
            render: (t) => (editingId === t.id ? (
              <div className="template-inline-edit">
                <input value={editingName} onChange={(e) => setEditingName(e.target.value)} autoFocus aria-label={`Nuevo nombre de ${t.nombre}`} />
                <button className="btn xs" onClick={() => renombrar(t)}>Guardar</button>
                <button className="btn ghost xs" onClick={() => setEditingId(null)}>Cancelar</button>
              </div>
            ) : (
              <><b>{t.nombre}</b>{t.descripcion && <><br /><small className="muted">{t.descripcion}</small></>}</>
            )),
          },
          { key: 'formato', label: 'Formato' },
          { key: 'sectores', label: 'Sectores', sortValue: (t) => t.sectores, render: (t) => <>{t.sectores}{t.numerados > 0 ? ` (${t.numerados} num.)` : ''}</> },
          {
            key: 'acciones', label: '', menuLabel: 'Acciones', sortable: false,
            tdProps: () => ({ className: 'row-actions' }),
            render: (t) => (
              <>
                {editingId !== t.id && <button className="link-cell" onClick={() => onUse(t)}>Usar</button>}
                {editingId !== t.id && <button className="link-cell" onClick={() => startRename(t)}>Renombrar</button>}
                {deletingId === t.id ? (
                  <>
                    <span className="muted">¿Eliminar?</span>
                    <button className="link-cell danger" onClick={() => eliminar(t)}>Sí, eliminar</button>
                    <button className="link-cell" onClick={() => setDeletingId(null)}>Cancelar</button>
                  </>
                ) : (
                  <button className="link-cell danger" onClick={() => { setEditingId(null); setDeletingId(t.id); setMsg(null); }}>Eliminar</button>
                )}
              </>
            ),
          },
        ]}
      />
    </section>
  );
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const EVENT_VENUES = [
  {
    id: 'erc',
    name: 'Estadio Eladio Rosabal Cordero',
  },
];

const EVENT_FLYER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const EVENT_FLYER_MAX_BYTES = 8 * 1024 * 1024;

// Valores placeholder del borrador auto-creado: permiten persistir el evento
// (y activar el mapa) antes de que el admin llene nombre y fecha reales.
const DRAFT_NOMBRE_PLACEHOLDER = 'Evento sin título';
function defaultDraftFecha() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(19, 0, 0, 0);
  return d.toISOString();
}

function EventFlyerPicker({ imageUrl = '', file = null, onFile, onError, busy = false, compact = false }) {
  const inputRef = useRef(null);
  const [localPreview, setLocalPreview] = useState('');

  useEffect(() => {
    if (!file) {
      setLocalPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (!EVENT_FLYER_TYPES.includes(selected.type)) {
      onError?.('El flyer debe ser JPG, PNG, WebP o AVIF.');
      return;
    }
    if (selected.size > EVENT_FLYER_MAX_BYTES) {
      onError?.('El flyer no puede superar 8 MB.');
      return;
    }
    onError?.('');
    onFile(selected);
  }

  const preview = localPreview || imageUrl;
  return (
    <div className={`event-flyer-picker${compact ? ' event-flyer-picker--compact' : ''}`}>
      <div className="event-flyer-preview">
        {preview
          ? <img src={preview} alt="Vista previa del flyer del evento" />
          : <div className="event-flyer-placeholder"><ImagePlus size={28} /><span>Flyer del evento</span></div>}
      </div>
      <div className="event-flyer-copy">
        <b>Imagen promocional</b>
        <span>JPG, PNG, WebP o AVIF · máximo 8 MB</span>
        <input ref={inputRef} type="file" accept={EVENT_FLYER_TYPES.join(',')} hidden onChange={choose} />
        <button type="button" className="btn ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
          <ImagePlus size={15} />{busy ? 'Subiendo…' : preview ? 'Reemplazar flyer' : 'Subir flyer'}
        </button>
      </div>
    </div>
  );
}

function EventCreateWorkspace({ navigate }) {
  const [templates, setTemplates] = useState([]);
  // Plantilla elegida desde el panel de templates ("Usar"): se lee de forma
  // síncrona para que el borrador auto-creado nazca ya con ella aplicada.
  const [initialTemplate] = useState(() => {
    try {
      const raw = sessionStorage.getItem('entradas_new_event_template');
      if (!raw) return null;
      sessionStorage.removeItem('entradas_new_event_template');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  const [templateId, setTemplateId] = useState(initialTemplate?.id || '');
  const [form, setForm] = useState({
    nombre: '',
    venue: 'Estadio Eladio Rosabal Cordero',
    fecha: '',
    descripcion: '',
    formato: initialTemplate?.formato === 'espectaculo' ? 'espectaculo' : 'partido',
  });
  const [error, setError] = useState('');
  // Borrador auto-creado: se persiste apenas se abre la página (con nombre y
  // fecha placeholder si aún no se llenan) para que el mapa (paso 03) esté
  // activo desde el inicio; cada cambio del formulario lo actualiza después.
  const [draft, setDraft] = useState(null);
  const [usedTemplate, setUsedTemplate] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [toast, setToast] = useState(null); // { text, kind: 'saving' | 'saved' | 'error' }
  const [flyerFile, setFlyerFile] = useState(null);
  const [flyerBusy, setFlyerBusy] = useState(false);
  const [flyerError, setFlyerError] = useState('');
  // Guardar la config del estadio (zonas, precios, butacas, tandas) como
  // plantilla reutilizable; los datos del evento no forman parte.
  const [finishing, setFinishing] = useState(false);
  const draftRef = useRef(null);
  const busyRef = useRef(false);
  const flyerFileRef = useRef(null);

  useEffect(() => {
    api('/admin/api/entradas/templates').then((d) => {
      if (d.ok) setTemplates(d.templates);
    });
  }, []);

  // Banner de guardado (arriba a la derecha); el de éxito se oculta solo.
  useEffect(() => {
    if (saveState === 'saving') {
      setToast({ text: 'Guardando borrador…', kind: 'saving' });
      return undefined;
    }
    if (saveState === 'saved') {
      setToast({ text: 'Borrador guardado', kind: 'saved' });
      const timer = setTimeout(() => setToast(null), 2400);
      return () => clearTimeout(timer);
    }
    if (saveState === 'error') {
      setToast({ text: 'No se pudo guardar el borrador', kind: 'error' });
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [saveState]);

  const selectedTemplate = templates.find((template) => template.id === templateId);
  const previewTipos = useMemo(() => {
    const sectores = form.formato === 'espectaculo' ? [...ERC_SECTORES, ...GRAMILLA_SECTORES.slice(0, 3)] : ERC_SECTORES;
    return Object.fromEntries(sectores.map((sector) => [sector.key, {
      nombre: sector.nombre,
      estado: 'activo',
      disponibles: sector.stock,
      precioCrc: sector.precio,
    }]));
  }, [form.formato]);

  function chooseTemplate(id) {
    const template = templates.find((item) => item.id === id);
    setTemplateId(id);
    if (template?.formato) setForm((current) => ({ ...current, formato: template.formato }));
  }

  async function uploadFlyer(evento, file) {
    setFlyerBusy(true);
    const result = await uploadFile(`/admin/api/entradas/eventos/${evento.id}/flyer`, file);
    setFlyerBusy(false);
    if (!result.ok) {
      setFlyerError(result.error || 'No se pudo subir el flyer.');
      return evento;
    }
    setFlyerError('');
    flyerFileRef.current = null;
    setFlyerFile(null);
    draftRef.current = result.evento;
    setDraft(result.evento);
    return result.evento;
  }

  async function chooseFlyer(file) {
    flyerFileRef.current = file;
    setFlyerFile(file);
    setFlyerError('');
    if (draftRef.current) await uploadFlyer(draftRef.current, file);
  }

  // Autosave con debounce: crea el borrador de una vez al montar (el mapa no
  // depende de que nombre/fecha estén llenos) y luego actualiza con cada cambio.
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      setSaveState('saving');
      const payload = {
        ...form,
        nombre: form.nombre.trim().length >= 3 ? form.nombre : (draftRef.current?.nombre || DRAFT_NOMBRE_PLACEHOLDER),
        fecha: form.fecha || draftRef.current?.fecha || defaultDraftFecha(),
      };
      if (!draftRef.current) {
        const d = await api('/admin/api/entradas/eventos', { method: 'POST', body: JSON.stringify(payload) });
        if (!d.ok) {
          setSaveState('error');
          setError(d.error);
          busyRef.current = false;
          return;
        }
        if (templateId) {
          const applied = await api(`/admin/api/entradas/eventos/${d.evento.id}/aplicar-template`, {
            method: 'POST',
            body: JSON.stringify({ templateId }),
          });
          if (applied.ok) setUsedTemplate(true);
          else setError(`No se pudo aplicar el template: ${applied.error}`);
        }
        let savedEvento = d.evento;
        if (flyerFileRef.current) savedEvento = await uploadFlyer(savedEvento, flyerFileRef.current);
        draftRef.current = savedEvento;
        setDraft(savedEvento);
        setSaveState('saved');
      } else {
        const d = await api(`/admin/api/entradas/eventos/${draftRef.current.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...payload,
            imagenUrl: draftRef.current.imagenUrl || '',
            feeTipo: draftRef.current.feeTipo || '',
            feeValor: draftRef.current.feeValor || 0,
          }),
        });
        if (d.ok) {
          draftRef.current = d.evento;
          setDraft(d.evento);
          setSaveState('saved');
        } else {
          setSaveState('error');
          setError(d.error);
        }
      }
      busyRef.current = false;
    }, draftRef.current ? 900 : 250); // la primera creación es casi inmediata: activa el mapa
    return () => clearTimeout(timer);
  }, [form, templateId]);

  const selectedVenue = EVENT_VENUES.find((venue) => venue.name === form.venue);

  const templateNombre = `${(form.nombre.trim().length >= 3 ? form.nombre.trim() : (draft?.nombre || DRAFT_NOMBRE_PLACEHOLDER))}-plantilla`;

  async function guardarPlantilla() {
    if (!draftRef.current) return;
    setFinishing(true);
    setToast({ text: 'Guardando plantilla…', kind: 'saving' });
    const d = await api(`/admin/api/entradas/eventos/${draftRef.current.id}/guardar-template`, {
      method: 'POST',
      body: JSON.stringify({
        nombre: templateNombre,
        descripcion: `Configuración del estadio guardada desde "${draftRef.current.nombre}"`,
      }),
    });
    setFinishing(false);
    if (!d.ok) {
      setToast(null);
      setError(`No se pudo guardar la plantilla: ${d.error}`);
      return;
    }
    setError('');
    setToast({ text: `Plantilla «${templateNombre}» guardada`, kind: 'saved' });
    setTimeout(() => setToast(null), 2400);
  }

  function finishAndExit() {
    navigate('/admin/entradas');
  }

  return (
    <main className="page event-workspace-page event-create-page">
      <header className="event-workspace-header">
        <div>
          <button className="workspace-back" onClick={() => navigate('/admin/entradas')}>‹ Volver a eventos</button>
          <p className="eyebrow">Nuevo evento</p>
          <h1>Preparar evento</h1>
          <p className="sub">Todo se configura en esta página: datos, formato y el mapa. El borrador se guarda solo.</p>
        </div>
        <div className="event-workspace-actions">
          <button className="btn ghost" onClick={() => navigate('/admin/entradas')}>Cancelar</button>
          <button className="btn" onClick={finishAndExit} disabled={!draft}>
            {saveState === 'saving' ? 'Guardando…' : 'Guardar evento'}
          </button>
        </div>
      </header>

      {error && <div className="error workspace-message">{error}</div>}
      {toast && (
        <div className={`save-toast save-toast--${toast.kind}`}>
          {toast.kind === 'saved' ? '✓ ' : ''}{toast.text}
        </div>
      )}

      <form id="new-event-form" className="event-create-details" onSubmit={(e) => e.preventDefault()}>
        <div className="event-create-col">
          <div className="workspace-section-heading">
            <div><h2>Datos del evento</h2><p>La información pública que verá la afición.</p></div>
          </div>
          <div className="event-create-details-layout">
            <div className="event-create-details-grid">
              <div className="event-create-field event-create-field--wide">
                <label>Nombre</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus placeholder="Herediano vs ..." />
              </div>
              <div className="event-create-field">
                <label>Lugar</label>
                <select value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}>
                  <option value="__create_stadium__" disabled>＋ Crear nuevo estadio</option>
                  {EVENT_VENUES.map((venue) => (
                    <option key={venue.id} value={venue.name}>{venue.name}</option>
                  ))}
                </select>
              </div>
              <div><label>Fecha y hora</label><input type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
              <div className="event-create-field event-create-field--wide">
                <label>Descripción</label>
                <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Información útil para quienes compran" />
              </div>
              <div className="event-create-field event-create-field--wide event-create-format-field">
                <label>Formato del evento</label>
                <div className="evento-formato-opts event-format-selector" role="radiogroup" aria-label="Formato del evento">
                  {[
                    { value: 'partido', label: 'Partido', desc: 'Seis tribunas', Icon: Trophy },
                    { value: 'espectaculo', label: 'Espectáculo', desc: 'Tribunas y gramilla', Icon: Sparkles },
                  ].map(({ value, label, desc, Icon }) => (
                    <label key={value} className={`evento-formato-opt${form.formato === value ? ' active' : ''}`}>
                      <input type="radio" name="formato" aria-label={label} checked={form.formato === value} onChange={() => setForm({ ...form, formato: value })} />
                      <span className="event-format-icon"><Icon size={18} /></span>
                      <span className="event-format-copy">
                        <span className="evento-formato-opt-label">{label}</span>
                        <span className="evento-formato-opt-desc">{desc}</span>
                      </span>
                      <span className="event-format-check" aria-hidden="true">{form.formato === value && <Check size={15} />}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <EventFlyerPicker
                imageUrl={draft?.imagenUrl || ''}
                file={flyerFile}
                onFile={chooseFlyer}
                onError={setFlyerError}
                busy={flyerBusy}
                compact
              />
              {flyerError && <div className="error event-flyer-error">{flyerError}</div>}
            </div>
          </div>
        </div>
      </form>

      <section className="event-create-map-step">
        <div className="workspace-section-heading workspace-section-heading--spaced">
          <div>
            <h2>Configuración del Estadio</h2>
            <p>
              {draft
                ? 'Tocá cada zona para precio, estado, tandas y butacas. El aforo se reparte automáticamente.'
                : 'Preparando el mapa…'}
            </p>
          </div>
        </div>
        <div className="event-create-map-options event-create-map-options--single">
          <div className="event-create-map-option">
            <label>Plantilla del estadio</label>
            <select value={templateId} disabled={!!draft} onChange={(e) => chooseTemplate(e.target.value)}>
              <option value="">Plantilla base — Estadio Eladio Rosabal Cordero</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.nombre} · {template.sectores} sectores
                </option>
              ))}
            </select>
            {selectedTemplate?.descripcion && <p className="muted template-description">{selectedTemplate.descripcion}</p>}
            {draft && <p className="muted template-description">La plantilla quedó definida al crear el borrador. Ajustá las zonas directamente en el mapa.</p>}
          </div>
        </div>
        {selectedVenue?.id === 'erc' && (
          draft
            ? <VenueMapConfig key={`${draft.id}:${draft.formato}:${draft.venue}`} evento={draft} autoSeed />
            : (
              <div className="event-create-map-preview">
                <StadiumSvgERC
                  tiposByKey={previewTipos}
                  venue={form.venue}
                  fieldTemplate={form.formato === 'espectaculo' ? '3' : null}
                  fieldSplits={form.formato === 'espectaculo' ? SPLITS_POR_TEMPLATE[3] : null}
                  interactive={false}
                />
              </div>
            )
        )}
        {draft && (
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn ghost" onClick={guardarPlantilla} disabled={finishing} title={`Se guarda como «${templateNombre}»`}>
              {finishing ? 'Guardando plantilla…' : 'Guardar el estadio como plantilla'}
            </button>
            <button className="btn" onClick={finishAndExit}>
              Guardar evento
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function EventBasicsPanel({ evento, onSavingChange, onSaved }) {
  const [form, setForm] = useState({
    nombre: evento.nombre,
    venue: evento.venue || '',
    fecha: toDateTimeLocal(evento.fecha),
    descripcion: evento.descripcion || '',
  });
  const [loading, setLoading] = useState(false);
  const [flyerFile, setFlyerFile] = useState(null);
  const [flyerError, setFlyerError] = useState('');
  const [error, setError] = useState('');

  const setSaving = (value) => { setLoading(value); onSavingChange?.(value); };

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (form.nombre.trim().length < 3 || !form.fecha) {
      return setError('Completá el nombre (mínimo 3 caracteres) y la fecha del evento.');
    }
    setSaving(true);
    const d = await api(`/admin/api/entradas/eventos/${evento.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...form,
        formato: evento.formato,
        imagenUrl: evento.imagenUrl || '',
        feeTipo: evento.feeTipo || '',
        feeValor: evento.feeValor || 0,
      }),
    });
    if (!d.ok) {
      setSaving(false);
      return setError(d.error);
    }
    let updated = d.evento;
    if (flyerFile) {
      const upload = await uploadFile(`/admin/api/entradas/eventos/${evento.id}/flyer`, flyerFile);
      if (!upload.ok) {
        setSaving(false);
        return setFlyerError(upload.error || 'No se pudo subir el flyer.');
      }
      updated = upload.evento;
    }
    setSaving(false);
    onSaved(updated);
  }

  return (
    <form id="event-basics-form" className="workspace-inline-form" onSubmit={submit}>
      <div className="workspace-inline-copy">
        <p className="eyebrow">Datos del evento</p>
        <h2>Editar información</h2>
        <p>Los cambios se reflejan en la venta pública.</p>
        <EventFlyerPicker
          imageUrl={evento.imagenUrl}
          file={flyerFile}
          onFile={(file) => { setFlyerFile(file); setFlyerError(''); }}
          onError={setFlyerError}
          busy={loading}
          compact
        />
        {flyerError && <div className="error event-flyer-error">{flyerError}</div>}
      </div>
      <div className="workspace-inline-fields">
        <label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        <div className="event-form-row">
          <div><label>Lugar</label><input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></div>
          <div><label>Fecha y hora</label><input type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
        </div>
        <label>Descripción</label><input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        {error && <div className="error">{error}</div>}
        <p className="muted">{loading ? 'Guardando…' : 'Usá «Guardar» arriba para aplicar los cambios.'}</p>
      </div>
    </form>
  );
}

function TemplateSavePanel({ evento, tipos, onCancel, onSaved }) {
  const [nombre, setNombre] = useState(evento.nombre);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const cleanName = nombre.trim();
    if (!cleanName) return setError('Escribí un nombre para identificar el template.');
    setError('');
    setLoading(true);
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/guardar-template`, {
      method: 'POST',
      body: JSON.stringify({ nombre: cleanName }),
    });
    setLoading(false);
    if (!d.ok) return setError(d.error);
    onSaved(d.template);
  }

  return (
    <form className="workspace-confirm-panel" onSubmit={submit}>
      <div className="workspace-confirm-icon"><Sparkles size={22} /></div>
      <div className="workspace-confirm-copy">
        <p className="eyebrow">Confirmar template</p>
        <h2>Guardar esta configuración</h2>
        <p>Se copiarán {tipos.length} sectores, sus precios, estados y tandas de preventa. Las ventas del evento no se incluyen.</p>
      </div>
      <div className="workspace-confirm-controls">
        <label>Nombre del template</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="Partido ERC estándar" />
        {error && <div className="error">{error}</div>}
        <div className="workspace-inline-buttons">
          <button className="btn" disabled={loading}>{loading ? 'Guardando…' : 'Sí, guardar template'}</button>
          <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </form>
  );
}

function EventWorkspace({ eventId, navigate }) {
  const confirm = useConfirm();
  const [autoSeed] = useState(() => sessionStorage.getItem('entradas_auto_seed_event') === eventId);
  const [evento, setEvento] = useState(null);
  const [tipos, setTipos] = useState([]);
  const [sales, setSales] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [savingBasics, setSavingBasics] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [detail, salesData] = await Promise.all([
      api(`/admin/api/entradas/eventos/${eventId}`),
      api(`/admin/api/entradas/ventas/${eventId}`),
    ]);
    if (!detail.ok) {
      setError(detail.error || 'No se pudo cargar el evento.');
      setLoading(false);
      return;
    }
    setEvento(detail.evento);
    setTipos(detail.tipos || []);
    if (salesData.ok) setSales(salesData);
    setError('');
    setLoading(false);
  };

  useEffect(() => {
    load(true);
    if (autoSeed) sessionStorage.removeItem('entradas_auto_seed_event');
  }, [eventId]);

  async function toggleEstado() {
    const publicar = evento.estado !== 'publicado';
    const estado = publicar ? 'publicado' : 'finalizado';
    const ok = await confirm(publicar
      ? {
        title: 'Publicar evento',
        message: `«${evento.nombre}» quedará visible al público y sus entradas saldrán a la venta.`,
        confirmLabel: 'Publicar',
      }
      : {
        title: 'Finalizar evento',
        message: `Se cierra la venta de «${evento.nombre}». El evento dejará de estar disponible para compra.`,
        confirmLabel: 'Finalizar',
        danger: true,
      });
    if (!ok) return;
    setMsg(null);
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/estado`, {
      method: 'POST',
      body: JSON.stringify({ estado }),
    });
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    setEvento(d.evento);
    setMsg({ type: 'ok', text: `${d.evento.nombre} quedó ${estado}.` });
  }

  if (loading) return <main className="page event-workspace-page"><p className="muted">Cargando espacio de trabajo…</p></main>;
  if (error || !evento) {
    return (
      <main className="page event-workspace-page">
        <button className="workspace-back" onClick={() => navigate('/admin/entradas')}>‹ Volver a eventos</button>
        <div className="error">{error || 'Evento no encontrado.'}</div>
      </main>
    );
  }

  const capacidad = tipos.filter((tipo) => tipo.estado === 'activo').reduce((sum, tipo) => sum + (tipo.stockTotal || 0), 0);
  const vendidos = sales?.boletosVendidos || 0;
  const usados = sales?.boletosUsados || 0;
  const ocupacion = capacidad > 0 ? Math.round((vendidos / capacidad) * 1000) / 10 : 0;

  return (
    <main className="page event-workspace-page">
      <header className="event-workspace-header">
        <div className="event-workspace-title">
          <button className="workspace-back" onClick={() => navigate('/admin/entradas')}>‹ Todos los eventos</button>
          <div className="event-workspace-kicker">
            <span className={`pill ${evento.estado}`}>{evento.estado}</span>
            <span>{evento.formato === 'espectaculo' ? 'Espectáculo' : 'Partido'}</span>
          </div>
          <h1>{evento.nombre}</h1>
          <div className="event-workspace-meta">
            <span><CalendarDays size={14} />{fmtFullDate(evento.fecha)}</span>
            {evento.venue && <span>📍 {evento.venue}</span>}
          </div>
        </div>
        <div className="event-workspace-actions" aria-label="Controles del evento">
          <button className="btn ghost" type="submit" form="event-basics-form" disabled={savingBasics}><Check size={16} />{savingBasics ? 'Guardando…' : 'Guardar'}</button>
          <button className={`btn ghost${action === 'cortesia' ? ' active' : ''}`} onClick={() => setAction(action === 'cortesia' ? null : 'cortesia')}><Gift size={16} />Cortesía</button>
          <button className={`btn ghost${action === 'template' ? ' active' : ''}`} onClick={() => setAction(action === 'template' ? null : 'template')}><Sparkles size={16} />Guardar template</button>
          <button className="btn" onClick={toggleEstado}>
            {evento.estado === 'publicado' ? <><Lock size={16} />Finalizar</> : <><Send size={16} />Publicar</>}
          </button>
        </div>
      </header>

      {msg && <div className={`${msg.type === 'ok' ? 'okbox' : 'error'} workspace-message`} role="status">{msg.type === 'ok' && <Check size={17} />}{msg.text}</div>}

      {action && (
        <section className="workspace-action-region">
          {action === 'cortesia' && (
            <div className="workspace-inline-form">
              <div className="workspace-inline-copy">
                <p className="eyebrow">Invitación</p>
                <h2>Emitir cortesía</h2>
                <p>La entrada se genera y se envía sin salir de esta página.</p>
                <button className="btn ghost" onClick={() => setAction(null)}>Cerrar</button>
              </div>
              <div className="workspace-inline-fields"><CortesiaModal evento={evento} tipos={tipos} asPanel /></div>
            </div>
          )}
          {action === 'template' && (
            <TemplateSavePanel
              evento={evento}
              tipos={tipos}
              onCancel={() => setAction(null)}
              onSaved={(template) => {
                setAction(null);
                setMsg({ type: 'ok', text: `Template "${template.nombre}" guardado correctamente. Ya podés usarlo al crear otro evento.` });
              }}
            />
          )}
        </section>
      )}

      <section className="event-sales-strip" aria-label="Resumen de ventas">
        <div className="event-sales-strip-title">
          <p className="eyebrow">Venta en tiempo real</p>
          <h2>Estado del evento</h2>
        </div>
        <div><span>Ingresos</span><b>{money(sales?.ingresosCrc || 0)}</b></div>
        <div><span>Vendidos</span><b>{vendidos}</b><small>de {capacidad}</small></div>
        <div><span>Validados</span><b>{usados}</b><small>en puerta</small></div>
        <div><span>Ocupación</span><b>{ocupacion}%</b><small>aforo activo</small></div>
      </section>

      <section className="workspace-action-region">
        <EventBasicsPanel
          evento={evento}
          onSavingChange={setSavingBasics}
          onSaved={(updated) => {
            setEvento(updated);
            setMsg({ type: 'ok', text: 'Los datos del evento se guardaron correctamente.' });
            load(false);
          }}
        />
      </section>

      <section className="event-map-workspace">
        <div className="event-map-workspace-head">
          <div>
            <p className="eyebrow">Configuración directa</p>
            <h2>Mapa y zonas de venta</h2>
          </div>
          <p>Tocá una zona para editar precio, estado o preventa. Las tribunas reparten {VENUE_AFORO_DEFAULT.toLocaleString('es-CR')} lugares; al abrir la gramilla se suman ~{GRAMILLA_AFORO_DEFAULT.toLocaleString('es-CR')} lugares de pie.</p>
        </div>
        <VenueMapConfig evento={evento} autoSeed={autoSeed} onChanged={() => load(false)} />
      </section>
    </main>
  );
}

// ── Wizard de creación de eventos ───────────────────────────────────
// Flujo por pasos: 0) punto de partida → 1) datos (crea el borrador) →
// 2) sectores → 3) butacas → 4) preventa/fee → 5) revisión y publicación.
// Si se cierra a mitad, el borrador queda en la tabla y se completa después.

const WIZARD_PASOS = ['Inicio', 'Datos', 'Sectores', 'Butacas', 'Preventa', 'Revisión'];

function WizardProgress({ paso }) {
  return (
    <div style={{ display: 'flex', gap: 4, margin: '0 0 16px', flexWrap: 'wrap' }}>
      {WIZARD_PASOS.map((label, i) => (
        <span
          key={label}
          className={`pill ${i === paso ? 'publicado' : i < paso ? 'agotado' : 'borrador'}`}
          style={{ fontSize: '.68rem', opacity: i <= paso ? 1 : 0.5 }}
        >
          {i + 1}. {label}
        </span>
      ))}
    </div>
  );
}

function EventWizardModal({ onClose, onDone }) {
  const [paso, setPaso] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [evento, setEvento] = useState(null); // se crea al completar el paso Datos
  const [tipos, setTipos] = useState([]);
  const [aplicado, setAplicado] = useState(null); // resultado de aplicar template
  const [form, setForm] = useState({ nombre: '', venue: 'Estadio Eladio Rosabal Cordero', fecha: '', descripcion: '', formato: 'partido' });
  const [fee, setFee] = useState({ feeTipo: '', feeValor: 0 });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { api('/admin/api/entradas/templates').then((d) => { if (d.ok) setTemplates(d.templates); }); }, []);

  const refresh = async (id = evento?.id) => {
    if (!id) return;
    const d = await api(`/admin/api/entradas/eventos/${id}`);
    if (d.ok) { setEvento(d.evento); setTipos(d.tipos); }
  };

  function goto(n) { setError(''); setMsg(''); setPaso(n); }

  // Paso 1 → crea el borrador (o guarda cambios si ya existe) y avanza.
  async function guardarDatos() {
    setError(''); setLoading(true);
    const body = { ...form, ...fee };
    const d = evento
      ? await api(`/admin/api/entradas/eventos/${evento.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/admin/api/entradas/eventos', { method: 'POST', body: JSON.stringify(body) });
    if (!d.ok) { setLoading(false); return setError(d.error); }
    let ev = d.evento;
    // Desde template: se aplica una sola vez, justo después de crear el borrador.
    if (!evento && templateId) {
      const r = await api(`/admin/api/entradas/eventos/${ev.id}/aplicar-template`, { method: 'POST', body: JSON.stringify({ templateId }) });
      if (r.ok) setAplicado(r);
      else setError(`Template: ${r.error}`);
    }
    setLoading(false);
    setEvento(ev);
    await refresh(ev.id);
    goto(2);
  }

  async function guardarFee() {
    setError(''); setLoading(true);
    const d = await api(`/admin/api/entradas/eventos/${evento.id}`, {
      method: 'PUT',
      body: JSON.stringify({ nombre: evento.nombre, venue: evento.venue, fecha: evento.fecha, descripcion: evento.descripcion, imagenUrl: evento.imagenUrl, formato: evento.formato, ...fee }),
    });
    setLoading(false);
    if (!d.ok) return setError(d.error);
    setEvento(d.evento);
    goto(5);
  }

  async function publicar() {
    setError(''); setLoading(true);
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/estado`, { method: 'POST', body: JSON.stringify({ estado: 'publicado' }) });
    setLoading(false);
    if (!d.ok) return setError(d.error);
    onDone();
  }

  async function guardarComoTemplate() {
    const nombre = form.nombre.trim();
    if (!nombre) return;
    setError(''); setMsg('');
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/guardar-template`, { method: 'POST', body: JSON.stringify({ nombre }) });
    if (!d.ok) return setError(d.error);
    setMsg(`Template "${d.template.nombre}" guardado.`);
  }

  const numerados = tipos.filter((t) => t.numerado);
  const capacidad = tipos.reduce((s, t) => s + (t.stockTotal || 0), 0);
  const tplSel = templates.find((t) => t.id === templateId);

  return (
    <Modal title={evento ? `Nuevo evento · ${evento.nombre}` : 'Nuevo evento'} onClose={() => { if (evento) onDone(); else onClose(); }} wide>
      <WizardProgress paso={paso} />

      {paso === 0 && (
        <>
          <h3>¿Cómo querés empezar?</h3>
          <div className="evento-formato-opts">
            <label className={`evento-formato-opt${!templateId ? ' active' : ''}`}>
              <input type="radio" name="inicio" checked={!templateId} onChange={() => setTemplateId('')} />
              <span className="evento-formato-opt-label">Desde cero</span>
              <span className="evento-formato-opt-desc">Configurás sectores y precios a mano</span>
            </label>
            <label className={`evento-formato-opt${templateId ? ' active' : ''}`} style={{ opacity: templates.length === 0 ? 0.5 : 1 }}>
              <input type="radio" name="inicio" disabled={templates.length === 0} checked={Boolean(templateId)} onChange={() => setTemplateId(templates[0]?.id || '')} />
              <span className="evento-formato-opt-label">Desde template</span>
              <span className="evento-formato-opt-desc">{templates.length === 0 ? 'Aún no hay templates guardados' : 'Sectores, butacas y preventa preconfigurados'}</span>
            </label>
          </div>
          {templateId && (
            <>
              <label>Template</label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre} · {t.sectores} sectores{t.numerados > 0 ? ` (${t.numerados} numerados)` : ''}</option>
                ))}
              </select>
              {tplSel?.descripcion && <p className="muted" style={{ fontSize: '.85rem' }}>{tplSel.descripcion}</p>}
            </>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={() => goto(1)}>Siguiente</button>
          </div>
        </>
      )}

      {paso === 1 && (
        <>
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
                <input type="radio" name="formato" value={value} checked={form.formato === value} disabled={Boolean(evento)} onChange={() => setForm({ ...form, formato: value })} />
                <span className="evento-formato-opt-label">{label}</span>
                <span className="evento-formato-opt-desc">{desc}</span>
              </label>
            ))}
          </div>
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => goto(0)} disabled={Boolean(evento)}>Atrás</button>
            <button className="btn" onClick={guardarDatos} disabled={loading || form.nombre.trim().length < 3 || !form.fecha}>
              {loading ? 'Guardando…' : evento ? 'Guardar y continuar' : templateId ? 'Crear desde template' : 'Crear y continuar'}
            </button>
          </div>
        </>
      )}

      {paso === 2 && evento && (
        <>
          {aplicado && (
            <div className="okbox">
              Template aplicado: {aplicado.sectores} sectores, {aplicado.butacas} butacas, {aplicado.tandas} tandas.
              {aplicado.advertencias?.length > 0 && <><br />Advertencias: {aplicado.advertencias.join(' · ')}</>}
            </div>
          )}
          <VenueMapConfig evento={evento} autoSeed />
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => goto(1)}>Atrás</button>
            <button className="btn" onClick={async () => { await refresh(); goto(3); }}>Siguiente</button>
          </div>
        </>
      )}

      {paso === 3 && evento && (
        <>
          <h3>Butacas por sector <span className="muted" style={{ fontSize: '.8rem', fontWeight: 400 }}>(opcional — sin grilla el sector vende por cantidad)</span></h3>
          {tipos.length === 0 && <p className="muted">Este evento aún no tiene sectores; volvé al paso anterior.</p>}
          {tipos.map((t) => (
            <details key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,.08)', padding: '8px 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                {t.nombre} {t.numerado ? <span className="pill publicado" style={{ marginLeft: 6, fontSize: '.65rem' }}>numerado</span> : <span className="pill borrador" style={{ marginLeft: 6, fontSize: '.65rem' }}>admisión general</span>}
              </summary>
              <div style={{ padding: '10px 0 4px' }}>
                <SeatAdminGrid tipo={t} onChanged={refresh} />
              </div>
            </details>
          ))}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => goto(2)}>Atrás</button>
            <button className="btn" onClick={async () => { await refresh(); goto(4); }}>Siguiente</button>
          </div>
        </>
      )}

      {paso === 4 && evento && (
        <>
          <h3>Preventa y cargo por servicio <span className="muted" style={{ fontSize: '.8rem', fontWeight: 400 }}>(opcional)</span></h3>
          <p className="muted" style={{ fontSize: '.85rem' }}>Tandas de precio por sector (ej. "Preventa" más barata con cupo limitado):</p>
          {tipos.map((t) => <WizardTandaRow key={t.id} tipo={t} />)}
          <label style={{ marginTop: 12 }}>Cargo por servicio del evento</label>
          <div className="two">
            <div>
              <select value={fee.feeTipo} onChange={(e) => setFee({ ...fee, feeTipo: e.target.value })}>
                <option value="">Usar cargo global</option>
                <option value="ninguno">Sin cargo</option>
                <option value="pct">Porcentaje (%)</option>
                <option value="crc">Monto fijo (CRC)</option>
              </select>
            </div>
            <div>
              <input type="number" min="0" value={fee.feeValor} disabled={fee.feeTipo === '' || fee.feeTipo === 'ninguno'} onChange={(e) => setFee({ ...fee, feeValor: Number(e.target.value) })} />
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => goto(3)}>Atrás</button>
            <button className="btn" onClick={guardarFee} disabled={loading}>{loading ? 'Guardando…' : 'Siguiente'}</button>
          </div>
        </>
      )}

      {paso === 5 && evento && (
        <>
          <h3>Revisión</h3>
          <div className="event-meta" style={{ marginBottom: 10 }}>
            <span><CalendarDays size={14} /> {fmtFullDate(evento.fecha)}</span>
            {evento.venue && <span>📍 {evento.venue}</span>}
            <span className={`pill ${evento.estado}`}>{evento.estado}</span>
          </div>
          <section className="coupon-stats">
            <div><span>Sectores</span><b>{tipos.length}</b></div>
            <div><span>Capacidad</span><b>{capacidad}</b></div>
            <div><span>Numerados</span><b>{numerados.length}</b></div>
          </section>
          <DataTable
            id="wizard-sectores"
            rows={tipos}
            empty="Sin sectores — el evento no se puede vender así."
            columns={[
              { key: 'nombre', label: 'Sector' },
              { key: 'precioCrc', label: 'Precio', render: (t) => money(t.precioCrc) },
              { key: 'stockTotal', label: 'Cupo' },
              { key: 'numerado', label: 'Butacas', sortValue: (t) => (t.numerado ? 0 : 1), render: (t) => (t.numerado ? 'Numerado' : 'General') },
            ]}
          />
          {msg && <div className="okbox">{msg}</div>}
          {error && <div className="error">{error}</div>}
          <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
            <button className="btn ghost" onClick={() => goto(4)}>Atrás</button>
            <button className="btn ghost" onClick={guardarComoTemplate}>Guardar como template</button>
            <button className="btn ghost" onClick={onDone}>Guardar borrador</button>
            <button className="btn" onClick={publicar} disabled={loading || tipos.length === 0}><Send size={15} />{loading ? 'Publicando…' : 'Publicar ahora'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// Fila compacta del paso Preventa: abre el editor de tandas del sector.
function WizardTandaRow({ tipo }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tipo-row">
      <div><b>{tipo.nombre}</b><span> {money(tipo.precioCrc)} · cupo {tipo.stockTotal}</span></div>
      <button className="btn ghost" onClick={() => setOpen(true)}>Tandas</button>
      {open && <TandasModal tipo={tipo} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ── Configurador del venue sobre el mapa (map-first) ────────────────
// El mapa del estadio ES la interfaz de sectores: entra con todo el venue
// activo (aforo fijo repartido) y cada ajuste se hace tocando una zona.

// Aforo de tribunas (asientos y gradas del bowl).
const VENUE_AFORO_DEFAULT = 3500;

// Aforo de pie de la gramilla (cancha) para espectáculos. Una cancha de fútbol
// 11 reglamentaria mide ≈ 105 × 68 m = 7.140 m². En conciertos se planifica
// ~2 personas/m² en zona general de pie (densidad cómoda y segura); descontando
// escenario, barreras y pasillos de evacuación queda ~50% de área útil, así que
// ≈ 7.000 personas caben sobre la cancha. Este aforo SUMA al de las tribunas:
// abrir la gramilla agranda el venue, no lo limita.
const GRAMILLA_AFORO_DEFAULT = 7000;

const esGramillaKey = (key) => typeof key === 'string' && key.startsWith('gramilla');

// Reparte `totalAforo` entre `sectores` proporcional a su `.stock`; el residuo
// se ajusta en la zona más grande para sumar exacto.
function repartirProporcional(sectores, totalAforo) {
  if (sectores.length === 0) return [];
  const base = sectores.reduce((s, x) => s + x.stock, 0) || 1;
  const cupos = sectores.map((s) => Math.max(1, Math.round((s.stock / base) * totalAforo)));
  const diff = totalAforo - cupos.reduce((a, b) => a + b, 0);
  const iMax = sectores.reduce((im, s, i) => (s.stock > sectores[im].stock ? i : im), 0);
  cupos[iMax] = Math.max(1, cupos[iMax] + diff);
  return cupos;
}

// Reparte el aforo de un venue completo: las tribunas comparten VENUE_AFORO_DEFAULT
// y la gramilla suma su propio aforo aparte (GRAMILLA_AFORO_DEFAULT). Devuelve los
// cupos en el mismo orden de `sectores` (cada uno debe traer `.key` y `.stock`).
function repartirAforo(sectores, totalAforo = VENUE_AFORO_DEFAULT, gramillaAforo = GRAMILLA_AFORO_DEFAULT) {
  const cupos = new Array(sectores.length).fill(0);
  const tribunas = [];
  const gramilla = [];
  sectores.forEach((s, i) => (esGramillaKey(s.key) ? gramilla : tribunas).push({ s, i }));
  const asignar = (grupo, total) => {
    const reparto = repartirProporcional(grupo.map(({ s }) => s), total);
    grupo.forEach(({ i }, k) => { cupos[i] = reparto[k]; });
  };
  if (tribunas.length) asignar(tribunas, totalAforo);
  if (gramilla.length) asignar(gramilla, gramillaAforo);
  return cupos;
}

function calcularDistribucionAforo(tipos, catalogo, totalAforo = VENUE_AFORO_DEFAULT) {
  const todosActivos = (tipos || []).filter((tipo) => tipo.estado === 'activo');
  const catalogoByKey = new Map(catalogo.map((zona) => [zona.key, zona]));
  const keyDe = (tipo) => tipo.mapa?.points?.key ?? nombreToZoneKey(tipo.nombre);

  // Los sectores numerados (butacas) conservan su cupo: lo define la grilla de
  // asientos. Su aforo se descuenta del total de tribunas a repartir.
  const aforoNumerado = todosActivos.filter((t) => t.numerado).reduce((s, t) => s + (t.stockTotal || 0), 0);
  const tribunaAforo = Math.max(0, totalAforo - aforoNumerado);

  // Solo las tribunas de pie entran al reparto automático de VENUE_AFORO_DEFAULT.
  // La gramilla (cancha) queda fuera: su capacidad es MANUAL y configurable por
  // zona, así que se conserva tal cual (como las zonas numeradas/especiales).
  const noNumerados = todosActivos.filter((tipo) => !tipo.numerado);
  const stands = noNumerados.filter((tipo) => !esGramillaKey(keyDe(tipo)));

  const resultado = [];
  const distribuir = (grupo, total) => {
    if (grupo.length === 0) return;
    const ponderados = grupo.map((tipo) => {
      const peso = catalogoByKey.get(keyDe(tipo))?.stock ?? Math.max(1, tipo.stockTotal || 1);
      return { tipo, stock: peso };
    });
    const cuposBase = repartirProporcional(ponderados, total);
    const cupos = cuposBase.map((cupo, i) => Math.max(cupo, ponderados[i].tipo.stockVendido || 0));

    let exceso = cupos.reduce((sum, cupo) => sum + cupo, 0) - total;
    const porHolgura = cupos
      .map((cupo, i) => ({ i, holgura: cupo - (ponderados[i].tipo.stockVendido || 0) }))
      .sort((a, b) => b.holgura - a.holgura);
    for (const item of porHolgura) {
      if (exceso <= 0) break;
      const recorte = Math.min(item.holgura, exceso);
      cupos[item.i] -= recorte;
      exceso -= recorte;
    }

    const faltante = total - cupos.reduce((sum, cupo) => sum + cupo, 0);
    if (faltante > 0) {
      const mayor = ponderados.reduce((best, item, i) => (item.stock > ponderados[best].stock ? i : best), 0);
      cupos[mayor] += faltante;
    }

    ponderados.forEach(({ tipo }, i) => resultado.push({ tipo, cupo: cupos[i] }));
  };

  distribuir(stands, tribunaAforo);
  return resultado;
}

// Variante admin de tiposByZoneKey: incluye sectores inactivos (para reactivarlos).
function zonasByKeyAdmin(tipos) {
  const map = {};
  for (const t of tipos || []) {
    const key = t.mapa?.points?.key ?? nombreToZoneKey(t.nombre);
    if (key && !map[key]) map[key] = t;
  }
  return map;
}

const SPLITS_POR_TEMPLATE = { 2: [0.5], 3: [0.33, 0.66], 4: [0.25, 0.5, 0.75] };

function VenueMapConfig({ evento, autoSeed = false, onChanged }) {
  const confirm = useConfirm();
  const [ev, setEv] = useState(evento);
  const [tipos, setTipos] = useState(null); // null = cargando
  const [selectedKey, setSelectedKey] = useState(null);
  const [hoveredKey, setHoveredKey] = useState(null);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tandasFor, setTandasFor] = useState(null);
  const [showButacas, setShowButacas] = useState(false);
  const [seatsByZoneKey, setSeatsByZoneKey] = useState({});
  const [seatSel, setSeatSel] = useState(() => new Set()); // ids de butacas seleccionadas en el mapa
  const [creatingEspecial, setCreatingEspecial] = useState(false);
  const [zonaForm, setZonaForm] = useState({ nombre: '', precioCrc: '', stockTotal: '', color: '#f59e0b' });
  const seededRef = useRef(false);

  // ESC limpia la selección múltiple de butacas.
  useEscClose(() => setSeatSel((prev) => (prev.size > 0 ? new Set() : prev)));

  const esEspectaculo = (ev?.formato ?? evento.formato) === 'espectaculo';
  const fieldTemplate = ev?.fieldTemplate ?? (esEspectaculo ? '2' : null);

  const catalogo = useMemo(() => {
    const zonas = [...ERC_SECTORES];
    if (esEspectaculo) {
      const keys = gramillaKeysForTemplate(fieldTemplate ?? '2');
      for (const g of GRAMILLA_SECTORES) if (keys.includes(g.key)) zonas.push(g);
    }
    return zonas;
  }, [esEspectaculo, fieldTemplate]);

  const refresh = async () => {
    const d = await api(`/admin/api/entradas/eventos/${evento.id}`);
    if (!d.ok) return [];
    setEv(d.evento);
    setTipos(d.tipos);
    onChanged?.();
    return d.tipos;
  };

  const loadSeats = async (currentTipos) => {
    const numerados = (currentTipos || []).filter((t) => t.numerado);
    if (numerados.length === 0) return;
    const results = {};
    await Promise.all(numerados.map(async (t) => {
      const key = t.mapa?.points?.key ?? nombreToZoneKey(t.nombre);
      if (!key) return;
      const d = await api(`/admin/api/entradas/tipos/${t.id}/asientos`);
      if (d.ok && d.asientos?.length > 0) results[key] = d.asientos;
    }));
    setSeatsByZoneKey(results);
  };

  // Crea las zonas del catálogo que falten, con el aforo fijo repartido.
  async function seedFaltantes(current, aviso = true, zonas = catalogo) {
    const byKey = zonasByKeyAdmin(current);
    const cupos = repartirAforo(zonas);
    let creadas = 0;
    setBusy(true);
    for (let i = 0; i < zonas.length; i++) {
      const s = zonas[i];
      if (byKey[s.key]) continue;
      const d = await api(`/admin/api/entradas/eventos/${evento.id}/tipos`, {
        method: 'POST',
        // La gramilla nace fuera de venta: el admin la pone a la venta a mano.
        body: JSON.stringify({ nombre: s.nombre, precioCrc: s.precio, stockTotal: cupos[i], zoneKey: s.key, estado: esGramillaKey(s.key) ? 'inactivo' : 'activo' }),
      });
      if (d.ok) creadas += 1;
    }
    setBusy(false);
    const updated = await refresh();
    if (aviso && creadas > 0) {
      const hayGramilla = zonas.some((z) => esGramillaKey(z.key));
      const totalTxt = hayGramilla
        ? `tribunas ${VENUE_AFORO_DEFAULT.toLocaleString('es-CR')} + gramilla ${GRAMILLA_AFORO_DEFAULT.toLocaleString('es-CR')}`
        : `${VENUE_AFORO_DEFAULT.toLocaleString('es-CR')}`;
      setMsg({ type: 'ok', text: `Venue listo: ${creadas} zonas creadas · aforo ${totalTxt} repartido en el mapa.` });
    }
    return updated;
  }

  async function redistribuirAforo(current, aviso = true, zonas = catalogo) {
    const distribucion = calcularDistribucionAforo(current, zonas);
    if (distribucion.length === 0) return current;
    setBusy(true);
    for (const { tipo, cupo } of distribucion) {
      if (tipo.stockTotal === cupo) continue;
      const d = await api(`/admin/api/entradas/tipos/${tipo.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre: tipo.nombre,
          precioCrc: tipo.precioCrc,
          stockTotal: cupo,
          estado: tipo.estado,
        }),
      });
      if (!d.ok) {
        setBusy(false);
        setMsg({ type: 'error', text: d.error });
        return current;
      }
    }
    setBusy(false);
    const updated = await refresh();
    if (aviso) {
      const hayGramilla = (current || []).some((t) => t.estado === 'activo' && esGramillaKey(t.mapa?.points?.key ?? nombreToZoneKey(t.nombre)));
      const totalTxt = hayGramilla
        ? `${VENUE_AFORO_DEFAULT.toLocaleString('es-CR')} en tribunas + ${GRAMILLA_AFORO_DEFAULT.toLocaleString('es-CR')} en gramilla`
        : `${VENUE_AFORO_DEFAULT.toLocaleString('es-CR')} lugares`;
      setMsg({ type: 'ok', text: `Aforo redistribuido: ${totalTxt} entre las zonas activas.` });
    }
    return updated;
  }

  // Genera la grilla de butacas de cada tribuna recién sembrada, para que
  // los asientos numerados existan sin pasos manuales del admin.
  async function generarButacasDefault(current) {
    const tribunas = (current || []).filter((t) => {
      const key = t.mapa?.points?.key ?? nombreToZoneKey(t.nombre);
      return key && !key.startsWith('gramilla') && !t.numerado && t.stockTotal > 0;
    });
    if (tribunas.length === 0) return current;
    setBusy(true);
    let total = 0;
    for (const t of tribunas) {
      const filas = Math.min(100, Math.max(Math.round(Math.sqrt(t.stockTotal / 8)) || 1, Math.ceil(t.stockTotal / 100)));
      const porFila = Math.min(100, Math.max(1, Math.round(t.stockTotal / filas)));
      const d = await api(`/admin/api/entradas/tipos/${t.id}/asientos/generar`, {
        method: 'POST',
        body: JSON.stringify({ filas, porFila }),
      });
      if (d.ok) total += filas * porFila;
    }
    setBusy(false);
    const updated = await refresh();
    setMsg({ type: 'ok', text: `Venue listo: ${tribunas.length} zonas con ${total.toLocaleString('es-CR')} butacas numeradas generadas.` });
    return updated;
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const current = await refresh();
      if (!alive) return;
      if (autoSeed && !seededRef.current && current.length === 0) {
        seededRef.current = true;
        const seeded = await seedFaltantes(current, false);
        const conButacas = await generarButacasDefault(seeded);
        await loadSeats(conButacas);
      } else if (autoSeed && !seededRef.current && catalogo.some((z) => !zonasByKeyAdmin(current)[z.key])) {
        // Al pasar el evento a espectáculo el servidor fija field_template pero no
        // crea los tipos de gramilla; se siembran aquí para que no queden "sin configurar".
        seededRef.current = true;
        const seeded = await seedFaltantes(current, false);
        const final = await redistribuirAforo(seeded, false);
        await loadSeats(final);
      } else if (current.length > 0) {
        const distribucion = calcularDistribucionAforo(current, catalogo);
        const necesitaAjuste = distribucion.some(({ tipo, cupo }) => tipo.stockTotal !== cupo);
        const final = necesitaAjuste ? await redistribuirAforo(current, false) : current;
        await loadSeats(final);
      }
    })();
    return () => { alive = false; };
  }, [evento.id]);

  const allByKey = useMemo(() => zonasByKeyAdmin(tipos || []), [tipos]);

  // Zonas especiales (DJ, patrocinador…): tipos con mapa rectangular dibujados
  // sobre la cancha. No entran en el reparto de aforo (cupo manual por zona).
  const especiales = useMemo(() => (tipos || []).filter((t) => t.mapa?.shape === 'rect'), [tipos]);
  const especialByKey = useMemo(() => {
    const m = {};
    for (const t of especiales) m[`especial:${t.id}`] = t;
    return m;
  }, [especiales]);

  function specialFormFromTipo(esp) {
    const r = esp?.mapa?.points || {};
    const numOr = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const w = clamp(numOr(r.w, 0.15), 0.04, 0.66);
    const h = clamp(numOr(r.h, 0.12), 0.04, 0.45);
    return {
      nombre: esp.nombre,
      precioCrc: String(esp.precioCrc),
      stockTotal: String(esp.stockTotal),
      color: esp.mapa?.color || '#f59e0b',
      rectX: clamp(numOr(r.x, 0.2), 0, 1 - w),
      rectY: clamp(numOr(r.y, 0.3), 0, 1 - h),
      rectW: Math.round(w * 100),
      rectH: Math.round(h * 100),
      rot: Math.round(numOr(r.rot, 0)),
    };
  }

  function updateSpecialZoneRect(key, rect) {
    const esp = especialByKey[key];
    if (!esp) return;
    const numOr = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const w = clamp(numOr(rect?.w, 0.15), 0.04, 0.66);
    const h = clamp(numOr(rect?.h, 0.12), 0.04, 0.45);
    setSelectedKey(key);
    setCreatingEspecial(false);
    setTandasFor(null);
    setShowButacas(false);
    setMsg(null);
    setForm((prev) => {
      const base = selectedKey === key && prev ? prev : specialFormFromTipo(esp);
      return {
        ...base,
        rectX: clamp(numOr(rect?.x, base.rectX), 0, 1 - w),
        rectY: clamp(numOr(rect?.y, base.rectY), 0, 1 - h),
        rectW: Math.round(w * 100),
        rectH: Math.round(h * 100),
        rot: Math.round(numOr(rect?.rot, 0)),
      };
    });
  }

  const specialZonesForMap = useMemo(
    () => especiales.map((t) => {
      const key = `especial:${t.id}`;
      let rect = t.mapa?.points;
      let color = t.mapa?.color;
      // Preview en vivo: la zona seleccionada refleja tamaño/rotación/color del form.
      if (key === selectedKey && form?.rectW != null && rect) {
        const numOr = (value, fallback) => {
          const n = Number(value);
          return Number.isFinite(n) ? n : fallback;
        };
        const w = clamp(numOr(form.rectW, 15) / 100, 0.04, 0.66);
        const h = clamp(numOr(form.rectH, 12) / 100, 0.04, 0.45);
        rect = {
          ...rect,
          x: clamp(numOr(form.rectX, rect.x ?? 0.2), 0, 1 - w),
          y: clamp(numOr(form.rectY, rect.y ?? 0.3), 0, 1 - h),
          w,
          h,
          rot: Math.round(numOr(form.rot, 0)),
        };
        if (form.color) color = form.color;
      }
      return { key, nombre: t.nombre, color, rect, estado: t.estado, tipo: t };
    }),
    [especiales, selectedKey, form],
  );

  // ── Selección de butacas individuales sobre el mapa ──
  function toggleSeat(a) {
    if (a.estado === 'vendido') return;
    setSeatSel((prev) => {
      const next = new Set(prev);
      if (next.has(a.id)) next.delete(a.id);
      else next.add(a.id);
      return next;
    });
  }

  function boxSelectSeats(hits, additive) {
    setSeatSel((prev) => {
      const next = additive ? new Set(prev) : new Set();
      for (const a of hits) if (a.estado !== 'vendido') next.add(a.id);
      return next;
    });
  }

  const seatSelPorZona = useMemo(() => {
    if (seatSel.size === 0) return [];
    const counts = new Map();
    for (const [key, list] of Object.entries(seatsByZoneKey)) {
      const n = list.filter((a) => seatSel.has(a.id)).length;
      if (n > 0) counts.set(key, n);
    }
    return [...counts.entries()];
  }, [seatSel, seatsByZoneKey]);

  async function setEstadoButacasSel(estado) {
    const ids = [...seatSel];
    if (ids.length === 0) return;
    const bloquear = estado === 'bloqueado';
    const ok = await confirm({
      title: bloquear ? 'Bloquear butacas' : 'Habilitar butacas',
      message: bloquear
        ? `${ids.length} butaca(s) quedarán bloqueadas y no se podrán vender.`
        : `${ids.length} butaca(s) volverán a estar disponibles para la venta.`,
      confirmLabel: bloquear ? 'Bloquear' : 'Habilitar',
      danger: bloquear,
    });
    if (!ok) return;
    setBusy(true);
    const d = await api('/admin/api/entradas/asientos/estado', {
      method: 'POST',
      body: JSON.stringify({ ids, estado }),
    });
    setBusy(false);
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    setSeatSel(new Set());
    const updated = await refresh();
    await loadSeats(updated);
    setMsg({
      type: 'ok',
      text: `${d.actualizados} butacas ${estado === 'bloqueado' ? 'bloqueadas' : 'habilitadas'}${d.omitidos ? ` · ${d.omitidos} omitidas` : ''}.`,
    });
  }

  function selectZone(key) {
    setSelectedKey(key);
    setMsg(null);
    setTandasFor(null);
    setShowButacas(false);
    setCreatingEspecial(false);
    const esp = especialByKey[key];
    if (esp) {
      setForm(specialFormFromTipo(esp));
      return;
    }
    const t = allByKey[key];
    setForm(t ? { nombre: t.nombre, precioCrc: String(t.precioCrc), stockTotal: String(t.stockTotal) } : null);
  }

  async function guardarSector() {
    const t = allByKey[selectedKey];
    if (!t || !form) return;
    setBusy(true);
    // La gramilla tiene cupo manual (configurable); el resto conserva el suyo.
    const stockTotal = esGramillaSel ? Math.max(1, Number(form.stockTotal) || 0) : t.stockTotal;
    const d = await api(`/admin/api/entradas/tipos/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({ nombre: form.nombre, precioCrc: Number(form.precioCrc), stockTotal, estado: t.estado }),
    });
    setBusy(false);
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    setMsg({ type: 'ok', text: `${d.tipo.nombre} actualizado.` });
    refresh();
  }

  async function setEstadoSector(t, estado, redistribuir = true) {
    setBusy(true);
    const d = await api(`/admin/api/entradas/tipos/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({ nombre: t.nombre, precioCrc: t.precioCrc, stockTotal: t.stockTotal, estado }),
    });
    setBusy(false);
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    const updated = await refresh();
    if (redistribuir) return redistribuirAforo(updated);
    return updated;
  }

  // Cambio de estado de un sector desde el panel (acción puntual del usuario);
  // los presets llaman a setEstadoSector directamente sin este diálogo.
  async function confirmSetEstadoSector(t, estado) {
    const alaventa = estado === 'activo';
    const especial = t.mapa?.shape === 'rect';
    const ok = await confirm({
      title: alaventa ? 'Poner sector a la venta' : 'Sacar sector de venta',
      message: especial
        ? (alaventa
            ? `«${t.nombre}» quedará disponible para compra en el mapa del evento.`
            : `«${t.nombre}» quedará como zona informativa: se muestra en el mapa del admin pero no se vende ni aparece al comprador.`)
        : (alaventa
            ? `«${t.nombre}» quedará disponible para compra y su cupo entra en el aforo activo.`
            : `«${t.nombre}» dejará de venderse y su cupo se redistribuye entre los sectores activos.`),
      confirmLabel: alaventa ? 'Poner a la venta' : 'Sacar de venta',
      danger: !alaventa,
    });
    if (!ok) return;
    // Las zonas especiales tienen cupo manual: no dispares el reparto de aforo.
    await setEstadoSector(t, estado, !especial);
  }

  async function agregarZona(key) {
    const i = catalogo.findIndex((s) => s.key === key);
    if (i < 0) return;
    const s = catalogo[i];
    const cupos = repartirAforo(catalogo);
    setBusy(true);
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/tipos`, {
      method: 'POST',
      body: JSON.stringify({ nombre: s.nombre, precioCrc: s.precio, stockTotal: cupos[i], zoneKey: s.key }),
    });
    setBusy(false);
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    const updated = await redistribuirAforo(await refresh());
    const t = zonasByKeyAdmin(updated)[key];
    if (t) setForm({ nombre: t.nombre, precioCrc: String(t.precioCrc), stockTotal: String(t.stockTotal) });
  }

  // Ubica la próxima zona especial en una grilla dentro de la cancha (coords unit).
  function nextEspecialRect(idx) {
    const FX = 0.172, FY = 0.275, FW = 0.656, FH = 0.45;
    const boxW = 0.15, boxH = 0.12, gap = 0.02, padX = 0.03, padY = 0.05;
    const perRow = 3;
    const col = idx % perRow;
    const row = Math.floor(idx / perRow);
    let x = FX + padX + col * (boxW + gap);
    let y = FY + padY + row * (boxH + gap);
    x = Math.min(x, FX + FW - boxW - 0.01);
    y = Math.min(y, FY + FH - boxH - 0.01);
    const r = (n) => Math.round(n * 10000) / 10000;
    return { x: r(x), y: r(y), w: boxW, h: boxH };
  }

  async function crearZonaEspecial() {
    const nombre = zonaForm.nombre.trim();
    if (!nombre) return setMsg({ type: 'error', text: 'Ponle un nombre a la zona.' });
    setBusy(true);
    const rect = nextEspecialRect(especiales.length);
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/tipos`, {
      method: 'POST',
      body: JSON.stringify({
        nombre,
        precioCrc: Number(zonaForm.precioCrc || 0),
        stockTotal: Number(zonaForm.stockTotal || 0),
        estado: 'inactivo', // nace como zona informativa; se pone a la venta a mano
      }),
    });
    if (!d.ok) { setBusy(false); return setMsg({ type: 'error', text: d.error }); }
    const m = await api(`/admin/api/entradas/tipos/${d.tipo.id}/mapa`, {
      method: 'PUT',
      body: JSON.stringify({ mapa: { shape: 'rect', points: rect, color: zonaForm.color } }),
    });
    setBusy(false);
    if (!m.ok) return setMsg({ type: 'error', text: m.error });
    await refresh();
    setCreatingEspecial(false);
    setZonaForm({ nombre: '', precioCrc: '', stockTotal: '', color: '#f59e0b' });
    setSelectedKey(`especial:${d.tipo.id}`);
    setForm({
      nombre,
      precioCrc: String(Number(zonaForm.precioCrc || 0)),
      stockTotal: String(Number(zonaForm.stockTotal || 0)),
      color: zonaForm.color,
      rectX: rect.x,
      rectY: rect.y,
      rectW: 15,
      rectH: 12,
      rot: 0,
    });
    setMsg({ type: 'ok', text: `Zona «${nombre}» agregada al mapa.` });
  }

  async function guardarZonaEspecial() {
    const t = especialByKey[selectedKey];
    if (!t || !form) return;
    setBusy(true);
    const d = await api(`/admin/api/entradas/tipos/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nombre: form.nombre,
        precioCrc: Number(form.precioCrc || 0),
        stockTotal: Number(form.stockTotal || 0),
        estado: t.estado,
      }),
    });
    if (!d.ok) { setBusy(false); return setMsg({ type: 'error', text: d.error }); }
    // Persistir posición, tamaño y rotación del rectángulo, ajustados al mapa.
    const base = t.mapa?.points || {};
    const numOr = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const w = clamp(numOr(form.rectW, 15) / 100, 0.04, 0.66);
    const h = clamp(numOr(form.rectH, 12) / 100, 0.04, 0.45);
    const rot = Math.max(-180, Math.min(180, Math.round(numOr(form.rot, 0))));
    const points = {
      x: round4(clamp(numOr(form.rectX, base.x ?? 0.2), 0, 1 - w)),
      y: round4(clamp(numOr(form.rectY, base.y ?? 0.3), 0, 1 - h)),
      w: round4(w),
      h: round4(h),
      ...(rot ? { rot } : {}),
    };
    const m = await api(`/admin/api/entradas/tipos/${t.id}/mapa`, {
      method: 'PUT',
      body: JSON.stringify({ mapa: { shape: 'rect', points, color: form.color || t.mapa?.color || '#f59e0b' } }),
    });
    if (!m.ok) { setBusy(false); return setMsg({ type: 'error', text: m.error }); }
    setBusy(false);
    await refresh();
    setMsg({ type: 'ok', text: `Zona «${d.tipo.nombre}» actualizada.` });
  }

  async function eliminarZonaEspecial(t) {
    const ok = await confirm({
      title: 'Eliminar zona especial',
      message: `«${t.nombre}» se quitará del mapa de forma permanente. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const d = await api(`/admin/api/entradas/tipos/${t.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    setSelectedKey(null);
    setForm(null);
    await refresh();
    setMsg({ type: 'ok', text: `Zona «${t.nombre}» eliminada.` });
  }

  // Presets del venue ("templates del mapa").
  async function presetEstadioCompleto() {
    const ok = await confirm({
      title: 'Activar estadio completo',
      message: `Se activan todas las zonas del estadio y se redistribuye el aforo (${VENUE_AFORO_DEFAULT.toLocaleString('es-CR')} lugares). Los precios que hayas definido se conservan.`,
      confirmLabel: 'Aplicar preset',
    });
    if (!ok) return;
    setMsg(null);
    const current = tipos || [];
    const keysActivas = new Set(catalogo.map((zona) => zona.key));
    for (const t of current) {
      const key = t.mapa?.points?.key ?? nombreToZoneKey(t.nombre);
      if (keysActivas.has(key) && t.estado === 'inactivo') await setEstadoSector(t, 'activo', false);
    }
    const updated = await seedFaltantes(await refresh(), false);
    await redistribuirAforo(updated);
  }

  async function presetGramilla(template) {
    const ok = await confirm({
      title: `Configurar gramilla en ${template} zonas`,
      message: `El campo se dividirá en ${template} zonas de gramilla. Nacen fuera de venta y con cupo editable (por defecto ~${GRAMILLA_AFORO_DEFAULT.toLocaleString('es-CR')} en total); las ponés a la venta cuando quieras. Las tribunas mantienen su aforo de ${VENUE_AFORO_DEFAULT.toLocaleString('es-CR')}.`,
      confirmLabel: 'Aplicar preset',
    });
    if (!ok) return;
    setMsg(null); setBusy(true);
    await api(`/admin/api/entradas/eventos/${evento.id}/mapa`, {
      method: 'PUT',
      body: JSON.stringify({ fieldTemplate: String(template), fieldSplits: SPLITS_POR_TEMPLATE[template] }),
    });
    setBusy(false);
    const updated = await refresh();
    // Desactiva zonas de gramilla fuera de la plantilla y crea/reactiva las que aplican.
    const keys = gramillaKeysForTemplate(String(template));
    const targetCatalogo = [...ERC_SECTORES, ...GRAMILLA_SECTORES.filter((zona) => keys.includes(zona.key))];
    const byKey = zonasByKeyAdmin(updated);
    for (const g of GRAMILLA_SECTORES) {
      const t = byKey[g.key];
      // Las zonas de gramilla fuera de la plantilla se sacan de venta. Las que
      // aplican NO se ponen a la venta automáticamente: nacen fuera de venta y
      // el admin las activa a mano (respetamos si ya estaban a la venta).
      if (!keys.includes(g.key) && t && t.estado === 'activo') {
        await setEstadoSector(t, 'inactivo', false);
      }
    }
    const seeded = await seedFaltantes(await refresh(), false, targetCatalogo);
    await redistribuirAforo(seeded, false, targetCatalogo);
    setMsg({ type: 'ok', text: `Gramilla configurada en ${template} zonas · nace fuera de venta con cupo configurable (~${GRAMILLA_AFORO_DEFAULT.toLocaleString('es-CR')} por defecto).` });
  }

  async function presetSoloTribunas() {
    const ok = await confirm({
      title: 'Dejar solo tribunas',
      message: `Todas las zonas de gramilla saldrán de venta y el aforo (${VENUE_AFORO_DEFAULT.toLocaleString('es-CR')} lugares) se redistribuye entre las tribunas.`,
      confirmLabel: 'Aplicar preset',
    });
    if (!ok) return;
    setMsg(null);
    const byKey = zonasByKeyAdmin(tipos || []);
    for (const g of GRAMILLA_SECTORES) {
      const t = byKey[g.key];
      if (t && t.estado === 'activo') await setEstadoSector(t, 'inactivo', false);
    }
    await redistribuirAforo(await refresh(), false);
    setMsg({ type: 'ok', text: `Solo tribunas: ${VENUE_AFORO_DEFAULT.toLocaleString('es-CR')} lugares redistribuidos.` });
  }

  if (tipos === null) return <p className="muted">Cargando venue…</p>;

  const esEspecialSel = selectedKey?.startsWith('especial:');
  const seleccionado = selectedKey ? (allByKey[selectedKey] ?? especialByKey[selectedKey]) : null;
  const metaSel = selectedKey ? (ERC_ZONE_META[selectedKey] ?? GRAMILLA_ZONE_META[selectedKey]) : null;
  const esGramillaSel = selectedKey?.startsWith('gramilla-');
  const aforoActivo = (tipos || []).filter((t) => t.estado === 'activo').reduce((s, t) => s + t.stockTotal, 0);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: '.8rem' }}>Presets del venue:</span>
        {!esEspectaculo && <button className="btn ghost" onClick={presetEstadioCompleto} disabled={busy}>Estadio completo</button>}
        {esEspectaculo && (
          <>
            {[2, 3, 4].map((n) => (
              <button key={n} className={`btn ghost${String(fieldTemplate) === String(n) ? ' active' : ''}`} onClick={() => presetGramilla(n)} disabled={busy}>Gramilla ×{n}</button>
            ))}
            <button className="btn ghost" onClick={presetSoloTribunas} disabled={busy}>Solo tribunas</button>
            <button className="btn ghost" onClick={presetEstadioCompleto} disabled={busy}>Todo activo</button>
          </>
        )}
        <button
          className="btn ghost"
          onClick={() => { setCreatingEspecial(true); setSelectedKey(null); setForm(null); setMsg(null); }}
          disabled={busy}
        >
          <Plus size={15} />Zona especial
        </button>
        <span className="pill publicado" style={{ marginLeft: 'auto', fontSize: '.7rem' }}>Aforo activo: {aforoActivo}</span>
      </div>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 420px', minWidth: 300 }}>
          <StadiumSvgERC
            tiposByKey={allByKey}
            hoveredKey={hoveredKey}
            selectedKey={selectedKey}
            onZoneClick={(key) => selectZone(key)}
            onZoneHover={setHoveredKey}
            venue={ev?.venue || evento.venue}
            fieldTemplate={esEspectaculo ? fieldTemplate : null}
            fieldSplits={esEspectaculo ? ev?.fieldSplits : null}
            seatsByZoneKey={seatsByZoneKey}
            selectedSeatIds={seatSel}
            onSeatClick={toggleSeat}
            onSeatBoxSelect={boxSelectSeats}
            specialZones={specialZonesForMap}
            editableSpecialZones={esEspecialSel && Boolean(form)}
            onSpecialZoneChange={updateSpecialZoneRect}
            showInactive
            showZoneDetails
          />
          {selectedKey && seatsByZoneKey[selectedKey]?.length > 0 && (
            <div className="zone-seat-expand">
              <SeatAdminPanel
                titulo={metaSel?.label ?? selectedKey}
                asientos={seatsByZoneKey[selectedKey]}
                selectedIds={seatSel}
                onSeatToggle={toggleSeat}
                onBoxSelect={boxSelectSeats}
                orientation={orientationForZone(selectedKey)}
                accentColor={metaSel?.color}
              />
            </div>
          )}
        </div>

        <div className="venue-map-inspector">
          {seatSel.size > 0 && (
            <div className="stadium-panel stadium-panel--sidebar" style={{ textAlign: 'left' }}>
              <h3 className="stadium-panel-name">{seatSel.size.toLocaleString('es-CR')} butaca{seatSel.size === 1 ? '' : 's'} seleccionada{seatSel.size === 1 ? '' : 's'}</h3>
              <p className="stadium-panel-hint">
                {seatSelPorZona.map(([key, n]) => `${(ERC_ZONE_META[key] ?? GRAMILLA_ZONE_META[key])?.label ?? key}: ${n}`).join(' · ')}
              </p>
              <p className="stadium-panel-hint">Tocá butacas para marcar o desmarcar; arrastrá sobre el mapa para seleccionar en bloque (Shift suma a la selección).</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => setEstadoButacasSel('bloqueado')} disabled={busy}>Bloquear</button>
                <button className="btn ghost" onClick={() => setEstadoButacasSel('disponible')} disabled={busy}>Habilitar</button>
                <button className="btn ghost" onClick={() => setSeatSel(new Set())} disabled={busy}>Limpiar</button>
              </div>
            </div>
          )}
          {tandasFor && (
            <div className="stadium-panel stadium-panel--sidebar stadium-panel--tool">
              <button className="workspace-back" onClick={() => { setTandasFor(null); refresh(); }}>‹ Volver a {tandasFor.nombre}</button>
              <TandasModal tipo={tandasFor} asPanel />
            </div>
          )}
          {!tandasFor && creatingEspecial && (
            <div className="stadium-panel stadium-panel--sidebar" style={{ textAlign: 'left' }}>
              <h3 className="stadium-panel-name">Nueva zona especial</h3>
              <p className="stadium-panel-hint">Zonas como DJ, patrocinador o backstage. Se dibujan sobre la cancha con cupo propio; nacen fuera de venta (informativas).</p>
              <label>Nombre</label>
              <input value={zonaForm.nombre} placeholder="Zona DJ, Patrocinador…" onChange={(e) => setZonaForm({ ...zonaForm, nombre: e.target.value })} />
              <label>Precio CRC</label>
              <input inputMode="numeric" value={zonaForm.precioCrc} onChange={(e) => setZonaForm({ ...zonaForm, precioCrc: e.target.value.replace(/\D/g, '') })} />
              <label>Cupo (lugares)</label>
              <input inputMode="numeric" value={zonaForm.stockTotal} onChange={(e) => setZonaForm({ ...zonaForm, stockTotal: e.target.value.replace(/\D/g, '') })} />
              <label>Color</label>
              <input type="color" value={zonaForm.color} onChange={(e) => setZonaForm({ ...zonaForm, color: e.target.value })} style={{ width: 56, height: 34, padding: 2 }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <button className="btn" onClick={crearZonaEspecial} disabled={busy || !zonaForm.nombre.trim()}>Agregar al mapa</button>
                <button className="btn ghost" onClick={() => setCreatingEspecial(false)} disabled={busy}>Cancelar</button>
              </div>
            </div>
          )}
          {!tandasFor && !creatingEspecial && !selectedKey && (
            <div className="stadium-panel stadium-panel--sidebar">
              <h3 className="stadium-panel-name">Tocá una zona del mapa</h3>
              <p className="stadium-panel-hint">Cada zona muestra precio y estado. Seleccionala para editarla; el aforo de 3.000 lugares se reparte automáticamente. Usá «Zona especial» para agregar áreas como DJ o patrocinador.</p>
            </div>
          )}
          {!tandasFor && selectedKey && !seleccionado && (
            <div className="stadium-panel stadium-panel--sidebar">
              <h3 className="stadium-panel-name">{metaSel?.label ?? selectedKey}</h3>
              <p className="stadium-panel-hint">Esta zona no está en el venue.</p>
              <button className="btn" onClick={() => agregarZona(selectedKey)} disabled={busy}><Plus size={15} />Agregar al mapa</button>
            </div>
          )}
          {!tandasFor && esEspecialSel && seleccionado && form && (
            <div className="stadium-panel stadium-panel--sidebar" style={{ textAlign: 'left' }}>
              <h3 className="stadium-panel-name">{seleccionado.nombre}</h3>
              <p className="stadium-panel-hint">Zona especial · cupo propio (no entra en el reparto de aforo).</p>
              <div className="zone-status-selector" aria-label="Estado de venta">
                <button
                  type="button"
                  className={seleccionado.estado === 'activo' ? 'active' : ''}
                  onClick={() => confirmSetEstadoSector(seleccionado, 'activo')}
                  disabled={busy || seleccionado.estado === 'activo'}
                >
                  A la venta
                </button>
                <button
                  type="button"
                  className={seleccionado.estado === 'inactivo' ? 'active inactive' : ''}
                  onClick={() => confirmSetEstadoSector(seleccionado, 'inactivo')}
                  disabled={busy || seleccionado.estado === 'inactivo'}
                >
                  Informativa
                </button>
              </div>
              <label>Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              <label>Precio CRC</label>
              <input inputMode="numeric" value={form.precioCrc} onChange={(e) => setForm({ ...form, precioCrc: e.target.value.replace(/\D/g, '') })} />
              <label>Cupo (lugares)</label>
              <input inputMode="numeric" value={form.stockTotal} onChange={(e) => setForm({ ...form, stockTotal: e.target.value.replace(/\D/g, '') })} />
              <label>Color</label>
              <input type="color" value={form.color || '#f59e0b'} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: 56, height: 34, padding: 2 }} />
              <p className="stadium-panel-hint">Arrastrá la zona en el mapa para moverla y usá las esquinas para cambiar su tamaño.</p>
              <label>Rotación · {form.rot ?? 0}°</label>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setForm({ ...form, rot: normalizeRot90((form.rot ?? 0) + 90) })}
              >
                <RotateCw size={15} />Rotar 90°
              </button>
              <div className="zone-capacity-summary">
                <span>Vendidos</span>
                <b>{seleccionado.stockVendido}</b>
                <small>{seleccionado.estado === 'activo' ? 'A la venta en el mapa del evento' : 'Informativa: visible solo en el admin'}</small>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn" onClick={guardarZonaEspecial} disabled={busy || !form.nombre.trim()}>Guardar</button>
                <button className="btn danger" onClick={() => eliminarZonaEspecial(seleccionado)} disabled={busy}><Trash2 size={15} />Eliminar</button>
              </div>
            </div>
          )}
          {!tandasFor && !showButacas && seleccionado && form && !esEspecialSel && (
            <div className="stadium-panel stadium-panel--sidebar" style={{ textAlign: 'left' }}>
              <h3 className="stadium-panel-name">{metaSel?.label ?? seleccionado.nombre}</h3>
              <div className="zone-status-selector" aria-label="Estado de venta">
                <button
                  type="button"
                  className={seleccionado.estado === 'activo' ? 'active' : ''}
                  onClick={() => confirmSetEstadoSector(seleccionado, 'activo')}
                  disabled={busy || seleccionado.estado === 'activo'}
                >
                  A la venta
                </button>
                <button
                  type="button"
                  className={seleccionado.estado === 'inactivo' ? 'active inactive' : ''}
                  onClick={() => confirmSetEstadoSector(seleccionado, 'inactivo')}
                  disabled={busy || seleccionado.estado === 'inactivo'}
                >
                  Fuera de venta
                </button>
              </div>
              {esGramillaSel && (
                <>
                  <label>Nombre</label>
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                  <label>Cupo (lugares de pie)</label>
                  <input inputMode="numeric" value={form.stockTotal} onChange={(e) => setForm({ ...form, stockTotal: e.target.value.replace(/\D/g, '') })} />
                </>
              )}
              <label>Precio CRC</label>
              <input inputMode="numeric" value={form.precioCrc} onChange={(e) => setForm({ ...form, precioCrc: e.target.value.replace(/\D/g, '') })} />
              <div className="zone-capacity-summary">
                <span>Lugares asignados</span>
                <b>{seleccionado.estado === 'activo' ? seleccionado.stockTotal.toLocaleString('es-CR') : '—'}</b>
                <small>
                  {seleccionado.stockVendido} vendidos ·{' '}
                  {seleccionado.numerado
                    ? 'sector numerado: el cupo lo definen sus butacas'
                    : esGramillaSel
                      ? 'cupo de pie configurable por zona'
                      : `reparto automático de ${VENUE_AFORO_DEFAULT.toLocaleString('es-CR')}`}
                </small>
              </div>
              {seleccionado.tandaNombre && <p className="muted zone-current-tanda">Tanda vigente: {seleccionado.tandaNombre}</p>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn" onClick={guardarSector} disabled={busy || !form.precioCrc || (esGramillaSel && !Number(form.stockTotal))}>{esGramillaSel ? 'Guardar' : 'Guardar precio'}</button>
                <button className="btn ghost" onClick={() => setTandasFor(seleccionado)}>Tandas</button>
                <button className="btn ghost" onClick={() => setShowButacas(true)}>{seleccionado.numerado ? 'Butacas ✓' : 'Butacas'}</button>
              </div>
            </div>
          )}
          {!tandasFor && showButacas && seleccionado && (
            <div className="stadium-panel stadium-panel--sidebar stadium-panel--tool">
              <button className="workspace-back" onClick={async () => { setShowButacas(false); const updated = await refresh(); await loadSeats(updated); }}>‹ Volver a {metaSel?.label ?? seleccionado.nombre}</button>
              <SeatAdminGrid tipo={seleccionado} onChanged={async () => { const updated = await refresh(); await loadSeats(updated); }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TandasModal({ tipo, onClose, asPanel = false }) {
  const toLocal = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
  const emptyForm = { nombre: '', precioCrc: '', ventaDesde: '', ventaHasta: '', cupo: '' };
  const [tandas, setTandas] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null); // tanda en edición o null (creando)
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async () => {
    const d = await api(`/admin/api/entradas/tipos/${tipo.id}/tandas`);
    if (d.ok) setTandas(d.tandas);
  };
  useEffect(() => { load(); }, [tipo.id]);
  function startEdit(t) {
    setEditing(t);
    setForm({ nombre: t.nombre, precioCrc: String(t.precioCrc), ventaDesde: toLocal(t.ventaDesde), ventaHasta: toLocal(t.ventaHasta), cupo: t.cupo == null ? '' : String(t.cupo) });
  }
  function cancelEdit() { setEditing(null); setForm(emptyForm); setError(''); }
  async function submit() {
    setError(''); setLoading(true);
    const body = {
      nombre: form.nombre,
      precioCrc: Number(form.precioCrc),
      ventaDesde: form.ventaDesde || null,
      ventaHasta: form.ventaHasta || null,
      cupo: form.cupo === '' ? null : Number(form.cupo),
    };
    const url = editing ? `/admin/api/entradas/tandas/${editing.id}` : `/admin/api/entradas/tipos/${tipo.id}/tandas`;
    const d = await api(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
    setLoading(false);
    if (!d.ok) return setError(d.error);
    cancelEdit(); load();
  }
  async function del(t) {
    const d = await api(`/admin/api/entradas/tandas/${t.id}`, { method: 'DELETE' });
    if (!d.ok) return setError(d.error);
    setDeletingId(null);
    load();
  }
  const fmtVentana = (t) => {
    const desde = t.ventaDesde ? fmtFullDate(t.ventaDesde) : 'ya';
    const hasta = t.ventaHasta ? fmtFullDate(t.ventaHasta) : 'sin límite';
    return `${desde} → ${hasta}`;
  };
  const inner = (
    <>
      {asPanel && <h3 className="stadium-panel-name">Preventa · {tipo.nombre}</h3>}
      <p className="muted" style={{ fontSize: '.85rem' }}>
        La tanda vigente (por fechas, cupo y orden) define el precio de venta. Sin tanda activa se usa el precio base ({money(tipo.precioCrc)}).
      </p>
      {tandas.length > 0 && (
        <div className="tipos-list">
          {tandas.map((t) => (
            <div key={t.id} className="tipo-row">
              <div>
                <b>{t.nombre}</b>
                <span>{money(t.precioCrc)} · {t.vendidos}{t.cupo != null ? `/${t.cupo}` : ''} vendidos · {fmtVentana(t)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn ghost" onClick={() => startEdit(t)}>Editar</button>
                {deletingId === t.id ? (
                  <>
                    <button className="btn ghost danger" onClick={() => del(t)}>Confirmar</button>
                    <button className="btn ghost" onClick={() => setDeletingId(null)}>No</button>
                  </>
                ) : (
                  <button className="btn ghost" onClick={() => setDeletingId(t.id)}>Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <h4 className="tipos-section-title">{editing ? `Editar "${editing.nombre}"` : 'Nueva tanda'}</h4>
      <div className="two">
        <div><label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Preventa" /></div>
        <div><label>Precio CRC</label><input inputMode="numeric" value={form.precioCrc} onChange={(e) => setForm({ ...form, precioCrc: e.target.value.replace(/\D/g, '') })} /></div>
      </div>
      <div className="two">
        <div><label>Venta desde</label><input type="datetime-local" value={form.ventaDesde} onChange={(e) => setForm({ ...form, ventaDesde: e.target.value })} /></div>
        <div><label>Venta hasta</label><input type="datetime-local" value={form.ventaHasta} onChange={(e) => setForm({ ...form, ventaHasta: e.target.value })} /></div>
      </div>
      <label>Cupo (opcional)</label>
      <input inputMode="numeric" value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value.replace(/\D/g, '') })} placeholder="Sin límite" />
      {error && <div className="error">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={submit} disabled={loading || !form.nombre || form.precioCrc === ''}>{loading ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar tanda'}</button>
        {editing && <button className="btn ghost" onClick={cancelEdit}>Cancelar</button>}
      </div>
    </>
  );
  return asPanel ? inner : <Modal title={`Tandas · ${tipo.nombre}`} onClose={onClose}>{inner}</Modal>;
}

function AsientosModal({ tipo, onClose, asPanel = false }) {
  const inner = (
    <>
      {asPanel && <h3 className="stadium-panel-name">Butacas · {tipo.nombre}</h3>}
      <SeatAdminGrid tipo={tipo} />
    </>
  );
  return asPanel ? inner : <Modal title={`Butacas · ${tipo.nombre}`} onClose={onClose}>{inner}</Modal>;
}


function CortesiaModal({ evento, tipos, onClose, asPanel }) {
  const confirm = useConfirm();
  const [form, setForm] = useState({ tipoId: tipos?.[0]?.id || '', nombre: '', email: '' });
  const [msg, setMsg] = useState(null);
  async function submit() {
    const tipoNombre = (tipos || []).find((t) => t.id === form.tipoId)?.nombre;
    const ok = await confirm({
      title: 'Emitir cortesía',
      message: `Se emitirá una entrada de cortesía${tipoNombre ? ` de «${tipoNombre}»` : ''}${form.email ? ` y se enviará a ${form.email}` : ''}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Emitir cortesía',
    });
    if (!ok) return;
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
      <DataTable
        id="ventas-eventos"
        rows={eventos}
        rowKey={(e) => e.evento.id}
        columns={[
          { key: 'nombre', label: 'Evento', sortValue: (e) => e.evento.nombre, render: (e) => e.evento.nombre },
          { key: 'estado', label: 'Estado', sortValue: (e) => e.evento.estado, render: (e) => <span className={`pill ${e.evento.estado}`}>{e.evento.estado}</span> },
          { key: 'boletosVendidos', label: 'Vendidos' },
          { key: 'boletosUsados', label: 'Ingresados' },
          { key: 'ingresosCrc', label: 'Ingresos', render: (e) => money(e.ingresosCrc) },
        ]}
      />
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

// Pestaña Butacas del detalle: todos los sectores del evento con su grilla.
function EventButacasPanel({ evento }) {
  const [tipos, setTipos] = useState([]);
  const refresh = async () => {
    const d = await api(`/admin/api/entradas/eventos/${evento.id}`);
    if (d.ok) setTipos(d.tipos);
  };
  useEffect(() => { refresh(); }, [evento.id]);
  if (tipos.length === 0) return <p className="muted">Este evento no tiene sectores todavía. Agregalos en la pestaña Sectores.</p>;
  return (
    <>
      {tipos.map((t) => (
        <details key={t.id} open={t.numerado} style={{ borderBottom: '1px solid rgba(255,255,255,.08)', padding: '8px 0' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
            {t.nombre} {t.numerado
              ? <span className="pill publicado" style={{ marginLeft: 6, fontSize: '.65rem' }}>numerado · {t.disponibles} disp.</span>
              : <span className="pill borrador" style={{ marginLeft: 6, fontSize: '.65rem' }}>admisión general</span>}
          </summary>
          <div style={{ padding: '10px 0 4px' }}>
            <SeatAdminGrid tipo={t} onChanged={refresh} />
          </div>
        </details>
      ))}
    </>
  );
}

function EventDetalleModal({ evento, tipos, onClose, onToggleEstado, onChanged }) {
  const [tab, setTab] = useState('detalles');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tplMsg, setTplMsg] = useState(null);
  async function guardarComoTemplate() {
    const nombre = evento.nombre.trim();
    if (!nombre) return;
    setTplMsg(null);
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/guardar-template`, { method: 'POST', body: JSON.stringify({ nombre }) });
    setTplMsg(d.ok ? { type: 'ok', text: `Template "${d.template.nombre}" guardado.` } : { type: 'error', text: d.error });
  }
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
        <button className={`btn ghost${tab === 'butacas' ? ' active' : ''}`} onClick={() => setTab('butacas')}><Accessibility size={16} />Butacas</button>
        <button className={`btn ghost${tab === 'cortesia' ? ' active' : ''}`} onClick={() => setTab('cortesia')}><Gift size={16} />Cortesia</button>
        <button className="btn ghost" onClick={guardarComoTemplate}><Sparkles size={16} />Guardar como template</button>
        {onToggleEstado && (evento.estado === 'publicado'
          ? <button className="btn ghost" onClick={onToggleEstado}><Lock size={16} />Finalizar</button>
          : <button className="btn ghost" onClick={onToggleEstado}><Send size={16} />Publicar</button>)}
      </div>

      {tplMsg && <div className={tplMsg.type === 'ok' ? 'okbox' : 'error'}>{tplMsg.text}</div>}
      {tab === 'detalles' && <>
        {error && <div className="error">{error}</div>}
        {!error && !data && <p className="muted">Cargando detalle…</p>}
        {data && <EventDetalleContenido evento={evento} data={data} />}
      </>}
      {tab === 'sectores' && <VenueMapConfig evento={evento} onChanged={onChanged} />}
      {tab === 'mapa' && <StadiumMapEditor evento={evento} tipos={tipos} embedded onClose={() => setTab('detalles')} onSaved={onChanged} />}
      {tab === 'butacas' && <EventButacasPanel evento={evento} />}
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
        <DataTable
          id="ocupacion-sectores"
          rows={sectores}
          rowKey={(s) => s.nombre}
          empty="Sin sectores"
          columns={[
            { key: 'nombre', label: 'Sector' },
            {
              key: 'pct', label: 'Ocupación',
              tdProps: () => ({ style: { minWidth: 160 } }),
              render: (s) => (
                <>
                  <div className="occ-bar"><div className="occ-fill" style={{ width: `${Math.min(100, s.pct)}%` }} /></div>
                  <small className="muted">{s.pct}%</small>
                </>
              ),
            },
            { key: 'vendido', label: 'Vendidos' },
            { key: 'stock', label: 'Cupo' },
            { key: 'ingresos', label: 'Ingresos', render: (s) => money(s.ingresos) },
          ]}
        />
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
