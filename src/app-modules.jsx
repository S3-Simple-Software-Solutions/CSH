import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, BadgePercent, CalendarDays, Car, Check, Clock, Eye, EyeOff, Globe, LogOut, Mail, Moon, Plus, QrCode, RotateCcw, RotateCw, ScanLine, Search, Shield, Sun, Ticket, ToggleLeft, ToggleRight, Trash2, Truck, Users, UtensilsCrossed } from 'lucide-react';
import QRCode from 'qrcode';
import sotano1Img from './croquis/sotano-1.png';
import sotano2Img from './croquis/sotano-2.png';
import './styles.css';

const PLAN_IMG = { 'sotano-1': sotano1Img, 'sotano-2': sotano2Img };
const PLAN_FLOW_ARROWS = {
  'sotano-1': [
    { x: 0.170, y: 0.181, r: 180 }, { x: 0.300, y: 0.181, r: 180 }, { x: 0.438, y: 0.181, r: 180 }, { x: 0.574, y: 0.181, r: 180 }, { x: 0.708, y: 0.181, r: 180 },
    { x: 0.153, y: 0.318, r: 90 }, { x: 0.153, y: 0.469, r: 90 }, { x: 0.153, y: 0.619, r: 90 }, { x: 0.151, y: 0.708, r: 180 },
    { x: 0.207, y: 0.389, r: -90 }, { x: 0.207, y: 0.615, r: 90 }, { x: 0.198, y: 0.704, r: 90 },
    { x: 0.792, y: 0.346, r: 90 }, { x: 0.792, y: 0.523, r: -90 }, { x: 0.792, y: 0.643, r: -90 }, { x: 0.792, y: 0.746, r: -90 },
    { x: 0.864, y: 0.438, r: 90 }, { x: 0.864, y: 0.557, r: 90 }, { x: 0.852, y: 0.690, r: 180 },
    { x: 0.833, y: 0.279, r: 90 }, { x: 0.854, y: 0.299, r: 90 }, { x: 0.776, y: 0.393, r: 45 }, { x: 0.845, y: 0.354, r: -90 },
  ],
  'sotano-2': [
    { x: 0.169, y: 0.192, r: 180 }, { x: 0.292, y: 0.192, r: 180 }, { x: 0.431, y: 0.192, r: 180 }, { x: 0.561, y: 0.192, r: 180 }, { x: 0.695, y: 0.192, r: 180 },
    { x: 0.128, y: 0.348, r: 90 }, { x: 0.128, y: 0.472, r: 90 }, { x: 0.128, y: 0.617, r: 90 }, { x: 0.144, y: 0.690, r: 180 },
    { x: 0.180, y: 0.403, r: -90 }, { x: 0.180, y: 0.570, r: -90 }, { x: 0.180, y: 0.682, r: -90 },
    { x: 0.383, y: 0.804, r: 180 }, { x: 0.548, y: 0.804, r: 180 }, { x: 0.708, y: 0.804, r: 180 },
    { x: 0.790, y: 0.326, r: -90 }, { x: 0.790, y: 0.462, r: -90 }, { x: 0.790, y: 0.598, r: -90 }, { x: 0.790, y: 0.734, r: -90 },
    { x: 0.864, y: 0.328, r: 90 }, { x: 0.864, y: 0.501, r: 90 }, { x: 0.864, y: 0.663, r: 90 }, { x: 0.846, y: 0.706, r: 180 },
  ],
};

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
const FLOW_ARROW_PATHS = {
  straight: ['M8 50 H88'],
  'turn-left': ['M78 88 V61 C78 39 62 26 38 26 H12'],
  'turn-right': ['M22 88 V61 C22 39 38 26 62 26 H88'],
  'split-up-right': ['M28 86 V22', 'M28 56 Q28 40 45 40 H80'],
  'split-left-right': ['M50 86 V60 Q50 40 25 40 H16', 'M50 60 Q50 40 75 40 H84'],
  'u-turn-right': ['M20 86 V42 Q20 18 50 18 Q82 18 82 50 V78'],
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

function FlowArrowSvg({ kind, editable }) {
  const safeKind = flowArrowKind(kind);
  const paths = FLOW_ARROW_PATHS[safeKind] || FLOW_ARROW_PATHS.straight;
  const connectors = flowArrowCapMarkers(safeKind);
  return (
    <svg className="flow-arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g className="flow-road-body">
        {paths.map((d) => <path key={`${d}-road`} d={d} />)}
      </g>
      <g className="flow-road-centerline">
        {paths.map((d) => <path key={`${d}-center`} d={d} />)}
      </g>
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
    <button className="icon-text ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function Header({ user, onLogout }) {
  return (
    <header className="top">
      <a className="brand" href="/">
        <img src="/brand/logo-shield.png" alt="Escudo Club Sport Herediano" />
        <span>Herediano</span>
      </a>
      <nav>
        <a href="/entradas">Entradas</a>
        <a href="/cuponera">Cuponera</a>
        <a href="/parqueo">Parqueo</a>
        <a href="/admin">Admin</a>
        <ThemeToggle />
        {user && <button className="icon-text ghost" onClick={onLogout}><LogOut size={16} />Salir</button>}
      </nav>
    </header>
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
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

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
  const shortW = STALL_SHORT_W;
  const shortH = (shortW * aspect);
  byId.forEach((spot) => {
    if (spot.ancho && spot.alto) {
      spot.w = spot.ancho;
      spot.h = spot.alto;
    } else if (spot.vertical) {
      spot.w = shortW;
      spot.h = clamp(shortH * STALL_LONG_RATIO, 0.04, 0.05);
    } else {
      spot.w = clamp(shortW * STALL_LONG_RATIO, 0.03, 0.035);
      spot.h = shortH;
    }
  });
  return byId;
}

function spotStyle(st, layout) {
  const g = layout.get(st.id) || { x: st.x, y: st.y, w: 0.032, h: 0.022 };
  return { left: `${g.x * 100}%`, top: `${g.y * 100}%`, width: `${g.w * 100}%`, height: `${g.h * 100}%` };
}

function flowArrowsForFloor(fl) {
  if (!fl) return [];
  const arrows = fl.arrows?.length ? fl.arrows : (PLAN_FLOW_ARROWS[fl.plan] || []);
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

function FlowArrows({ arrows, editable = false, selected = null, onPointerDown, aspect = 1.5 }) {
  return (
    <>
      {arrows.map((arrow) => {
        const Tag = editable ? 'button' : 'span';
        const kind = flowArrowKind(arrow.kind);
        const size = flowArrowRoadSize(arrow, arrows, aspect);
        return (
          <React.Fragment key={arrow.id}>
            <Tag
              type={editable ? 'button' : undefined}
              className={`flow-arrow kind-${kind}${editable ? ' editable' : ''}${selected === arrow.id ? ' selected' : ''}`}
              style={{ left: `${arrow.x * 100}%`, top: `${arrow.y * 100}%`, width: `${size.w * 100}%`, height: `${size.h * 100}%`, '--rot': `${arrow.r}deg` }}
              title={editable ? `Mover flecha: ${FLOW_ARROW_LABELS[kind]}` : undefined}
              aria-hidden={editable ? undefined : 'true'}
              aria-label={editable ? `Mover flecha: ${FLOW_ARROW_LABELS[kind]}` : undefined}
              onPointerDown={editable ? (e) => onPointerDown?.(e, arrow) : undefined}
              onClick={editable ? (e) => e.stopPropagation() : undefined}
            >
              <FlowArrowSvg kind={kind} editable={editable} />
            </Tag>
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
      <div className="plano" style={{ aspectRatio: String(fl.aspect) }}>
        <img src={PLAN_IMG[fl.plan]} alt={`Plano ${fl.plan}`} draggable="false" />
        <div className="plano-overlay">
          {showFlow && <FlowArrows arrows={flowArrows} aspect={fl.aspect} />}
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
      </div>
    </div>
  );
}

// Editor visual del croquis: permite marcar y mover plazas sobre el plano.
// Solo se monta para administradores de parqueo.
function PlanoEditor({ floor, onClose, onSaved }) {
  const [floors, setFloors] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedArrow, setSelectedArrow] = useState(null);
  const [arrowKind, setArrowKind] = useState('straight');
  const [addingArrow, setAddingArrow] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const overlayRef = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);

  const reload = () => api('/api/parqueo/croquis').then((d) => d.ok && setFloors(d.floors));
  useEffect(() => { reload(); }, []);

  const fl = floors?.find((f) => f.piso === floor);
  const visibleStalls = useMemo(() => (fl?.stalls || []).filter((st) => st.utilizado !== false), [fl]);
  const spotLayout = useMemo(() => buildSpotLayout(visibleStalls, fl?.aspect), [visibleStalls, fl?.aspect]);
  const flowArrows = useMemo(() => flowArrowsForFloor(fl), [fl]);
  const selectedStall = visibleStalls.find((st) => st.id === selected) || null;
  const selectedArrowItem = flowArrows.find((arrow) => arrow.id === selectedArrow) || null;

  function frac(e) {
    const r = overlayRef.current.getBoundingClientRect();
    return { x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) };
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

  async function addDot(e) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (e.target !== overlayRef.current || busy) return;
    const { x, y } = frac(e);
    setBusy(true);
    setMsg(null);
    const data = await api('/admin/api/parqueo/espacio', { method: 'POST', body: JSON.stringify({ piso: floor, x, y }) });
    setBusy(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    await reload();
    setSelected(data.espacio.id);
    setSelectedArrow(null);
    onSaved?.();
  }

  async function addArrow(e) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (e.target !== overlayRef.current || busy) return;
    const { x, y } = frac(e);
    setBusy(true);
    setMsg(null);
    const data = await api('/admin/api/parqueo/flecha', { method: 'POST', body: JSON.stringify({ piso: floor, x, y, r: 0, kind: arrowKind }) });
    setBusy(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, arrows: [...flowArrowsForFloor(f), data.flecha] })));
    setSelected(null);
    setSelectedArrow(data.flecha.id);
    setArrowKind(flowArrowKind(data.flecha.kind));
    setAddingArrow(false);
    onSaved?.();
  }

  function handleOverlayClick(e) {
    if (addingArrow) return addArrow(e);
    return addDot(e);
  }

  function startDrag(e, st) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(st.id);
    setSelectedArrow(null);
    setAddingArrow(false);
    drag.current = { id: st.id, moved: false };
    const onMove = (ev) => {
      if (!drag.current) return;
      drag.current.moved = true;
      const { x, y } = frac(ev);
      patchDot(st.id, x, y);
    };
    const onUp = async (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const moved = drag.current?.moved;
      drag.current = null;
      if (!moved) return;
      // El arrastre termina con un click; evitá que dispare un addDot.
      suppressClick.current = true;
      const { x, y } = frac(ev);
      const data = await api(`/admin/api/parqueo/espacio/${encodeURIComponent(st.id)}/pos`, { method: 'PUT', body: JSON.stringify({ x, y }) });
      if (!data.ok) { setMsg({ type: 'error', text: data.error }); reload(); return; }
      onSaved?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startArrowDrag(e, arrow) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(null);
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
    const onUp = async (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const moved = drag.current?.moved;
      const finalPoint = drag.current ? { x: drag.current.x, y: drag.current.y } : frac(ev);
      drag.current = null;
      if (!moved) return;
      suppressClick.current = true;
      const data = await api(`/admin/api/parqueo/flecha/${encodeURIComponent(arrow.id)}/pos`, { method: 'PUT', body: JSON.stringify(finalPoint) });
      if (!data.ok) { setMsg({ type: 'error', text: data.error }); reload(); return; }
      onSaved?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  async function saveArrowPatch(id, patch) {
    setBusy(true);
    setMsg(null);
    patchArrow(id, patch);
    const data = await api(`/admin/api/parqueo/flecha/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) });
    setBusy(false);
    if (!data.ok) { setMsg({ type: 'error', text: data.error }); reload(); return null; }
    patchArrow(id, data.flecha);
    setArrowKind(flowArrowKind(data.flecha.kind));
    onSaved?.();
    return data.flecha;
  }

  async function rotateArrow(delta) {
    if (!selectedArrowItem) return;
    await saveArrowPatch(selectedArrowItem.id, { r: normalizeRotation(selectedArrowItem.r + delta) });
  }

  async function changeArrowKind(kind) {
    if (!selectedArrowItem) return;
    const safeKind = flowArrowKind(kind);
    setArrowKind(safeKind);
    await saveArrowPatch(selectedArrowItem.id, { kind: safeKind });
  }

  async function flipTurnDirection() {
    if (!selectedArrowItem) return;
    const flippedKind = FLOW_TURN_FLIP[flowArrowKind(selectedArrowItem.kind)];
    if (!flippedKind) return;
    setArrowKind(flippedKind);
    await saveArrowPatch(selectedArrowItem.id, { kind: flippedKind });
  }

  async function removeArrow(id) {
    if (!window.confirm('¿Borrar esta flecha de circulación?')) return;
    setBusy(true);
    setMsg(null);
    const data = await api(`/admin/api/parqueo/flecha/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setBusy(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setFloors((prev) => prev.map((f) => (f.piso !== floor ? f : { ...f, arrows: flowArrowsForFloor(f).filter((arrow) => arrow.id !== id) })));
    setSelectedArrow(null);
    onSaved?.();
  }

  async function removeDot(id) {
    setBusy(true);
    setMsg(null);
    const data = await api(`/admin/api/parqueo/espacio/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setBusy(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setSelected(null);
    setSelectedArrow(null);
    setAddingArrow(false);
    setEditTarget(null);
    await reload();
    onSaved?.();
  }

  async function clearAll() {
    if (!window.confirm('¿Vaciar el plano? Se borrarán TODOS los espacios y sus reservas. Esta acción no se puede deshacer.')) return;
    setBusy(true);
    setMsg(null);
    const data = await api('/admin/api/parqueo/croquis/clear', { method: 'POST' });
    setBusy(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setFloors(data.floors);
    setSelected(null);
    setSelectedArrow(null);
    setAddingArrow(false);
    setMsg({ type: 'ok', text: 'Plano vaciado. Hacé clic para marcar los espacios.' });
    onSaved?.();
  }

  if (!fl) return <div className="plano-loading">Cargando croquis del plano...</div>;
  const count = visibleStalls.length;
  const editorHint = addingArrow
    ? 'Hacé clic en el plano para ubicar la nueva flecha de circulación.'
    : 'Hacé clic para marcar una plaza. Arrastrá flechas desde las esquinas del carril para unir tramos de calle; seleccionalas para cambiar dirección.';

  return (
    <div className="plano-editor">
      <div className="editor-bar">
        <span className="hint">{editorHint}</span>
        <div className="editor-actions">
          <select
            className="arrow-kind-select"
            value={selectedArrowItem ? flowArrowKind(selectedArrowItem.kind) : arrowKind}
            title="Tipo de flecha"
            disabled={busy}
            onChange={(e) => (selectedArrowItem ? changeArrowKind(e.target.value) : setArrowKind(flowArrowKind(e.target.value)))}
          >
            {FLOW_ARROW_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
          </select>
          <button
            className={`btn ghost${addingArrow ? ' active' : ''}`}
            onClick={() => {
              setAddingArrow((value) => !value);
              setSelected(null);
              setSelectedArrow(null);
              setEditTarget(null);
            }}
            disabled={busy}
            title="Agregar flecha de circulación"
          >
            <Plus size={16} />{addingArrow ? 'Ubicar flecha' : 'Agregar flecha'}
          </button>
          <button className="btn ghost danger" onClick={clearAll} disabled={busy}>Vaciar plano</button>
          <button className="btn ghost" onClick={onClose} disabled={busy}>Cerrar</button>
        </div>
      </div>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <div className="plano-wrap">
        <div className="plano" style={{ aspectRatio: String(fl.aspect) }}>
          <img src={PLAN_IMG[fl.plan]} alt={`Plano ${fl.plan}`} draggable="false" />
          <div ref={overlayRef} className={`plano-overlay editing${addingArrow ? ' adding-arrow' : ''}`} onClick={handleOverlayClick}>
            <FlowArrows arrows={flowArrows} editable selected={selectedArrow} onPointerDown={startArrowDrag} aspect={fl.aspect} />
            {visibleStalls.map((st) => (
              <button
                key={st.id}
                type="button"
                className={`pspot editable${st.discapacitado ? ' accessible' : ''}${selected === st.id ? ' selected' : ''}`}
                style={spotStyle(st, spotLayout)}
                title={st.nombre || st.id}
                onPointerDown={(e) => startDrag(e, st)}
                onClick={(e) => e.stopPropagation()}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="editor-props">
        <span>{count} espacio{count === 1 ? '' : 's'} en Sótano -{floor}</span>
        {selected && (
          <>
            <b>{selectedStall?.nombre || selected}</b>
            <button className="btn ghost" onClick={() => selectedStall && setEditTarget(selectedStall)} disabled={busy}>Editar plaza</button>
            <button className="btn ghost danger" onClick={() => removeDot(selected)} disabled={busy}>Borrar espacio</button>
            <button className="btn ghost" onClick={() => setSelected(null)} disabled={busy}>Deseleccionar</button>
          </>
        )}
        {selectedArrow && (
          <>
            <b>{selectedArrow}</b>
            <span>{FLOW_ARROW_LABELS[flowArrowKind(selectedArrowItem?.kind)] || 'Flecha'} · {normalizeRotation(selectedArrowItem?.r || 0)}°</span>
            <button className="btn ghost icon-only" onClick={() => rotateArrow(-45)} disabled={busy || !selectedArrowItem} title="Girar 45 grados a la izquierda" aria-label="Girar flecha a la izquierda"><RotateCcw size={16} /></button>
            <button className="btn ghost icon-only" onClick={() => rotateArrow(45)} disabled={busy || !selectedArrowItem} title="Girar 45 grados a la derecha" aria-label="Girar flecha a la derecha"><RotateCw size={16} /></button>
            {isTurnArrowKind(selectedArrowItem?.kind) && <button className="btn ghost" onClick={flipTurnDirection} disabled={busy || !selectedArrowItem} title="Cambiar curva izquierda/derecha"><ArrowLeftRight size={16} />Cambiar lado</button>}
            <button className="btn ghost danger" onClick={() => removeArrow(selectedArrow)} disabled={busy}><Trash2 size={16} />Borrar flecha</button>
            <button className="btn ghost" onClick={() => setSelectedArrow(null)} disabled={busy}>Deseleccionar</button>
          </>
        )}
      </div>
      {editTarget && (
        <EditSpaceModal
          stall={editTarget}
          layout={spotLayout}
          onClose={() => setEditTarget(null)}
          onSaved={async () => {
            setEditTarget(null);
            await reload();
            onSaved?.();
          }}
        />
      )}
    </div>
  );
}

function pctValue(value) {
  return String(Math.round(Number(value || 0) * 1000) / 10);
}

function EditSpaceModal({ stall, layout, onClose, onSaved }) {
  const current = layout.get(stall.id) || { w: stall.ancho || 0.032, h: stall.alto || 0.022 };
  const [form, setForm] = useState({
    nombre: stall.nombre || '',
    discapacitado: Boolean(stall.discapacitado),
    ancho: pctValue(stall.ancho || current.w),
    alto: pctValue(stall.alto || current.h),
  });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    setMsg(null);
    const ancho = Number(form.ancho) / 100;
    const alto = Number(form.alto) / 100;
    if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) return setMsg({ type: 'error', text: 'Ingresa un tamano valido.' });
    setSaving(true);
    const data = await api(`/admin/api/parqueo/espacio/${encodeURIComponent(stall.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ nombre: form.nombre, discapacitado: form.discapacitado, ancho, alto }),
    });
    setSaving(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    await onSaved?.(data.espacio);
  }
  async function resetSize() {
    setMsg(null);
    setSaving(true);
    const data = await api(`/admin/api/parqueo/espacio/${encodeURIComponent(stall.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ nombre: form.nombre, discapacitado: form.discapacitado, ancho: null, alto: null }),
    });
    setSaving(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    await onSaved?.(data.espacio);
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
        <button className="btn" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar plaza'}</button>
        <button className="btn ghost" onClick={resetSize} disabled={saving}>Tamano automatico</button>
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

        <Toolbar floor={floor} setFloor={setFloor} stats={`${available}/${total} libres en Sótano -${floor}`}>
          <FlowToggleButton showFlow={showFlow} setShowFlow={setShowFlow} />
        </Toolbar>
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

function Toolbar({ floor, setFloor, stats, children }) {
  return (
    <div className="toolbar">
      <div className="tabs">
        {[1, 2].map((p) => <button key={p} className={floor === p ? 'active' : ''} onClick={() => setFloor(p)}>Sótano -{p}</button>)}
      </div>
      <div className="legend">
        <span><i className="green" />Disponible</span>
        <span><i className="blue" />Discapacitados</span>
        <span><i className="orange" />Reservado</span>
        <span><i className="red" />Ocupado</span>
        <span><i className="wine" />Tiempo vencido</span>
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

function AdminApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(location.pathname);
  useEffect(() => {
    api('/api/session').then((data) => { setUser(data.user); setLoading(false); });
    const onPop = () => setRoute(location.pathname);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const navigate = (path) => { history.pushState(null, '', path); setRoute(path); };
  async function logout() { await api('/admin/logout', { method: 'POST', body: '{}' }); location.href = '/admin'; }
  if (loading) return <main className="page"><p>Cargando...</p></main>;
  if (!user) return <AdminLogin />;
  return (
    <div className="admin-shell">
      <aside>
        <a className="side-brand" onClick={() => navigate('/admin')}><img src="/brand/logo-shield.png" alt="" /><b>Herediano</b><span>Admin</span></a>
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
      </aside>
      <section className="admin-main">
        <Header user={user} onLogout={logout} />
        {route === '/admin/parqueo' ? <AdminParking user={user} /> : route === '/admin/entradas' ? <AdminEntradas user={user} /> : route === '/admin/cuponera' ? <AdminCoupons user={user} /> : route === '/admin/usuarios' ? <AdminUsers /> : route === '/admin/web' ? <AdminWeb /> : WIP_MODULES[route] ? <UnderConstruction modulo={WIP_MODULES[route]} /> : <AdminHome user={user} navigate={navigate} />}
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
    location.href = '/admin';
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
    const response = await fetch('/admin/api/web/hero-imagen', { method: 'POST', headers: { 'content-type': file.type }, body: file });
    const data = await response.json().catch(() => ({ ok: false, error: 'Respuesta invalida' }));
    setSaving(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
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
      <p className="sub">Edita el hero de la portada: la imagen de fondo y sus textos. Los cambios se aplican de inmediato en el sitio.</p>
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
  useEffect(() => { api('/admin/api/users').then((data) => data.ok && setUsers(data.users)); }, []);
  return (
    <main className="page">
      <p className="eyebrow">Cuentas y permisos</p><h1>Gestion de usuarios</h1>
      <div className="table"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Area</th><th>Estado</th><th></th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.area}</td><td><span className="pill">{u.status}</span></td><td><button className="btn ghost" onClick={() => setTarget(u)}>Cambiar clave</button></td></tr>)}</tbody></table></div>
      {target && <PasswordModal user={target} onClose={() => setTarget(null)} />}
    </main>
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
      <Toolbar floor={floor} setFloor={setFloor} stats={`${available}/${total} libres en Sótano -${floor}`}>
        {!editing && <FlowToggleButton showFlow={showFlow} setShowFlow={setShowFlow} />}
        {canEdit && !editing && <button className="btn ghost" onClick={() => setEditing(true)}>Editar plazas</button>}
      </Toolbar>
      {editing
        ? <PlanoEditor floor={floor} onClose={() => setEditing(false)} onSaved={refresh} />
        : <PlanoCroquis spaces={state.espacios} reservations={state.reservas} floor={floor} me={user} admin showFlow={showFlow} onSpace={(space, reservation) => setModal({ space, reservation })} />}
      <section className="events"><h2>Log de eventos</h2><div className="table"><table><thead><tr><th>Fecha/Hora</th><th>Tipo</th><th>Espacio</th><th>Placa</th><th>Usuario</th><th>Notas</th></tr></thead><tbody>{events.map((e) => <tr key={e.id}><td>{fmtFullDate(e.timestamp)}</td><td>{e.tipo}</td><td>{e.espacioId}</td><td>{e.placa}</td><td>{e.userName}</td><td>{e.notas}</td></tr>)}</tbody></table></div></section>
      {modal && <AdminSpaceModal modal={modal} user={user} onClose={() => setModal(null)} afterAction={afterAction} />}
    </main>
  );
}

function AdminCoupons({ user }) {
  const [state, setState] = useState({ cupones: [], eventos: [], stats: {}, role: 'socio', sponsor: '' });
  const [message, setMessage] = useState(null);
  const refresh = async () => {
    const data = await api('/admin/api/cuponera');
    if (data.ok) setState(data);
  };
  useEffect(() => { refresh(); }, []);
  async function toggle(cupon) {
    setMessage(null);
    const estado = cupon.estado === 'habilitado' ? 'retirado' : 'habilitado';
    const data = await api(`/admin/api/cuponera/${cupon.id}/estado`, { method: 'POST', body: JSON.stringify({ estado }) });
    if (!data.ok) return setMessage({ type: 'error', text: data.error });
    setMessage({ type: 'ok', text: `${cupon.proveedor}: cupon ${estado}.` });
    refresh();
  }
  const canManage = state.role === 'admin' || state.role === 'patrocinador';
  return (
    <main className="page">
      <p className="eyebrow">Beneficios y proveedores</p><h1>Cuponera</h1>
      <p className="sub">{state.role === 'patrocinador' ? `Panel de patrocinador para ${state.sponsor}.` : 'Panel administrativo para revisar, retirar o habilitar cupones de descuento.'}</p>
      <section className="coupon-stats">
        <div><span>Total</span><b>{state.stats.total || 0}</b></div>
        <div><span>Habilitados</span><b>{state.stats.habilitados || 0}</b></div>
        <div><span>Retirados</span><b>{state.stats.retirados || 0}</b></div>
      </section>
      {message && <div className={message.type === 'ok' ? 'okbox' : 'error'}>{message.text}</div>}
      <section className="coupon-list admin-coupons">
        {state.cupones.map((cupon) => <CouponCard key={cupon.id} cupon={cupon} admin={canManage} onToggle={toggle} />)}
      </section>
      <section className="events"><h2>Actividad de cupones</h2><div className="table"><table><thead><tr><th>Fecha/Hora</th><th>Proveedor</th><th>Cupon</th><th>Estado</th><th>Usuario</th></tr></thead><tbody>{state.eventos.map((e) => <tr key={e.id}><td>{fmtFullDate(e.timestamp)}</td><td>{e.proveedor}</td><td>{e.cuponId}</td><td>{e.estado}</td><td>{e.userName}</td></tr>)}</tbody></table></div></section>
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

function Modal({ title, children, onClose }) {
  return <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal"><div className="modal-head"><h3>{title}</h3><button onClick={onClose}>×</button></div>{children}</section></div>;
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
  useEffect(() => { api(`/api/entradas/publico/eventos/${encodeURIComponent(slug)}`).then((d) => (d.ok ? setData(d) : setError(d.error))); }, [slug]);
  if (error) return (<><main className="page"><p className="eyebrow">Entradas</p><h1>Evento no disponible</h1><p className="sub">{error}</p><a className="btn ghost" href="/entradas">Volver a eventos</a></main></>);
  if (!data) return (<><main className="page"><p>Cargando...</p></main></>);
  const { evento, tipos } = data;
  const setCantidad = (id, n, max) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, n)) }));
  const lineas = tipos.filter((t) => qty[t.id] > 0).map((t) => ({ tipoId: t.id, cantidad: qty[t.id] }));
  const total = tipos.reduce((s, t) => s + t.precioCrc * (qty[t.id] || 0), 0);
  const count = lineas.reduce((s, l) => s + l.cantidad, 0);
  return (
    <>
      
      <main className="page">
        <a className="back-link" href="/entradas">‹ Eventos</a>
        <p className="eyebrow">{fmtFullDate(evento.fecha)} · {evento.venue}</p>
        <h1>{evento.nombre}</h1>
        <p className="sub">{evento.descripcion}</p>
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
        <div className="checkout-bar">
          <div><span>{count} boleto(s)</span><b>{money(total)}</b></div>
          <button className="btn" disabled={count === 0} onClick={() => setCheckout(true)}>Continuar</button>
        </div>
      </main>
      {checkout && <CheckoutModal slug={slug} lineas={lineas} total={total} evento={evento} onClose={() => setCheckout(false)} onDone={(res) => { setCheckout(false); setDone(res); }} />}
      {done && <TicketsModal result={done} onClose={() => { setDone(null); location.reload(); }} />}
    </>
  );
}

function CheckoutModal({ slug, lineas, total, evento, onClose, onDone }) {
  const [buyer, setBuyer] = useState({ nombre: '', email: '' });
  const [pago, setPago] = useState({ name: '', cardNumber: '', exp: '', cvv: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const count = lineas.reduce((s, l) => s + l.cantidad, 0);
  async function submit() {
    setError(''); setLoading(true);
    const body = { slug, lineas, comprador: buyer, pago: total > 0 ? pago : undefined };
    const d = await api('/api/entradas/publico/comprar', { method: 'POST', body: JSON.stringify(body) });
    setLoading(false);
    if (!d.ok) return setError(d.error);
    onDone(d);
  }
  return (
    <Modal title="Finalizar compra" onClose={onClose}>
      <div className="pay-summary">{evento.nombre}<br />{count} boleto(s) · Total <b>{money(total)}</b></div>
      <label>Nombre completo</label><input value={buyer.nombre} onChange={(e) => setBuyer({ ...buyer, nombre: e.target.value })} autoFocus />
      <label>Correo (recibis el QR aqui)</label><input type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} />
      {total > 0 && (
        <>
          <label>Nombre en la tarjeta</label><input value={pago.name} onChange={(e) => setPago({ ...pago, name: e.target.value })} />
          <label>Numero de tarjeta</label><input inputMode="numeric" value={pago.cardNumber} onChange={(e) => setPago({ ...pago, cardNumber: e.target.value })} />
          <div className="two"><div><label>Expira</label><input placeholder="MM/AA" value={pago.exp} onChange={(e) => setPago({ ...pago, exp: e.target.value.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2') })} /></div><div><label>CVV</label><input inputMode="numeric" value={pago.cvv} onChange={(e) => setPago({ ...pago, cvv: e.target.value })} /></div></div>
        </>
      )}
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit} disabled={loading}>{loading ? 'Procesando...' : `Pagar ${money(total)}`}</button>
    </Modal>
  );
}

function TicketsModal({ result, onClose }) {
  return (
    <Modal title="Compra exitosa" onClose={onClose}>
      <p className="muted">{result.emailSent ? `Enviamos tus boletos a ${result.correo}.` : 'Compra registrada. No se pudo enviar el correo ahora, guarda estos codigos.'}</p>
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
  const refresh = async () => { const d = await api('/admin/api/entradas/eventos'); if (d.ok) setEventos(d.eventos); };
  useEffect(() => { refresh(); }, []);
  async function setEstado(ev, estado) {
    setMsg(null);
    const d = await api(`/admin/api/entradas/eventos/${ev.evento.id}/estado`, { method: 'POST', body: JSON.stringify({ estado }) });
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    setMsg({ type: 'ok', text: `${ev.evento.nombre}: ${estado}.` }); refresh();
  }
  return (
    <>
      <div className="actions left"><button className="btn" onClick={() => setModal({ type: 'evento' })}><Plus size={16} />Nuevo evento</button></div>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <div className="table"><table><thead><tr><th>Evento</th><th>Fecha</th><th>Estado</th><th>Vendidos</th><th>Ingresos</th><th></th></tr></thead><tbody>
        {eventos.map((ev) => (
          <tr key={ev.evento.id}>
            <td>{ev.evento.nombre}</td>
            <td>{fmtFullDate(ev.evento.fecha)}</td>
            <td><span className="pill">{ev.evento.estado}</span></td>
            <td>{ev.boletosVendidos}</td>
            <td>{money(ev.ingresosCrc)}</td>
            <td className="row-actions">
              <button className="btn ghost" onClick={() => setModal({ type: 'tipos', evento: ev.evento })}>Sectores</button>
              {ev.evento.estado === 'publicado'
                ? <button className="btn ghost" onClick={() => setEstado(ev, 'finalizado')}>Cerrar</button>
                : <button className="btn ghost" onClick={() => setEstado(ev, 'publicado')}>Publicar</button>}
              <button className="btn ghost" onClick={() => setModal({ type: 'cortesia', evento: ev.evento, tipos: ev.tipos })}>Cortesia</button>
            </td>
          </tr>
        ))}
      </tbody></table></div>
      {modal?.type === 'evento' && <EventFormModal onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'tipos' && <TiposModal evento={modal.evento} onClose={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'cortesia' && <CortesiaModal evento={modal.evento} tipos={modal.tipos} onClose={() => setModal(null)} />}
    </>
  );
}

function EventFormModal({ onClose, onDone }) {
  const [form, setForm] = useState({ nombre: '', venue: 'Estadio Eladio Rosabal Cordero', fecha: '', descripcion: '' });
  const [error, setError] = useState('');
  async function submit() {
    setError('');
    const d = await api('/admin/api/entradas/eventos', { method: 'POST', body: JSON.stringify(form) });
    if (!d.ok) return setError(d.error);
    onDone();
  }
  return (
    <Modal title="Nuevo evento" onClose={onClose}>
      <label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus placeholder="Herediano vs ..." />
      <label>Lugar</label><input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
      <label>Fecha y hora</label><input type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
      <label>Descripcion</label><input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit}>Crear evento</button>
    </Modal>
  );
}

function TiposModal({ evento, onClose }) {
  const [tipos, setTipos] = useState([]);
  const [form, setForm] = useState({ nombre: '', precioCrc: '', stockTotal: '' });
  const [error, setError] = useState('');
  const refresh = async () => { const d = await api(`/admin/api/entradas/eventos/${evento.id}`); if (d.ok) setTipos(d.tipos); };
  useEffect(() => { refresh(); }, []);
  async function add() {
    setError('');
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/tipos`, { method: 'POST', body: JSON.stringify({ nombre: form.nombre, precioCrc: Number(form.precioCrc), stockTotal: Number(form.stockTotal) }) });
    if (!d.ok) return setError(d.error);
    setForm({ nombre: '', precioCrc: '', stockTotal: '' }); refresh();
  }
  async function toggle(t) {
    const d = await api(`/admin/api/entradas/tipos/${t.id}`, { method: 'PUT', body: JSON.stringify({ nombre: t.nombre, precioCrc: t.precioCrc, stockTotal: t.stockTotal, estado: t.estado === 'activo' ? 'inactivo' : 'activo' }) });
    if (d.ok) refresh(); else setError(d.error);
  }
  return (
    <Modal title={`Sectores · ${evento.nombre}`} onClose={onClose}>
      <div className="tipos-list">
        {tipos.map((t) => (
          <div key={t.id} className="tipo-row">
            <div><b>{t.nombre}</b><span>{money(t.precioCrc)} · {t.stockVendido}/{t.stockTotal} · {t.estado}</span></div>
            <button className="btn ghost" onClick={() => toggle(t)}>{t.estado === 'activo' ? 'Desactivar' : 'Activar'}</button>
          </div>
        ))}
      </div>
      <label>Nuevo sector</label>
      <input placeholder="Nombre (ej. Sol Sur)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      <div className="two">
        <div><label>Precio CRC</label><input inputMode="numeric" value={form.precioCrc} onChange={(e) => setForm({ ...form, precioCrc: e.target.value.replace(/\D/g, '') })} /></div>
        <div><label>Cupo</label><input inputMode="numeric" value={form.stockTotal} onChange={(e) => setForm({ ...form, stockTotal: e.target.value.replace(/\D/g, '') })} /></div>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={add}><Plus size={16} />Agregar sector</button>
    </Modal>
  );
}

function CortesiaModal({ evento, tipos, onClose }) {
  const [form, setForm] = useState({ tipoId: tipos?.[0]?.id || '', nombre: '', email: '' });
  const [msg, setMsg] = useState(null);
  async function submit() {
    setMsg(null);
    const d = await api('/admin/api/entradas/cortesia', { method: 'POST', body: JSON.stringify({ eventoId: evento.id, ...form }) });
    if (!d.ok) return setMsg({ type: 'error', text: d.error });
    setMsg({ type: 'ok', text: `Cortesia ${d.boleto.codigo} emitida${d.emailSent ? ' y enviada' : ''}.` });
  }
  return (
    <Modal title="Emitir cortesia" onClose={onClose}>
      <p className="muted">{evento.nombre}</p>
      <label>Sector</label>
      <select value={form.tipoId} onChange={(e) => setForm({ ...form, tipoId: e.target.value })}>{(tipos || []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
      <label>Nombre del invitado</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      <label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <button className="btn" onClick={submit}>Emitir cortesia gratis</button>
    </Modal>
  );
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
        {eventos.map((e) => <tr key={e.evento.id}><td>{e.evento.nombre}</td><td><span className="pill">{e.evento.estado}</span></td><td>{e.boletosVendidos}</td><td>{e.boletosUsados}</td><td>{money(e.ingresosCrc)}</td></tr>)}
      </tbody></table></div>
    </>
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

export { PublicParking, PublicCoupons, PublicEntradas, AdminApp, ThemeToggle, applyTheme, THEME_KEY };
