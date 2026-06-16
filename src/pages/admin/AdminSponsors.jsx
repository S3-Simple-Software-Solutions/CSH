import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, Pencil, Trash2, Plus } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, uploadFile } from '../../utils/api.js';

function SortableRow({ sponsor, onEdit, onDelete, onToggleActivo }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sponsor.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <tr ref={setNodeRef} style={style}>
      <td><button className="icon-text ghost drag-handle" {...attributes} {...listeners} title="Arrastrar"><GripVertical size={15} /></button></td>
      <td>{sponsor.logoPath ? <img src={sponsor.logoPath} alt={sponsor.nombre} className="thumb" /> : <div className="thumb-placeholder" />}</td>
      <td><strong>{sponsor.nombre}</strong></td>
      <td>{sponsor.esApparel ? <span className="pill ok">Apparel</span> : <span className="pill">Patrocinador</span>}</td>
      <td>
        <button className={`btn ghost tight${!sponsor.activo ? ' danger' : ''}`} onClick={() => onToggleActivo(sponsor)} title={sponsor.activo ? 'Desactivar' : 'Activar'}>
          {sponsor.activo ? '✓' : '✕'}
        </button>
      </td>
      <td className="row-actions">
        <button className="btn ghost" onClick={() => onEdit(sponsor)}><Pencil size={14} />Editar</button>
        <button className="btn ghost danger" onClick={() => onDelete(sponsor)}><Trash2 size={14} /></button>
      </td>
    </tr>
  );
}

function SponsorModal({ sponsor, onClose, onSaved }) {
  const isEdit = Boolean(sponsor?.id);
  const [form, setForm] = useState({
    nombre: sponsor?.nombre ?? '',
    orden: sponsor?.orden ?? 0,
    esApparel: sponsor?.esApparel ?? false,
    activo: sponsor?.activo ?? true,
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(sponsor?.logoPath ?? null);
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
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');
    setBusy(true); setError(null);
    try {
      let res;
      if (isEdit) {
        res = await api(`/admin/api/sponsors/${sponsor.id}`, { method: 'PATCH', body: JSON.stringify({ ...form, orden: Number(form.orden) }) });
      } else {
        res = await api('/admin/api/sponsors', { method: 'POST', body: JSON.stringify({ ...form, orden: Number(form.orden) }) });
      }
      if (!res.ok) { setError(res.error); setBusy(false); return; }
      const id = res.sponsor.id;
      if (file) {
        const up = await uploadFile(`/admin/api/sponsors/${id}/logo`, file);
        if (!up.ok) { setError(up.error); setBusy(false); return; }
      }
      onSaved();
    } catch { setError('Error de conexión'); setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{isEdit ? 'Editar sponsor' : 'Nuevo sponsor'}</h2><button className="icon-text ghost" onClick={onClose}>✕</button></div>
        <label>Nombre *</label>
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Reebok" />
        <label>Orden</label>
        <input type="number" value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} />
        <div className="check-row">
          <label><input type="checkbox" checked={form.esApparel} onChange={(e) => setForm({ ...form, esApparel: e.target.checked })} /> Es partner de apparel</label>
          <label><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo</label>
        </div>
        <label>Logo</label>
        {preview && <img src={preview} alt="preview" className="img-preview" style={{ background: '#1a1a1a', padding: '8px' }} />}
        <input ref={fileRef} type="file" accept="image/*,.svg" style={{ display: 'none' }} onChange={handleFile} />
        <button className="btn ghost" onClick={() => fileRef.current.click()}>Seleccionar logo</button>
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

export default function AdminSponsors() {
  const [sponsors, setSponsors] = useState([]);
  const [modal, setModal] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor));

  const load = () => api('/admin/api/sponsors').then((d) => d.ok && setSponsors(d.sponsors));
  useEffect(() => { load(); }, []);

  async function toggleActivo(s) {
    await api(`/admin/api/sponsors/${s.id}`, { method: 'PATCH', body: JSON.stringify({ activo: !s.activo }) });
    load();
  }

  async function confirmDelete() {
    setDelBusy(true);
    await api(`/admin/api/sponsors/${delTarget.id}`, { method: 'DELETE' });
    setDelBusy(false); setDelTarget(null); load();
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sponsors.findIndex((s) => s.id === active.id);
    const newIndex = sponsors.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sponsors, oldIndex, newIndex).map((s, i) => ({ ...s, orden: i }));
    setSponsors(reordered);
    await api('/admin/api/sponsors/reorder', { method: 'POST', body: JSON.stringify({ items: reordered.map((s) => ({ id: s.id, orden: s.orden })) }) });
  }

  return (
    <main className="page">
      <p className="eyebrow">Contenido del sitio</p>
      <h1>Sponsors</h1>
      <p className="sub">Arrastrá filas para reordenar.</p>
      <div className="toolbar" style={{ marginBottom: '1rem' }}>
        <button className="btn" onClick={() => setModal({})}><Plus size={15} />Nuevo sponsor</button>
      </div>
      <div className="table">
        <table>
          <thead><tr><th></th><th>Logo</th><th>Nombre</th><th>Tipo</th><th>Activo</th><th></th></tr></thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sponsors.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {sponsors.map((s) => (
                  <SortableRow key={s.id} sponsor={s}
                    onEdit={(sp) => setModal(sp)} onDelete={(sp) => setDelTarget(sp)}
                    onToggleActivo={toggleActivo} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
      {modal !== null && <SponsorModal sponsor={modal?.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {delTarget && <ConfirmModal title="Eliminar sponsor" text={`¿Eliminar a ${delTarget.nombre}? Esta acción no se puede deshacer.`} onConfirm={confirmDelete} onClose={() => setDelTarget(null)} busy={delBusy} />}
    </main>
  );
}
