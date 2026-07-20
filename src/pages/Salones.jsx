import React, { useEffect, useMemo, useState } from 'react';
import { Users, MapPin, Check, CalendarDays } from 'lucide-react';
import { api } from '../utils/api.js';

const money = (crc) => new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(crc || 0);
const hoy = () => new Date().toISOString().slice(0, 10);

const FORM_INICIAL = {
  salonId: '', clienteNombre: '', clienteEmail: '', clienteTelefono: '', tipoEvento: '',
  fecha: '', horaInicio: '09:00', horaFin: '13:00', personas: '', notas: '',
};

// Alquiler de salones: catálogo público + solicitud de cotización. No cobra en
// línea; el club confirma la reserva desde el panel.
export default function Salones() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(null);

  useEffect(() => {
    api('/api/venues/salones').then((d) => {
      if (!d.ok) return setError(d.error || 'No se pudo cargar la información.');
      setData(d);
      setForm((f) => ({ ...f, salonId: f.salonId || d.salones[0]?.id || '' }));
    });
  }, []);

  const salon = data?.salones.find((s) => s.id === form.salonId) || null;

  // Días ya comprometidos del salón elegido, para avisar antes de enviar.
  const ocupadasSalon = useMemo(
    () => (data?.ocupadas || []).filter((o) => o.salonId === form.salonId && o.fecha >= hoy()),
    [data, form.salonId],
  );
  const choque = ocupadasSalon.some((o) => o.fecha === form.fecha && o.horaInicio < form.horaFin && o.horaFin > form.horaInicio);

  // Días que el club cerró a mano para ese salón: no se pueden solicitar.
  const bloqueadasSalon = useMemo(
    () => (data?.bloqueadas || []).filter((b) => b.salonId === form.salonId && b.fecha >= hoy()).map((b) => b.fecha),
    [data, form.salonId],
  );
  const diaCerrado = bloqueadasSalon.includes(form.fecha);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setError('');
    const d = await api('/api/venues/solicitudes', {
      method: 'POST',
      body: JSON.stringify({ ...form, personas: Number(form.personas) || 0 }),
    });
    setEnviando(false);
    if (!d.ok) return setError(d.error || 'No se pudo enviar la solicitud.');
    setOk(d);
    setForm({ ...FORM_INICIAL, salonId: form.salonId });
  }

  if (error && !data) return <main className="page"><p className="eyebrow">Alquiler de salones</p><h1>No disponible</h1><p className="sub">{error}</p></main>;
  if (!data) return <main className="page"><p>Cargando…</p></main>;

  return (
    <main className="page">
      <p className="eyebrow">Alquiler de espacios</p>
      <h1>Salones del club</h1>
      <p className="sub">Alquilá nuestros salones para reuniones, capacitaciones y celebraciones. Enviá tu solicitud y el club te confirma disponibilidad y precio.</p>

      <div className="salon-cards">
        {data.salones.map((s) => (
          <article key={s.id} className={`salon-card${form.salonId === s.id ? ' selected' : ''}`}>
            {s.imagenUrl ? <img className="salon-card-img" src={s.imagenUrl} alt={`Foto de ${s.nombre}`} loading="lazy" /> : <div className="salon-card-img empty" />}
            <div className="salon-card-body">
              <div className="salon-card-title"><b>{s.nombre}</b></div>
              <p className="muted" style={{ margin: '2px 0' }}>
                <MapPin size={13} /> {s.ubicacion || 'Estadio Eladio Rosabal Cordero'} · <Users size={13} /> hasta {s.capacidad} personas
              </p>
              <p style={{ margin: '2px 0' }}>{money(s.tarifaHoraCrc)} por hora · {money(s.tarifaDiaCrc)} el día completo</p>
              {s.descripcion && <p className="muted">{s.descripcion}</p>}
              {s.amenidades?.length > 0 && (
                <ul className="salon-amenidades">
                  {s.amenidades.map((a) => <li key={a}><Check size={13} />{a}</li>)}
                </ul>
              )}
              <div className="salon-card-actions">
                <button className="btn" onClick={() => setForm({ ...form, salonId: s.id })}>
                  {form.salonId === s.id ? 'Seleccionado' : 'Cotizar este salón'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {ok ? (
        <div className="okbox" style={{ marginTop: 24 }}>
          <b>¡Listo!</b> Recibimos tu solicitud <b>{ok.codigo}</b>. El club te contacta para confirmar disponibilidad y precio.
          {ok.ocupado && <p className="muted" style={{ margin: '6px 0 0' }}>Ojo: ese horario ya tiene una reserva confirmada, así que quizá te propongan otra fecha.</p>}
          <p style={{ margin: '10px 0 0' }}><button className="btn ghost" onClick={() => setOk(null)}>Enviar otra solicitud</button></p>
        </div>
      ) : (
        <form className="salon-form" onSubmit={enviar}>
          <h2>Solicitar cotización</h2>
          <label>Salón</label>
          <select value={form.salonId} onChange={(e) => setForm({ ...form, salonId: e.target.value })} required>
            {data.salones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <label>Nombre completo *</label>
          <input value={form.clienteNombre} onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })} required />
          <div className="two">
            <div><label>Correo *</label><input type="email" value={form.clienteEmail} onChange={(e) => setForm({ ...form, clienteEmail: e.target.value })} required /></div>
            <div><label>Teléfono</label><input value={form.clienteTelefono} onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value })} /></div>
          </div>
          <label>Tipo de evento</label>
          <input value={form.tipoEvento} onChange={(e) => setForm({ ...form, tipoEvento: e.target.value })} placeholder="Cumpleaños, capacitación, conferencia…" />
          <div className="two">
            <div><label>Fecha *</label><input type="date" min={hoy()} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></div>
            <div><label>Personas</label><input type="number" min="1" max={salon?.capacidad || undefined} value={form.personas} onChange={(e) => setForm({ ...form, personas: e.target.value })} /></div>
          </div>
          <div className="two">
            <div><label>Desde *</label><input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} required /></div>
            <div><label>Hasta *</label><input type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} required /></div>
          </div>
          <label>Contanos del evento</label>
          <textarea rows={3} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          {diaCerrado && <div className="error">El {form.fecha} el salón no está disponible. Elegí otra fecha.</div>}
          {!diaCerrado && choque && <div className="okbox warn">Ese horario ya está reservado en {salon?.nombre}. Podés enviar la solicitud igual y el club te propone alternativas.</div>}
          {error && <div className="error">{error}</div>}
          <button className="btn" disabled={enviando || diaCerrado}>{enviando ? 'Enviando…' : 'Enviar solicitud'}</button>

          {(ocupadasSalon.length > 0 || bloqueadasSalon.length > 0) && (
            <div className="salon-ocupadas">
              <h3><CalendarDays size={15} /> Fechas no disponibles</h3>
              <ul>
                {bloqueadasSalon.slice(0, 8).map((f) => <li key={f}>{f} · todo el día</li>)}
                {ocupadasSalon.slice(0, 8).map((o, i) => <li key={i}>{o.fecha} · {o.horaInicio}–{o.horaFin}</li>)}
              </ul>
            </div>
          )}
        </form>
      )}
    </main>
  );
}
