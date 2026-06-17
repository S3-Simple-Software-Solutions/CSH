import React, { useEffect, useState } from 'react';
import { standings } from '../data/calendar.js';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function abrevFecha(iso) {
  const d = new Date(iso);
  return `${DIAS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`;
}

function horaLabel(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return 'TBD';
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function initials(nombre) {
  return nombre.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
}

function resultClass(p) {
  const esLocal = p.equipoLocal.toLowerCase().includes('herediano');
  const gl = p.golesLocal ?? 0;
  const gv = p.golesVisita ?? 0;
  if (esLocal) return gl > gv ? 'win' : gl < gv ? 'loss' : 'draw';
  return gv > gl ? 'win' : gv < gl ? 'loss' : 'draw';
}

function TeamSlot({ nombre, side }) {
  const esHerediano = nombre.toLowerCase().includes('herediano');
  return (
    <div className={`cal-team${side === 'right' ? ' right' : ''}`}>
      {esHerediano
        ? <img src="/brand/logo-shield.png" alt="Herediano" className="cal-logo" />
        : <span className="cal-badge">{initials(nombre)}</span>}
      <span className="cal-team-name">{nombre}</span>
    </div>
  );
}

function CalRow({ p }) {
  const esResultado = p.tipo === 'resultado';
  const rc = esResultado ? resultClass(p) : '';
  const scoreNode = esResultado
    ? <span className="cal-score">{p.golesLocal} – {p.golesVisita}</span>
    : <span className="cal-score tbd">{horaLabel(p.fecha)}</span>;

  return (
    <article className={`cal-row${esResultado ? ` cal-row--result ${rc}` : ''}`}>
      <div className="cal-meta">
        <span className="cal-meta-date">{abrevFecha(p.fecha)}</span>
        <span className="cal-meta-liga">{p.competicion}</span>
      </div>
      <TeamSlot nombre={p.equipoLocal} side="left" />
      {scoreNode}
      <TeamSlot nombre={p.equipoVisita} side="right" />
    </article>
  );
}

function StandingsTable({ data }) {
  return (
    <div>
      <h3 className="standings-title">{data.nombre}</h3>
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>PJ</th>
            <th>DG</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
          {data.equipos.map((e, i) => (
            <tr key={e.equipo} className={e.equipo === 'Herediano' ? 'highlight' : ''}>
              <td>{i + 1}</td>
              <td>{e.equipo}</td>
              <td>{e.pj}</td>
              <td>{e.dg > 0 ? `+${e.dg}` : e.dg}</td>
              <td><strong>{e.pts}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Calendario() {
  const [tab, setTab] = useState('proximos');
  const [proximos, setProximos] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/partidos').then(r => r.json()).then(d => {
      if (d.ok) {
        setProximos(d.proximos ?? []);
        setResultados(d.resultados ?? []);
      }
      setLoading(false);
    });
  }, []);

  const todos = [...resultados, ...proximos].sort(
    (a, b) => new Date(a.fecha) - new Date(b.fecha)
  );

  const lista = tab === 'proximos' ? proximos : tab === 'resultados' ? resultados : todos;

  return (
    <main className="page section">
      <div className="tabs">
        <button className={tab === 'proximos' ? 'active' : ''} onClick={() => setTab('proximos')}>Próximos</button>
        <button className={tab === 'resultados' ? 'active' : ''} onClick={() => setTab('resultados')}>Resultados</button>
        <button className={tab === 'todos' ? 'active' : ''} onClick={() => setTab('todos')}>Todos</button>
      </div>

      {loading && <p className="muted" style={{ padding: '24px 0' }}>Cargando partidos…</p>}

      {!loading && (
        <div className="cal-list">
          {lista.length === 0 && (
            <p className="muted" style={{ padding: '24px 0' }}>
              {tab === 'proximos' ? 'No hay partidos próximos programados.' : 'No hay partidos registrados.'}
            </p>
          )}
          {lista.map(p => <CalRow key={p.id} p={p} />)}
        </div>
      )}

      <div className="standings-section">
        <StandingsTable data={standings.ligaFPD} />
        <StandingsTable data={standings.copaCentroamericana} />
      </div>
    </main>
  );
}
