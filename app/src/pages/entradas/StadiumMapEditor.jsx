import { useEffect, useState } from 'react';
import { api } from '../../utils/api.js';
import { StadiumSvgERC } from './StadiumSvgERC.jsx';
import {
  ERC_LAYOUT,
  ERC_ESPECTACULO_LAYOUT,
  ERC_SECTORES,
  ERC_ZONE_KEYS,
  ERC_ZONE_META,
  GRAMILLA_ZONE_META,
  isErcVectorLayout,
  mapaFromZoneKey,
  nombreToZoneKey,
} from './stadiumErc.js';
import { gramillaKeysForTemplate, buildFieldSplitLines } from './stadiumFieldGeometry.js';

function tiposByZoneKey(tipos) {
  const map = {};
  for (const t of tipos) {
    const key = t.mapa?.points?.key ?? nombreToZoneKey(t.nombre);
    if (key) map[key] = t;
  }
  return map;
}

const TEMPLATES = [
  { value: '2', label: '2 partes', desc: 'Izq / Der' },
  { value: '3', label: '3 partes', desc: 'A / B / C' },
  { value: '4', label: '4 cuadrantes', desc: '2×2' },
];

/**
 * Editor admin alineado al SVG vectorial ERC.
 * Soporta modo partido (tribunas ERC) y modo espectáculo (tribunas + gramilla).
 */
