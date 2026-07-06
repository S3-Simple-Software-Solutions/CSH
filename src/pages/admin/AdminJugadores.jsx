import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, Trash2, Plus, Star, UserX } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, uploadFile } from '../../utils/api.js';
import { useEscClose } from '../../utils/useEscClose.js';
import DataTable from '../../components/DataTable.jsx';

const CATEGORIAS = ['Porteros', 'Defensas', 'Mediocampistas', 'Mediocampistas Ofensivos', 'Delanteros', 'Staff'];
const MAX_DESTACADOS = 5;

// El orden de las filas es manual (drag) y se persiste como dato, por eso la
// tabla no ofrece "ordenar por columna"; sí permite ocultar/mover columnas.
const JUGADOR_COLUMNS = [
  { key: 'drag', label: '', menuLabel: 'Arrastrar' },
  { key: 'foto', label: 'Foto', render: (j) => (j.fotoPath ? <img src={j.fotoPath} alt={j.nombre} className="thumb" /> : <div className="thumb-placeholder" />) },
  { key: 'nombre', label: 'Nombre', render: (j) => <strong>{j.nombre}</strong> },
  { key: 'dorsal', label: '#', menuLabel: 'Dorsal', tdProps: () => ({ className: 'muted' }), render: (j) => j.dorsal ?? '—' },
  { key: 'posicion', label: 'Posición', tdProps: () => ({ className: 'muted' }), render: (j) => j.posicion ?? '—' },
  { key: 'categoria', label: 'Categoría', render: (j) => <span className="pill">{j.categoria}</span> },
  { key: 'nacionalidad', label: 'NAC', tdProps: () => ({ className: 'muted' }) },
  { key: 'destacado', label: '★', menuLabel: 'Destacado' },
  { key: 'activo', label: 'Activo' },
];

function SortableRow({ jugador, columns, onEdit, onToggleDestacado, onToggleActivo, destacadosCount }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: jugador.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const canDestacado = jugador.destacado || destacadosCount < MAX_DESTACADOS;
  const stop = (e) => e.stopPropagation();
  // Celdas interactivas que necesitan handlers del row (drag, toggles).
  const special = {
    drag: (
      <td key="drag" onClick={stop}><button className="icon-text ghost drag-handle" {...attributes} {...listeners} title="Arrastrar"><GripVertical size={15} /></button></td>
    ),
    destacado: (
      <td key="destacado" onClick={stop}>
        <button
          className={`btn ghost tight${jugador.destacado ? ' active' : ''}`}
          onClick={() => onToggleDestacado(jugador)}
          disabled={!canDestacado}
          title={jugador.destacado ? 'Quitar destacado' : `Destacar (${destacadosCount}/${MAX_DESTACADOS})`}
        >
          <Star size={14} />
        </button>
      </td>
    ),
    activo: (
      <td key="activo" onClick={stop}>
        <button className={`btn ghost tight${!jugador.activo ? ' danger' : ''}`} onClick={() => onToggleActivo(jugador)} title={jugador.activo ? 'Desactivar' : 'Activar'}>
          {jugador.activo ? '✓' : <UserX size={14} />}
        </button>
      </td>
    ),
  };
  return (
    <tr ref={setNodeRef} style={style} className="clickable-row" onClick={() => onEdit(jugador)}>
      {columns.map((c) => special[c.key] ?? (
        <td key={c.key} {...(c.tdProps ? c.tdProps(jugador) : {})}>{c.render ? c.render(jugador) : jugador[c.key]}</td>
      ))}
    </tr>
  );
}

