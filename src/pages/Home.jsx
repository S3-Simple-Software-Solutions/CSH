import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { SectionHeader, StatGrid, PlayerCard, NewsCard, SponsorWall, Countdown } from '../components/site.jsx';
import { club } from '../data/club.js';
import { palmares } from '../data/history.js';
import { nextMatch } from '../data/calendar.js';
import { squad, featuredPlayers } from '../data/players.js';
import { news } from '../data/news.js';
import { sponsors } from '../data/sponsors.js';

const allPlayers = squad.flatMap((g) => g.jugadores);
const featured = featuredPlayers.map((slug) => allPlayers.find((p) => p.slug === slug)).filter(Boolean);

export default function Home() {
  return (
    <main className="home">
      {/* HERO */}
      <section className="hero" style={{ backgroundImage: `url(/brand/hero/champions-bw.jpg)` }}>
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-kicker">Clausura 2026 · Campeón Nacional</p>
          <h1 className="hero-title">Campeón<b>{club.campeonatos}</b></h1>
          <p className="hero-sub">{club.lema}</p>
          <div className="hero-actions">
            <Link className="btn" to="/historia">Historia del Team <ArrowRight size={16} /></Link>
            <Link className="btn ghost" to="/plantilla">Ver plantilla</Link>
          </div>
        </div>
      </section>

      {/* PRÓXIMO PARTIDO */}
      <section className="page section">
        <div className="match-feature">
          <div className="match-feature-head">
            <p className="eyebrow">Próximo partido</p>
            <span className="muted">{nextMatch.competicion}</span>
          </div>
          <div className="match-feature-body">
            <div className="match-team">
              <img src={nextMatch.local.logo} alt={nextMatch.local.nombre} />
              <strong>{nextMatch.local.nombre}</strong>
            </div>
            <div className="match-vs">
              <span>VS</span>
              <small>{nextMatch.fechaLabel}</small>
            </div>
            <div className="match-team">
              <div className="match-team-badge">{nextMatch.visita.code}</div>
              <strong>{nextMatch.visita.nombre}</strong>
            </div>
          </div>
          <Countdown targetISO={nextMatch.fechaISO} />
          <p className="match-feature-foot"><MapPin size={14} /> {nextMatch.estadio}</p>
          <Link className="btn ghost" to="/calendario">Ver calendario</Link>
        </div>
      </section>

      {/* LA VITRINA */}
      <section className="page section">
        <SectionHeader eyebrow="La Vitrina" title="Honores Rojiamarillos" center />
        <StatGrid items={palmares} />
      </section>

      {/* PLANTILLA DESTACADA */}
      <section className="page section">
        <SectionHeader eyebrow="El Plantel" title="Figuras del Team" />
        <div className="player-grid">
          {featured.map((p) => <PlayerCard key={p.slug} p={p} />)}
        </div>
        <div className="section-cta"><Link className="btn ghost" to="/plantilla">Plantilla completa <ArrowRight size={16} /></Link></div>
      </section>

      {/* NOTICIAS */}
      <section className="page section">
        <SectionHeader eyebrow="Últimas noticias" title="Lo que pasa en el Team" />
        <div className="news-grid">
          {news.slice(0, 3).map((n) => <NewsCard key={n.slug} n={n} />)}
        </div>
        <div className="section-cta"><Link className="btn ghost" to="/noticias">Todas las noticias <ArrowRight size={16} /></Link></div>
      </section>

      {/* SPONSORS */}
      <section className="page section">
        <SectionHeader eyebrow="Patrocinadores oficiales" title="Aliados del Team" center />
        <SponsorWall sponsors={sponsors} />
      </section>
    </main>
  );
}
