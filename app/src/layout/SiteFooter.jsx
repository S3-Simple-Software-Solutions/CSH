import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, AtSign, PlayCircle, MessageCircle, Music2 } from 'lucide-react';
import { club, contacto, social, footerLinks, externalLinks } from '../data/club.js';

const ICONS = { instagram: Camera, facebook: AtSign, youtube: PlayCircle, tiktok: Music2, whatsapp: MessageCircle };

export default function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="site-foot-inner">
        <div className="site-foot-brand">
          <img src={club.logo} alt="Club Sport Herediano" />
          <p className="site-foot-tag">El Team · {club.fundacion.split(' de ').pop()}</p>
          <p className="muted">Más de cien años defendiendo los colores de la ciudad de las flores.</p>
          <div className="site-foot-social">
            {social.map((s) => {
              const Icon = ICONS[s.icon] || MessageCircle;
              return (
                <a key={s.red} href={s.url} target="_blank" rel="noreferrer" title={s.red} aria-label={s.red}>
                  <Icon size={18} />
                </a>
              );
            })}
          </div>
        </div>

        <div className="site-foot-col">
          <h4>El club</h4>
          {footerLinks.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
        </div>

        <div className="site-foot-col">
          <h4>Servicios</h4>
          <a href={externalLinks.tienda} target="_blank" rel="noreferrer">Tienda oficial</a>
          <Link to="/entradas">Entradas</Link>
          <Link to="/cuponera">Cuponera</Link>
          <Link to="/parqueo">Parqueo</Link>
          <Link to="/salones">Alquiler de salones</Link>
        </div>

        <div className="site-foot-col">
          <h4>Contacto</h4>
          <a href={`mailto:${contacto.general.email}`}>{contacto.general.email}</a>
          <span className="muted">{contacto.general.whatsapp}</span>
          <span className="muted">{club.ciudad}</span>
        </div>
      </div>
      <div className="site-foot-legal">
        <span>© {new Date().getFullYear()} {club.nombre}. Todos los derechos reservados.</span>
      </div>
    </footer>
  );
}
