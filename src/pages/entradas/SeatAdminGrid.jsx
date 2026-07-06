import { useEffect, useState } from 'react';
import { api } from '../../utils/api.js';

// Grilla admin de butacas de un sector: generar/regenerar la grilla y
// bloquear/desbloquear butacas con click. Compartida por el modal de sectores,
// el wizard de eventos y la pestaña Butacas del detalle.
export function SeatAdminGrid({ tipo, onChanged }) {
  const [asientos, setAsientos] = useState([]);
  const [form, setForm] = useState({ filas: '10', porFila: '20' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const load = async () => {
    const d = await api(`/admin/api/entradas/tipos/${tipo.id}/asientos`);
    if (d.ok) setAsientos(d.asientos);
  };
  useEffect(() => { load(); }, [tipo.id]);
  const stats = asientos.reduce((s, a) => ({ ...s, [a.estado]: (s[a.estado] || 0) + 1 }), {});
  async function generar() {
    const total = Number(form.filas) * Number(form.porFila);
    const warn = asientos.length > 0
      ? `Esto reemplaza las ${asientos.length} butacas actuales del sector (se rechaza si hay vendidas). ¿Continuar?`
      : `Se generarán ${total} butacas (${form.filas} filas × ${form.porFila}). El cupo del sector pasa a ${total}. ¿Continuar?`;
    if (!window.confirm(warn)) return;
    setError(''); setMsg(''); setLoading(true);
    const d = await api(`/admin/api/entradas/tipos/${tipo.id}/asientos/generar`, { method: 'POST', body: JSON.stringify({ filas: Number(form.filas), porFila: Number(form.porFila) }) });
    setLoading(false);
    if (!d.ok) return setError(d.error);
    setMsg(`${d.total} butacas generadas.`);
    load();
    onChanged?.();
  }
  async function toggleBloqueo(a) {
    if (a.estado !== 'disponible' && a.estado !== 'bloqueado') return;
    const estado = a.estado === 'bloqueado' ? 'disponible' : 'bloqueado';
    const d = await api(`/admin/api/entradas/asientos/${a.id}`, { method: 'PATCH', body: JSON.stringify({ estado }) });
    if (!d.ok) return setError(d.error);
    setAsientos((prev) => prev.map((x) => (x.id === a.id ? d.asiento : x)));
    onChanged?.();
  }
  const porFila = new Map();
  for (const a of asientos) {
    if (!porFila.has(a.fila)) porFila.set(a.fila, []);
    porFila.get(a.fila).push(a);
  }
  const seatColor = (a) => (
    a.estado === 'vendido' ? { bg: '#7a2020', fg: '#f3baba' }
      : a.estado === 'bloqueado' ? { bg: '#555', fg: '#ccc' }
        : a.estado === 'reservado' ? { bg: '#7a6420', fg: '#f0e0a0' }
          : { bg: '#1d2e1d', fg: '#9fd49f' }
  );
  return (
    <>
      <p className="muted" style={{ fontSize: '.85rem' }}>
        {asientos.length === 0
          ? 'Este sector aún no tiene butacas. Generá la grilla para venderlo por asiento numerado.'
          : `${asientos.length} butacas · ${stats.disponible || 0} disponibles · ${stats.vendido || 0} vendidas · ${stats.bloqueado || 0} bloqueadas. Click en una butaca para bloquear/desbloquear.`}
      </p>
      <div className="two">
        <div><label>Filas</label><input inputMode="numeric" value={form.filas} onChange={(e) => setForm({ ...form, filas: e.target.value.replace(/\D/g, '') })} /></div>
        <div><label>Asientos por fila</label><input inputMode="numeric" value={form.porFila} onChange={(e) => setForm({ ...form, porFila: e.target.value.replace(/\D/g, '') })} /></div>
      </div>
      <button className="btn" onClick={generar} disabled={loading || !Number(form.filas) || !Number(form.porFila)}>
        {loading ? 'Generando…' : asientos.length > 0 ? 'Regenerar butacas' : 'Generar butacas'}
      </button>
      {error && <div className="error">{error}</div>}
      {msg && <div className="okbox">{msg}</div>}
      {asientos.length > 0 && (
        <div style={{ marginTop: 12, overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
          {[...porFila.keys()].sort().map((fila) => (
            <div key={fila} style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 3 }}>
              <span className="muted" style={{ width: 26, fontSize: '.68rem', textAlign: 'center', flexShrink: 0 }}>{fila}</span>
              {porFila.get(fila).sort((a, b) => a.numero - b.numero).map((a) => {
                const c = seatColor(a);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleBloqueo(a)}
                    disabled={a.estado === 'vendido' || a.estado === 'reservado'}
                    title={`${a.fila}${a.numero} · ${a.estado}`}
                    style={{ width: 24, height: 24, borderRadius: 5, fontSize: '.6rem', fontWeight: 700, border: '1px solid #444', background: c.bg, color: c.fg, cursor: a.estado === 'vendido' ? 'not-allowed' : 'pointer', padding: 0 }}
                  >
                    {a.numero}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
