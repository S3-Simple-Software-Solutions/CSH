import React, { useEffect, useState } from 'react';
import { SectionHeader, PlayerCard } from '../components/site.jsx';

export default function Plantilla() {
  const [squad, setSquad] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/jugadores').then((r) => r.json()).then((d) => {
      if (d.ok) {
        setSquad(d.squad.map((g) => ({
          categoria: g.categoria,
          jugadores: g.jugadores.map((j) => ({ ...j, foto: j.fotoPath })),
        })));
        setStaff(d.staff.map((s) => ({ ...s, foto: s.fotoPath })));
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <main className="page section"><p className="muted">Cargando plantilla…</p></main>;

  return (
    <main className="page section">
      <p className="eyebrow">Temporada 2026</p>
      <h1>Plantilla</h1>
      <p className="sub">El plantel campeón nacional. Conocé a las figuras rojiamarillas por línea.</p>

      {squad.map((grupo) => (
        <section className="squad-block" key={grupo.categoria}>
          <SectionHeader title={grupo.categoria} />
          <div className="player-grid">
            {grupo.jugadores.map((p) => <PlayerCard key={p.id} p={p} />)}
          </div>
        </section>
      ))}

      {staff.length > 0 && (
        <section className="squad-block">
          <SectionHeader title="Cuerpo Técnico" sub="El Banquillo" />
          <div className="staff-grid">
            {staff.map((s) => (
              <div className="staff-cell" key={s.id}>
                <strong>{s.nombre}</strong>
                <span>{s.posicion}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
