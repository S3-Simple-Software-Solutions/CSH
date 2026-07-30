import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, Trash2, Plus, Check } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, uploadFile } from '../../utils/api.js';
import { useEscClose } from '../../utils/useEscClose.js';
import DataTable from '../../components/DataTable.jsx';

// Fallback por si el backend es más viejo que el bundle: el catálogo real
// (ESPACIOS_PAUTA) llega en la respuesta de /admin/api/sponsors.
const ESPACIOS_FALLBACK = [
  { id: 'web', nombre: 'Página web' },
  { id: 'vallas_dentro', nombre: 'Vallas dentro del estadio' },
  { id: 'vallas_fuera', nombre: 'Vallas fuera del estadio' },
  { id: 'pantallas', nombre: 'Pantallas' },
  { id: 'entrada_estadio', nombre: 'Entrada del estadio' },
  { id: 'entrada_parqueo', nombre: 'Entrada del parqueo' },
];

// Chips de espacios: cada uno se prende/apaga con un click y persiste al toque.
function EspaciosChips({ sponsor, catalogo, onToggle }) {
  return (
    <div className="espacios-chips" onClick={(e) => e.stopPropagation()}>
      {catalogo.map((esp) => {
        const on = sponsor.espacios?.includes(esp.id);
        return (
          <button
            key={esp.id}
            type="button"
            className={`espacio-chip${on ? ' on' : ''}`}
            onClick={() => onToggle(sponsor, esp.id)}
            title={on ? `Pauta en ${esp.nombre} — click para quitar` : `No pauta en ${esp.nombre} — click para activar`}
            aria-pressed={on}
          >
            {on && <Check size={12} />}{esp.nombre}
          </button>
        );
      })}
    </div>
  );
}

function SortableRow({ sponsor, columns, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sponsor.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <tr ref={setNodeRef} style={style} className="clickable-row" onClick={() => onEdit(sponsor)}>
      {columns.map((c) => (c.key === 'drag' ? (
        <td key="drag" onClick={(e) => e.stopPropagation()}><button className="icon-text ghost drag-handle" {...attributes} {...listeners} title="Arrastrar"><GripVertical size={15} /></button></td>
      ) : (
        <td key={c.key}>{c.render(sponsor)}</td>
      )))}
    </tr>
  );
}

