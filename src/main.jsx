import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BadgePercent, Car, Clock, Globe, LogOut, Mail, Moon, Shield, Sun, Ticket, ToggleLeft, ToggleRight, Truck, Users, UtensilsCrossed } from 'lucide-react';
import './styles.css';

const money = (value) => `₡${Number(value || 0).toLocaleString('es-CR')}`;
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtFullDate = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDur = (ms) => {
  const neg = ms < 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  return `${neg ? '-' : ''}${pad(h)}:${pad(m)}:${pad(s)}`;
};
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const json = await response.json().catch(() => ({ ok: false, error: 'Respuesta invalida' }));
  if (!response.ok && json.ok !== false) json.error = 'Error de servidor';
  return json;
}

const THEME_KEY = 'csh-theme';
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}
function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  useEffect(() => { applyTheme(theme); }, [theme]);
  return (
    <button className="icon-text ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function Header({ user, onLogout }) {
  return (
    <header className="top">
      <a className="brand" href="/">
        <img src="/admin/assets/logo-shield.png" alt="Escudo Club Sport Herediano" />
        <span>Herediano</span>
      </a>
      <nav>
        <a href="/cuponera">Cuponera</a>
        <a href="/parqueo">Parqueo</a>
        <a href="/admin">Admin</a>
        <ThemeToggle />
        {user && <button className="icon-text ghost" onClick={onLogout}><LogOut size={16} />Salir</button>}
      </nav>
    </header>
  );
}

