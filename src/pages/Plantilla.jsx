import React from 'react';
import { SectionHeader, PlayerCard } from '../components/site.jsx';
import { squad, staff } from '../data/players.js';

export default function Plantilla() {
  return (
    <main className="page section">
      <p className="eyebrow">Temporada 2026</p>
      <h1>Plantilla</h1>
      <p className="sub">El plantel campeón nacional. Conocé a las figuras rojiamarillas por línea.</p>

      {squad.map((grupo) => (
        <section className="squad-block" key={grupo.categoria}>
          <SectionHeader title={grupo.categoria} />
          <div className="player-grid">
            {grupo.jugadores.map((p) => <PlayerCard key={p.slug} p={p} />)}
          </div>
        </section>
      ))}

      <section className="squad-block">
        <SectionHeader title="Cuerpo Técnico" sub="El Banquillo" />
        <div className="staff-grid">
          {staff.map((s) => (
            <div className="staff-cell" key={s.nombre}>
              <strong>{s.nombre}</strong>
              <span>{s.rol}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
