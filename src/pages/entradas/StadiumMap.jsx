import { useMemo, useState } from 'react';
import { StadiumSvgERC } from './StadiumSvgERC.jsx';
import { SeatPickerPanel } from './SeatPicker.jsx';
import {
  ERC_ZONE_KEYS,
  ERC_ZONE_META,
  GRAMILLA_ZONE_META,
  isErcVectorLayout,
  nombreToZoneKey,
  orientationForZone,
} from './stadiumErc.js';
import { gramillaKeysForTemplate } from './stadiumFieldGeometry.js';

// Precio a mostrar: tanda de preventa vigente si existe, si no el base.
function precioDe(tipo) {
  return tipo.precioVigente ?? tipo.precioCrc;
}

export function tiposByZoneKey(tipos) {
  const map = {};
  for (const t of tipos) {
    if (t.estado === 'inactivo') continue;
    let key = null;
    if (t.mapa?.shape === 'zone' && t.mapa.points?.key) {
      key = t.mapa.points.key;
    } else {
      key = nombreToZoneKey(t.nombre);
    }
    // Acepta tribunas ERC y zonas de gramilla
    const valid = ERC_ZONE_KEYS.includes(key) || /^gramilla-[1-4]$/.test(key);
    if (key && valid && !map[key]) map[key] = t;
  }
  return map;
}

