/**
 * StadiumSvgERC — mapa vectorial 2D del Estadio Eladio Rosabal Cordero.
 * viewBox 1000×720, tribunas curvas alrededor del campo.
 */
import { ERC_ZONE_META } from './stadiumErc.js';

/** Paths por zona (puede haber varios paths para una misma zona, ej. Palco). */
export const ERC_ZONE_PATHS = {
  'sol-norte': [
    'M 130 48 Q 500 28 870 48 L 855 155 Q 500 135 145 155 Z',
  ],
  'sol-sur': [
    'M 145 525 Q 500 545 855 525 L 870 672 Q 500 692 130 672 Z',
  ],
  'lateral-este': [
    'M 855 155 L 952 175 L 952 545 L 855 525 Z',
  ],
  'lateral-oeste': [
    'M 145 155 L 48 175 L 48 320 L 145 300 Z',
  ],
  'socio': [
    'M 48 400 L 145 420 L 145 525 L 48 545 Z',
  ],
  'palco': [
    'M 145 300 L 48 320 L 48 400 L 145 420 Z',
    'M 855 300 L 952 320 L 952 400 L 855 420 Z',
  ],
};

const FIELD_PATH = 'M 200 195 L 800 195 Q 820 195 820 215 L 820 505 Q 820 525 800 525 L 200 525 Q 180 525 180 505 L 180 215 Q 180 195 200 195 Z';
const TRACK_PATH = 'M 165 175 L 835 175 Q 870 175 870 210 L 870 510 Q 870 545 835 545 L 165 545 Q 130 545 130 510 L 130 210 Q 130 175 165 175 Z';
const BOWL_PATH = 'M 100 55 Q 500 15 900 55 L 930 180 L 930 540 Q 900 705 500 705 Q 100 705 70 540 L 70 180 Z';

export function StadiumSvgERC({
  tiposByKey,
  hoveredKey,
  selectedKey,
  onZoneClick,
  onZoneHover,
  interactive = true,
  showLabels = true,
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

  function zoneFill(key, status) {
    const meta = ERC_ZONE_META[key];
    const base = meta?.color ?? '#c9a961';
    if (status === 'inactive') return '#2a2a2a';
    if (status === 'agotado') return '#4a4a4a';
    return base;
  }

  function zoneOpacity(status) {
    if (status === 'inactive') return 0.15;
    if (status === 'agotado') return 0.35;
    if (status === 'selected') return 0.92;
    if (status === 'hover') return 0.78;
    return 0.55;
  }

  function zoneStroke(status) {
    if (status === 'selected') return '#fff';
    if (status === 'hover') return '#f0d078';
    return 'rgba(255,255,255,0.25)';
  }

  return (
    <svg
      viewBox="0 0 1000 720"
      className={`stadium-svg-erc ${className}`}
      role="img"
      aria-label="Mapa del Estadio Eladio Rosabal Cordero"
    >
      <defs>
        <linearGradient id="erc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#141414" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
        <linearGradient id="erc-field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d9b52" />
          <stop offset="100%" stopColor="#2d7a3e" />
        </linearGradient>
        <filter id="erc-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Fondo */}
      <rect width="1000" height="720" fill="url(#erc-bg)" rx="12" />

      {/* Silueta del bowl (no interactiva) */}
      <path d={BOWL_PATH} fill="#1e1e1e" stroke="#333" strokeWidth="2" />

      {/* Pista (debajo de las zonas — antes tapaba las tribunas) */}
      <path d={TRACK_PATH} fill="#2a2a2a" fillOpacity="0.45" pointerEvents="none" />
      <path d={TRACK_PATH} fill="none" stroke="#555" strokeWidth="4" pointerEvents="none" />

      {/* Zonas interactivas encima de la pista */}
      {Object.entries(ERC_ZONE_PATHS).map(([key, paths]) => {
        const status = zoneStatus(key);
        if (status === 'inactive') return null;
        const t = tiposByKey?.[key];
        const canInteract = interactive && t;
        const groupHandlers = canInteract
          ? {
              onClick: (e) => { e.stopPropagation(); onZoneClick?.(key, t); },
              onMouseEnter: () => onZoneHover?.(key),
              onMouseLeave: () => onZoneHover?.(null),
              onFocus: () => onZoneHover?.(key),
              onBlur: () => onZoneHover?.(null),
            }
          : {};

        return (
          <g
            key={key}
            className={`stadium-zone-group stadium-zone--${status}`}
            style={{ cursor: canInteract ? 'pointer' : 'default' }}
            tabIndex={canInteract ? 0 : -1}
            role={canInteract ? 'button' : undefined}
            aria-label={canInteract ? `${ERC_ZONE_META[key]?.label ?? key} · ₡${t.precioCrc.toLocaleString('es-CR')} · ${t.disponibles} disponibles` : undefined}
            {...groupHandlers}
          >
            {paths.map((d, i) => (
              <path
                key={`${key}-${i}`}
                d={d}
                fill={zoneFill(key, status)}
                fillOpacity={zoneOpacity(status)}
                stroke={zoneStroke(status)}
                strokeWidth={status === 'selected' ? 3 : 1.5}
                className="stadium-zone"
                style={{ transition: 'fill-opacity 0.15s, stroke 0.15s' }}
                filter={status === 'selected' ? 'url(#erc-glow)' : undefined}
                pointerEvents="all"
              />
            ))}
          </g>
        );
      })}

      {/* Campo (centro; no tapa tribunas) */}
      <path d={FIELD_PATH} fill="url(#erc-field)" pointerEvents="none" />
      <line x1="500" y1="195" x2="500" y2="525" stroke="rgba(255,255,255,0.55)" strokeWidth="2" pointerEvents="none" />
      <circle cx="500" cy="360" r="55" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" pointerEvents="none" />
      <rect x="180" y="290" width="90" height="140" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" pointerEvents="none" />
      <rect x="730" y="290" width="90" height="140" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" pointerEvents="none" />

      {/* Labels en zonas */}
      {showLabels && Object.entries(ERC_ZONE_META).map(([key, meta]) => {
        const t = tiposByKey?.[key];
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
            className="stadium-zone-label"
            pointerEvents="none"
          >
            {showFull ? meta.label : meta.short}
          </text>
        );
      })}

      {/* Marca del estadio */}
      <text x="500" y="38" textAnchor="middle" className="stadium-erc-title" pointerEvents="none">
        Estadio Eladio Rosabal Cordero
      </text>
    </svg>
  );
}
