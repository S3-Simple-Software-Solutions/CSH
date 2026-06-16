import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { SectionHeader, Countdown } from '../components/site.jsx';
import { competitions } from '../data/calendar.js';

const fmt = (iso) => new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });

export default function Calendario() {
  const [tab, setTab] = useState('proximos');
  const [proximos, setProximos] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/partidos').then((r) => r.json()).then((d) => {
      if (d.ok) {
        setProximos(d.proximos ?? []);
        setResultados(d.resultados ?? []);
      }
      setLoading(false);
    });
  }, []);

  const nextMatch = proximos[0] ?? null;

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

      {loading && <p className="muted">Cargando partidos…</p>}

      {!loading && tab === 'proximos' && (
        <section className="cal-next">
          {nextMatch ? (
            <div className="match-feature">
              <div className="match-feature-head">
                <p className="eyebrow">Próximo partido</p>
                <span className="muted">{nextMatch.competicion}</span>
              </div>
              <div className="match-feature-body">
                <div className="match-team"><img src="/brand/logo-shield.png" alt={nextMatch.equipoLocal} /><strong>{nextMatch.equipoLocal}</strong></div>
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
            </div>
          ) : (
            <p className="muted">No hay partidos próximos programados.</p>
          )}
        </section>
      )}

      {!loading && tab === 'resultados' && (
        <section className="result-list">
          {resultados.length === 0 && <p className="muted">No hay resultados recientes.</p>}
          {resultados.map((r) => {
            const win = r.equipoLocal === 'Herediano' ? r.golesLocal > r.golesVisita : r.golesVisita > r.golesLocal;
            const draw = r.golesLocal === r.golesVisita;
            return (
              <article className={`result-row ${win ? 'win' : draw ? 'draw' : 'loss'}`} key={r.id}>
                <span className="result-date">{fmt(r.fecha)}</span>
                <span className="result-team right">{r.equipoLocal}</span>
                <span className="result-score">{r.golesLocal} – {r.golesVisita}</span>
                <span className="result-team">{r.equipoVisita}</span>
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
