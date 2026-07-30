import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ExternalLink, LogIn, LogOut, Menu, ShieldCheck, SquareParking, Ticket, User, UserPlus, X } from 'lucide-react';
import { ThemeToggle } from '../app-modules.jsx';
import { isAdminUser } from '../pages/Auth.jsx';
import { api } from '../utils/api.js';
import { club, navMain, navModules, externalLinks } from '../data/club.js';

function AuthGuestDesktop({ onNavigate }) {
  return (
    <div className="site-top-auth" aria-label="Acceso a cuenta">
      <Link className="site-top-auth-login" to="/login" onClick={onNavigate}>
        Entrar
      </Link>
      <Link className="site-top-auth-register" to="/registro" onClick={onNavigate}>
        Crear cuenta
      </Link>
    </div>
  );
}

function AuthGuestMobileBar({ onNavigate }) {
  return (
    <Link className="site-quick-login" to="/login" onClick={onNavigate} aria-label="Entrar">
      <LogIn size={16} />
    </Link>
  );
}

function AuthGuestDrawer({ onNavigate }) {
  return (
    <section className="site-auth-card" aria-label="Acceso a cuenta">
      <p className="site-auth-card-eyebrow">Tu cuenta</p>
      <h2 className="site-auth-card-title">Unite a la familia rojiamarilla</h2>
      <p className="site-auth-card-copy">Crea tu perfil de aficionado para seguir el club, usar cupones y comprar entradas.</p>
      <div className="site-auth-card-actions">
        <Link className="btn site-auth-card-primary" to="/registro" onClick={onNavigate}>
          <UserPlus size={16} />
          Crear cuenta
        </Link>
        <Link className="btn ghost site-auth-card-secondary" to="/login" onClick={onNavigate}>
          Ya tengo cuenta
        </Link>
      </div>
    </section>
  );
}

function AuthLoggedIn({ user, onNavigate, onLogout, compact }) {
  const firstName = (user.name || '').split(' ')[0] || 'Mi cuenta';

  if (compact) {
    return (
      <Link
        className="site-quick-login site-quick-login-user"
        to={isAdminUser(user) ? '/admin' : '/mi-cuenta'}
        onClick={onNavigate}
        title={user.name}
        aria-label={user.name}
      >
        {isAdminUser(user) ? <ShieldCheck size={16} /> : <User size={16} />}
      </Link>
    );
  }

  return (
    <div className="site-top-user">
      {isAdminUser(user) ? (
        <Link className="site-top-user-link site-top-user-admin" to="/admin" onClick={onNavigate} title={user.name}>
          <ShieldCheck size={14} />
          {firstName}
        </Link>
      ) : (
        <Link className="site-top-user-link" to="/mi-cuenta" onClick={onNavigate} title={user.name}>
          <User size={14} />
          {firstName}
        </Link>
      )}
      <button className="site-top-user-logout" type="button" onClick={onLogout} title="Cerrar sesión">
        <LogOut size={14} />
        <span>Salir</span>
      </button>
    </div>
  );
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api('/api/session').then((data) => {
      if (!alive) return;
      setUser(data && data.user ? data.user : null);
      setSessionReady(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const close = () => setOpen(false);

  async function logout() {
    await api('/admin/logout', { method: 'POST', body: '{}' });
    location.href = '/';
  }

  const guest = sessionReady && !user;

  return (
    <header className="site-top">
      {open && <button className="site-nav-backdrop" aria-label="Cerrar menú" onClick={close} />}
      <div className="site-top-inner" ref={navRef}>
        <Link className="site-brand" to="/" onClick={close}>
          <img src={club.logo} alt="Escudo Club Sport Herediano" />
          <span className="site-brand-name">Herediano</span>
        </Link>

        <nav id="site-nav" className={`site-nav${open ? ' open' : ''}`}>
          <div className="site-nav-head">
            <Link className="site-brand" to="/" onClick={close}>
              <img src={club.logo} alt="" />
              <span className="site-brand-name">Herediano</span>
            </Link>
            <button className="site-nav-close" onClick={close} aria-label="Cerrar menú"><X size={20} /></button>
          </div>

          {guest && <AuthGuestDrawer onNavigate={close} />}

          <div className="site-nav-section site-nav-main" role="group" aria-label="Páginas del club">
            {navMain.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={close}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          <span className="site-nav-divider" aria-hidden="true" />

          <div className="site-nav-section site-nav-modules" role="group" aria-label="Servicios">
            {navModules.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={close}
                className={({ isActive }) =>
                  `chip${l.primary ? ' chip-cta' : ''}${isActive ? ' active' : ''}`
                }
              >
                {l.label}
              </NavLink>
            ))}

            <span className="site-nav-util-sep" aria-hidden="true" />

            <a
              className="chip chip-ghost"
              href={externalLinks.tienda}
              target="_blank"
              rel="noreferrer"
            >
              Tienda <ExternalLink size={11} />
            </a>
          </div>

          <div className="site-nav-section site-nav-drawer-util" role="group" aria-label="Preferencias">
            <ThemeToggle />
          </div>
        </nav>

        <div className="site-top-actions" aria-label="Cuenta">
          <ThemeToggle />
          {sessionReady && (
            user
              ? <AuthLoggedIn user={user} onNavigate={close} onLogout={logout} />
              : <AuthGuestDesktop onNavigate={close} />
          )}
        </div>

        <div className="site-quick" role="group" aria-label="Accesos rápidos">
          <NavLink
            className={({ isActive }) => `chip chip-cta${isActive ? ' active' : ''}`}
            to="/entradas"
            onClick={close}
          >
            <Ticket size={13} />
            Entradas
          </NavLink>
          <NavLink
            className={({ isActive }) => `chip${isActive ? ' active' : ''}`}
            to="/parqueo"
            onClick={close}
          >
            <SquareParking size={13} />
            Parqueo
          </NavLink>
          {sessionReady && (
            user
              ? <AuthLoggedIn user={user} onNavigate={close} onLogout={logout} compact />
              : <AuthGuestMobileBar onNavigate={close} />
          )}
        </div>

        <button
          className="site-burger"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="site-nav"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}
