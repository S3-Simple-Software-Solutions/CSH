import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, LogOut, Tag, Ticket, TrendingUp, Users, X } from 'lucide-react';
import { api } from '../utils/api.js';
import { Spinner, LoadingBlock } from '../components/Loading.jsx';

function money(crc) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(crc || 0);
}

function fmtFecha(iso) {
  try {
    return new Date(iso).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const REVENTA_ESTADO_LABEL = {
  activa: 'Publicada',
  reservada: 'En pago',
  vendida: 'Vendida',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
};

// Modal para poner un boleto en reventa (precio con tope visible).
function VenderModal({ boleto, onClose, onDone }) {
  const [precio, setPrecio] = useState(String(boleto.valorNominalCrc || ''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    const value = Number(precio);
    if (!Number.isFinite(value) || value <= 0) return setError('Ingresá un precio válido.');
    setLoading(true);
    const d = await api('/api/entradas/reventa', {
      method: 'POST',
      body: JSON.stringify({ boletoId: boleto.id, precioCrc: Math.round(value) }),
    });
    setLoading(false);
    if (!d.ok) return setError(d.error || 'No se pudo publicar la reventa.');
    onDone();
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal">
        <div className="modal-head">
          <h3>Vender boleto</h3>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="muted" style={{ margin: '0 0 10px' }}>
          {boleto.eventoNombre} · {boleto.tipoNombre}{boleto.asientoLabel ? ` · ${boleto.asientoLabel}` : ''}
        </p>
        <label>Precio de venta (CRC)</label>
        <input type="number" min="1" value={precio} onChange={(e) => setPrecio(e.target.value)} autoFocus />
        <p className="muted" style={{ fontSize: '.85rem', margin: '6px 0 0' }}>
          Valor nominal: {money(boleto.valorNominalCrc)}. Al venderse, tu QR actual se invalida y se reemite al comprador.
        </p>
        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        <button className="btn" style={{ marginTop: 12 }} onClick={submit} disabled={loading}>
          {loading ? <><Spinner size={15} /> Publicando…</> : 'Publicar en reventa'}
        </button>
      </section>
    </div>
  );
}

function MiCuentaEntradas() {
  const [boletos, setBoletos] = useState([]);
  const [reventas, setReventas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [vender, setVender] = useState(null);
  const [msg, setMsg] = useState('');

  async function load() {
    const [b, r] = await Promise.all([
      api('/api/entradas/mis-boletos'),
      api('/api/entradas/mis-reventas'),
    ]);
    if (b.ok) setBoletos(b.boletos || []);
    if (r.ok) setReventas(r.reventas || []);
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function cancelar(id) {
    setMsg('');
    const d = await api(`/api/entradas/reventa/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!d.ok) { setMsg(d.error || 'No se pudo cancelar.'); return; }
    load();
  }

  return (
    <>
      <section className="profile-card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Mis boletos</p>
        <h2 style={{ marginTop: 4 }}><Ticket size={18} /> Entradas a mi nombre</h2>
        {!loaded ? (
          <LoadingBlock label="Cargando tus boletos…" />
        ) : boletos.length === 0 ? (
          <p className="muted">Todavía no tenés boletos. Cuando compres, aparecerán acá para revenderlos.</p>
        ) : (
          <div className="detail-grid" style={{ gap: 12 }}>
            {boletos.map((b) => (
              <div key={b.id} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: 12 }}>
                <b>{b.eventoNombre}</b>
                <div className="muted" style={{ fontSize: '.85rem' }}>
                  {b.tipoNombre}{b.asientoLabel ? ` · ${b.asientoLabel}` : ''} · {fmtFecha(b.eventoFecha)}
                </div>
                <div className="muted" style={{ fontSize: '.8rem', margin: '4px 0' }}>
                  Código {b.codigo} · {b.estado.toUpperCase()}
                </div>
                {b.reventa ? (
                  <span className="pill">En reventa · {money(b.reventa.precioCrc)} · {REVENTA_ESTADO_LABEL[b.reventa.estado] || b.reventa.estado}</span>
                ) : b.vendible ? (
                  <button className="btn ghost" onClick={() => setVender(b)}><Tag size={15} /> Vender</button>
                ) : (
                  <span className="muted" style={{ fontSize: '.8rem' }}>No disponible para reventa</span>
                )}
              </div>
            ))}
          </div>
        )}
        {msg && <div className="error" style={{ marginTop: 10 }}>{msg}</div>}
      </section>

      <section className="profile-card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Mis reventas</p>
        <h2 style={{ marginTop: 4 }}><Tag size={18} /> Publicaciones</h2>
        {!loaded ? (
          <LoadingBlock label="Cargando tus publicaciones…" />
        ) : reventas.length === 0 ? (
          <p className="muted">No tenés boletos publicados en reventa.</p>
        ) : (
          <div className="detail-grid" style={{ gap: 12 }}>
            {reventas.map((r) => (
              <div key={r.id} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: 12 }}>
                <b>{r.eventoNombre}</b>
                <div className="muted" style={{ fontSize: '.85rem' }}>
                  {r.tipoNombre}{r.asientoLabel ? ` · ${r.asientoLabel}` : ''}
                </div>
                <div style={{ margin: '4px 0' }}>{money(r.precioCrc)}</div>
                <span className="pill">{REVENTA_ESTADO_LABEL[r.estado] || r.estado}</span>
                {r.estado === 'activa' && (
                  <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => cancelar(r.id)}>Cancelar</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {vender && <VenderModal boleto={vender} onClose={() => setVender(null)} onDone={() => { setVender(null); load(); }} />}
    </>
  );
}

function display(value) {
  const text = String(value ?? '').trim();
  return text || '—';
}

function DetailItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <b>{display(value)}</b>
    </div>
  );
}

export default function PerfilPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api('/api/me').then((data) => {
      if (!alive) return;
      if (!data.ok || !data.user) {
        location.href = '/login?next=/mi-cuenta';
        return;
      }
      setUser(data.user);
      setLoading(false);
    }).catch(() => {
      if (!alive) return;
      setError('No se pudo cargar el perfil.');
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  async function logout() {
    await api('/admin/logout', { method: 'POST', body: '{}' });
    location.href = '/';
  }

  if (loading) {
    return (
      <main className="page profile-page">
        <LoadingBlock label="Cargando perfil…" />
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="page profile-page">
        <p className="error">{error || 'Perfil no disponible.'}</p>
        <Link className="btn ghost" to="/">Volver al inicio</Link>
      </main>
    );
  }

  const p = user.profile;
  const metricas = p?.metricas;

  return (
    <main className="page profile-page">
      <div className="profile-card">
        <p className="eyebrow">Mi cuenta</p>
        <div className="user-detail-head">
          <h1>{user.name}</h1>
          <span className={`pill ${user.status.toLowerCase()}`}>{user.status}</span>
          <span className="pill">{user.role}</span>
          <span className="muted">{user.area}</span>
        </div>

        {!p ? (
          <p className="muted">Esta cuenta no tiene perfil ampliado.</p>
        ) : (
          <>
            <h3 className="detail-section"><Users size={15} />Informacion personal</h3>
            <div className="detail-grid">
              <DetailItem label="Telefono" value={p.personal?.telefono} />
              <DetailItem label="Cedula" value={p.personal?.cedula} />
              <DetailItem label="Nacimiento" value={p.personal?.nacimiento} />
              <DetailItem label="Provincia" value={p.personal?.provincia} />
              <DetailItem label="Genero" value={p.personal?.genero} />
            </div>

            <h3 className="detail-section"><Activity size={15} />Cuenta</h3>
            <div className="detail-grid">
              <DetailItem label="Correo" value={user.email} />
              <DetailItem label="Usuario" value={user.username} />
              <DetailItem label="Registrado" value={p.app?.registrado} />
              <DetailItem label="Ultimo acceso" value={p.app?.ultimoAcceso} />
              <DetailItem label="Plataforma" value={p.app?.plataforma} />
              <DetailItem label="Notificaciones" value={p.app?.notificaciones ? 'Activas' : 'Inactivas'} />
              <DetailItem label="Sesiones (30d)" value={p.app?.sesiones30d} />
            </div>

            {p.category === 'socio' && metricas && (
              <>
                <h3 className="detail-section"><Users size={15} />Membresia</h3>
                <div className="detail-grid">
                  <DetailItem label="No. miembro" value={metricas.numeroMiembro} />
                  <DetailItem label="Membresia" value={metricas.membresia} />
                </div>
              </>
            )}

            {metricas && (
              <>
                <h3 className="detail-section">
                  <TrendingUp size={15} />
                  Metricas {p.category === 'socio' ? 'del socio' : 'del aficionado'}
                </h3>
                <div className="user-stats">
                  <div><span>Partidos</span><b>{metricas.partidosAsistidos}</b></div>
                  <div><span>Asistencia</span><b>{metricas.asistenciaPct}%</b></div>
                  <div><span>Entradas</span><b>{metricas.entradasCompradas}</b></div>
                  <div><span>Gasto total</span><b>{money(metricas.gastoTotalCrc)}</b></div>
                  <div><span>Cupones</span><b>{metricas.cuponesUsados}</b></div>
                  <div><span>Parqueo</span><b>{metricas.reservasParqueo}</b></div>
                  <div><span>Puntos</span><b>{metricas.puntosFidelidad.toLocaleString('es-CR')}</b></div>
                  <div><span>Antiguedad</span><b>{metricas.antiguedadMeses}m</b></div>
                </div>
              </>
            )}
          </>
        )}

        <div className="profile-actions">
          <Link className="btn ghost" to="/">Volver al inicio</Link>
          <button className="btn ghost" type="button" onClick={logout}>
            <LogOut size={16} />
            Cerrar sesion
          </button>
        </div>
      </div>

      <MiCuentaEntradas />
    </main>
  );
}