function PatrocinadorModal({ sponsor, catalogo, onClose, onSaved, onDelete }) {
  useEscClose(onClose);
  const isEdit = Boolean(sponsor?.id);
  const [form, setForm] = useState({
    nombre: sponsor?.nombre ?? '',
    orden: sponsor?.orden ?? 0,
    esApparel: sponsor?.esApparel ?? false,
    activo: sponsor?.activo ?? true,
  });
  const [espacios, setEspacios] = useState(sponsor?.espacios ?? ['web']);
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

  function toggleEspacio(id) {
    setEspacios((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  async function save() {
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');
    setBusy(true); setError(null);
    try {
      const body = JSON.stringify({ ...form, orden: Number(form.orden), espacios });
      const res = isEdit
        ? await api(`/admin/api/sponsors/${sponsor.id}`, { method: 'PATCH', body })
        : await api('/admin/api/sponsors', { method: 'POST', body });
      if (!res.ok) { setError(res.error); setBusy(false); return; }
      const id = res.sponsor.id;
      if (isEdit) {
        const esp = await api(`/admin/api/sponsors/${id}/espacios`, { method: 'PUT', body: JSON.stringify({ espacios }) });
        if (!esp.ok) { setError(esp.error); setBusy(false); return; }
      }
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
        <div className="modal-head"><h2>{isEdit ? 'Editar patrocinador' : 'Nuevo patrocinador'}</h2><button className="icon-text ghost" onClick={onClose}>✕</button></div>
        {isEdit && (
          <div className="modal-toolbar">
            <button className="btn ghost danger" onClick={onDelete}><Trash2 size={14} />Eliminar</button>
          </div>
        )}
        <label>Nombre *</label>
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Reebok" />
        <label>Orden</label>
        <input type="number" value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} />
        <label>Dónde pauta</label>
        <div className="espacios-chips">
          {catalogo.map((esp) => (
            <button key={esp.id} type="button" className={`espacio-chip${espacios.includes(esp.id) ? ' on' : ''}`} onClick={() => toggleEspacio(esp.id)} aria-pressed={espacios.includes(esp.id)}>
              {espacios.includes(esp.id) && <Check size={12} />}{esp.nombre}
            </button>
          ))}
        </div>
        <div className="check-row">
          <label><input type="checkbox" checked={form.esApparel} onChange={(e) => setForm({ ...form, esApparel: e.target.checked })} /> Es partner de apparel</label>
          <label><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo</label>
        </div>
        <label>Logo</label>
        {preview && <img src={preview} alt="preview" className="img-preview" style={{ background: '#1a1a1a', padding: '8px' }} />}
        <input ref={fileRef} type="file" accept="image/*,.svg" style={{ display: 'none' }} onChange={handleFile} />
        <button className="btn ghost" onClick={() => fileRef.current.click()}>Seleccionar logo</button>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

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

export default function AdminPatrocinadores() {
  const [sponsors, setSponsors] = useState([]);
  const [catalogo, setCatalogo] = useState(ESPACIOS_FALLBACK);
  const [modal, setModal] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor));

  const load = () => api('/admin/api/sponsors').then((d) => {
    if (!d.ok) return;
    setSponsors(d.sponsors);
    if (Array.isArray(d.espaciosCatalogo) && d.espaciosCatalogo.length) setCatalogo(d.espaciosCatalogo);
  });
  useEffect(() => { load(); }, []);

  // Un click en un chip persiste de inmediato; la fila se actualiza optimista.
  async function toggleEspacio(sponsor, espacioId) {
    const actuales = sponsor.espacios ?? [];
    const espacios = actuales.includes(espacioId) ? actuales.filter((e) => e !== espacioId) : [...actuales, espacioId];
    setSponsors((prev) => prev.map((s) => (s.id === sponsor.id ? { ...s, espacios } : s)));
    const d = await api(`/admin/api/sponsors/${sponsor.id}/espacios`, { method: 'PUT', body: JSON.stringify({ espacios }) });
    if (!d.ok) load();
  }

  const columns = useMemo(() => [
    { key: 'drag', label: '', menuLabel: 'Arrastrar', sortable: false },
    { key: 'logo', label: 'Logo', render: (s) => (s.logoPath ? <img src={s.logoPath} alt={s.nombre} className="thumb-logo" /> : <div className="thumb-placeholder" />) },
    { key: 'nombre', label: 'Nombre', render: (s) => <strong>{s.nombre}</strong> },
    { key: 'espacios', label: 'Dónde pauta', sortable: false, render: (s) => <EspaciosChips sponsor={s} catalogo={catalogo} onToggle={toggleEspacio} /> },
    { key: 'tipo', label: 'Tipo', render: (s) => (s.esApparel ? <span className="pill ok">Apparel</span> : <span className="pill">Patrocinador</span>) },
    { key: 'activo', label: 'Activo', render: (s) => <span className={`pill${s.activo ? ' ok' : ''}`}>{s.activo ? 'Activo' : 'Inactivo'}</span> },
  ], [catalogo]);

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
      <p className="eyebrow">Comercial</p>
      <h1>Patrocinadores</h1>
      <p className="sub">Lista completa de patrocinadores y en qué espacios pauta cada uno. Marcá o desmarcá un espacio con un click. “Página web” es lo que decide si el logo sale en el sitio.</p>
      <div className="rest-metrics">
        {catalogo.map((esp) => (
          <div key={esp.id} className="rest-metric">
            <b>{sponsors.filter((s) => s.espacios?.includes(esp.id)).length}</b>
            <span>{esp.nombre}</span>
          </div>
        ))}
      </div>
      <div className="toolbar" style={{ marginBottom: '1rem' }}>
        <button className="btn" onClick={() => setModal({})}><Plus size={15} />Nuevo patrocinador</button>
      </div>
      <DataTable
        id="patrocinadores"
        rows={sponsors}
        columns={columns}
        sortable={false}
        renderBody={(cols, rows) => (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {rows.map((s) => (
                  <SortableRow key={s.id} sponsor={s} columns={cols} onEdit={(sp) => setModal(sp)} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        )}
      />
      {modal !== null && <PatrocinadorModal sponsor={modal?.id ? modal : null} catalogo={catalogo} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} onDelete={() => { const t = modal; setModal(null); setDelTarget(t); }} />}
      {delTarget && <ConfirmModal title="Eliminar patrocinador" text={`¿Eliminar a ${delTarget.nombre}? Esta acción no se puede deshacer.`} onConfirm={confirmDelete} onClose={() => setDelTarget(null)} busy={delBusy} />}
    </main>
  );
}
