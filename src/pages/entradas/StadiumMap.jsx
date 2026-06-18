import { useMemo, useState } from 'react';
import { StadiumSvgERC } from './StadiumSvgERC.jsx';
import {
  ERC_ZONE_KEYS,
  ERC_ZONE_META,
  isErcVectorLayout,
  nombreToZoneKey,
} from './stadiumErc.js';

function tiposByZoneKey(tipos) {
  const map = {};
  for (const t of tipos) {
    if (t.estado === 'inactivo') continue;
    let key = null;
    if (t.mapa?.shape === 'zone' && t.mapa.points?.key) {
      key = t.mapa.points.key;
    } else {
      key = nombreToZoneKey(t.nombre);
    }
    if (key && ERC_ZONE_KEYS.includes(key) && !map[key]) map[key] = t;
  }
  return map;
}

function ZonePanel({ tipo, zoneKey, qty, onUpdate, onClose, compact }) {
  const max = Math.min(tipo.disponibles, 10);
  const meta = zoneKey ? ERC_ZONE_META[zoneKey] : null;
  const agotado = tipo.disponibles <= 0;

  return (
    <div className={`stadium-panel${compact ? ' stadium-panel--sidebar' : ''}`}>
      {onClose && (
        <button className="stadium-panel-close" onClick={onClose} aria-label="Cerrar panel">✕</button>
      )}
      {meta?.tier && (
        <span className="stadium-panel-tier" style={{ borderColor: meta.color, color: meta.color }}>
          {meta.tier}
        </span>
      )}
      <h3 className="stadium-panel-name">{tipo.nombre}</h3>
      <p className="stadium-panel-price">₡{tipo.precioCrc.toLocaleString('es-CR')}</p>
      <p className="stadium-panel-avail">
        {agotado ? 'Agotado' : `${tipo.disponibles.toLocaleString('es-CR')} disponibles`}
      </p>
      {!agotado && (
        <div className="stepper">
          <button disabled={qty <= 0} onClick={() => onUpdate(tipo.id, -1)} aria-label="Quitar uno">−</button>
          <span>{qty}</span>
          <button disabled={qty >= max} onClick={() => onUpdate(tipo.id, +1)} aria-label="Agregar uno">+</button>
        </div>
      )}
      {qty > 0 && (
        <p className="stadium-panel-subtotal">
          Subtotal: ₡{(qty * tipo.precioCrc).toLocaleString('es-CR')}
        </p>
      )}
    </div>
  );
}

function PanelEmpty() {
  return (
    <div className="stadium-panel stadium-panel--empty stadium-panel--sidebar">
      <div className="stadium-panel-empty-icon" aria-hidden="true">◎</div>
      <h3 className="stadium-panel-name">Selecciona tu tribuna</h3>
      <p className="stadium-panel-hint">
        Haz click en una zona del mapa o en un chip de la leyenda para ver precio y disponibilidad.
      </p>
    </div>
  );
}

function MapTooltip({ tipo, zoneKey }) {
  const meta = ERC_ZONE_META[zoneKey];
  return (
    <div className="stadium-tooltip" role="status">
      <strong>{meta?.label ?? tipo.nombre}</strong>
      {meta?.tier && <span className="stadium-tooltip-tier">{meta.tier}</span>}
      <span>₡{tipo.precioCrc.toLocaleString('es-CR')}</span>
      <span>{tipo.disponibles > 0 ? `${tipo.disponibles} disponibles` : 'Agotado'}</span>
    </div>
  );
}

