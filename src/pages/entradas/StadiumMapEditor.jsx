import { useEffect, useState } from 'react';
import { api } from '../../utils/api.js';
import { StadiumSvgERC } from './StadiumSvgERC.jsx';
import {
  ERC_LAYOUT,
  ERC_SECTORES,
  ERC_ZONE_KEYS,
  ERC_ZONE_META,
  isErcVectorLayout,
  mapaFromZoneKey,
  nombreToZoneKey,
} from './stadiumErc.js';

function tiposByZoneKey(tipos) {
  const map = {};
  for (const t of tipos) {
    const key = t.mapa?.points?.key ?? nombreToZoneKey(t.nombre);
    if (key) map[key] = t;
  }
  return map;
}

/**
 * Editor admin alineado al SVG vectorial ERC.
 * Vincula sectores ↔ zonas del mapa, ajusta color y activa/desactiva geometría.
 */
export function StadiumMapEditor({ evento, tipos: tiposInit, onClose, onSaved }) {
  const [tipos, setTipos] = useState(tiposInit ?? []);
  const [zonas, setZonas] = useState({});
  const [selectedKey, setSelectedKey] = useState(ERC_ZONE_KEYS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [useVector, setUseVector] = useState(isErcVectorLayout(evento));

  useEffect(() => {
    const load = async () => {
      const d = await api(`/admin/api/entradas/eventos/${evento.id}/mapa`);
      if (d.ok) {
        setTipos(d.tipos);
        setUseVector(isErcVectorLayout(d.evento));
        const m = {};
        for (const t of d.tipos) {
          if (t.mapa) {
            const key = t.mapa.points?.key ?? nombreToZoneKey(t.nombre);
            if (key) m[key] = { ...t.mapa, tipoId: t.id };
          }
        }
        setZonas(m);
      }
    };
    load();
  }, [evento.id]);

  const tiposMap = tiposByZoneKey(tipos);
  const selectedTipo = tiposMap[selectedKey];

  function toggleZoneLink() {
    if (!selectedTipo) return;
    setZonas((prev) => {
      const next = { ...prev };
      if (next[selectedKey]) {
        delete next[selectedKey];
      } else {
        next[selectedKey] = {
          ...mapaFromZoneKey(selectedKey),
          tipoId: selectedTipo.id,
        };
      }
      return next;
    });
  }

  function setZoneColor(key, color) {
    setZonas((prev) => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: { ...prev[key], color } };
    });
  }

  async function enableVectorLayout() {
    setSaving(true);
    setError('');
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/mapa`, {
      method: 'PUT',
      body: JSON.stringify({ mapImageUrl: ERC_LAYOUT }),
    });
    setSaving(false);
    if (!d.ok) return setError(d.error ?? 'Error');
    setUseVector(true);
    // Auto-vincular sectores por nombre
    const linked = {};
    for (const t of tipos) {
      const key = nombreToZoneKey(t.nombre);
      if (key) linked[key] = { ...mapaFromZoneKey(key), tipoId: t.id };
    }
    setZonas(linked);
  }

  async function save() {
    setSaving(true);
    setError('');
    const batch = tipos.map((t) => {
      const key = Object.keys(zonas).find((k) => zonas[k]?.tipoId === t.id);
      if (!key || !zonas[key]) return { tipoId: t.id, mapa: null };
      const { tipoId: _tid, ...mapa } = zonas[key];
      return { tipoId: t.id, mapa };
    });
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/mapa/batch`, {
      method: 'POST',
      body: JSON.stringify({ tipos: batch }),
    });
    setSaving(false);
    if (!d.ok) return setError(d.error ?? 'Error al guardar');
    onSaved?.();
    onClose?.();
  }

  return (
    <div className="stadium-editor-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="stadium-editor stadium-editor--vector">
        <div className="stadium-editor-header">
          <h2>Mapa ERC — {evento.nombre}</h2>
          <button className="btn ghost" onClick={onClose}>Cerrar</button>
        </div>

        {!useVector ? (
          <div className="stadium-editor-promo">
            <p>Activa el mapa vectorial 2D del Estadio Eladio Rosabal Cordero con las 6 zonas confirmadas.</p>
            <button className="btn" onClick={enableVectorLayout} disabled={saving}>
              Activar mapa vectorial ERC
            </button>
          </div>
        ) : (
          <div className="stadium-editor-body">
            <div className="stadium-editor-toolbar">
              <p className="toolbar-hint">Selecciona una zona y vincula el sector correspondiente.</p>
              {ERC_ZONE_KEYS.map((key) => {
                const meta = ERC_ZONE_META[key];
                const linked = zonas[key];
                const tipo = tiposMap[key];
                return (
                  <div
                    key={key}
                    className={`toolbar-sector${selectedKey === key ? ' active' : ''}${linked ? ' linked' : ''}`}
                    onClick={() => setSelectedKey(key)}
                  >
                    <span className="sector-swatch" style={{ background: linked?.color ?? meta.color }} />
                    <span className="sector-name">{meta.label}</span>
                    <span className="sector-disp">
                      {tipo ? (linked ? tipo.nombre : 'sin vincular') : 'sin sector'}
                    </span>
                    {linked && (
                      <input
                        type="color"
                        value={linked.color ?? meta.color}
                        title="Color"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setZoneColor(key, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="stadium-editor-map">
              <StadiumSvgERC
                tiposByKey={tiposMap}
                hoveredKey={selectedKey}
                selectedKey={selectedKey}
                interactive={false}
                showLabels
              />
            </div>

            <div className="stadium-editor-side">
              <h3>{ERC_ZONE_META[selectedKey]?.label}</h3>
              {selectedTipo ? (
                <>
                  <p className="side-sector">Sector: <strong>{selectedTipo.nombre}</strong></p>
                  <p className="side-price">₡{selectedTipo.precioCrc.toLocaleString('es-CR')}</p>
                  <p className="side-avail">{selectedTipo.disponibles} disponibles</p>
                  <button className="btn ghost" onClick={toggleZoneLink}>
                    {zonas[selectedKey] ? 'Desvincular zona' : 'Vincular zona al sector'}
                  </button>
                </>
              ) : (
                <p className="side-hint">
                  Crea un sector llamado «{ERC_ZONE_META[selectedKey]?.label}» en Sectores para vincular esta zona.
                </p>
              )}
              <div className="side-sectors-ref">
                <p className="toolbar-hint">Sectores del evento:</p>
                <ul>
                  {ERC_SECTORES.map((s) => {
                    const t = tipos.find((x) => nombreToZoneKey(x.nombre) === s.key);
                    return (
                      <li key={s.key}>
                        {s.nombre}: {t ? '✓' : '—'}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}

        {error && <div className="error" style={{ margin: '0 1rem' }}>{error}</div>}
        <div className="stadium-editor-footer">
          {useVector && (
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar mapa'}
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
