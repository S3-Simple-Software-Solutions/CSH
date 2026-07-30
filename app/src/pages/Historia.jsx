import React from 'react';
import { SectionHeader, StatGrid } from '../components/site.jsx';
import { palmares, timeline, legends, stadium, heroBg } from '../data/history.js';

export default function Historia() {
  return (
    <main className="historia">
      <section className="hero compact" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-kicker">El Team · 1921</p>
          <h1 className="hero-title">Más de 100 años</h1>
          <p className="hero-sub">Historia del Club Sport Herediano</p>
        </div>
      </section>

      <section className="page section">
        <SectionHeader eyebrow="Honores" title="Palmarés Rojiamarillo" center />
        <StatGrid items={palmares} />
      </section>

      <section className="page section">
        <SectionHeader eyebrow="Capítulos" title="Nuestra historia" />
        <div className="timeline">
          {timeline.map((c) => (
            <article className="tl-item" key={c.num}>
              <div className="tl-img" style={{ backgroundImage: `url(${c.img})` }}>
                <span className="tl-num">{c.num}</span>
              </div>
              <div className="tl-body">
                <span className="tl-period">{c.periodo}</span>
                <h3>{c.titulo}</h3>
                <p className="muted">{c.texto}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="page section">
        <SectionHeader eyebrow="Salón de la Fama" title="Leyendas Rojiamarillas" />
        <div className="legend-grid">
          {legends.map((l) => (
            <article className="legend-card" key={l.nombre}>
              <div className="legend-photo"><img src={l.foto} alt={l.nombre} loading="lazy" /></div>
              <div className="legend-meta">
                <span className="legend-period">{l.periodo}</span>
                <strong>{l.nombre}</strong>
                <span className="muted">{l.detalle}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="page section">
        <div className="stadium" style={{ backgroundImage: `url(${stadium.img})` }}>
          <div className="stadium-overlay" />
          <div className="stadium-body">
            <p className="eyebrow">{stadium.apodo}</p>
            <h2>{stadium.nombre}</h2>
            <div className="stadium-facts">
              <div><b>{stadium.inaugurado}</b><span>Inaugurado</span></div>
              <div><b>{stadium.capacidad}</b><span>Capacidad</span></div>
              <div><b>{stadium.provincia}</b><span>Provincia</span></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
