import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Archive, Reply, Send, Mail, Phone, Inbox } from 'lucide-react';
import { api } from '../../utils/api.js';
import { useEscClose } from '../../utils/useEscClose.js';

const ESTADOS = ['nuevo', 'leido', 'respondido', 'archivado'];
const ESTADO_LABELS = { nuevo: 'Nuevo', leido: 'Leído', respondido: 'Respondido', archivado: 'Archivado' };
const pillClass = (estado) => `pill${estado === 'nuevo' ? ' warn' : estado === 'respondido' ? ' ok' : ''}`;
const fmtFecha = (iso) => new Date(iso).toLocaleString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function ConfirmModal({ title, text, onConfirm, onClose, busy }) {
  useEscClose(onClose);
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

function Reader({ mensaje, respuestas, onChangeEstado, onReply, onDelete, busyEstado }) {
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const taRef = useRef(null);

  useEffect(() => { setTexto(''); setMsg(null); }, [mensaje.id]);

  async function enviar() {
    if (!texto.trim()) return setMsg({ type: 'error', text: 'Escribí una respuesta antes de enviar.' });
    setSending(true); setMsg(null);
    const res = await onReply(mensaje.id, texto.trim());
    setSending(false);
    if (res.ok) { setTexto(''); setMsg({ type: 'ok', text: `Respuesta enviada a ${mensaje.email}.` }); }
    else setMsg({ type: 'error', text: res.error || 'No se pudo enviar la respuesta.' });
  }

  return (
    <div className="reader">
      <div className="reader-head">
        <div>
          <h2>{mensaje.asunto}</h2>
          <div className="reader-from">
            <strong>{mensaje.nombre} {mensaje.apellido}</strong>
            <a href={`mailto:${mensaje.email}`}><Mail size={13} /> {mensaje.email}</a>
            {mensaje.telefono && <span><Phone size={13} /> {mensaje.telefono}</span>}
          </div>
          <div className="muted reader-date">{new Date(mensaje.creadoAt).toLocaleString('es-CR')}</div>
        </div>
        <span className={pillClass(mensaje.estado)}>{ESTADO_LABELS[mensaje.estado]}</span>
      </div>

      <div className="reader-actions">
        {ESTADOS.filter((e) => e !== 'nuevo').map((e) => (
          <button key={e} className={`btn ghost${mensaje.estado === e ? ' active' : ''}`} disabled={busyEstado || mensaje.estado === e} onClick={() => onChangeEstado(mensaje.id, e)}>
            {e === 'archivado' ? <Archive size={14} /> : null}{ESTADO_LABELS[e]}
          </button>
        ))}
        <button className="btn ghost danger" onClick={() => onDelete(mensaje)}><Trash2 size={14} /> Eliminar</button>
      </div>

      <div className="msg-bubble">{mensaje.mensaje}</div>

      {respuestas.length > 0 && (
        <div className="thread">
          {respuestas.map((r) => (
            <div key={r.id} className="msg-bubble reply">
              <div className="reply-meta"><Reply size={13} /> {r.adminName} · {fmtFecha(r.creadoAt)}</div>
              {r.cuerpo}
            </div>
          ))}
        </div>
      )}

      <div className="composer">
        <label>Responder a {mensaje.nombre}</label>
        <textarea ref={taRef} rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`Escribí tu respuesta para ${mensaje.email}…`} />
        {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
        <button className="btn" onClick={enviar} disabled={sending}><Send size={15} /> {sending ? 'Enviando…' : 'Enviar respuesta'}</button>
      </div>
    </div>
  );
}

export default function AdminMensajes() {
  const [mensajes, setMensajes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [respuestas, setRespuestas] = useState([]);
  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [busyEstado, setBusyEstado] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  const load = () => api('/admin/api/contacto').then((d) => d.ok && setMensajes(d.mensajes || []));
  useEffect(() => { load(); }, []);

  async function open(id) {
    setSelectedId(id);
    setRespuestas([]);
    const d = await api(`/admin/api/contacto/${id}`);
    if (d.ok) {
      setRespuestas(d.respuestas || []);
      setMensajes((prev) => prev.map((m) => (m.id === id ? d.mensaje : m)));
    }
  }

  async function changeEstado(id, estado) {
    setBusyEstado(true);
    const d = await api(`/admin/api/contacto/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) });
    setBusyEstado(false);
    if (d.ok) setMensajes((prev) => prev.map((m) => (m.id === id ? d.mensaje : m)));
  }

  async function reply(id, cuerpo) {
    const d = await api(`/admin/api/contacto/${id}/responder`, { method: 'POST', body: JSON.stringify({ cuerpo }) });
    if (d.ok) {
      setRespuestas((prev) => [...prev, d.respuesta]);
      setMensajes((prev) => prev.map((m) => (m.id === id ? d.mensaje : m)));
    }
    return d;
  }

  async function confirmDelete() {
    setDelBusy(true);
    await api(`/admin/api/contacto/${delTarget.id}`, { method: 'DELETE' });
    setDelBusy(false);
    if (selectedId === delTarget.id) { setSelectedId(null); setRespuestas([]); }
    setDelTarget(null);
    load();
  }

  const nuevos = mensajes.filter((m) => m.estado === 'nuevo').length;
  const filtered = filtro === 'todos' ? mensajes : mensajes.filter((m) => m.estado === filtro);
  const selected = mensajes.find((m) => m.id === selectedId) || null;

  return (
    <main className="page">
      <p className="eyebrow">Contenido del sitio</p>
      <h1>Mensajes de contacto {nuevos > 0 && <span className="badge">{nuevos} nuevos</span>}</h1>

      <div className="inbox-filters">
        <button className={`chip${filtro === 'todos' ? ' active' : ''}`} onClick={() => setFiltro('todos')}>Todos</button>
        {ESTADOS.map((e) => (
          <button key={e} className={`chip${filtro === e ? ' active' : ''}`} onClick={() => setFiltro(e)}>{ESTADO_LABELS[e]}</button>
        ))}
      </div>

      <div className="inbox">
        <div className="inbox-list">
          {filtered.length === 0 && <div className="inbox-empty muted">Sin mensajes</div>}
          {filtered.map((m) => (
            <button
              key={m.id}
              className={`inbox-item${m.id === selectedId ? ' selected' : ''}${m.estado === 'nuevo' ? ' unread' : ''}`}
              onClick={() => open(m.id)}
            >
              <div className="inbox-item-top">
                <span className="inbox-sender">{m.estado === 'nuevo' && <i className="dot" />}{m.nombre} {m.apellido}</span>
                <span className="inbox-date">{new Date(m.creadoAt).toLocaleDateString('es-CR')}</span>
              </div>
              <div className="inbox-subject">{m.asunto}</div>
              <div className="inbox-snippet">{m.mensaje}</div>
              <span className={pillClass(m.estado)}>{ESTADO_LABELS[m.estado]}</span>
            </button>
          ))}
        </div>

        <div className="inbox-reader">
          {selected ? (
            <Reader
              mensaje={selected}
              respuestas={respuestas}
              onChangeEstado={changeEstado}
              onReply={reply}
              onDelete={setDelTarget}
              busyEstado={busyEstado}
            />
          ) : (
            <div className="inbox-placeholder muted"><Inbox size={40} /><p>Seleccioná un mensaje para leerlo y responder.</p></div>
          )}
        </div>
      </div>

      {delTarget && <ConfirmModal title="Eliminar mensaje" text={`¿Eliminar el mensaje de ${delTarget.nombre} ${delTarget.apellido}?`} onConfirm={confirmDelete} onClose={() => setDelTarget(null)} busy={delBusy} />}
    </main>
  );
}
