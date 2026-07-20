import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Ban, CalendarDays, CheckCircle2, Clock, LogOut, ShieldCheck, Tag, Ticket, TrendingUp, Users, X } from 'lucide-react';
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

// Badge de estado de una reventa con color e icono según etapa.
function ReventaBadge({ estado }) {
  const label = REVENTA_ESTADO_LABEL[estado] || estado;
  const icon = estado === 'vendida' ? <CheckCircle2 size={13} />
    : estado === 'reservada' ? <Clock size={13} />
    : estado === 'cancelada' || estado === 'expirada' ? <Ban size={13} />
    : <Tag size={13} />;
  return <span className={`rev-badge rev-badge--${estado}`}>{icon}{label}</span>;
}

// Línea de progreso Publicada → En pago → Vendida. Estados terminales negativos
// (cancelada/expirada) no muestran timeline.
const REVENTA_PASOS = [
  { key: 'activa', label: 'Publicada' },
  { key: 'reservada', label: 'En pago' },
  { key: 'vendida', label: 'Vendida' },
];
function ReventaTimeline({ estado }) {
  if (estado === 'cancelada' || estado === 'expirada') return null;
  const idx = REVENTA_PASOS.findIndex((p) => p.key === estado);
  return (
    <div className="rev-timeline" aria-hidden="true">
      {REVENTA_PASOS.map((p, i) => (
        <React.Fragment key={p.key}>
          <span className={`rev-step${i <= idx ? ' is-done' : ''}${i === idx ? ' is-current' : ''}`}>
            <em />{p.label}
          </span>
          {i < REVENTA_PASOS.length - 1 && <span className={`rev-line${i < idx ? ' is-done' : ''}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// Modal para poner un boleto en reventa: tarjeta del boleto + desglose en vivo
// del cargo del comprador y, sobre todo, el neto que recibe el vendedor.
function VenderModal({ boleto, config, onClose, onDone }) {
  const nominal = Math.max(0, Math.round(boleto.valorNominalCrc || 0));
  const topeNominal = config?.topeNominal !== false; // por defecto se limita al nominal
  const feeCompradorPct = Number(config?.feeCompradorPct || 0);
  const feeVendedorPct = Number(config?.feeVendedorPct || 0);
  const [precio, setPrecio] = useState(String(nominal || ''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const value = Math.max(0, Math.round(Number(precio) || 0));
  const feeComprador = Math.round((value * feeCompradorPct) / 100);
  const feeVendedor = Math.round((value * feeVendedorPct) / 100);
  const compradorPaga = value + feeComprador;
  const vosRecibis = Math.max(0, value - feeVendedor);
  const excedeTope = topeNominal && nominal > 0 && value > nominal;
  const sliderMax = topeNominal && nominal > 0 ? nominal : Math.max(nominal * 2, value, 1000);

  async function submit() {
    setError('');
    if (!Number.isFinite(value) || value <= 0) return setError('Ingresá un precio válido.');
    if (excedeTope) return setError(`El precio no puede superar el valor nominal (${money(nominal)}).`);
    setLoading(true);
    const d = await api('/api/entradas/reventa', {
      method: 'POST',
      body: JSON.stringify({ boletoId: boleto.id, precioCrc: value }),
    });
    setLoading(false);
    if (!d.ok) return setError(d.error || 'No se pudo publicar la reventa.');
    onDone();
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal rev-sell-modal">
        <div className="modal-head">
          <h3>Vender boleto</h3>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="rev-ticket">
          <div className="rev-ticket-stub"><Ticket size={22} /></div>
          <div className="rev-ticket-body">
            <b>{boleto.eventoNombre}</b>
            <span>{boleto.tipoNombre}{boleto.asientoLabel ? ` · ${boleto.asientoLabel}` : ''}</span>
            <span className="muted"><CalendarDays size={12} /> {fmtFecha(boleto.eventoFecha)}</span>
          </div>
        </div>

        <label className="rev-field-label">Precio de venta</label>
        <div className="rev-price-input">
          <span>₡</span>
          <input type="number" min="1" max={topeNominal && nominal ? nominal : undefined} value={precio}
            onChange={(e) => setPrecio(e.target.value)} autoFocus />
        </div>
        <input className="rev-slider" type="range" min="0" max={sliderMax} step="500"
          value={Math.min(value, sliderMax)} onChange={(e) => setPrecio(e.target.value)} />
        <div className="rev-price-hint">
          <span className="muted">Valor nominal {money(nominal)}</span>
          {topeNominal
            ? <span className="muted">Tope: valor nominal</span>
            : <span className="muted">Sin tope</span>}
        </div>

        <div className="rev-breakdown">
          <div className="rev-row"><span>Precio de venta</span><b>{money(value)}</b></div>
          {feeCompradorPct > 0 && (
            <div className="rev-row muted"><span>+ Cargo del comprador ({feeCompradorPct}%)</span><b>{money(feeComprador)}</b></div>
          )}
          <div className="rev-row rev-row--sub"><span>El comprador paga</span><b>{money(compradorPaga)}</b></div>
          {feeVendedorPct > 0 && (
            <div className="rev-row muted"><span>− Comisión de plataforma ({feeVendedorPct}%)</span><b>−{money(feeVendedor)}</b></div>
          )}
          <div className="rev-net">
            <span>Vos recibís</span>
            <b>{money(vosRecibis)}</b>
          </div>
        </div>

        <p className="rev-note"><ShieldCheck size={14} /> Al venderse, tu QR se invalida y se reemite a nombre del comprador. El pago se liquida de forma manual.</p>

        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        <button className="btn rev-sell-cta" onClick={submit} disabled={loading || value <= 0 || excedeTope}>
          {loading ? <><Spinner size={15} /> Publicando…</> : <><Tag size={16} /> Publicar en reventa</>}
        </button>
      </section>
    </div>
  );
}

function MiCuentaEntradas() {
  const [boletos, setBoletos] = useState([]);
  const [reventas, setReventas] = useState([]);
  const [config, setConfig] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [vender, setVender] = useState(null);
  const [confirm, setConfirm] = useState(''); // id de reventa en confirmación de cancelar
  const [msg, setMsg] = useState('');

  async function load() {
    const [b, r] = await Promise.all([
      api('/api/entradas/mis-boletos'),
      api('/api/entradas/mis-reventas'),
    ]);
    if (b.ok) { setBoletos(b.boletos || []); setConfig(b.reventaConfig || null); }
    if (r.ok) setReventas(r.reventas || []);
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function cancelar(id) {
    setMsg('');
    const d = await api(`/api/entradas/reventa/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setConfirm('');
    if (!d.ok) { setMsg(d.error || 'No se pudo cancelar.'); return; }
    load();
  }

  const activas = reventas.filter((r) => r.estado === 'activa' || r.estado === 'reservada');
  const historial = reventas.filter((r) => r.estado !== 'activa' && r.estado !== 'reservada');

  return (
    <>
      <section className="profile-card" style={{ marginTop: 18 }}>
        <p className="eyebrow">Mis boletos</p>
        <h2 style={{ marginTop: 4 }}><Ticket size={18} /> Entradas a mi nombre</h2>
        {!loaded ? (
          <LoadingBlock label="Cargando tus boletos…" />
        ) : boletos.length === 0 ? (
          <div className="rev-empty">
            <Ticket size={26} />
            <p>Todavía no tenés boletos. Cuando compres, aparecerán acá para revenderlos.</p>
            <Link className="btn ghost" to="/entradas">Ver eventos</Link>
          </div>
        ) : (
          <div className="rev-cards">
            {boletos.map((b) => (
              <div key={b.id} className="rev-card">
                <div className="rev-card-main">
                  <b>{b.eventoNombre}</b>
                  <span className="rev-card-meta">{b.tipoNombre}{b.asientoLabel ? ` · ${b.asientoLabel}` : ''}</span>
                  <span className="rev-card-meta muted"><CalendarDays size={12} /> {fmtFecha(b.eventoFecha)}</span>
                  <span className="rev-code">{b.codigo}</span>
                </div>
                <div className="rev-card-side">
                  {b.reventa ? (
                    <>
                      <ReventaBadge estado={b.reventa.estado} />
                      <span className="rev-card-price">{money(b.reventa.precioCrc)}</span>
                    </>
                  ) : b.vendible ? (
                    <button className="btn ghost rev-vender-btn" onClick={() => setVender(b)}><Tag size={15} /> Vender</button>
                  ) : (
                    <span className="muted" style={{ fontSize: '.8rem' }}>No disponible</span>
                  )}
                </div>
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
          <div className="rev-empty">
            <Tag size={26} />
            <p>No tenés boletos publicados en reventa. Poné uno a la venta desde “Mis boletos”.</p>
          </div>
        ) : (
          <div className="rev-listings">
            {[...activas, ...historial].map((r) => (
              <div key={r.id} className={`rev-listing${r.estado === 'cancelada' || r.estado === 'expirada' ? ' is-muted' : ''}`}>
                <div className="rev-listing-head">
                  <div>
                    <b>{r.eventoNombre}</b>
                    <span className="rev-card-meta">{r.tipoNombre}{r.asientoLabel ? ` · ${r.asientoLabel}` : ''}</span>
                  </div>
                  <ReventaBadge estado={r.estado} />
                </div>
                <ReventaTimeline estado={r.estado} />
                <div className="rev-listing-foot">
                  <span className="rev-card-price">{money(r.precioCrc)}</span>
                  {r.estado === 'activa' && (
                    confirm === r.id ? (
                      <span className="rev-confirm">
                        ¿Cancelar?
                        <button className="btn ghost danger" onClick={() => cancelar(r.id)}>Sí, cancelar</button>
                        <button className="btn ghost" onClick={() => setConfirm('')}>No</button>
                      </span>
                    ) : (
                      <button className="btn ghost" onClick={() => setConfirm(r.id)}>Cancelar</button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {vender && <VenderModal boleto={vender} config={config} onClose={() => setVender(null)} onDone={() => { setVender(null); load(); }} />}
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
