import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Check, Ban, ImagePlus, Pencil } from 'lucide-react';
import { api, uploadFile } from '../../utils/api.js';
import { useEscClose } from '../../utils/useEscClose.js';
import DataTable from '../../components/DataTable.jsx';

const ESTADO_LABEL = { solicitada: 'Solicitada', confirmada: 'Confirmada', cancelada: 'Cancelada', completada: 'Completada' };
const ESTADO_PILL = { solicitada: 'warn', confirmada: 'ok', cancelada: 'suspendido', completada: '' };

const money = (crc) => new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(crc || 0);
const hoy = () => new Date().toISOString().slice(0, 10);

function Modal({ title, onClose, children }) {
  useEscClose(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-text ghost" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

// ---- Reserva cargada a mano por el club (nace confirmada) ----
function ReservaModal({ salones, onClose, onSaved }) {
  const [form, setForm] = useState({
    salonId: salones[0]?.id ?? '',
    clienteNombre: '', clienteEmail: '', clienteTelefono: '', tipoEvento: '',
    fecha: hoy(), horaInicio: '09:00', horaFin: '13:00', personas: 0, notas: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setBusy(true); setError('');
    const d = await api('/admin/api/venues/reservas', { method: 'POST', body: JSON.stringify({ ...form, personas: Number(form.personas) }) });
    setBusy(false);
    if (!d.ok) return setError(d.error);
    onSaved();
  }

  return (
    <Modal title="Nueva reserva" onClose={onClose}>
      <label>Salón</label>
      <select value={form.salonId} onChange={(e) => setForm({ ...form, salonId: e.target.value })}>
        {salones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      <label>Cliente *</label>
      <input value={form.clienteNombre} onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })} placeholder="Nombre y apellido" />
      <div className="two">
        <div><label>Correo *</label><input value={form.clienteEmail} onChange={(e) => setForm({ ...form, clienteEmail: e.target.value })} placeholder="correo@ejemplo.com" /></div>
        <div><label>Teléfono</label><input value={form.clienteTelefono} onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value })} /></div>
      </div>
      <label>Tipo de evento</label>
      <input value={form.tipoEvento} onChange={(e) => setForm({ ...form, tipoEvento: e.target.value })} placeholder="Cumpleaños, capacitación, conferencia…" />
      <div className="two">
        <div><label>Fecha</label><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
        <div><label>Personas</label><input type="number" min="0" value={form.personas} onChange={(e) => setForm({ ...form, personas: e.target.value })} /></div>
      </div>
      <div className="two">
        <div><label>Desde</label><input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} /></div>
        <div><label>Hasta</label><input type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} /></div>
      </div>
      <label>Notas</label>
      <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
      {error && <div className="error">{error}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Crear reserva'}</button>
      </div>
    </Modal>
  );
}

