import React, { useState } from 'react';
import { Mail, MessageCircle, MapPin, Clock } from 'lucide-react';
import { SectionHeader } from '../components/site.jsx';
import { contacto } from '../data/club.js';

const EMPTY = { nombre: '', apellido: '', email: '', telefono: '', asunto: '', mensaje: '' };

export default function Contacto() {
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (!form.nombre.trim() || !form.email.trim() || !form.mensaje.trim()) {
      return setMsg({ type: 'error', text: 'Completá nombre, correo y mensaje.' });
    }
    setLoading(true);
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
      setLoading(false);
      if (!data.ok) return setMsg({ type: 'error', text: data.error || 'No se pudo enviar el mensaje.' });
      setMsg({ type: 'ok', text: 'Mensaje enviado. Te responderemos en un máximo de 48 horas hábiles.' });
      setForm(EMPTY);
    } catch {
      setLoading(false);
      setMsg({ type: 'error', text: 'No se pudo enviar el mensaje. Intentá más tarde.' });
    }
  }

  return (
    <main className="page section contacto">
      <p className="eyebrow">Estamos para ayudarte</p>
      <h1>Contacto</h1>
      <p className="sub">Escribinos y te responderemos en un máximo de 48 horas hábiles.</p>

      <div className="contacto-grid">
        <form className="contacto-form" onSubmit={submit}>
          <div className="two">
            <div><label>Nombre</label><input value={form.nombre} onChange={set('nombre')} /></div>
            <div><label>Apellido</label><input value={form.apellido} onChange={set('apellido')} /></div>
          </div>
          <div className="two">
            <div><label>Correo electrónico</label><input type="email" value={form.email} onChange={set('email')} /></div>
            <div><label>Teléfono (opcional)</label><input value={form.telefono} onChange={set('telefono')} /></div>
          </div>
          <label>Asunto</label>
          <input value={form.asunto} onChange={set('asunto')} />
          <label>Mensaje</label>
          <textarea rows={5} value={form.mensaje} onChange={set('mensaje')} />
          {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
          <button className="btn" disabled={loading}>{loading ? 'Enviando...' : 'Enviar mensaje'}</button>
        </form>

        <aside className="contacto-info">
          <SectionHeader title="Atención directa" />
          <div className="contacto-line"><Mail size={16} /><a href={`mailto:${contacto.general.email}`}>{contacto.general.email}</a></div>
          <div className="contacto-line"><MessageCircle size={16} /><span>{contacto.general.whatsapp}</span></div>
          <div className="contacto-line"><MapPin size={16} /><span>{contacto.general.ubicacion}</span></div>
          <div className="contacto-line"><Clock size={16} /><span>{contacto.general.horario}</span></div>

          <SectionHeader title="Socios" />
          <div className="contacto-line"><Mail size={16} /><a href={`mailto:${contacto.socios.email}`}>{contacto.socios.email}</a></div>
          <div className="contacto-line"><MessageCircle size={16} /><span>{contacto.socios.whatsapp}</span></div>
        </aside>
      </div>
    </main>
  );
}
