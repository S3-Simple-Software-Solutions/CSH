import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// Encabezado de sección reutilizable.
export function SectionHeader({ eyebrow, title, sub, center }) {
  return (
    <header className={`sec-head ${center ? 'center' : ''}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {sub && <p className="sub">{sub}</p>}
    </header>
  );
}

// Bloque de estadística (palmarés).
export function StatGrid({ items }) {
  return (
    <div className="stat-grid">
      {items.map((it) => (
        <div className="stat-cell" key={it.titulo}>
          <b>{it.cantidad}</b>
          <span>{it.titulo}</span>
        </div>
      ))}
    </div>
  );
}

// Tarjeta de jugador.
export function PlayerCard({ p }) {
  return (
    <article className="player-card">
      <div className="player-photo">
        {p.foto ? <img src={p.foto} alt={p.nombre} loading="lazy" /> : <div className="player-noimg" />}
        <span className="player-dorsal">{p.dorsal}</span>
      </div>
      <div className="player-meta">
        <strong>{p.nombre}</strong>
        <span>{p.posicion} · {p.nacionalidad}</span>
      </div>
    </article>
  );
}

// Tarjeta de noticia. Si tiene slug, es un link a la página de detalle.
export function NewsCard({ n, linked = true }) {
  const fecha = new Date(n.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
  const inner = (
    <>
      <div className="news-thumb">
        {n.imagen ? <img src={n.imagen} alt={n.titulo} loading="lazy" /> : <div className="news-noimg">CSH</div>}
        <span className="news-cat">{n.categoria}</span>
      </div>
      <div className="news-body">
        <h3>{n.titulo}</h3>
        <p>{n.resumen}</p>
        <small className="muted">{fecha} · {n.fuente}</small>
      </div>
    </>
  );
  if (linked && n.slug) {
    return <Link to={`/noticias/${n.slug}`} className="news-card">{inner}</Link>;
  }
  return <article className="news-card">{inner}</article>;
}

// Muro de patrocinadores.
export function SponsorWall({ sponsors }) {
  return (
    <div className="sponsor-wall">
      {sponsors.map((s) => <img key={s.name} src={s.path} alt={s.name} title={s.name} loading="lazy" />)}
    </div>
  );
}

// Countdown en vivo hacia una fecha ISO.
export function Countdown({ targetISO }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, new Date(targetISO).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const cell = (val, lbl) => <div className="cd-cell"><b>{String(val).padStart(2, '0')}</b><span>{lbl}</span></div>;
  return (
    <div className="countdown">
      {cell(d, 'días')}{cell(h, 'hrs')}{cell(m, 'min')}{cell(s, 'seg')}
    </div>
  );
}
