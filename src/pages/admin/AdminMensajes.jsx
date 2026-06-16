import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../utils/api.js';

const ESTADOS = ['nuevo', 'leido', 'respondido', 'archivado'];
const ESTADO_LABELS = { nuevo: 'Nuevo', leido: 'Leído', respondido: 'Respondido', archivado: 'Archivado' };

function MensajeModal({ mensaje, onClose, onUpdated }) {
  const [estado, setEstado] = useState(mensaje.estado);
  const [busy, setBusy] = useState(false);

  async function cambiarEstado(nuevoEstado) {
    setBusy(true);
    await api(`/admin/api/contacto/${mensaje.id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: nuevoEstado }) });
    setEstado(nuevoEstado);
    setBusy(false);
    onUpdated();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Mensaje de {mensaje.nombre} {mensaje.apellido}</h2>
          <button className="icon-text ghost" onClick={onClose}>✕</button>
        </div>
        <div className="detail-row"><span className="muted">Email:</span> <a href={`mailto:${mensaje.email}`}>{mensaje.email}</a></div>
        {mensaje.telefono && <div className="detail-row"><span className="muted">Teléfono:</span> {mensaje.telefono}</div>}
        <div className="detail-row"><span className="muted">Asunto:</span> <strong>{mensaje.asunto}</strong></div>
        <div className="detail-row"><span className="muted">Fecha:</span> {new Date(mensaje.creadoAt).toLocaleString('es-CR')}</div>
        <div className="msg-body">{mensaje.mensaje}</div>
        <label style={{ marginTop: '1rem' }}>Estado</label>
        <div className="toggle-group">
          {ESTADOS.map((e) => (
            <button key={e} className={`btn${estado === e ? '' : ' ghost'}`} disabled={busy || estado === e} onClick={() => cambiarEstado(e)}>
              {ESTADO_LABELS[e]}
            </button>
          ))}
        </div>
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

export default function AdminMensajes() {
  const [mensajes, setMensajes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  const load = () => api('/admin/api/contacto').then((d) => d.ok && setMensajes(d.messages));
  useEffect(() => { load(); }, []);

  async function confirmDelete() {
    setDelBusy(true);
    await api(`/admin/api/contacto/${delTarget.id}`, { method: 'DELETE' });
    setDelBusy(false); setDelTarget(null); load();
  }

  const nuevos = mensajes.filter((m) => m.estado === 'nuevo').length;
  const filtered = filtro === 'todos' ? mensajes : mensajes.filter((m) => m.estado === filtro);

  return (
    <main className="page">
      <p className="eyebrow">Contenido del sitio</p>
      <h1>Mensajes de contacto {nuevos > 0 && <span className="badge">{nuevos} nuevos</span>}</h1>
      <div className="toolbar" style={{ marginBottom: '1rem', gap: '0.5rem' }}>
        <button className={`btn${filtro === 'todos' ? '' : ' ghost'}`} onClick={() => setFiltro('todos')}>Todos</button>
        {ESTADOS.map((e) => (
          <button key={e} className={`btn${filtro === e ? '' : ' ghost'}`} onClick={() => setFiltro(e)}>{ESTADO_LABELS[e]}</button>
        ))}
      </div>
      <div className="table">
        <table>
          <thead><tr><th>Remitente</th><th>Asunto</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className={m.estado === 'nuevo' ? 'row-new' : ''} style={{ cursor: 'pointer' }} onClick={() => setSelected(m)}>
                <td><strong>{m.nombre} {m.apellido}</strong><br /><small className="muted">{m.email}</small></td>
                <td>{m.asunto}</td>
                <td className="muted">{new Date(m.creadoAt).toLocaleDateString('es-CR')}</td>
                <td><span className={`pill${m.estado === 'nuevo' ? ' warn' : m.estado === 'respondido' ? ' ok' : ''}`}>{ESTADO_LABELS[m.estado]}</span></td>
                <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn ghost danger" onClick={() => setDelTarget(m)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '2rem' }}>Sin mensajes</td></tr>}
          </tbody>
        </table>
      </div>
      {selected && <MensajeModal mensaje={selected} onClose={() => setSelected(null)} onUpdated={() => { load(); }} />}
      {delTarget && <ConfirmModal title="Eliminar mensaje" text={`¿Eliminar el mensaje de ${delTarget.nombre} ${delTarget.apellido}?`} onConfirm={confirmDelete} onClose={() => setDelTarget(null)} busy={delBusy} />}
    </main>
  );
}
