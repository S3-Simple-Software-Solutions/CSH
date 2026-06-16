import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '../app-modules.jsx';
import { club, navMain, navModules, externalLinks } from '../data/club.js';

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-top">
      <div className="site-top-inner">
        <Link className="site-brand" to="/" onClick={() => setOpen(false)}>
          <img src={club.logo} alt="Escudo Club Sport Herediano" />
          <span>Herediano</span>
        </Link>

        <button className="site-burger" onClick={() => setOpen((v) => !v)} aria-label="Menú">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav className={`site-nav ${open ? 'open' : ''}`}>
          <div className="site-nav-main">
            {navMain.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={() => setOpen(false)}
                className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
          </div>
          <div className="site-nav-modules">
            {navModules.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}
                className={({ isActive }) => `chip ${isActive ? 'active' : ''}`}>
                {l.label}
              </NavLink>
            ))}
            <a className="chip" href={externalLinks.tienda} target="_blank" rel="noreferrer">Tienda</a>
            <Link className="chip admin" to="/admin" onClick={() => setOpen(false)}><ShieldCheck size={14} />Admin</Link>
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