export function StadiumMapEditor({ evento, tipos: tiposInit, onClose, onSaved, embedded }) {
  const [tipos, setTipos] = useState(tiposInit ?? []);
  const [zonas, setZonas] = useState({});
  const [selectedKey, setSelectedKey] = useState(ERC_ZONE_KEYS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [useVector, setUseVector] = useState(isErcVectorLayout(evento));
  const [tab, setTab] = useState('tribunas'); // 'tribunas' | 'gramilla'

  // Gramilla state
  const esEspectaculo = evento?.formato === 'espectaculo';
  const [fieldTemplate, setFieldTemplate] = useState(evento?.fieldTemplate ?? '2');
  const [fieldSplits, setFieldSplits] = useState(evento?.fieldSplits ?? null);

  useEffect(() => {
    const load = async () => {
      const d = await api(`/admin/api/entradas/eventos/${evento.id}/mapa`);
      if (d.ok) {
        setTipos(d.tipos);
        setUseVector(isErcVectorLayout(d.evento));
        if (d.evento.fieldTemplate) setFieldTemplate(d.evento.fieldTemplate);
        if (d.evento.fieldSplits) setFieldSplits(d.evento.fieldSplits);
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
  const selectedMeta = ERC_ZONE_META[selectedKey] ?? GRAMILLA_ZONE_META[selectedKey];
  const selectedTipo = tiposMap[selectedKey];
  const gramillaKeys = gramillaKeysForTemplate(fieldTemplate);
  const splitLines = buildFieldSplitLines(fieldTemplate, fieldSplits);

  function toggleZoneLink(key) {
    const tipo = tiposMap[key];
    if (!tipo) return;
    setZonas((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        const mapa = mapaFromZoneKey(key);
        if (mapa) next[key] = { ...mapa, tipoId: tipo.id };
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
    const layoutUrl = esEspectaculo ? ERC_ESPECTACULO_LAYOUT : ERC_LAYOUT;
    const body = { mapImageUrl: layoutUrl };
    if (esEspectaculo) {
      body.fieldTemplate = fieldTemplate;
      body.fieldSplits = null;
    }
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/mapa`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!d.ok) return setError(d.error ?? 'Error');
    setUseVector(true);
    const linked = {};
    for (const t of tipos) {
      const key = t.mapa?.points?.key ?? nombreToZoneKey(t.nombre);
      if (key) linked[key] = { ...mapaFromZoneKey(key), tipoId: t.id };
    }
    setZonas(linked);
  }

  async function saveFieldConfig() {
    setSaving(true);
    setError('');
    const d = await api(`/admin/api/entradas/eventos/${evento.id}/mapa`, {
      method: 'PUT',
      body: JSON.stringify({ fieldTemplate, fieldSplits }),
    });
    setSaving(false);
    if (!d.ok) setError(d.error ?? 'Error al guardar');
  }

  async function save() {
    setSaving(true);
    setError('');
    // Si es espectáculo, guardar configuración de gramilla primero
    if (esEspectaculo) {
      const d = await api(`/admin/api/entradas/eventos/${evento.id}/mapa`, {
        method: 'PUT',
        body: JSON.stringify({ fieldTemplate, fieldSplits }),
      });
      if (!d.ok) { setSaving(false); return setError(d.error ?? 'Error al guardar config gramilla'); }
    }
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

  // Ajuste fino de splits con slider
  function onSplitChange(index, value) {
    const n = Number(value);
    const prev = fieldSplits ? [...fieldSplits] : (fieldTemplate === '2' ? [0.5] : fieldTemplate === '3' ? [0.333, 0.667] : [0.5, 0.5]);
    if (fieldTemplate === '3') {
      // Mantener orden: splits[0] < splits[1]
      const other = index === 0 ? (prev[1] ?? 0.667) : (prev[0] ?? 0.333);
      const clamped = index === 0 ? Math.min(n, other - 0.05) : Math.max(n, other + 0.05);
      const next = [...prev];
      next[index] = Math.max(0.05, Math.min(0.95, clamped));
      setFieldSplits(next);
    } else {
      const next = [...prev];
      next[index] = Math.max(0.05, Math.min(0.95, n));
      setFieldSplits(next);
    }
  }

  const currentSplits = fieldSplits ?? (fieldTemplate === '2' ? [0.5] : fieldTemplate === '3' ? [0.333, 0.667] : [0.5, 0.5]);

  const allKeys = esEspectaculo && tab === 'gramilla' ? gramillaKeys : ERC_ZONE_KEYS;
  const allMeta = (key) => ERC_ZONE_META[key] ?? GRAMILLA_ZONE_META[key];

  return (
    <div className={embedded ? 'stadium-editor-embed' : 'stadium-editor-overlay'} onClick={embedded ? undefined : (e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`stadium-editor stadium-editor--vector${embedded ? ' stadium-editor--embedded' : ''}`}>
        {!embedded && (
          <div className="stadium-editor-header">
            <h2>Mapa ERC — {evento.nombre}</h2>
            {esEspectaculo && <span className="badge badge--espectaculo">Espectáculo</span>}
            <button className="btn ghost" onClick={onClose}>Cerrar</button>
          </div>
        )}

        {!useVector ? (
          <div className="stadium-editor-promo">
            <p>
              Activa el mapa vectorial 2D de{' '}
              {evento.venue?.trim() ? evento.venue : 'este estadio'}
              {esEspectaculo ? ' con tribunas y zonas de gramilla.' : ' con las 6 zonas confirmadas.'}
            </p>
            <button className="btn" onClick={enableVectorLayout} disabled={saving}>
              Activar mapa vectorial ERC
            </button>
          </div>
        ) : (
          <div className="stadium-editor-body">
            {/* Tabs (solo espectáculo) */}
            {esEspectaculo && (
              <div className="editor-tabs">
                <button className={`editor-tab${tab === 'tribunas' ? ' active' : ''}`} onClick={() => { setTab('tribunas'); setSelectedKey(ERC_ZONE_KEYS[0]); }}>
                  Tribunas
                </button>
                <button className={`editor-tab${tab === 'gramilla' ? ' active' : ''}`} onClick={() => { setTab('gramilla'); setSelectedKey(gramillaKeys[0] ?? 'gramilla-1'); }}>
                  Gramilla
                </button>
              </div>
            )}

            <div className="stadium-editor-toolbar">
              {tab === 'gramilla' && esEspectaculo ? (
                <>
                  <p className="toolbar-hint">Elige plantilla y ajusta las líneas de división arrastrando los sliders.</p>
                  <label className="toolbar-label">Plantilla</label>
                  <div className="template-opts">
                    {TEMPLATES.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        className={`template-opt${fieldTemplate === value ? ' active' : ''}`}
                        onClick={() => { setFieldTemplate(value); setFieldSplits(null); }}
                      >
                        <span>{label}</span>
                        <span className="template-opt-desc">{desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Sliders de splits */}
                  <div className="splits-panel">
                    {fieldTemplate === '2' && (
                      <label className="split-row">
                        <span>División vertical ({Math.round(currentSplits[0] * 100)}%)</span>
                        <input type="range" min="0.1" max="0.9" step="0.01" value={currentSplits[0]} onChange={(e) => onSplitChange(0, e.target.value)} />
                      </label>
                    )}
                    {fieldTemplate === '3' && (
                      <>
                        <label className="split-row">
                          <span>1.ª línea ({Math.round(currentSplits[0] * 100)}%)</span>
                          <input type="range" min="0.05" max="0.88" step="0.01" value={currentSplits[0]} onChange={(e) => onSplitChange(0, e.target.value)} />
                        </label>
                        <label className="split-row">
                          <span>2.ª línea ({Math.round(currentSplits[1] * 100)}%)</span>
                          <input type="range" min="0.12" max="0.95" step="0.01" value={currentSplits[1]} onChange={(e) => onSplitChange(1, e.target.value)} />
                        </label>
                      </>
                    )}
                    {fieldTemplate === '4' && (
                      <>
                        <label className="split-row">
                          <span>División vertical ({Math.round(currentSplits[0] * 100)}%)</span>
                          <input type="range" min="0.1" max="0.9" step="0.01" value={currentSplits[0]} onChange={(e) => onSplitChange(0, e.target.value)} />
                        </label>
                        <label className="split-row">
                          <span>División horizontal ({Math.round(currentSplits[1] * 100)}%)</span>
                          <input type="range" min="0.1" max="0.9" step="0.01" value={currentSplits[1]} onChange={(e) => onSplitChange(1, e.target.value)} />
                        </label>
                      </>
                    )}
                    <button className="btn ghost" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }} onClick={saveFieldConfig} disabled={saving}>
                      Aplicar configuración
                    </button>
                  </div>

                  <p className="toolbar-hint" style={{ marginTop: '1rem' }}>Vincula cada zona al sector correspondiente.</p>
                  {gramillaKeys.map((key) => {
                    const meta = GRAMILLA_ZONE_META[key];
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
                </>
              ) : (
                <>
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
                </>
              )}
            </div>

            <div className="stadium-editor-map">
              <StadiumSvgERC
                venue={evento?.venue}
                fieldTemplate={tab === 'gramilla' ? fieldTemplate : null}
                fieldSplits={tab === 'gramilla' ? currentSplits : null}
                tiposByKey={tiposMap}
                hoveredKey={selectedKey}
                selectedKey={selectedKey}
                interactive={false}
                showLabels
              />
              {/* Líneas de split sobre el SVG (decorativo en preview) */}
              {tab === 'gramilla' && splitLines.length > 0 && (
                <svg
                  viewBox="0 0 1000 720"
                  className="editor-split-overlay"
                  pointerEvents="none"
                  aria-hidden="true"
                >
                  {splitLines.map((l, i) => (
                    <line
                      key={i}
                      x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth="2"
                      strokeDasharray="8 4"
                    />
                  ))}
                </svg>
              )}
            </div>

            <div className="stadium-editor-side">
              <h3>{selectedMeta?.label ?? selectedKey}</h3>
              {selectedTipo ? (
                <>
                  <p className="side-sector">Sector: <strong>{selectedTipo.nombre}</strong></p>
                  <p className="side-price">₡{selectedTipo.precioCrc.toLocaleString('es-CR')}</p>
                  <p className="side-avail">{selectedTipo.disponibles} disponibles</p>
                  <button className="btn ghost" onClick={() => toggleZoneLink(selectedKey)}>
                    {zonas[selectedKey] ? 'Desvincular zona' : 'Vincular zona al sector'}
                  </button>
                </>
              ) : (
                <p className="side-hint">
                  Crea un sector llamado «{selectedMeta?.label ?? selectedKey}» en Sectores para vincular esta zona.
                </p>
              )}
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
