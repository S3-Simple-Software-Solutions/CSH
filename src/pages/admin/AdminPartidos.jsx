import React, { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { api } from '../../utils/api.js';
import { escudoFor } from '../../data/escudos.js';

const ESTADOS = ['programado', 'jugado', 'cancelado', 'pospuesto'];

function PartidoModal({ partido, onClose, onSaved }) {
  const isEdit = Boolean(partido?.id);
  const [tipo, setTipo] = useState(partido?.tipo ?? 'proximo');
  const [form, setForm] = useState({
    competicion: partido?.competicion ?? '',
    equipoLocal: partido?.equipoLocal ?? 'Herediano',
    equipoVisita: partido?.equipoVisita ?? '',
    fecha: partido?.fecha ? partido.fecha.slice(0, 16) : '',
    estadio: partido?.estadio ?? 'Estadio Coyella Fonseca',
    golesLocal: partido?.golesLocal ?? '',
    golesVisita: partido?.golesVisita ?? '',
    estado: partido?.estado ?? 'programado',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.competicion.trim() || !form.equipoVisita.trim() || !form.fecha) {
      return setError('Competición, rival y fecha son obligatorios');
    }
    if (tipo === 'resultado' && (form.golesLocal === '' || form.golesVisita === '')) {
      return setError('Los goles son obligatorios para resultados');
    }
    setBusy(true); setError(null);
    try {
      const body = {
        tipo,
        competicion: form.competicion.trim(),
        equipoLocal: form.equipoLocal.trim(),
        equipoVisita: form.equipoVisita.trim(),
        fecha: form.fecha,
        estadio: form.estadio.trim(),
        estado: tipo === 'resultado' ? 'jugado' : form.estado,
        golesLocal: tipo === 'resultado' ? Number(form.golesLocal) : null,
        golesVisita: tipo === 'resultado' ? Number(form.golesVisita) : null,
      };
      let res;
      if (isEdit) {
        res = await api(`/admin/api/partidos/${partido.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        res = await api('/admin/api/partidos', { method: 'POST', body: JSON.stringify(body) });
      }
      if (!res.ok) { setError(res.error); setBusy(false); return; }
      onSaved();
    } catch { setError('Error de conexión'); setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{isEdit ? 'Editar partido' : 'Nuevo partido'}</h2><button className="icon-text ghost" onClick={onClose}>✕</button></div>
        <div className="toggle-group" style={{ marginBottom: '1rem' }}>
          <button className={`btn${tipo === 'proximo' ? '' : ' ghost'}`} onClick={() => setTipo('proximo')}>Próximo</button>
          <button className={`btn${tipo === 'resultado' ? '' : ' ghost'}`} onClick={() => setTipo('resultado')}>Resultado</button>
        </div>
        <label>Competición *</label>
        <input value={form.competicion} onChange={(e) => setForm({ ...form, competicion: e.target.value })} placeholder="Liga Promerica" />
        <div className="two">
          <div><label>Equipo local</label><input value={form.equipoLocal} onChange={(e) => setForm({ ...form, equipoLocal: e.target.value })} /></div>
          <div><label>Equipo visitante *</label><input value={form.equipoVisita} onChange={(e) => setForm({ ...form, equipoVisita: e.target.value })} placeholder="Saprissa" /></div>
        </div>
        <label>Fecha y hora *</label>
        <input type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        <label>Estadio</label>
        <input value={form.estadio} onChange={(e) => setForm({ ...form, estadio: e.target.value })} />
        {tipo === 'resultado' ? (
          <>
            <label>Marcador</label>
            <div className="two">
              <div><label>Goles local</label><input type="number" min={0} value={form.golesLocal} onChange={(e) => setForm({ ...form, golesLocal: e.target.value })} /></div>
              <div><label>Goles visitante</label><input type="number" min={0} value={form.golesVisita} onChange={(e) => setForm({ ...form, golesVisita: e.target.value })} /></div>
            </div>
          </>
        ) : (
          <>
            <label>Estado</label>
            <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS.filter((s) => s !== 'jugado').map((s) => <option key={s}>{s}</option>)}
            </select>
          </>
        )}
        {error && <div className="error">{error}</div>}
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  );
}

function ConfirmModal({ title, text, onConfirm, onClose, busy }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2></div>
        <p className="muted">{text}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn danger" onClick={onConfirm} disabled={busy}>{busy ? 'Eliminando…' : 'Eliminar'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPartidos() {
  const [partidos, setPartidos] = useState([]);
  const [modal, setModal] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = () => api('/admin/api/partidos').then((d) => d.ok && setPartidos(d.partidos));
  useEffect(() => { load(); }, []);

  async function confirmDelete() {
    setDelBusy(true);
    await api(`/admin/api/partidos/${delTarget.id}`, { method: 'DELETE' });
    setDelBusy(false); setDelTarget(null); load();
  }

  return (
    <main className="page">
      <p className="eyebrow">Contenido del sitio</p>
      <h1>Partidos</h1>
      <div className="toolbar" style={{ marginBottom: '1rem' }}>
        <button className="btn" onClick={() => setModal({})}><Plus size={15} />Nuevo partido</button>
      </div>
      <div className="table">
        <table>
          <thead><tr><th>Tipo</th><th>Competición</th><th>Partido</th><th>Fecha</th><th>Marcador</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {partidos.map((p) => (
              <tr key={p.id}>
                <td><span className={`pill${p.tipo === 'proximo' ? '' : ' ok'}`}>{p.tipo === 'proximo' ? 'Próximo' : 'Resultado'}</span></td>
                <td className="muted">{p.competicion}</td>
                <td>
                  <span className="partido-cell">
                    <span className="partido-team">
                      <img src={escudoFor(p.equipoLocal)} alt="" className="escudo-mini" />
                      <strong>{p.equipoLocal}</strong>
                    </span>
                    <span className="muted">vs</span>
                    <span className="partido-team">
                      <img src={escudoFor(p.equipoVisita)} alt="" className="escudo-mini" />
                      <strong>{p.equipoVisita}</strong>
                    </span>
                  </span>
                </td>
                <td className="muted">{new Date(p.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="muted">{p.golesLocal != null ? `${p.golesLocal} - ${p.golesVisita}` : '—'}</td>
                <td><span className="pill">{p.estado}</span></td>
                <td className="row-actions">
                  <button className="btn ghost" onClick={() => setModal(p)}><Pencil size={14} />Editar</button>
                  <button className="btn ghost danger" onClick={() => setDelTarget(p)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal !== null && <PartidoModal partido={modal?.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {delTarget && <ConfirmModal title="Eliminar partido" text={`¿Eliminar ${delTarget.equipoLocal} vs ${delTarget.equipoVisita}? Esta acción no se puede deshacer.`} onConfirm={confirmDelete} onClose={() => setDelTarget(null)} busy={delBusy} />}
    </main>
  );
}
