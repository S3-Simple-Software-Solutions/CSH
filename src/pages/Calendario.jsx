import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { SectionHeader, Countdown } from '../components/site.jsx';
import { nextMatch, competitions, recentResults } from '../data/calendar.js';

const fmt = (iso) => new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });

export default function Calendario() {
  const [tab, setTab] = useState('proximos');
  return (
    <main className="page section">
      <p className="eyebrow">Competiciones 2026</p>
      <h1>Calendario</h1>
      <p className="sub">Próximos encuentros, resultados recientes y competiciones activas del Team.</p>

      <div className="tabs">
        <button className={tab === 'proximos' ? 'active' : ''} onClick={() => setTab('proximos')}>Próximos</button>
        <button className={tab === 'resultados' ? 'active' : ''} onClick={() => setTab('resultados')}>Resultados</button>
        <button className={tab === 'competiciones' ? 'active' : ''} onClick={() => setTab('competiciones')}>Competiciones</button>
      </div>

      {tab === 'proximos' && (
        <section className="cal-next">
          <div className="match-feature">
            <div className="match-feature-head">
              <p className="eyebrow">Próximo partido</p>
              <span className="muted">{nextMatch.competicion}</span>
            </div>
            <div className="match-feature-body">
              <div className="match-team"><img src={nextMatch.local.logo} alt={nextMatch.local.nombre} /><strong>{nextMatch.local.nombre}</strong></div>
              <div className="match-vs"><span>VS</span><small>{nextMatch.fechaLabel}</small></div>
              <div className="match-team"><div className="match-team-badge">{nextMatch.visita.code}</div><strong>{nextMatch.visita.nombre}</strong></div>
            </div>
            <Countdown targetISO={nextMatch.fechaISO} />
            <p className="match-feature-foot"><MapPin size={14} /> {nextMatch.estadio}</p>
          </div>
        </section>
      )}

      {tab === 'resultados' && (
        <section className="result-list">
          {recentResults.map((r, i) => {
            const win = r.local === 'Herediano' ? r.golesL > r.golesV : r.golesV > r.golesL;
            const draw = r.golesL === r.golesV;
            return (
              <article className={`result-row ${win ? 'win' : draw ? 'draw' : 'loss'}`} key={i}>
                <span className="result-date">{fmt(r.fecha)}</span>
                <span className="result-team right">{r.local}</span>
                <span className="result-score">{r.golesL} – {r.golesV}</span>
                <span className="result-team">{r.visita}</span>
                <span className="result-comp muted">{r.competicion}</span>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'competiciones' && (
        <section className="comp-list">
          {competitions.map((c) => (
            <article className="comp-card" key={c.nombre}>
              <SectionHeader title={c.nombre} sub={c.estado} />
              <div className="comp-teams">
                {c.equipos.map((e) => <span className="pill" key={e}>{e}</span>)}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
