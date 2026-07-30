import React, { useEffect, useState } from 'react';
import { NewsCard } from '../components/site.jsx';

const DEFAULT_CATEGORIAS = ['Todas', 'Noticias', 'Refuerzos', 'Comunicados', 'Crónicas', 'Cantera', 'Femenino', 'Entradas'];

export default function Noticias() {
  const [all, setAll] = useState([]);
  const [categorias, setCategorias] = useState(DEFAULT_CATEGORIAS);
  const [cat, setCat] = useState('Todas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/noticias').then((r) => r.json()).then((d) => {
      if (d.ok) {
        setAll(d.noticias.map((n) => ({ ...n, imagen: n.imagenPath })));
        if (Array.isArray(d.categorias) && d.categorias.length) setCategorias(d.categorias);
      }
      setLoading(false);
    });
  }, []);

  const list = cat === 'Todas' ? all : all.filter((n) => n.categoria === cat);

  return (
    <main className="page section">
      <p className="eyebrow">Sala de prensa</p>
      <h1>Noticias</h1>
      <p className="sub">Todo lo que pasa en el Team: refuerzos, comunicados, crónicas y más.</p>

      <div className="tabs news-tabs">
        {categorias.map((c) => (
          <button key={c} className={cat === c ? 'active' : ''} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Cargando noticias…</p>
      ) : (
        <>
          <div className="news-grid">
            {list.map((n) => <NewsCard key={n.id} n={n} />)}
          </div>
          {list.length === 0 && <p className="muted">No hay noticias en esta categoría por ahora.</p>}
        </>
      )}
    </main>
  );
}
