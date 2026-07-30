import React, { useEffect, useMemo, useRef, useState } from 'react';
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

// ---- Calendario de disponibilidad (selección por arrastre, tipo Airbnb) ----

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Celdas de un mes: huecos al inicio para que el 1 caiga en su día de semana
// (semana que arranca en lunes).
function celdasDelMes(anio, mes) {
  const primero = new Date(anio, mes, 1);
  const offset = (primero.getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  const celdas = Array(offset).fill(null);
  for (let d = 1; d <= total; d++) celdas.push(ymd(new Date(anio, mes, d)));
  return celdas;
}

// Todas las fechas entre dos extremos, en cualquier orden de selección.
function rango(a, b) {
  const [ini, fin] = a <= b ? [a, b] : [b, a];
  const out = [];
  const cur = new Date(`${ini}T00:00:00`);
  const hasta = new Date(`${fin}T00:00:00`);
  while (cur <= hasta) { out.push(ymd(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}

function SalonCalendario({ salon, bloqueadas, agenda, onChanged }) {
  const [mesBase, setMesBase] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [ancla, setAncla] = useState(null);     // primer día del arrastre
  const [hover, setHover] = useState(null);     // día bajo el cursor mientras arrastra
  const [seleccion, setSeleccion] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const hoyStr = ymd(new Date());
  const bloqueadasSet = useMemo(() => new Map(bloqueadas.map((b) => [b.fecha, b.motivo])), [bloqueadas]);
  const reservadas = useMemo(() => {
    const m = new Map();
    for (const r of agenda) m.set(r.fecha, `${r.codigo} · ${r.horaInicio}–${r.horaFin}`);
    return m;
  }, [agenda]);

  // Mientras se arrastra, la preselección se calcula del ancla al día bajo el cursor.
  const preview = ancla && hover ? rango(ancla, hover) : [];
  const activas = new Set(preview.length ? preview : seleccion);

  function soltar() {
    if (!ancla) return;
    const dias = rango(ancla, hover || ancla).filter((f) => f >= hoyStr && !reservadas.has(f));
    setSeleccion(dias);
    setAncla(null); setHover(null);
  }

  useEffect(() => {
    // El arrastre puede terminar fuera del calendario: se escucha en la ventana.
    if (!ancla) return undefined;
    window.addEventListener('pointerup', soltar);
    return () => window.removeEventListener('pointerup', soltar);
  });

  async function aplicar(bloquear) {
    setBusy(true); setError('');
    const d = await api(`/admin/api/venues/salones/${salon.id}/disponibilidad`, {
      method: 'PUT',
      body: JSON.stringify({ fechas: seleccion, bloquear, motivo: bloquear ? motivo : '' }),
    });
    setBusy(false);
    if (!d.ok) return setError(d.error);
    setSeleccion([]); setMotivo(''); onChanged();
  }

  const meses = [mesBase, new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 1)];
  const seleccionBloqueadas = seleccion.filter((f) => bloqueadasSet.has(f)).length;

  return (
    <div className="cal-wrap">
      <div className="cal-head">
        <button className="btn ghost xs" onClick={() => setMesBase(new Date(mesBase.getFullYear(), mesBase.getMonth() - 1, 1))}>←</button>
        <b>Disponibilidad</b>
        <button className="btn ghost xs" onClick={() => setMesBase(new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 1))}>→</button>
        <span className="muted cal-hint">Arrastrá para marcar varios días</span>
      </div>

      <div className="cal-months">
        {meses.map((m) => (
          <div key={`${m.getFullYear()}-${m.getMonth()}`} className="cal-month">
            <div className="cal-month-name">{MESES[m.getMonth()]} {m.getFullYear()}</div>
            <div className="cal-grid">
              {DIAS_SEMANA.map((d, idx) => <span key={idx} className="cal-dow">{d}</span>)}
              {celdasDelMes(m.getFullYear(), m.getMonth()).map((fecha, idx) => {
                if (!fecha) return <span key={`v${idx}`} className="cal-day empty" />;
                const pasado = fecha < hoyStr;
                const reservada = reservadas.get(fecha);
                const bloqueada = bloqueadasSet.has(fecha);
                const sel = activas.has(fecha);
                const clase = ['cal-day',
                  pasado ? 'pasado' : '',
                  reservada ? 'reservada' : '',
                  bloqueada ? 'bloqueada' : '',
                  sel ? 'sel' : ''].filter(Boolean).join(' ');
                const titulo = reservada ? `Reservado · ${reservada}`
                  : bloqueada ? `No disponible${bloqueadasSet.get(fecha) ? ` · ${bloqueadasSet.get(fecha)}` : ''}`
                    : pasado ? 'Fecha pasada' : 'Disponible';
                return (
                  <button
                    key={fecha}
                    type="button"
                    className={clase}
                    title={titulo}
                    disabled={pasado || Boolean(reservada)}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      // En touch el navegador captura el puntero en el elemento
                      // original; sin soltarlo, el arrastre no marcaría los días
                      // siguientes. Con mouse no hay captura implícita.
                      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                      setAncla(fecha); setHover(fecha);
                    }}
                    onPointerEnter={() => ancla && setHover(fecha)}
                  >
                    {Number(fecha.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="cal-legend">
        <span><i className="sw libre" />Disponible</span>
        <span><i className="sw bloqueada" />No disponible</span>
        <span><i className="sw reservada" />Reservado</span>
      </div>

      {seleccion.length > 0 && (
        <div className="cal-actions">
          <b>{seleccion.length} {seleccion.length === 1 ? 'día' : 'días'}</b>
          <span className="muted">{seleccion[0]}{seleccion.length > 1 ? ` → ${seleccion[seleccion.length - 1]}` : ''}</span>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" />
          <button className="btn" onClick={() => aplicar(true)} disabled={busy}>Marcar no disponible</button>
          <button className="btn ghost" onClick={() => aplicar(false)} disabled={busy || seleccionBloqueadas === 0}>Liberar</button>
          <button className="btn ghost xs" onClick={() => setSeleccion([])}>Limpiar</button>
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

// ---- Ficha editable de un salón ----
function SalonCard({ salon, bloqueadas, agenda, onChanged }) {
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
          <button className="btn ghost" onClick={toggleActivo} title="Cierra el salón por completo: deja de mostrarse en el sitio">
            {salon.activo ? 'Cerrar el salón' : 'Reabrir el salón'}
          </button>
        </div>
        <SalonCalendario salon={salon} bloqueadas={bloqueadas} agenda={agenda} onChanged={onChanged} />
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
          {data.salones.map((s) => (
            <SalonCard
              key={s.id}
              salon={s}
              bloqueadas={(data.bloqueadas || []).filter((b) => b.salonId === s.id)}
              agenda={(data.agenda || []).filter((a) => a.salonId === s.id)}
              onChanged={load}
            />
          ))}
        </div>
      )}

      {nueva && <ReservaModal salones={data.salones.filter((s) => s.activo)} onClose={() => setNueva(false)} onSaved={() => { setNueva(false); load(); }} />}
      {detalle && <ReservaDetalle reserva={detalle} onClose={() => setDetalle(null)} onChanged={() => { setDetalle(null); load(); }} />}
    </main>
  );
}
