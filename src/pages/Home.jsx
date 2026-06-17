import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { SectionHeader, StatGrid, PlayerCard, NewsCard, SponsorWall, Countdown } from '../components/site.jsx';
import { palmares } from '../data/history.js';

const DEFAULT_HERO = {
  kicker: 'Clausura 2026 · Campeón Nacional',
  title: 'Campeón',
  number: '32',
  sub: 'Nuestra pasión es eterna',
  imageUrl: '/brand/hero/champions-bw.jpg',
};

export default function Home() {
  const [hero, setHero] = useState(DEFAULT_HERO);
  const [nextMatch, setNextMatch] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [news, setNews] = useState([]);
  const [sponsors, setSponsors] = useState([]);

  useEffect(() => {
    fetch('/api/web/hero').then((r) => r.json()).then((d) => d.ok && setHero(d.hero));
    fetch('/api/partidos/siguiente').then((r) => r.json()).then((d) => d.ok && setNextMatch(d.partido));
    fetch('/api/jugadores/destacados').then((r) => r.json()).then((d) => {
      if (d.ok) setFeatured(d.jugadores.map((j) => ({ ...j, foto: j.fotoPath })));
    });
    fetch('/api/noticias').then((r) => r.json()).then((d) => {
      if (d.ok) setNews(d.noticias.map((n) => ({ ...n, imagen: n.imagenPath })));
    });
    fetch('/api/sponsors').then((r) => r.json()).then((d) => {
      if (d.ok) setSponsors(d.sponsors.map((s) => ({ name: s.nombre, path: s.logoPath })).filter((s) => s.path));
    });
  }, []);

  return (
    <main className="home">
      <section className="hero" style={{ backgroundImage: `url(${hero.imageUrl})` }}>
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-kicker">{hero.kicker}</p>
          <h1 className="hero-title">{hero.title}<b>{hero.number}</b></h1>
          <p className="hero-sub">{hero.sub}</p>
          <div className="hero-actions">
            <Link className="btn" to="/historia">Historia del Team <ArrowRight size={16} /></Link>
            <Link className="btn ghost" to="/plantilla">Ver plantilla</Link>
          </div>
        </div>
      </section>

      {nextMatch && (
        <section className="page section">
          <div className="match-feature">
            <div className="match-feature-head">
              <p className="eyebrow">Próximo partido</p>
              <span className="muted">{nextMatch.competicion}</span>
            </div>
            <div className="match-feature-body">
              <div className="match-team">
                <img src="/brand/logo-shield.png" alt={nextMatch.equipoLocal} />
                <strong>{nextMatch.equipoLocal}</strong>
              </div>
              <div className="match-vs">
                <span>VS</span>
                <small>{new Date(nextMatch.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
              </div>
              <div className="match-team">
                <div className="match-team-badge">{nextMatch.equipoVisita.slice(0, 3).toUpperCase()}</div>
                <strong>{nextMatch.equipoVisita}</strong>
              </div>
            </div>
            <Countdown targetISO={nextMatch.fecha} />
            <p className="match-feature-foot"><MapPin size={14} /> {nextMatch.estadio}</p>
            <Link className="btn ghost" to="/calendario">Ver calendario</Link>
          </div>
        </section>
      )}

      <section className="page section">
        <SectionHeader eyebrow="La Vitrina" title="Honores Rojiamarillos" center />
        <StatGrid items={palmares} />
      </section>

      {featured.length > 0 && (
        <section className="page section">
          <SectionHeader eyebrow="El Plantel" title="Figuras del Team" />
          <div className="player-grid">
            {featured.map((p) => <PlayerCard key={p.id} p={p} />)}
          </div>
          <div className="section-cta"><Link className="btn ghost" to="/plantilla">Plantilla completa <ArrowRight size={16} /></Link></div>
        </section>
      )}

      {news.length > 0 && (
        <section className="page section">
          <SectionHeader eyebrow="Últimas noticias" title="Lo que pasa en el Team" />
          <div className="news-grid">
            {news.slice(0, 3).map((n) => <NewsCard key={n.id} n={n} />)}
          </div>
          <div className="section-cta"><Link className="btn ghost" to="/noticias">Todas las noticias <ArrowRight size={16} /></Link></div>
        </section>
      )}

      {sponsors.length > 0 && (
        <section className="page section">
          <SectionHeader eyebrow="Patrocinadores oficiales" title="Aliados del Team" center />
          <SponsorWall sponsors={sponsors} />
        </section>
      )}
    </main>
  );
}