function JugadorModal({ jugador, onClose, onSaved, onDelete }) {
  useEscClose(onClose);
  const isEdit = Boolean(jugador?.id);
  const [form, setForm] = useState({
    nombre: jugador?.nombre ?? '',
    dorsal: jugador?.dorsal ?? '',
    posicion: jugador?.posicion ?? '',
    categoria: jugador?.categoria ?? 'Porteros',
    nacionalidad: jugador?.nacionalidad ?? 'CRC',
    destacado: jugador?.destacado ?? false,
    activo: jugador?.activo ?? true,
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(jugador?.fotoPath ?? null);
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
        res = await api(`/admin/api/jugadores/${jugador.id}`, { method: 'PATCH', body: JSON.stringify({ ...form, dorsal: form.dorsal !== '' ? Number(form.dorsal) : null }) });
      } else {
        res = await api('/admin/api/jugadores', { method: 'POST', body: JSON.stringify({ ...form, dorsal: form.dorsal !== '' ? Number(form.dorsal) : null }) });
      }
      if (!res.ok) { setError(res.error); setBusy(false); return; }
      const id = res.jugador.id;
      if (file) {
        const up = await uploadFile(`/admin/api/jugadores/${id}/foto`, file);
        if (!up.ok) { setError(up.error); setBusy(false); return; }
      }
      onSaved();
    } catch { setError('Error de conexión'); setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{isEdit ? 'Editar jugador' : 'Nuevo jugador'}</h2><button className="icon-text ghost" onClick={onClose}>✕</button></div>
        {isEdit && (
          <div className="modal-toolbar">
            <button className="btn ghost danger" onClick={onDelete}><Trash2 size={14} />Eliminar</button>
          </div>
        )}
        <label>Nombre *</label>
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Marcel Hernández" />
        <div className="two">
          <div><label>Dorsal</label><input type="number" value={form.dorsal} onChange={(e) => setForm({ ...form, dorsal: e.target.value })} placeholder="9" /></div>
          <div><label>Nacionalidad</label><input value={form.nacionalidad} onChange={(e) => setForm({ ...form, nacionalidad: e.target.value })} maxLength={3} placeholder="CRC" /></div>
        </div>
        <label>Categoría</label>
        <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label>Posición</label>
        <input value={form.posicion} onChange={(e) => setForm({ ...form, posicion: e.target.value })} placeholder="Centro Delantero" />
        <div className="check-row">
          <label><input type="checkbox" checked={form.destacado} onChange={(e) => setForm({ ...form, destacado: e.target.checked })} /> Destacar en Home</label>
          <label><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo</label>
        </div>
        <label>Foto</label>
        {preview && <img src={preview} alt="preview" className="img-preview" />}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        <button className="btn ghost" onClick={() => fileRef.current.click()}>Seleccionar imagen</button>
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

export default function AdminJugadores() {
  const [jugadores, setJugadores] = useState([]);
  const [modal, setModal] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor));

  const load = () => api('/admin/api/jugadores').then((d) => d.ok && setJugadores(d.jugadores));
  useEffect(() => { load(); }, []);

  const destacadosCount = jugadores.filter((j) => j.destacado && j.categoria !== 'Staff').length;

  async function toggleDestacado(j) {
    await api(`/admin/api/jugadores/${j.id}`, { method: 'PATCH', body: JSON.stringify({ destacado: !j.destacado }) });
    load();
  }
  async function toggleActivo(j) {
    await api(`/admin/api/jugadores/${j.id}`, { method: 'PATCH', body: JSON.stringify({ activo: !j.activo }) });
    load();
  }
  async function confirmDelete() {
    setDelBusy(true);
    await api(`/admin/api/jugadores/${delTarget.id}`, { method: 'DELETE' });
    setDelBusy(false); setDelTarget(null); load();
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = jugadores.findIndex((j) => j.id === active.id);
    const newIndex = jugadores.findIndex((j) => j.id === over.id);
    const reordered = arrayMove(jugadores, oldIndex, newIndex).map((j, i) => ({ ...j, orden: i }));
    setJugadores(reordered);
    await api('/admin/api/jugadores/reorder', { method: 'POST', body: JSON.stringify({ items: reordered.map((j) => ({ id: j.id, orden: j.orden })) }) });
  }

  return (
    <main className="page">
      <p className="eyebrow">Contenido del sitio</p>
      <h1>Jugadores</h1>
      <p className="sub">Plantilla y cuerpo técnico. Arrastrá filas para reordenar. Máx. {MAX_DESTACADOS} destacados en el Home.</p>
      <div className="toolbar" style={{ marginBottom: '1rem' }}>
        <button className="btn" onClick={() => setModal({})}><Plus size={15} />Nuevo jugador</button>
        <span className="muted" style={{ marginLeft: '1rem' }}>{destacadosCount}/{MAX_DESTACADOS} destacados</span>
      </div>
      <DataTable
        id="jugadores"
        rows={jugadores}
        columns={JUGADOR_COLUMNS}
        sortable={false}
        renderBody={(cols, rows) => (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map((j) => j.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {rows.map((j) => (
                  <SortableRow key={j.id} jugador={j} columns={cols} destacadosCount={destacadosCount}
                    onEdit={(jug) => setModal(jug)}
                    onToggleDestacado={toggleDestacado} onToggleActivo={toggleActivo} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        )}
      />
      {modal !== null && <JugadorModal jugador={modal?.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} onDelete={() => { const t = modal; setModal(null); setDelTarget(t); }} />}
      {delTarget && <ConfirmModal title="Eliminar jugador" text={`¿Eliminar a ${delTarget.nombre}? Esta acción no se puede deshacer.`} onConfirm={confirmDelete} onClose={() => setDelTarget(null)} busy={delBusy} />}
    </main>
  );
}
