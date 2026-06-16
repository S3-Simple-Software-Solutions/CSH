import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { api, uploadFile } from '../../utils/api.js';

const CATEGORIAS = ['Noticias', 'Refuerzos', 'Comunicados', 'Crónicas', 'Cantera', 'Femenino', 'Entradas'];

function NoticiaModal({ noticia, onClose, onSaved }) {
  const isEdit = Boolean(noticia?.id);
  const [form, setForm] = useState({
    titulo: noticia?.titulo ?? '',
    categoria: noticia?.categoria ?? 'Noticias',
    fuente: noticia?.fuente ?? '',
    resumen: noticia?.resumen ?? '',
    cuerpo: noticia?.cuerpo ?? '',
    fecha: noticia?.fecha ? noticia.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10),
    estado: noticia?.estado ?? 'borrador',
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(noticia?.imagenPath ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!form.titulo.trim()) return setError('El título es obligatorio');
    setBusy(true); setError(null);
    try {
      let res;
      if (isEdit) {
        res = await api(`/admin/api/noticias/${noticia.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      } else {
        res = await api('/admin/api/noticias', { method: 'POST', body: JSON.stringify(form) });
      }
      if (!res.ok) { setError(res.error); setBusy(false); return; }
      const id = res.noticia.id;
      if (file) {
        const up = await uploadFile(`/admin/api/noticias/${id}/imagen`, file);
        if (!up.ok) { setError(up.error); setBusy(false); return; }
      }
      onSaved();
    } catch { setError('Error de conexión'); setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{isEdit ? 'Editar noticia' : 'Nueva noticia'}</h2><button className="icon-text ghost" onClick={onClose}>✕</button></div>
        <label>Título *</label>
        <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Herediano anuncia refuerzo…" />
        <div className="two">
          <div>
            <label>Categoría</label>
            <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label>Estado</label>
            <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              <option value="borrador">Borrador</option>
              <option value="publicado">Publicado</option>
            </select>
          </div>
        </div>
        <label>Fecha</label>
        <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        <label>Fuente</label>
        <input value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })} placeholder="Prensa Herediano" />
        <label>Resumen</label>
        <textarea rows={3} value={form.resumen} onChange={(e) => setForm({ ...form, resumen: e.target.value })} placeholder="Breve descripción que aparece en las cards y como intro del artículo…" />
        <label>Cuerpo del artículo</label>
        <textarea rows={10} value={form.cuerpo} onChange={(e) => setForm({ ...form, cuerpo: e.target.value })} placeholder="Escribí el texto completo de la noticia. Separá los párrafos con una línea en blanco." style={{ fontFamily: 'inherit', lineHeight: '1.6' }} />
        <label>Portada</label>
        {preview && <img src={preview} alt="preview" className="img-preview" />}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        <button className="btn ghost" onClick={() => fileRef.current.click()}>Seleccionar imagen</button>
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

export default function AdminNoticias() {
  const [noticias, setNoticias] = useState([]);
  const [modal, setModal] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = () => api('/admin/api/noticias').then((d) => d.ok && setNoticias(d.noticias));
  useEffect(() => { load(); }, []);

  async function toggleEstado(n) {
    const estado = n.estado === 'publicado' ? 'borrador' : 'publicado';
    await api(`/admin/api/noticias/${n.id}`, { method: 'PATCH', body: JSON.stringify({ estado }) });
    load();
  }

  async function confirmDelete() {
    setDelBusy(true);
    await api(`/admin/api/noticias/${delTarget.id}`, { method: 'DELETE' });
    setDelBusy(false); setDelTarget(null); load();
  }

  return (
    <main className="page">
      <p className="eyebrow">Contenido del sitio</p>
      <h1>Noticias</h1>
      <div className="toolbar" style={{ marginBottom: '1rem' }}>
        <button className="btn" onClick={() => setModal({})}><Plus size={15} />Nueva noticia</button>
      </div>
      <div className="table">
        <table>
          <thead><tr><th>Portada</th><th>Título</th><th>Categoría</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {noticias.map((n) => (
              <tr key={n.id}>
                <td>{n.imagenPath ? <img src={n.imagenPath} alt={n.titulo} className="thumb" /> : <div className="thumb-placeholder" />}</td>
                <td><strong>{n.titulo}</strong><br /><small className="muted">{n.fuente}</small></td>
                <td><span className="pill">{n.categoria}</span></td>
                <td className="muted">{new Date(n.fecha).toLocaleDateString('es-CR')}</td>
                <td>
                  <button className={`pill estado${n.estado === 'publicado' ? ' ok' : ''}`} onClick={() => toggleEstado(n)}>
                    {n.estado === 'publicado' ? 'Publicado' : 'Borrador'}
                  </button>
                </td>
                <td className="row-actions">
                  <button className="btn ghost" onClick={() => setModal(n)}><Pencil size={14} />Editar</button>
                  <button className="btn ghost danger" onClick={() => setDelTarget(n)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal !== null && <NoticiaModal noticia={modal?.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {delTarget && <ConfirmModal title="Eliminar noticia" text={`¿Eliminar "${delTarget.titulo}"? Esta acción no se puede deshacer.`} onConfirm={confirmDelete} onClose={() => setDelTarget(null)} busy={delBusy} />}
    </main>
  );
}
