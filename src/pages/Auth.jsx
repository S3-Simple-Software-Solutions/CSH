import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../utils/api.js';

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

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ usuario: '', clave: '' });
  const [error, setError] = useState('');

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
    const data = await api('/admin/sign-in', { method: 'POST', body: JSON.stringify(form) });
    if (!data.ok) return setError(data.error);
    redirectAfterLogin(data.user);
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <img src="/brand/logo-shield.png" alt="" />
        <h1>Club Sport Herediano</h1>
        <label>Usuario o correo</label>
        <input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} autoFocus />
        <label>Contrasena</label>
        <PasswordInput value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} />
        {error && <div className="error">{error}</div>}
        <button className="btn">Entrar</button>
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
  async function submit(e) {
    e.preventDefault();
    if (form.clave !== form.confirmar) return setError('Las contrasenas no coinciden');
    const data = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        nombre: form.nombre,
        email: form.email,
        username: form.username,
        clave: form.clave,
      }),
    });
    if (!data.ok) return setError(data.error);
    location.href = '/';
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <img src="/brand/logo-shield.png" alt="" />
        <h1>Crear cuenta</h1>
        <p className="auth-hint">Registrate como aficionado del club.</p>
        <label>Nombre completo</label>
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
        <label>Correo electronico</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label>Usuario</label>
        <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" />
        <label>Contrasena</label>
        <PasswordInput value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} autoComplete="new-password" />
        <p className="auth-hint">Minimo 8 caracteres.</p>
        <label>Confirmar contrasena</label>
        <PasswordInput value={form.confirmar} onChange={(e) => setForm({ ...form, confirmar: e.target.value })} autoComplete="new-password" />
        {error && <div className="error">{error}</div>}
        <button className="btn">Crear cuenta</button>
        <p className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesion</Link>
        </p>
      </form>
    </main>
  );
}