function MapLegendChips({ tiposByKey, selectedKey, hoveredKey, onSelect }) {
  return (
    <div className="stadium-legend-chips" aria-label="Sectores y precios">
      {ERC_ZONE_KEYS.map((key) => {
        const t = tiposByKey[key];
        if (!t || t.estado === 'inactivo') return null;
        const meta = ERC_ZONE_META[key];
        const agotado = t.disponibles <= 0;
        const active = selectedKey === key;
        const hover = hoveredKey === key;
        return (
          <button
            key={key}
            type="button"
            className={`stadium-chip${active ? ' active' : ''}${hover ? ' hover' : ''}${agotado ? ' agotado' : ''}`}
            disabled={agotado}
            onClick={() => onSelect(key, t)}
            aria-pressed={active}
          >
            <span className="stadium-chip-swatch" style={{ background: agotado ? '#555' : meta.color }} />
            <span className="stadium-chip-name">{meta.short}</span>
            <span className="stadium-chip-price">₡{t.precioCrc.toLocaleString('es-CR')}</span>
            <span className="stadium-chip-tier">{meta.tier}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Mapa vectorial ERC (2D desde arriba). */
function ErcVectorMap({ tipos, qty, onUpdate }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const [panelTipo, setPanelTipo] = useState(null);
  const tiposMap = useMemo(() => tiposByZoneKey(tipos), [tipos]);
  const selectedKey = panelTipo
    ? (panelTipo.mapa?.points?.key ?? nombreToZoneKey(panelTipo.nombre))
    : null;

  function selectZone(key, t) {
    if (!t || t.disponibles <= 0) return;
    setPanelTipo((prev) => (prev?.id === t.id ? null : t));
  }

  function handleZoneClick(key, t) {
    selectZone(key, t);
  }

  function handleChipSelect(key, t) {
    selectZone(key, t);
  }

  const hoveredTipo = hoveredKey ? tiposMap[hoveredKey] : null;

  return (
    <div className="stadium-map-wrap stadium-map-wrap--vector">
      <div className="stadium-map-stage">
        <div className="stadium-map-plano stadium-map-plano--vector">
          <StadiumSvgERC
            tiposByKey={tiposMap}
            hoveredKey={hoveredKey}
            selectedKey={selectedKey}
            onZoneClick={handleZoneClick}
            onZoneHover={setHoveredKey}
          />
          {hoveredTipo && !panelTipo && (
            <MapTooltip tipo={hoveredTipo} zoneKey={hoveredKey} />
          )}
        </div>
        <MapLegendChips
          tiposByKey={tiposMap}
          selectedKey={selectedKey}
          hoveredKey={hoveredKey}
          onSelect={handleChipSelect}
        />
      </div>
      <aside className="stadium-map-sidebar">
        {panelTipo
          ? (
            <ZonePanel
              tipo={panelTipo}
              zoneKey={selectedKey}
              qty={qty[panelTipo.id] ?? 0}
              onUpdate={onUpdate}
              onClose={() => setPanelTipo(null)}
              compact
            />
          )
          : <PanelEmpty />}
      </aside>
    </div>
  );
}

/** Fallback: overlay sobre foto (eventos sin layout vectorial). */
function PhotoOverlayMap({ evento, tipos, qty, onUpdate }) {
  const [panelTipo, setPanelTipo] = useState(null);
  const tiposConMapa = tipos.filter((t) => t.mapa && t.estado === 'activo' && t.mapa.shape !== 'zone');

  function zoneStatus(t) {
    if (t.disponibles <= 0) return 'agotado';
    if (panelTipo?.id === t.id) return 'selected';
    return 'available';
  }

  function renderShape(t) {
    const z = t.mapa;
    const status = zoneStatus(t);
    const color = z.color ?? '#c9a961';
    const common = {
      fill: status === 'agotado' ? '#888' : color,
      fillOpacity: status === 'agotado' ? 0.25 : status === 'selected' ? 0.75 : 0.45,
      stroke: status === 'selected' ? '#c9a961' : 'rgba(255,255,255,0.6)',
      strokeWidth: status === 'selected' ? 0.006 : 0.003,
      style: { cursor: t.disponibles > 0 ? 'pointer' : 'not-allowed' },
      onClick: () => { if (t.disponibles > 0) setPanelTipo((p) => (p?.id === t.id ? null : t)); },
    };

    if (z.shape === 'rect') {
      const { x, y, w, h } = z.points;
      return (
        <g key={t.id}>
          <rect x={x} y={y} width={w} height={h} {...common} />
          <text x={z.labelX ?? x + w / 2} y={z.labelY ?? y + h / 2} textAnchor="middle" dominantBaseline="middle" fontSize="0.03" fill="#fff" fontWeight="700" style={{ pointerEvents: 'none' }}>
            {t.nombre}
          </text>
        </g>
      );
    }
    if (z.shape === 'polygon') {
      const pts = z.points.map((p) => `${p.x},${p.y}`).join(' ');
      return <polygon key={t.id} points={pts} {...common} />;
    }
    return null;
  }

  const imgSrc = `${evento.mapImageUrl ?? '/brand/estadio.jpg'}${evento.mapVersion ? `?v=${evento.mapVersion}` : ''}`;

  return (
    <div className="stadium-map-wrap">
      <div className="plano stadium-map-plano">
        <img src={imgSrc} alt="Plano del estadio" draggable={false} />
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="stadium-map-svg">
          {tiposConMapa.map(renderShape)}
        </svg>
      </div>
      {panelTipo && (
        <ZonePanel
          tipo={panelTipo}
          zoneKey={nombreToZoneKey(panelTipo.nombre)}
          qty={qty[panelTipo.id] ?? 0}
          onUpdate={onUpdate}
          onClose={() => setPanelTipo(null)}
        />
      )}
    </div>
  );
}

/**
 * StadiumMap — mapa interactivo de zonas GA.
 * Usa SVG vectorial ERC cuando el evento tiene layout vector:erc-v1.
 */
export function StadiumMap({ evento, tipos, qty, onUpdate }) {
  if (isErcVectorLayout(evento)) {
    return <ErcVectorMap tipos={tipos} qty={qty} onUpdate={onUpdate} />;
  }
  return <PhotoOverlayMap evento={evento} tipos={tipos} qty={qty} onUpdate={onUpdate} />;
}