// ---- Detalle de una reserva: estado, precio y datos del cliente ----
function ReservaDetalle({ reserva, onClose, onChanged }) {
  const [motivo, setMotivo] = useState(reserva.motivo || '');
  const [precio, setPrecio] = useState(reserva.precioCrc);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function guardar(patch) {
    setBusy(true); setError('');
    const d = await api(`/admin/api/venues/reservas/${reserva.id}`, { method: 'PUT', body: JSON.stringify(patch) });
    setBusy(false);
    if (!d.ok) return setError(d.error);
    onChanged();
  }
  async function eliminar() {
    setBusy(true);
    const d = await api(`/admin/api/venues/reservas/${reserva.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!d.ok) return setError(d.error);
    onChanged();
  }

  return (
    <Modal title={`Reserva ${reserva.codigo}`} onClose={onClose}>
      <p className="muted" style={{ margin: '0 0 10px' }}>
        <b>{reserva.salonNombre}</b> · {reserva.fecha} de {reserva.horaInicio} a {reserva.horaFin}
        {reserva.personas > 0 && <> · {reserva.personas} personas</>}
      </p>
      <p style={{ margin: '0 0 10px' }}>
        {reserva.clienteNombre}<br />
        <span className="muted">{reserva.clienteEmail}{reserva.clienteTelefono ? ` · ${reserva.clienteTelefono}` : ''}</span>
      </p>
      {reserva.tipoEvento && <p className="muted" style={{ margin: '0 0 10px' }}>Evento: {reserva.tipoEvento}</p>}
      {reserva.notas && <p style={{ fontStyle: 'italic' }}>“{reserva.notas}”</p>}
      <label>Precio acordado</label>
      <div className="two">
        <input type="number" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        <button className="btn ghost" onClick={() => guardar({ precioCrc: Number(precio) })} disabled={busy}>Guardar precio</button>
      </div>
      {(reserva.estado === 'solicitada' || reserva.estado === 'confirmada') && (
        <>
          <label>Motivo (si cancelás)</label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Fecha ya comprometida, cliente desistió…" />
        </>
      )}
      {error && <div className="error">{error}</div>}
      <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
        <button className="btn ghost danger" onClick={eliminar} disabled={busy}><Trash2 size={14} />Eliminar</button>
        {reserva.estado === 'solicitada' && <button className="btn" onClick={() => guardar({ estado: 'confirmada' })} disabled={busy}><Check size={15} />Confirmar</button>}
        {reserva.estado === 'confirmada' && <button className="btn" onClick={() => guardar({ estado: 'completada' })} disabled={busy}><Check size={15} />Marcar completada</button>}
        {(reserva.estado === 'solicitada' || reserva.estado === 'confirmada') && (
          <button className="btn ghost danger" onClick={() => guardar({ estado: 'cancelada', motivo })} disabled={busy}><Ban size={15} />Cancelar reserva</button>
        )}
      </div>
    </Modal>
  );
}

// ---- Ficha editable de un salón ----
function SalonCard({ salon, onChanged }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(salon);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => { setForm(salon); }, [salon]);

  async function guardar() {
    setBusy(true); setError('');
    const d = await api(`/admin/api/venues/salones/${salon.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nombre: form.nombre,
        descripcion: form.descripcion,
        ubicacion: form.ubicacion,
        capacidad: Number(form.capacidad),
        tarifaHoraCrc: Number(form.tarifaHoraCrc),
        tarifaDiaCrc: Number(form.tarifaDiaCrc),
        amenidades: String(form.amenidades ?? '').length && !Array.isArray(form.amenidades)
          ? String(form.amenidades).split(',').map((a) => a.trim()).filter(Boolean)
          : form.amenidades,
      }),
    });
    setBusy(false);
    if (!d.ok) return setError(d.error);
    setEdit(false); onChanged();
  }

  async function toggleActivo() {
    const d = await api(`/admin/api/venues/salones/${salon.id}`, { method: 'PUT', body: JSON.stringify({ activo: !salon.activo }) });
    if (d.ok) onChanged();
  }

  async function subirFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const d = await uploadFile(`/admin/api/venues/salones/${salon.id}/imagen`, file);
    setBusy(false); e.target.value = '';
    if (!d.ok) return setError(d.error);
    onChanged();
  }

  return (
    <div className="salon-card">
      {salon.imagenUrl ? <img className="salon-card-img" src={salon.imagenUrl} alt="" /> : <div className="salon-card-img empty" />}
      <div className="salon-card-body">
        {!edit ? (
          <>
            <div className="salon-card-title">
              <b>{salon.nombre}</b>
              <span className={`pill${salon.activo ? ' ok' : ' suspendido'}`}>{salon.activo ? 'Disponible' : 'No disponible'}</span>
            </div>
            <p className="muted" style={{ margin: '2px 0' }}>{salon.ubicacion || 'Estadio'} · hasta {salon.capacidad} personas</p>
            <p style={{ margin: '2px 0' }}>{money(salon.tarifaHoraCrc)} por hora · {money(salon.tarifaDiaCrc)} el día</p>
            {salon.descripcion && <p className="muted">{salon.descripcion}</p>}
            {salon.amenidades?.length > 0 && (
              <div className="espacios-chips">{salon.amenidades.map((a) => <span key={a} className="espacio-chip on">{a}</span>)}</div>
            )}
          </>
        ) : (
          <>
            <label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <label>Descripción</label><input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            <label>Ubicación</label><input value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} />
            <div className="two">
              <div><label>Capacidad</label><input type="number" min="0" value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: e.target.value })} /></div>
              <div><label>Tarifa por hora</label><input type="number" min="0" value={form.tarifaHoraCrc} onChange={(e) => setForm({ ...form, tarifaHoraCrc: e.target.value })} /></div>
            </div>
            <label>Tarifa día completo</label><input type="number" min="0" value={form.tarifaDiaCrc} onChange={(e) => setForm({ ...form, tarifaDiaCrc: e.target.value })} />
            <label>Amenidades (separadas por coma)</label>
            <input
              value={Array.isArray(form.amenidades) ? form.amenidades.join(', ') : form.amenidades}
              onChange={(e) => setForm({ ...form, amenidades: e.target.value })}
            />
          </>
        )}
        {error && <div className="error">{error}</div>}
        <div className="salon-card-actions">
          {!edit
            ? <button className="btn ghost" onClick={() => setEdit(true)}><Pencil size={15} />Editar</button>
            : <><button className="btn" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button><button className="btn ghost" onClick={() => { setEdit(false); setForm(salon); }}>Cancelar</button></>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={subirFoto} />
          <button className="btn ghost" onClick={() => fileRef.current.click()} disabled={busy}><ImagePlus size={15} />Foto</button>
          <button className="btn ghost" onClick={toggleActivo}>{salon.activo ? 'Marcar no disponible' : 'Marcar disponible'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminVenues() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('reservas');
  const [estado, setEstado] = useState('');
  const [nueva, setNueva] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const load = () => api(`/admin/api/venues${estado ? `?estado=${estado}` : ''}`).then((d) => { if (d.ok) setData(d); });
  useEffect(() => { load(); }, [estado]);

  if (!data) return <main className="page"><p>Cargando…</p></main>;

  const columns = [
    { key: 'codigo', label: 'Código', render: (r) => <strong>{r.codigo}</strong> },
    { key: 'salon', label: 'Salón', render: (r) => r.salonNombre, sortValue: (r) => r.salonNombre },
    { key: 'fecha', label: 'Fecha', render: (r) => <>{r.fecha}<span className="muted"> · {r.horaInicio}–{r.horaFin}</span></>, sortValue: (r) => `${r.fecha} ${r.horaInicio}` },
    { key: 'cliente', label: 'Cliente', render: (r) => <>{r.clienteNombre}<span className="muted" style={{ display: 'block', fontSize: '.85rem' }}>{r.clienteEmail}</span></>, sortValue: (r) => r.clienteNombre },
    { key: 'personas', label: 'Personas', render: (r) => r.personas || '—' },
    { key: 'precio', label: 'Precio', render: (r) => money(r.precioCrc), sortValue: (r) => r.precioCrc },
    { key: 'estado', label: 'Estado', render: (r) => <span className={`pill ${ESTADO_PILL[r.estado] || ''}`}>{ESTADO_LABEL[r.estado] || r.estado}</span>, sortValue: (r) => r.estado },
  ];

  return (
    <main className="page">
      <p className="eyebrow">Alquiler de espacios</p>
      <h1>Salones</h1>
      <div className="rest-metrics">
        <div className="rest-metric"><b>{data.metricas.solicitudes}</b><span>Solicitudes por atender</span></div>
        <div className="rest-metric"><b>{data.metricas.confirmadas}</b><span>Confirmadas próximas</span></div>
        <div className="rest-metric"><b>{money(data.metricas.ingresosConfirmados)}</b><span>Ingresos confirmados</span></div>
      </div>
      <div className="admin-tabs">
        <button className={tab === 'reservas' ? 'active' : ''} onClick={() => setTab('reservas')}>Reservas</button>
        <button className={tab === 'salones' ? 'active' : ''} onClick={() => setTab('salones')}>Salones ({data.salones.length})</button>
      </div>

      {tab === 'reservas' && (
        <>
          <div className="toolbar" style={{ marginBottom: '1rem' }}>
            <button className="btn" onClick={() => setNueva(true)} disabled={!data.salones.length}><Plus size={15} />Nueva reserva</button>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {data.reservas.length === 0
            ? <div className="result empty">No hay reservas {estado ? `en estado ${ESTADO_LABEL[estado].toLowerCase()}` : 'todavía'}.</div>
            : <DataTable id="venue-reservas" rows={data.reservas} columns={columns} rowProps={(r) => ({ className: 'clickable-row', onClick: () => setDetalle(r) })} />}
        </>
      )}

      {tab === 'salones' && (
        <div className="salon-cards">
          {data.salones.map((s) => <SalonCard key={s.id} salon={s} onChanged={load} />)}
        </div>
      )}

      {nueva && <ReservaModal salones={data.salones.filter((s) => s.activo)} onClose={() => setNueva(false)} onSaved={() => { setNueva(false); load(); }} />}
      {detalle && <ReservaDetalle reserva={detalle} onClose={() => setDetalle(null)} onChanged={() => { setDetalle(null); load(); }} />}
    </main>
  );
}