function ZonePanel({ tipo, zoneKey, qty, onUpdate, onClose, compact }) {
  const max = Math.min(tipo.disponibles, 10);
  const meta = zoneKey ? (ERC_ZONE_META[zoneKey] ?? GRAMILLA_ZONE_META[zoneKey]) : null;
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
      <p className="stadium-panel-price">
        ₡{precioDe(tipo).toLocaleString('es-CR')}
        {tipo.tandaNombre && <span className="stadium-panel-tanda" style={{ display: 'block', fontSize: '.72rem', opacity: 0.8 }}>{tipo.tandaNombre}</span>}
      </p>
      <p className="stadium-panel-avail">
        {agotado ? 'Agotado' : `${tipo.disponibles.toLocaleString('es-CR')} disponibles`}
      </p>
      {!agotado && tipo.numerado && (
        <>
          <p className="stadium-panel-hint">Sector numerado: tocá las butacas en el mapa o en la grilla bajo él (arrastrá para elegir en bloque).</p>
          {qty > 0 && <p className="stadium-panel-avail">{qty} butaca{qty === 1 ? '' : 's'} seleccionada{qty === 1 ? '' : 's'}</p>}
        </>
      )}
      {!agotado && !tipo.numerado && (
        <div className="stepper">
          <button disabled={qty <= 0} onClick={() => onUpdate(tipo.id, -1)} aria-label="Quitar uno">−</button>
          <span>{qty}</span>
          <button disabled={qty >= max} onClick={() => onUpdate(tipo.id, +1)} aria-label="Agregar uno">+</button>
        </div>
      )}
      {qty > 0 && (
        <p className="stadium-panel-subtotal">
          Subtotal: ₡{(qty * precioDe(tipo)).toLocaleString('es-CR')}
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

function MapTooltip({ tipo, zoneKey, meta }) {
  const m = meta ?? ERC_ZONE_META[zoneKey] ?? GRAMILLA_ZONE_META[zoneKey];
  return (
    <div className="stadium-tooltip" role="status">
      <strong>{m?.label ?? tipo.nombre}</strong>
      {m?.tier && <span className="stadium-tooltip-tier">{m.tier}</span>}
      <span>₡{precioDe(tipo).toLocaleString('es-CR')}</span>
      <span>{tipo.disponibles > 0 ? `${tipo.disponibles} disponibles` : 'Agotado'}</span>
    </div>
  );
}

function MapLegendChips({ tiposByKey, selectedKey, hoveredKey, onSelect, gramillaKeys = [] }) {
  const allKeys = [...ERC_ZONE_KEYS, ...gramillaKeys];
  return (
    <div className="stadium-legend-chips" aria-label="Sectores y precios">
      {allKeys.map((key) => {
        const t = tiposByKey[key];
        if (!t || t.estado === 'inactivo') return null;
        const meta = ERC_ZONE_META[key] ?? GRAMILLA_ZONE_META[key];
        if (!meta) return null;
        const agotado = t.disponibles <= 0;
        const active = selectedKey === key;
        const hover = hoveredKey === key;
        const isGram = key.startsWith('gramilla-');
        return (
          <button
            key={key}
            type="button"
            className={`stadium-chip${active ? ' active' : ''}${hover ? ' hover' : ''}${agotado ? ' agotado' : ''}${isGram ? ' stadium-chip--gramilla' : ''}`}
            disabled={agotado}
            onClick={() => onSelect(key, t)}
            aria-pressed={active}
          >
            <span className="stadium-chip-swatch" style={{ background: agotado ? '#555' : meta.color }} />
            <span className="stadium-chip-name">{meta.short}</span>
            <span className="stadium-chip-price">₡{precioDe(t).toLocaleString('es-CR')}</span>
            <span className="stadium-chip-tier">{meta.tier}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Mapa vectorial ERC (2D desde arriba). Soporta partidos y espectáculos. */
function ErcVectorMap({ evento, tipos, qty, onUpdate, asientos = [], seats = {}, onSeatClick = null, onSeatBoxSelect = null }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const [panelTipo, setPanelTipo] = useState(null);
  const tiposMap = useMemo(() => tiposByZoneKey(tipos), [tipos]);
  const selectedKey = panelTipo
    ? (panelTipo.mapa?.points?.key ?? nombreToZoneKey(panelTipo.nombre))
    : null;

  // Butacas numeradas agrupadas por zona (mismo croquis que usa el admin).
  const seatsByZoneKey = useMemo(() => {
    const map = {};
    for (const [key, t] of Object.entries(tiposMap)) {
      if (!t.numerado) continue;
      const list = asientos.filter((a) => a.tipoId === t.id);
      if (list.length) map[key] = list;
    }
    return map;
  }, [tiposMap, asientos]);
  const selectedSeatIds = useMemo(() => new Set(Object.values(seats).flat()), [seats]);
  // Zonas cuyas butacas están seleccionadas: se resaltan en el mapa junto con
  // el panel abierto, para que la tribuna de la butaca quede marcada también.
  const selectedSeatZoneKeys = useMemo(() => {
    const keys = new Set();
    for (const [key, list] of Object.entries(seatsByZoneKey)) {
      if (list.some((a) => selectedSeatIds.has(a.id))) keys.add(key);
    }
    return keys;
  }, [seatsByZoneKey, selectedSeatIds]);

  const fieldTemplate = evento?.fieldTemplate ?? null;
  const fieldSplits = evento?.fieldSplits ?? null;
  const gramillaKeys = fieldTemplate ? gramillaKeysForTemplate(fieldTemplate) : [];

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
  const hoveredMeta = hoveredKey
    ? (ERC_ZONE_META[hoveredKey] ?? GRAMILLA_ZONE_META[hoveredKey])
    : null;

  return (
    <div className="stadium-map-wrap stadium-map-wrap--vector">
      <div className="stadium-map-stage">
        <div className="stadium-map-plano stadium-map-plano--vector">
          <StadiumSvgERC
            venue={evento?.venue}
            fieldTemplate={fieldTemplate}
            fieldSplits={fieldSplits}
            tiposByKey={tiposMap}
            hoveredKey={hoveredKey}
            selectedKey={selectedKey}
            onZoneClick={handleZoneClick}
            onZoneHover={setHoveredKey}
            showZoneDetails
            seatsByZoneKey={seatsByZoneKey}
            selectedSeatIds={selectedSeatIds}
            selectedSeatZoneKeys={selectedSeatZoneKeys}
            onSeatClick={onSeatClick}
            onSeatBoxSelect={onSeatBoxSelect}
          />
          {hoveredTipo && !panelTipo && (
            <MapTooltip tipo={hoveredTipo} zoneKey={hoveredKey} meta={hoveredMeta} />
          )}
        </div>
        {selectedKey && seatsByZoneKey[selectedKey]?.length > 0 && (
          <div className="zone-seat-expand">
            <SeatPickerPanel
              tipo={tiposMap[selectedKey]}
              asientos={seatsByZoneKey[selectedKey]}
              selectedIds={selectedSeatIds}
              onSeatToggle={onSeatClick}
              onBoxSelect={onSeatBoxSelect}
              orientation={orientationForZone(selectedKey)}
              accentColor={(ERC_ZONE_META[selectedKey] ?? GRAMILLA_ZONE_META[selectedKey])?.color}
            />
          </div>
        )}
        <MapLegendChips
          tiposByKey={tiposMap}
          selectedKey={selectedKey}
          hoveredKey={hoveredKey}
          onSelect={handleChipSelect}
          gramillaKeys={gramillaKeys}
        />
      </div>
      <aside className="stadium-map-sidebar">
        {panelTipo
          ? (
            <ZonePanel
              tipo={panelTipo}
              zoneKey={selectedKey}
              qty={panelTipo.numerado ? (seats[panelTipo.id]?.length ?? 0) : (qty[panelTipo.id] ?? 0)}
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
 * El croquis vectorial aplica cuando el evento lo declara (vector:erc-v1) o
 * cuando sus sectores ya están mapeados a zonas ERC (eventos viejos con foto).
 */
export function usesVectorMap(evento, tipos = []) {
  return isErcVectorLayout(evento) || tipos.some((t) => t.estado !== 'inactivo' && t.mapa?.shape === 'zone');
}

/**
 * StadiumMap — mapa interactivo de zonas GA.
 * Usa SVG vectorial ERC cuando el evento tiene layout vector:erc-v1.
 */
export function StadiumMap({ evento, tipos, qty, onUpdate, asientos, seats, onSeatClick, onSeatBoxSelect }) {
  if (usesVectorMap(evento, tipos)) {
    return (
      <ErcVectorMap
        evento={evento}
        tipos={tipos}
        qty={qty}
        onUpdate={onUpdate}
        asientos={asientos}
        seats={seats}
        onSeatClick={onSeatClick}
        onSeatBoxSelect={onSeatBoxSelect}
      />
    );
  }
  return <PhotoOverlayMap evento={evento} tipos={tipos} qty={qty} onUpdate={onUpdate} />;
}
