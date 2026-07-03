/**
 * StadiumSvgERC v2 — mapa vectorial detallado del Estadio Eladio Rosabal Cordero.
 * Soporta modo partido (6 tribunas) y modo espectáculo (tribunas + gramilla).
 */
import { ERC_ZONE_KEYS, ERC_ZONE_META, GRAMILLA_ZONE_META } from './stadiumErc.js';
import {
  BOWL_INNER_RIM,
  BOWL_OUTER,
  ERC_ZONE_PATHS_V2,
  FIELD_PATH,
  TRACK_PATH,
  ZONE_SEAT_LINES,
} from './stadiumSvgGeometry.js';
import { buildFieldZonePaths, buildFieldZoneLabelPositions } from './stadiumFieldGeometry.js';

export const ERC_ZONE_PATHS = ERC_ZONE_PATHS_V2;

function zoneGradientId(key) {
  return `zone-grad-${key}`;
}

function FieldMarkings() {
  return (
    <g className="stadium-field-marks" pointerEvents="none">
      {/* Rayas de césped sutiles */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect
          key={`stripe-${i}`}
          x={172 + i * 82}
          y={198}
          width={41}
          height={324}
          fill={i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'}
        />
      ))}
      <line x1="500" y1="198" x2="500" y2="522" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" />
      <circle cx="500" cy="360" r="58" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
      <circle cx="500" cy="360" r="3" fill="rgba(255,255,255,0.7)" />
      <rect x="172" y="292" width="118" height="140" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <rect x="710" y="292" width="118" height="140" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <circle cx="286" cy="360" r="42" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <circle cx="714" cy="360" r="42" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <path d="M 172 248 L 172 268 A 42 42 0 0 0 214 310" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <path d="M 828 248 L 828 268 A 42 42 0 0 1 786 310" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <path d="M 172 472 L 172 452 A 42 42 0 0 1 214 410" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <path d="M 828 472 L 828 452 A 42 42 0 0 0 786 410" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
    </g>
  );
}

function SeatLines({ zoneKey, status }) {
  const ys = ZONE_SEAT_LINES[zoneKey];
  if (!ys || status === 'inactive') return null;
  const paths = ERC_ZONE_PATHS_V2[zoneKey];
  if (!paths?.[0]) return null;
  if (zoneKey === 'sol-norte' || zoneKey === 'sol-sur') {
    return (
      <g pointerEvents="none" opacity={0.12}>
        {ys.map((y) => (
          <line key={y} x1="200" y1={y} x2="800" y2={y} stroke="#fff" strokeWidth="1" />
        ))}
      </g>
    );
  }
  if (zoneKey === 'lateral-este') {
    return (
      <g pointerEvents="none" opacity={0.12}>
        {ys.map((y) => (
          <line key={y} x1="830" y1={y} x2="910" y2={y} stroke="#fff" strokeWidth="1" />
        ))}
      </g>
    );
  }
  return null;
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
}) {
  if (!fieldTemplate) return null;

  const paths = buildFieldZonePaths(fieldTemplate, fieldSplits);
  const labelPos = buildFieldZoneLabelPositions(fieldTemplate, fieldSplits);

  return Object.entries(paths).map(([key, pathArr]) => {
    const status = zoneStatus(key);
    if (status === 'inactive') return null;
    const t = tiposByKey?.[key];
    const canInteract = interactive && t;
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
        aria-label={canInteract ? `${meta?.label ?? key} · ₡${(t.precioVigente ?? t.precioCrc).toLocaleString('es-CR')} · ${t.disponibles} disponibles` : undefined}
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
            {showFull ? (meta?.label ?? key) : (meta?.short ?? key)}
          </text>
        )}
      </g>
    );
  });
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
}) {
  function zoneStatus(key) {
    const t = tiposByKey?.[key];
    if (!t || t.estado === 'inactivo') return 'inactive';
    if (t.disponibles <= 0) return 'agotado';
    if (selectedKey === key) return 'selected';
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
      viewBox="0 0 1000 720"
      className={`stadium-svg-erc stadium-svg-erc--v2 ${className}`}
      role="img"
      aria-label={ariaLabel}
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
        if (status === 'inactive') return null;
        const t = tiposByKey?.[key];
        const canInteract = interactive && t;
        const handlers = canInteract
          ? {
              onClick: (e) => { e.stopPropagation(); onZoneClick?.(key, t); },
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
            tabIndex={canInteract ? 0 : -1}
            role={canInteract ? 'button' : undefined}
            aria-label={canInteract ? `${ERC_ZONE_META[key]?.label ?? key} · ₡${(t.precioVigente ?? t.precioCrc).toLocaleString('es-CR')} · ${t.disponibles} disponibles` : undefined}
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
            <SeatLines zoneKey={key} status={status} />
          </g>
        );
      })}

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
          onZoneClick={onZoneClick}
          onZoneHover={onZoneHover}
          interactive={interactive}
          showLabels={showLabels}
          zoneStatus={zoneStatus}
          zoneOpacity={zoneOpacity}
          zoneStroke={zoneStroke}
          zoneFilter={zoneFilter}
          zoneFillProps={zoneFillProps}
        />
      )}

      {/* Labels tribunas */}
      {showLabels && Object.entries(ERC_ZONE_META).map(([key, meta]) => {
        const status = zoneStatus(key);
        if (status === 'inactive') return null;
        const showFull = hoveredKey === key || selectedKey === key;
        return (
          <text
            key={`lbl-${key}`}
            x={meta.labelX}
            y={meta.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`stadium-zone-label${showFull ? ' stadium-zone-label--full' : ''}`}
            pointerEvents="none"
          >
            {showFull ? meta.label : meta.short}
          </text>
        );
      })}

      <NorthMarker />
      <VenueTitle venue={venue} />
    </svg>
  );
}
