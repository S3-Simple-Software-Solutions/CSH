import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ExternalLink, LogIn, LogOut, Menu, ShieldCheck, User, X } from 'lucide-react';
import { ThemeToggle, isAdminUser } from '../app-modules.jsx';
import { api } from '../utils/api.js';
import { club, navMain, navModules, externalLinks } from '../data/club.js';

// Control de sesión del navbar público: muestra "Iniciar sesión" si no hay sesión,
// o el nombre del usuario. Un admin enlaza al panel; un socio solo aparece logueado.
function SessionControl({ onNavigate }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    api('/api/session').then((data) => {
      if (!alive) return;
      setUser(data && data.user ? data.user : null);
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  async function logout() {
    await api('/admin/logout', { method: 'POST', body: '{}' });
    location.href = '/';
  }

  if (!ready) return null;

  if (!user) {
    return (
      <Link className="chip chip-admin" to="/admin" onClick={onNavigate}>
        <LogIn size={13} />
        Iniciar sesión
      </Link>
    );
  }

  const firstName = (user.name || '').split(' ')[0] || 'Mi cuenta';

  return (
    <span className="site-nav-user">
      {isAdminUser(user) ? (
        <Link className="chip chip-admin" to="/admin" onClick={onNavigate} title={user.name}>
          <ShieldCheck size={13} />
          {firstName}
        </Link>
      ) : (
        <span className="chip chip-user" title={user.name}>
          <User size={13} />
          {firstName}
        </span>
      )}
      <button className="chip chip-ghost" onClick={logout} title="Cerrar sesión">
        <LogOut size={13} />
        Salir
      </button>
    </span>
  );
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const navRef = useRef(null);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Cerrar al hacer clic fuera del menú
  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="site-top">
      {open && <button className="site-nav-backdrop" aria-label="Cerrar menú" onClick={close} />}
      <div className="site-top-inner" ref={navRef}>

        {/* Marca */}
        <Link className="site-brand" to="/" onClick={close}>
          <img src={club.logo} alt="Escudo Club Sport Herediano" />
          <span className="site-brand-name">Herediano</span>
        </Link>

        {/* Burger (mobile) */}
        <button
          className="site-burger"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="site-nav"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Navegación */}
        <nav id="site-nav" className={`site-nav${open ? ' open' : ''}`}>

          {/* Cabecera del drawer (solo mobile): marca + cerrar */}
          <div className="site-nav-head">
            <Link className="site-brand" to="/" onClick={close}>
              <img src={club.logo} alt="" />
              <span className="site-brand-name">Herediano</span>
            </Link>
            <button className="site-nav-close" onClick={close} aria-label="Cerrar menú"><X size={20} /></button>
          </div>

          {/* Bloque 1: páginas del club */}
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

          {/* Bloque 2: módulos + utilidades */}
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

            <ThemeToggle />

            <SessionControl onNavigate={close} />
          </div>
        </nav>

      </div>
    </header>
  );
}
