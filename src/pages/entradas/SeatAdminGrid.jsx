import { useEffect, useState } from 'react';
import { api } from '../../utils/api.js';
import { SeatCanvas } from './SeatPicker.jsx';
import { nombreToZoneKey, orientationForZone } from './stadiumErc.js';
import { useConfirm } from '../../utils/confirm.jsx';

// Grilla admin de butacas de un sector: generar/regenerar la grilla y
// bloquear/desbloquear butacas con click. Compartida por el modal de sectores,
// el wizard de eventos y la pestaña Butacas del detalle.
// Usa el mismo lienzo del selector público (SeatCanvas) con semántica admin:
// click en disponible ↔ bloqueada; vendidas/reservadas no se tocan.
export function SeatAdminGrid({ tipo, onChanged }) {
  const confirm = useConfirm();
  const [asientos, setAsientos] = useState([]);
  const [form, setForm] = useState({ filas: '10', porFila: '20' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const load = async () => {
    const d = await api(`/admin/api/entradas/tipos/${tipo.id}/asientos`);
    if (d.ok) setAsientos(d.asientos);
  };
  useEffect(() => { load(); }, [tipo.id]);
  const stats = asientos.reduce((s, a) => ({ ...s, [a.estado]: (s[a.estado] || 0) + 1 }), {});
  async function generar() {
    const total = Number(form.filas) * Number(form.porFila);
    const regenera = asientos.length > 0;
    const ok = await confirm({
      title: regenera ? 'Regenerar butacas' : 'Generar butacas',
      message: regenera
        ? `Esto reemplaza las ${asientos.length} butacas actuales del sector (se rechaza si hay vendidas).`
        : `Se generarán ${total} butacas (${form.filas} filas × ${form.porFila}). El cupo del sector pasa a ${total}.`,
      confirmLabel: regenera ? 'Regenerar' : 'Generar',
      danger: regenera,
    });
    if (!ok) return;
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
        <div className="seatpicker seatpicker--admin" style={{ marginTop: 12 }}>
          <div className="seatpicker-head">
            <div className="seatpicker-title">
              <span className="sp-stat sp-stat--libre">{stats.disponible || 0} disp.</span>
              <span className="sp-stat sp-stat--vendida">{stats.vendido || 0} vend.</span>
              <span className="sp-stat sp-stat--bloq">{stats.bloqueado || 0} bloq.</span>
              {(stats.reservado || 0) > 0 && <span className="sp-stat sp-stat--reservada">{stats.reservado} reserv.</span>}
            </div>
            <div className="seatpicker-zoom" role="group" aria-label="Zoom">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.6, z / 1.25))} aria-label="Alejar">−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(2.4, z * 1.25))} aria-label="Acercar">+</button>
            </div>
          </div>
          <SeatCanvas
            asientos={asientos}
            orientation={orientationForZone(tipo.mapa?.points?.key ?? nombreToZoneKey(tipo.nombre))}
            selectedIds={null}
            onSeatClick={toggleBloqueo}
            clickableStates={['disponible', 'bloqueado']}
            zoom={zoom}
            onZoomChange={setZoom}
          />
          <p className="seatpicker-hint">Click en una butaca para bloquear ↔ habilitar. Las vendidas no se pueden tocar.</p>
        </div>
      )}
    </>
  );
}
