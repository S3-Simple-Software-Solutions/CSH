import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LogOut, Menu } from 'lucide-react';
import { ThemeToggle } from '../app-modules.jsx';

export default function AdminTopBar({ user, onLogout, onMenu }) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar-inner">
        <div className="admin-topbar-left">
          <button className="admin-topbar-menu" onClick={onMenu} aria-label="Abrir menu">
            <Menu size={18} />
          </button>
          <Link className="admin-topbar-back" to="/">
            <ArrowLeft size={15} />
            Ver sitio
          </Link>
        </div>

        <div className="admin-topbar-right">
          {user && (
            <span className="admin-topbar-user">
              <span className="admin-topbar-name">{user.name}</span>
              <span className="admin-topbar-role">{user.role}</span>
            </span>
          )}
          <ThemeToggle />
          {user && (
            <button className="admin-topbar-logout" onClick={onLogout}>
              <LogOut size={15} />
              Salir
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
