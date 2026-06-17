import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ExternalLink, Menu, ShieldCheck, X } from 'lucide-react';
import { ThemeToggle } from '../app-modules.jsx';
import { club, navMain, navModules, externalLinks } from '../data/club.js';

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

            <Link className="chip chip-admin" to="/admin" onClick={close}>
              <ShieldCheck size={13} />
              Admin
            </Link>
          </div>
        </nav>

      </div>
    </header>
  );
}
