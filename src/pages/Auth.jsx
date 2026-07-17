import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Check, CheckCircle2 } from 'lucide-react';
import { api } from '../utils/api.js';
import { Spinner } from '../components/Loading.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export function isAdminUser(user) {
  if (!user) return false;
  return (
    user.isSuperAdmin ||
    user.role === 'admin' ||
    user.parkingRole === 'admin' ||
    user.couponRole === 'admin' ||
    user.couponRole === 'patrocinador' ||
    (user.eventsRole && user.eventsRole !== 'ninguno') ||
    (user.restaurantRole && user.restaurantRole !== 'ninguno')
  );
}

function sanitizeUsername(value) {
  return value
    .toLowerCase()
    .replace(/[\s.\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 32);
}

function PasswordInput({ value, onChange, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} {...rest} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function FieldHint({ ok, bad, children }) {
  return (
    <p className={`field-hint${ok ? ' ok' : ''}${bad ? ' bad' : ''}`}>
      {ok && <Check size={13} />}
      <span>{children}</span>
    </p>
  );
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ usuario: '', clave: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function redirectAfterLogin(sessionUser) {
    const next = searchParams.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      location.href = next;
      return;
    }
    location.href = isAdminUser(sessionUser) ? '/admin' : '/';
  }

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const data = await api('/admin/sign-in', { method: 'POST', body: JSON.stringify(form) });
      if (!data.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }
      redirectAfterLogin(data.user);
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      setLoading(false);
    }
  }
  return (
    <main className="login">
      <form onSubmit={submit} className="auth-card">
        <img src="/brand/logo-shield.png" alt="" />
        <h1>Club Sport Herediano</h1>
        <label htmlFor="login-usuario">Usuario o correo</label>
        <input
          id="login-usuario"
          name="username"
          value={form.usuario}
          onChange={(e) => setForm({ ...form, usuario: e.target.value })}
          autoFocus
          disabled={loading}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <label htmlFor="login-clave">Contrasena</label>
        <PasswordInput
          id="login-clave"
          name="password"
          value={form.clave}
          onChange={(e) => setForm({ ...form, clave: e.target.value })}
          disabled={loading}
          autoComplete="current-password"
        />
        {error && <div className="error" key={error} role="alert">{error}</div>}
        <button className={`btn${loading ? ' is-loading' : ''}`} disabled={loading}>
          {loading ? <><Spinner size={16} /> Entrando…</> : 'Entrar'}
        </button>
        <p className="auth-switch">
          ¿No tienes cuenta? <Link to="/registro">Crear cuenta</Link>
        </p>
      </form>
    </main>
  );
}

export function RegistroPage() {
  const [form, setForm] = useState({ nombre: '', email: '', username: '', clave: '', confirmar: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const nombreOk = form.nombre.trim().length >= 2 && form.nombre.trim().length <= 80;
  const emailOk = EMAIL_RE.test(form.email.trim());
  const userOk = USERNAME_RE.test(form.username);
  const claveOk = form.clave.length >= 8;
  const confirmOk = claveOk && form.confirmar === form.clave;

  function onEmailChange(e) {
    setForm((f) => ({ ...f, email: e.target.value }));
  }

  function onUsernameChange(e) {
    setForm((f) => ({ ...f, username: sanitizeUsername(e.target.value) }));
  }

  async function submit(e) {
    e.preventDefault();
    if (loading || success) return;
    setSubmitted(true);
    setError('');
    if (!nombreOk) return setError('Escribe tu nombre completo (minimo 2 caracteres)');
    if (!emailOk) return setError('Correo electronico invalido');
    if (!userOk) return setError('El usuario debe tener entre 3 y 32 caracteres (letras, numeros y _)');
    if (!claveOk) return setError('La contrasena debe tener al menos 8 caracteres');
    if (!confirmOk) return setError('Las contrasenas no coinciden');
    setLoading(true);
    try {
      const data = await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          nombre: form.nombre,
          email: form.email,
          username: form.username,
          clave: form.clave,
        }),
      });
      if (!data.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => { location.href = '/'; }, 1400);
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="login">
        <div className="auth-card auth-success" role="status">
          <CheckCircle2 size={64} className="auth-success-icon" />
          <h1>¡Bienvenido, rojiamarillo!</h1>
          <p className="auth-hint">Tu cuenta fue creada. Te estamos redirigiendo…</p>
          <Spinner size={20} />
        </div>
      </main>
    );
  }

  return (
    <main className="login">
      <form onSubmit={submit} className="auth-card">
        <img src="/brand/logo-shield.png" alt="" />
        <h1>Crear cuenta</h1>
        <p className="auth-hint">Registrate como aficionado del club.</p>

        <label htmlFor="reg-nombre">Nombre completo</label>
        <input
          id="reg-nombre"
          name="name"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          autoFocus
          disabled={loading}
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Ej: Ana Rodriguez"
          className={submitted && !nombreOk ? 'invalid' : ''}
        />

        <label htmlFor="reg-email">Correo electronico</label>
        <input
          id="reg-email"
          name="email"
          type="email"
          inputMode="email"
          value={form.email}
          onChange={onEmailChange}
          disabled={loading}
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          className={submitted && !emailOk ? 'invalid' : ''}
        />

        <label htmlFor="reg-username">Usuario</label>
        <input
          id="reg-username"
          name="username"
          value={form.username}
          onChange={onUsernameChange}
          disabled={loading}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="tu_usuario"
          className={submitted && !userOk ? 'invalid' : ''}
        />
        <FieldHint ok={userOk} bad={submitted && !userOk}>
          {userOk ? 'Usuario valido' : 'Solo minusculas, numeros y guion bajo (3–32).'}
        </FieldHint>

        <label htmlFor="reg-clave">Contrasena</label>
        <PasswordInput
          id="reg-clave"
          name="new-password"
          value={form.clave}
          onChange={(e) => setForm({ ...form, clave: e.target.value })}
          disabled={loading}
          autoComplete="new-password"
          className={submitted && !claveOk ? 'invalid' : ''}
        />
        <FieldHint ok={claveOk} bad={submitted && !claveOk}>
          {claveOk ? 'Contrasena valida' : 'Minimo 8 caracteres.'}
        </FieldHint>

        <label htmlFor="reg-confirmar">Confirmar contrasena</label>
        <PasswordInput
          id="reg-confirmar"
          name="confirm-password"
          value={form.confirmar}
          onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
          disabled={loading}
          autoComplete="new-password"
          className={submitted && !confirmOk ? 'invalid' : ''}
        />
        {form.confirmar.length > 0 && (
          <FieldHint ok={confirmOk} bad={!confirmOk}>
            {confirmOk ? 'Las contrasenas coinciden' : 'Las contrasenas no coinciden todavia.'}
          </FieldHint>
        )}

        {error && <div className="error" key={error} role="alert">{error}</div>}
        <button className={`btn${loading ? ' is-loading' : ''}`} disabled={loading}>
          {loading ? <><Spinner size={16} /> Creando cuenta…</> : 'Crear cuenta'}
        </button>
        <p className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesion</Link>
        </p>
      </form>
    </main>
  );
}
