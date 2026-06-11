import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Car, Clock, LogOut, Mail, Shield, Users } from 'lucide-react';
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

function Header({ user, onLogout }) {
  return (
    <header className="top">
      <a className="brand" href="/">
        <img src="/admin/assets/logo-shield.png" alt="Escudo Club Sport Herediano" />
        <span>Herediano</span>
      </a>
      <nav>
        <a href="/parqueo">Parqueo</a>
        <a href="/admin">Admin</a>
        {user && <button className="icon-text ghost" onClick={onLogout}><LogOut size={16} />Salir</button>}
      </nav>
    </header>
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
  const grouped = { A: [], B: [] };
  spaces.filter((s) => s.piso === floor).forEach((s) => grouped[s.zona]?.push(s));
  const reservationById = new Map(reservations.map((r) => [r.id, r]));
  const renderZone = (zone) => (
    <section className="zone">
      <h3>Zona {zone} · Piso {floor}</h3>
      <div className="grid">
        {grouped[zone].sort((a, b) => a.num - b.num).map((space) => {
          const reservation = reservationById.get(space.reservaId);
          const mine = reservation && reservation.userId === me?.id;
          return (
            <button
              key={space.id}
              className={`space ${space.estado} ${mine ? 'mine' : ''}`}
              onClick={() => onSpace?.(space, reservation)}
              title={admin && reservation ? `${space.id} · ${reservation.placa}` : `${space.id} · ${space.estado}`}
            >
              <span>{space.num}</span>
              {(reservation || space.reserva) && <ExpirationBar start={(reservation || space.reserva).inicio} end={(reservation || space.reserva).fin} />}
            </button>
          );
        })}
      </div>
    </section>
  );
  return (
    <div className="parking-grid">
      {renderZone('A')}
      <div className="street"><span>ENTRADA</span><b>CALLE</b></div>
      {renderZone('B')}
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
        <button className={route === '/admin/usuarios' ? 'active' : ''} onClick={() => navigate('/admin/usuarios')}><Users size={17} />Gestion de usuarios</button>
      </aside>
      <section className="admin-main">
        <Header user={user} onLogout={logout} />
        {route === '/admin/parqueo' ? <AdminParking user={user} /> : route === '/admin/usuarios' ? <AdminUsers /> : <AdminHome user={user} navigate={navigate} />}
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
  return <main className="page"><p className="eyebrow">Centro de mando</p><h1>Administracion CSH</h1><p className="sub">Sesion activa de {user.name}. Selecciona un modulo para operar.</p><div className="module-grid"><button onClick={() => navigate('/admin/parqueo')}><Car />Gestion de parqueo</button><button onClick={() => navigate('/admin/usuarios')}><Users />Gestion de usuarios</button></div></main>;
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
  return <PublicParking />;
}

createRoot(document.getElementById('root')).render(<App />);