function CouponCard({ cupon, admin = false, onToggle }) {
  const pct = Math.min(100, Math.round((Number(cupon.usos || 0) / Math.max(1, Number(cupon.limite || 1))) * 100));
  return (
    <article className={`coupon ${cupon.estado}`}>
      <div className="coupon-stub">
        <img src={cupon.logo} alt={cupon.proveedor} />
        <span>{cupon.categoria}</span>
      </div>
      <div className="coupon-body">
        <div className="coupon-top">
          <span className="coupon-provider">{cupon.proveedor}</span>
          <b className={`coupon-status ${cupon.estado}`}>{cupon.estado}</b>
        </div>
        <h2>{cupon.titulo}</h2>
        <p>{cupon.descripcion}</p>
        <div className="coupon-code"><span>Codigo</span><strong>{cupon.codigo}</strong></div>
        <div className="coupon-usage">
          <div className="coupon-meter"><i className={pct >= 85 ? 'high' : ''} style={{ width: `${pct}%` }} /></div>
          <small>{cupon.usos}/{cupon.limite} usos</small>
        </div>
        <div className="coupon-foot">
          <small>Vence {fmtFullDate(cupon.vigencia)}</small>
          {admin && (
            <button className="coupon-toggle" onClick={() => onToggle?.(cupon)} title={cupon.estado === 'habilitado' ? 'Retirar cupon' : 'Habilitar cupon'}>
              {cupon.estado === 'habilitado' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {cupon.estado === 'habilitado' ? 'Retirar' : 'Habilitar'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function PublicCoupons() {
  const [state, setState] = useState({ cupones: [], stats: null });
  useEffect(() => { api('/api/cuponera/publico').then((data) => data.ok && setState({ cupones: data.cupones, stats: data.stats })); }, []);
  return (
    <>
      <Header />
      <main className="page">
        <p className="eyebrow">Modulo de cuponera</p>
        <h1>Beneficios para socios</h1>
        <p className="sub">Cupones activos de patrocinadores oficiales. Presenta el codigo en el comercio participante para aplicar el descuento.</p>
        <section className="coupon-stats">
          <div><span>Disponibles</span><b>{state.stats?.habilitados || state.cupones.length}</b></div>
          <div><span>Usos registrados</span><b>{state.stats?.usos || 0}</b></div>
          <div><span>Proveedores</span><b>{new Set(state.cupones.map((c) => c.proveedor)).size}</b></div>
        </section>
        <section className="coupon-list">
          {state.cupones.map((cupon) => <CouponCard key={cupon.id} cupon={cupon} />)}
        </section>
      </main>
    </>
  );
}

function ExpirationBar({ start, end }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const total = Math.max(1, new Date(end).getTime() - new Date(start).getTime());
  const left = new Date(end).getTime() - now;
  const pct = Math.max(0, Math.min(1, left / total));
  const cls = left <= 0 ? 'vencido' : pct <= 0.2 ? 'bajo' : pct <= 0.5 ? 'medio' : '';
  return <span className="exp"><i className={cls} style={{ width: `${pct * 100}%` }} /></span>;
}

function ParkingGrid({ spaces, floor, onSpace, admin = false, reservations = [], me }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const grouped = { A: [], B: [] };
  spaces.filter((s) => s.piso === floor).forEach((s) => grouped[s.zona]?.push(s));
  Object.values(grouped).forEach((list) => list.sort((a, b) => a.num - b.num));
  const reservationById = new Map(reservations.map((r) => [r.id, r]));
  const total = grouped.A.length + grouped.B.length;

  const stall = (space, open) => {
    const reservation = reservationById.get(space.reservaId);
    const session = reservation || space.reserva;
    const mine = reservation && reservation.userId === me?.id;
    const expired = session && new Date(session.fin).getTime() <= now;
    return (
      <button
        key={space.id}
        className={`stall ${space.estado} open-${open} ${expired ? 'vencido' : ''} ${mine ? 'mine' : ''}`}
        onClick={() => onSpace?.(space, reservation)}
        title={admin && reservation ? `${space.id} · ${reservation.placa}${expired ? ' · vencido' : ''}` : `${space.id} · ${expired ? 'tiempo vencido' : space.estado}`}
      >
        {space.estado === 'ocupado' && <Car size={11} aria-hidden />}
        <span>{space.num}</span>
        {session && <ExpirationBar start={session.inicio} end={session.fin} />}
      </button>
    );
  };
  const strip = (zone, from, to, open) => (
    <div className="stall-strip">{grouped[zone].slice(from, to).map((s) => stall(s, open))}</div>
  );
  const lane = (dir) => (
    <div className={`lane ${dir}`} aria-hidden>
      <span>{dir === 'left' ? '‹ ‹ ‹' : '› › ›'}</span>
    </div>
  );

  return (
    <div className="lot-wrap">
      <div className="lot">
        <div className="lot-banner">Nivel {floor}</div>
        <div className="lot-head"><span>Zona A</span><span /><span>Zona B</span></div>
        <div className="lot-row">
          {strip('A', 0, 25, 'down')}
          <div className="lot-core stairs"><span>Gradas</span></div>
          {strip('B', 0, 25, 'down')}
        </div>
        {lane('right')}
        <div className="lot-row">
          <div className="bay-col">
            {strip('A', 25, 50, 'up')}
            <div className="bay-divider" />
            {strip('A', 50, 75, 'down')}
          </div>
          <div className="lot-core ramp"><span>Rampa<br />{floor === 1 ? '↑ N2' : '↓ N1'}</span></div>
          <div className="bay-col">
            {strip('B', 25, 50, 'up')}
            <div className="bay-divider" />
            {strip('B', 50, 75, 'down')}
          </div>
        </div>
        {lane('left')}
        <div className="lot-row">
          {strip('A', 75, 100, 'up')}
          <div className="lot-core entry"><span>Entrada ↓</span></div>
          {strip('B', 75, 100, 'up')}
        </div>
        <div className="lot-foot">Total nivel {floor}: {total} espacios</div>
      </div>
    </div>
  );
}

function PublicParking() {
  const [spaces, setSpaces] = useState([]);
  const [floor, setFloor] = useState(1);
  const [selected, setSelected] = useState(null);
  const [plate, setPlate] = useState('');
  const [lookup, setLookup] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [modal, setModal] = useState(null);

  const refresh = async () => {
    const data = await api('/api/parqueo/publico/estado');
    if (data.ok) setSpaces(data.espacios);
  };
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, []);

  const available = spaces.filter((s) => s.piso === floor && s.estado === 'disponible').length;
  const total = spaces.filter((s) => s.piso === floor).length;

  async function search() {
    setError('');
    setLookup(null);
    const value = plate.trim().toUpperCase();
    if (!value) return setError('Ingresa la placa del vehiculo.');
    const data = await api('/api/parqueo/publico/consulta', { method: 'POST', body: JSON.stringify({ placa: value }) });
    if (!data.ok) return setError(data.error);
    setLookup(data.info);
  }
  async function resend() {
    if (!lookup) return;
    const data = await api('/api/parqueo/publico/reenviar', { method: 'POST', body: JSON.stringify({ placa: lookup.placa }) });
    if (!data.ok) return setError(data.error);
    setLookup({ ...lookup, resendMessage: `Correo reenviado a ${data.correo}.` });
  }

  return (
    <>
      <Header />
      <main className="page">
        <p className="eyebrow">Modulo de parqueo</p>
        <h1>Parqueo del estadio</h1>
        <p className="sub">Consulta disponibilidad, toma un espacio como invitado y busca tu reserva por placa.</p>
        <div className="notice">Las reservas son exclusivas para socios y personal del club. <a href="/admin">Inicia sesion</a> si tienes una cuenta.</div>

        <section className="search-panel">
          <div>
            <h2>Buscar mi Carro</h2>
            <p>Ingresa la placa para confirmar la reserva y ver el correo asociado de forma segura.</p>
            <label>Placa del vehiculo</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={12} placeholder="ABC-123" />
            <button className="btn" onClick={search}>Buscar mi Carro</button>
            {error && <div className="error">{error}</div>}
          </div>
          <ReservationResult lookup={lookup} onResend={resend} onPay={() => setPaying(true)} />
        </section>

        <Toolbar floor={floor} setFloor={setFloor} stats={`${available}/${total} libres en piso ${floor}`} />
        <ParkingGrid spaces={spaces} floor={floor} onSpace={(space) => space.estado === 'disponible' && setSelected(space)} />
      </main>
      {selected && <TakeSpaceModal space={selected} onClose={() => setSelected(null)} onDone={(m) => { setModal(m); setSelected(null); refresh(); }} />}
      {paying && lookup && <PaymentModal info={lookup} onClose={() => setPaying(false)} onDone={(receipt) => { setLookup({ receipt }); setPaying(false); refresh(); }} />}
      {modal && <MessageModal title={modal.title} text={modal.text} onClose={() => setModal(null)} />}
    </>
  );
}

function ReservationResult({ lookup, onResend, onPay }) {
  if (!lookup) return <div className="result empty">Busca una placa para ver el resultado a la par.</div>;
  if (lookup.receipt) {
    return (
      <div className="result">
        <strong>Pago registrado</strong>
        <div className="total"><span>Transaccion<br /><small>{lookup.receipt.transaccion}</small></span><b>{money(lookup.receipt.monto)}</b></div>
        <p>El espacio quedo liberado y el recibo fue enviado a {lookup.receipt.correo}.</p>
      </div>
    );
  }
  return (
    <div className="result">
      <strong>Reserva encontrada</strong>
      <div className="facts">
        <div><span>Espacio</span>{lookup.espacioId}</div>
        <div><span>Estado</span>{lookup.estado.toUpperCase()}</div>
        <div><span>Placa</span>{lookup.placa}</div>
        <div><span>Correo</span>{lookup.correo}</div>
        <div><span>Desde</span>{fmtDate(lookup.inicio)}</div>
        <div><span>Hasta</span>{fmtDate(lookup.fin)}</div>
      </div>
      <div className="total"><span>Total a pagar<br /><small>{lookup.horas}h a {money(lookup.tarifa)}/h</small></span><b>{money(lookup.monto)}</b></div>
      <div className="actions">
        <button className="btn" onClick={onPay}>Pagar parqueo</button>
        <button className="btn ghost" onClick={onResend}><Mail size={16} />Reenviar correo</button>
      </div>
      {lookup.resendMessage && <p className="ok">{lookup.resendMessage}</p>}
      <p className="security">Por seguridad, el codigo de reserva y el QR solo se muestran dentro del area autenticada.</p>
    </div>
  );
}

function Toolbar({ floor, setFloor, stats }) {
  return (
    <div className="toolbar">
      <div className="tabs">
        {[1, 2].map((p) => <button key={p} className={floor === p ? 'active' : ''} onClick={() => setFloor(p)}>Piso {p}</button>)}
      </div>
      <div className="legend">
        <span><i className="green" />Disponible</span>
        <span><i className="orange" />Reservado</span>
        <span><i className="red" />Ocupado</span>
        <span><i className="wine" />Tiempo vencido</span>
        <span>{stats}</span>
      </div>
    </div>
  );
}

function TakeSpaceModal({ space, onClose, onDone }) {
  const [form, setForm] = useState({ placa: '', duracion: '60', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit() {
    setError('');
    if (!form.placa.trim()) return setError('Ingresa la placa del vehiculo.');
    if (!form.email.trim()) return setError('Ingresa un correo para enviar el QR.');
    setLoading(true);
    const data = await api('/api/parqueo/publico/ocupar', { method: 'POST', body: JSON.stringify({ espacioId: space.id, placa: form.placa.trim().toUpperCase(), duracion: Number(form.duracion), email: form.email.trim() }) });
    setLoading(false);
    if (!data.ok) return setError(data.error);
    onDone({ title: 'Espacio tomado', text: data.sesion.emailSent ? `QR enviado a ${data.sesion.correo}.` : 'No se pudo enviar el correo ahora. La reserva quedo registrada.' });
  }
  return (
    <Modal title={space.id} onClose={onClose}>
      <p className="muted">Disponible · Piso {space.piso} · Zona {space.zona}</p>
      <label>Placa del vehiculo</label>
      <input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} maxLength={12} autoFocus />
      <label>Tiempo estimado</label>
      <select value={form.duracion} onChange={(e) => setForm({ ...form, duracion: e.target.value })}>
        <option value="30">30 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option><option value="240">4 horas</option><option value="480">8 horas</option>
      </select>
      <label>Correo para recibir el QR</label>
      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit} disabled={loading}>{loading ? 'Registrando...' : 'Tomar espacio'}</button>
    </Modal>
  );
}

function PaymentModal({ info, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', cardNumber: '', exp: '', cvv: '' });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  async function pay() {
    setMessage(null);
    setLoading(true);
    const data = await api('/api/parqueo/publico/pagar', { method: 'POST', body: JSON.stringify({ placa: info.placa, pago: form }) });
    setLoading(false);
    if (!data.ok) return setMessage({ type: 'error', text: data.error || 'No se pudo realizar la transaccion.' });
    setMessage({ type: 'ok', text: `Pago exitoso. Recibo enviado a ${data.recibo.correo}.` });
    setTimeout(() => onDone(data.recibo), 850);
  }
  return (
    <Modal title="Pagar parqueo" onClose={onClose}>
      <div className="pay-summary">Espacio <b>{info.espacioId}</b> · Placa <b>{info.placa}</b><br />Tiempo cobrado: <b>{info.horas}h</b><br />Total: <b>{money(info.monto)}</b><br />Recibo a: <b>{info.correo}</b></div>
      <label>Nombre en la tarjeta</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <label>Numero de tarjeta</label><input inputMode="numeric" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} />
      <div className="two"><div><label>Expira</label><input placeholder="MM/AA" value={form.exp} onChange={(e) => setForm({ ...form, exp: e.target.value.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2') })} /></div><div><label>CVV</label><input inputMode="numeric" value={form.cvv} onChange={(e) => setForm({ ...form, cvv: e.target.value })} /></div></div>
      {message && <div className={message.type === 'ok' ? 'okbox' : 'error'}>{message.text}</div>}
      <button className="btn" onClick={pay} disabled={loading}>{loading ? 'Procesando...' : `Pagar ${money(info.monto)}`}</button>
    </Modal>
  );
}

const WIP_MODULES = {
  '/admin/restaurantes': {
    icon: UtensilsCrossed,
    title: 'Gestion de restaurantes',
    desc: 'Administracion de los puntos de comida del estadio: locales, menus, precios e inventario por evento.',
    items: ['Catalogo de locales y menus por partido', 'Control de inventario y precios', 'Reportes de ventas por evento'],
  },
  '/admin/proveedores': {
    icon: Truck,
    title: 'Gestion de proveedores',
    desc: 'Registro y seguimiento de proveedores del club: contratos, ordenes de compra y pagos.',
    items: ['Directorio de proveedores y contactos', 'Ordenes de compra y entregas', 'Historial de contratos y pagos'],
  },
};

function UnderConstruction({ modulo }) {
  const Icon = modulo.icon;
  return (
    <main className="page">
      <p className="eyebrow">Modulo en construccion</p>
      <h1>{modulo.title}</h1>
      <p className="sub">{modulo.desc}</p>
      <div className="wip-card">
        <Icon size={36} />
        <div>
          <span className="pill">En construccion</span>
          <p>Lo que incluira este modulo:</p>
          <ul>{modulo.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
    </main>
  );
}

function AdminApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(location.pathname);
  useEffect(() => {
    api('/api/session').then((data) => { setUser(data.user); setLoading(false); });
    const onPop = () => setRoute(location.pathname);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const navigate = (path) => { history.pushState(null, '', path); setRoute(path); };
  async function logout() { await api('/admin/logout', { method: 'POST', body: '{}' }); location.href = '/admin'; }
  if (loading) return <main className="page"><p>Cargando...</p></main>;
  if (!user) return <AdminLogin />;
  return (
    <div className="admin-shell">
      <aside>
        <a className="side-brand" onClick={() => navigate('/admin')}><img src="/admin/assets/logo-shield.png" alt="" /><b>Herediano</b><span>Admin</span></a>
        <button className={route === '/admin' ? 'active' : ''} onClick={() => navigate('/admin')}><Shield size={17} />Resumen</button>
        <button className={route === '/admin/parqueo' ? 'active' : ''} onClick={() => navigate('/admin/parqueo')}><Car size={17} />Gestion de parqueo</button>
        <button className={route === '/admin/cuponera' ? 'active' : ''} onClick={() => navigate('/admin/cuponera')}><Ticket size={17} />Cuponera</button>
        <button className={route === '/admin/usuarios' ? 'active' : ''} onClick={() => navigate('/admin/usuarios')}><Users size={17} />Gestion de usuarios</button>
        <button className={route === '/admin/web' ? 'active' : ''} onClick={() => navigate('/admin/web')}><Globe size={17} />Gestion de la pagina web</button>
        {Object.entries(WIP_MODULES).map(([path, mod]) => {
          const Icon = mod.icon;
          return <button key={path} className={route === path ? 'active' : ''} onClick={() => navigate(path)}><Icon size={17} />{mod.title}</button>;
        })}
      </aside>
      <section className="admin-main">
        <Header user={user} onLogout={logout} />
        {route === '/admin/parqueo' ? <AdminParking user={user} /> : route === '/admin/cuponera' ? <AdminCoupons user={user} /> : route === '/admin/usuarios' ? <AdminUsers /> : route === '/admin/web' ? <AdminWeb /> : WIP_MODULES[route] ? <UnderConstruction modulo={WIP_MODULES[route]} /> : <AdminHome user={user} navigate={navigate} />}
      </section>
    </div>
  );
}

function AdminLogin() {
  const [form, setForm] = useState({ usuario: '', clave: '' });
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    const data = await api('/admin/sign-in', { method: 'POST', body: JSON.stringify(form) });
    if (!data.ok) return setError(data.error);
    location.href = '/admin';
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <img src="/admin/assets/logo-shield.png" alt="" />
        <h1>Club Sport Herediano</h1>
        <label>Usuario o correo</label><input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} autoFocus />
        <label>Contrasena</label><input type="password" value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} />
        {error && <div className="error">{error}</div>}
        <button className="btn">Entrar</button>
      </form>
    </main>
  );
}

function AdminHome({ user, navigate }) {
  return (
    <main className="page">
      <p className="eyebrow">Centro de mando</p>
      <h1>Administracion CSH</h1>
      <p className="sub">Sesion activa de {user.name}. Selecciona un modulo para operar.</p>
      <div className="module-grid">
        <button onClick={() => navigate('/admin/parqueo')}><Car />Gestion de parqueo</button>
        <button onClick={() => navigate('/admin/cuponera')}><BadgePercent />Cuponera</button>
        <button onClick={() => navigate('/admin/usuarios')}><Users />Gestion de usuarios</button>
        <button onClick={() => navigate('/admin/web')}><Globe />Gestion de la pagina web</button>
        {Object.entries(WIP_MODULES).map(([path, mod]) => {
          const Icon = mod.icon;
          return <button key={path} className="wip" onClick={() => navigate(path)}><Icon /><span>{mod.title}<small>En construccion</small></span></button>;
        })}
      </div>
    </main>
  );
}

const HERO_ORIGINAL_IMG = '/_next/image?url=%2Fbrand%2Fhero%2Fchampions-bw.jpg&w=1200&q=75&dpl=dpl_2yZw8b3Benaf9j1imRXmBqppL4z9';

function AdminWeb() {
  const [config, setConfig] = useState(null);
  const [defaults, setDefaults] = useState({});
  const [form, setForm] = useState({ kicker: '', title: '', number: '', sub: '' });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await api('/admin/api/web');
    if (!data.ok) return setMsg({ type: 'error', text: data.error || 'No se pudo cargar la configuracion' });
    setConfig(data.config);
    setDefaults(data.defaults);
    setForm({
      kicker: data.config.kicker || data.defaults.kicker,
      title: data.config.title || data.defaults.title,
      number: data.config.number || data.defaults.number,
      sub: data.config.sub || data.defaults.sub,
    });
  };
  useEffect(() => { load(); }, []);

  async function saveTexts() {
    setMsg(null);
    setSaving(true);
    const data = await api('/admin/api/web', { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setConfig(data.config);
    setMsg({ type: 'ok', text: 'Textos del hero guardados. Ya estan visibles en el sitio.' });
  }
  async function uploadImage(file) {
    if (!file) return;
    setMsg(null);
    setSaving(true);
    const response = await fetch('/admin/api/web/hero-imagen', { method: 'POST', headers: { 'content-type': file.type }, body: file });
    const data = await response.json().catch(() => ({ ok: false, error: 'Respuesta invalida' }));
    setSaving(false);
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setConfig(data.config);
    setMsg({ type: 'ok', text: 'Imagen de fondo actualizada.' });
  }
  async function removeImage() {
    setMsg(null);
    const data = await api('/admin/api/web/hero-imagen', { method: 'DELETE' });
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setConfig(data.config);
    setMsg({ type: 'ok', text: 'Se restauro la imagen original del sitio.' });
  }
  function restoreTexts() { setForm({ ...defaults }); }

  if (!config) return <main className="page"><p>Cargando...</p></main>;
  const heroImg = config.imageVersion ? `/site-assets/hero?v=${config.imageVersion}` : HERO_ORIGINAL_IMG;
  return (
    <main className="page">
      <p className="eyebrow">Contenido del sitio publico</p>
      <h1>Gestion de la pagina web</h1>
      <p className="sub">Edita el hero de la portada: la imagen de fondo y sus textos. Los cambios se aplican de inmediato en el sitio.</p>
      {msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}
      <div className="web-editor">
        <section className="hero-preview" style={{ backgroundImage: `url(${heroImg})` }}>
          <div className="hero-preview-body">
            <span className="hero-kicker">{form.kicker}</span>
            <strong className="hero-title">{form.title}<b>{form.number}</b></strong>
            <em className="hero-sub">{form.sub}</em>
          </div>
          <span className="hero-tag">{config.imageVersion ? 'Imagen personalizada' : 'Imagen original'}</span>
        </section>
        <section className="web-form">
          <h2>Textos del hero</h2>
          <label>Linea superior</label>
          <input value={form.kicker} onChange={(e) => setForm({ ...form, kicker: e.target.value })} maxLength={120} />
          <div className="two">
            <div>
              <label>Titulo</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={40} />
            </div>
            <div>
              <label>Numero</label>
              <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} maxLength={10} />
            </div>
          </div>
          <label>Frase</label>
          <input value={form.sub} onChange={(e) => setForm({ ...form, sub: e.target.value })} maxLength={120} />
          <div className="actions left">
            <button className="btn" onClick={saveTexts} disabled={saving}>{saving ? 'Guardando...' : 'Guardar textos'}</button>
            <button className="btn ghost" onClick={restoreTexts}>Restaurar originales</button>
          </div>
          <h2 className="web-form-img">Imagen de fondo</h2>
          <p className="muted">PNG, JPG, WebP o AVIF · maximo 8 MB. Se recomienda una foto horizontal de al menos 1920px.</p>
          <div className="actions left">
            <label className="btn ghost file-btn">
              Subir imagen
              <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(e) => { uploadImage(e.target.files[0]); e.target.value = ''; }} />
            </label>
            {config.imageVersion && <button className="btn ghost" onClick={removeImage}>Quitar imagen personalizada</button>}
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [target, setTarget] = useState(null);
  useEffect(() => { api('/admin/api/users').then((data) => data.ok && setUsers(data.users)); }, []);
  return (
    <main className="page">
      <p className="eyebrow">Cuentas y permisos</p><h1>Gestion de usuarios</h1>
      <div className="table"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Area</th><th>Estado</th><th></th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.area}</td><td><span className="pill">{u.status}</span></td><td><button className="btn ghost" onClick={() => setTarget(u)}>Cambiar clave</button></td></tr>)}</tbody></table></div>
      {target && <PasswordModal user={target} onClose={() => setTarget(null)} />}
    </main>
  );
}
function PasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  async function save() {
    if (password.length < 8) return setMsg({ type: 'error', text: 'La contrasena debe tener al menos 8 caracteres.' });
    if (password !== confirm) return setMsg({ type: 'error', text: 'Las contrasenas no coinciden.' });
    const data = await api('/admin/api/users/password', { method: 'POST', body: JSON.stringify({ userId: user.id, password }) });
    if (!data.ok) return setMsg({ type: 'error', text: data.error });
    setMsg({ type: 'ok', text: `Clave actualizada para ${user.name}.` });
  }
  return <Modal title="Cambiar clave" onClose={onClose}><p className="muted">{user.email}</p><label>Nueva contrasena</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><label>Confirmar</label><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />{msg && <div className={msg.type === 'ok' ? 'okbox' : 'error'}>{msg.text}</div>}<button className="btn" onClick={save}>Guardar clave</button></Modal>;
}

function AdminParking({ user }) {
  const [state, setState] = useState({ espacios: [], reservas: [] });
  const [events, setEvents] = useState([]);
  const [floor, setFloor] = useState(1);
  const [modal, setModal] = useState(null);
  const refresh = async () => {
    const data = await api('/admin/api/parqueo/estado');
    if (data.ok) setState({ espacios: data.espacios, reservas: data.reservas });
  };
  const loadEvents = async () => {
    const data = await api('/admin/api/parqueo/eventos?limit=50');
    if (data.ok) setEvents(data.eventos);
  };
  useEffect(() => { refresh(); loadEvents(); const id = setInterval(refresh, 60000); return () => clearInterval(id); }, []);
  const available = state.espacios.filter((s) => s.piso === floor && s.estado === 'disponible').length;
  const total = state.espacios.filter((s) => s.piso === floor).length;
  async function afterAction(promise) {
    const data = await promise;
    if (!data.ok) return setModal({ error: data.error });
    setModal(null); refresh(); loadEvents();
  }
  return (
    <main className="page">
      <p className="eyebrow">Zonas y reservas</p><h1>Gestion de parqueo</h1>
      <Toolbar floor={floor} setFloor={setFloor} stats={`${available}/${total} libres en piso ${floor}`} />
      <ParkingGrid spaces={state.espacios} reservations={state.reservas} floor={floor} me={user} admin onSpace={(space, reservation) => setModal({ space, reservation })} />
      <section className="events"><h2>Log de eventos</h2><div className="table"><table><thead><tr><th>Fecha/Hora</th><th>Tipo</th><th>Espacio</th><th>Placa</th><th>Usuario</th><th>Notas</th></tr></thead><tbody>{events.map((e) => <tr key={e.id}><td>{fmtFullDate(e.timestamp)}</td><td>{e.tipo}</td><td>{e.espacioId}</td><td>{e.placa}</td><td>{e.userName}</td><td>{e.notas}</td></tr>)}</tbody></table></div></section>
      {modal && <AdminSpaceModal modal={modal} user={user} onClose={() => setModal(null)} afterAction={afterAction} />}
    </main>
  );
}

function AdminCoupons({ user }) {
  const [state, setState] = useState({ cupones: [], eventos: [], stats: {}, role: 'socio', sponsor: '' });
  const [message, setMessage] = useState(null);
  const refresh = async () => {
    const data = await api('/admin/api/cuponera');
    if (data.ok) setState(data);
  };
  useEffect(() => { refresh(); }, []);
  async function toggle(cupon) {
    setMessage(null);
    const estado = cupon.estado === 'habilitado' ? 'retirado' : 'habilitado';
    const data = await api(`/admin/api/cuponera/${cupon.id}/estado`, { method: 'POST', body: JSON.stringify({ estado }) });
    if (!data.ok) return setMessage({ type: 'error', text: data.error });
    setMessage({ type: 'ok', text: `${cupon.proveedor}: cupon ${estado}.` });
    refresh();
  }
  const canManage = state.role === 'admin' || state.role === 'patrocinador';
  return (
    <main className="page">
      <p className="eyebrow">Beneficios y proveedores</p><h1>Cuponera</h1>
      <p className="sub">{state.role === 'patrocinador' ? `Panel de patrocinador para ${state.sponsor}.` : 'Panel administrativo para revisar, retirar o habilitar cupones de descuento.'}</p>
      <section className="coupon-stats">
        <div><span>Total</span><b>{state.stats.total || 0}</b></div>
        <div><span>Habilitados</span><b>{state.stats.habilitados || 0}</b></div>
        <div><span>Retirados</span><b>{state.stats.retirados || 0}</b></div>
      </section>
      {message && <div className={message.type === 'ok' ? 'okbox' : 'error'}>{message.text}</div>}
      <section className="coupon-list admin-coupons">
        {state.cupones.map((cupon) => <CouponCard key={cupon.id} cupon={cupon} admin={canManage} onToggle={toggle} />)}
      </section>
      <section className="events"><h2>Actividad de cupones</h2><div className="table"><table><thead><tr><th>Fecha/Hora</th><th>Proveedor</th><th>Cupon</th><th>Estado</th><th>Usuario</th></tr></thead><tbody>{state.eventos.map((e) => <tr key={e.id}><td>{fmtFullDate(e.timestamp)}</td><td>{e.proveedor}</td><td>{e.cuponId}</td><td>{e.estado}</td><td>{e.userName}</td></tr>)}</tbody></table></div></section>
    </main>
  );
}

function AdminSpaceModal({ modal, user, onClose, afterAction }) {
  const { space, reservation } = modal;
  const [plate, setPlate] = useState('');
  const [duration, setDuration] = useState('60');
  const [email, setEmail] = useState('');
  if (modal.error) return <MessageModal title="Error" text={modal.error} onClose={onClose} />;
  if (space.estado === 'disponible') {
    return <Modal title={space.id} onClose={onClose}><p className="muted">Disponible · Piso {space.piso} · Zona {space.zona}</p><label>Placa</label><input value={plate} onChange={(e) => setPlate(e.target.value)} /><label>Duracion</label><select value={duration} onChange={(e) => setDuration(e.target.value)}><option value="30">30 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option><option value="240">4 horas</option></select><button className="btn" onClick={() => afterAction(api('/admin/api/parqueo/reservar', { method: 'POST', body: JSON.stringify({ espacioId: space.id, placa: plate.trim().toUpperCase(), duracion: Number(duration) }) }))}>Reservar</button></Modal>;
  }
  return (
    <Modal title={space.id} onClose={onClose}>
      <div className="facts single"><div><span>Estado</span>{reservation?.estado?.toUpperCase()}</div><div><span>Placa</span>{reservation?.placa}</div><div><span>Usuario</span>{reservation?.userName}</div><div><span>Codigo</span>{reservation?.codigo}</div><div><span>Desde</span>{reservation && fmtFullDate(reservation.inicio)}</div><div><span>Hasta</span>{reservation && fmtFullDate(reservation.fin)}</div></div>
      <div className="actions">
        {user.parkingRole === 'admin' && reservation?.estado === 'reservado' && <button className="btn" onClick={() => afterAction(api('/admin/api/parqueo/ocupar', { method: 'POST', body: JSON.stringify({ reservaId: reservation.id }) }))}>Marcar ocupado</button>}
        <button className="btn ghost" onClick={() => afterAction(api('/admin/api/parqueo/extender', { method: 'POST', body: JSON.stringify({ reservaId: reservation.id, minutos: 30 }) }))}><Clock size={16} />Extender +30</button>
        <button className="btn ghost" onClick={() => afterAction(api('/admin/api/parqueo/liberar', { method: 'POST', body: JSON.stringify({ espacioId: space.id }) }))}>Liberar</button>
      </div>
      <label>Correo para reenviar QR</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn ghost" onClick={() => afterAction(api('/admin/api/parqueo/enviar-qr', { method: 'POST', body: JSON.stringify({ reservaId: reservation.id, email }) }))}><Mail size={16} />Enviar QR</button>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal"><div className="modal-head"><h3>{title}</h3><button onClick={onClose}>×</button></div>{children}</section></div>;
}
function MessageModal({ title, text, onClose }) {
  return <Modal title={title} onClose={onClose}><p>{text}</p><button className="btn" onClick={onClose}>Listo</button></Modal>;
}

function App() {
  const path = location.pathname;
  if (path.startsWith('/admin')) return <AdminApp />;
  if (path.startsWith('/cuponera')) return <PublicCoupons />;
  return <PublicParking />;
}

applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
createRoot(document.getElementById('root')).render(<App />);
