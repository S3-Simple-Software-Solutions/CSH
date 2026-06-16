import React, { useMemo, useState } from 'react';
import { NewsCard } from '../components/site.jsx';
import { news, categories } from '../data/news.js';

export default function Noticias() {
  const [cat, setCat] = useState('Todas');
  const list = cat === 'Todas' ? news : news.filter((n) => n.categoria === cat);
  return (
    <main className="page section">
      <p className="eyebrow">Sala de prensa</p>
      <h1>Noticias</h1>
      <p className="sub">Todo lo que pasa en el Team: refuerzos, comunicados, crónicas y más.</p>

      <div className="tabs news-tabs">
        {categories.map((c) => (
          <button key={c} className={cat === c ? 'active' : ''} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <div className="news-grid">
        {list.map((n) => <NewsCard key={n.slug} n={n} />)}
      </div>
      {list.length === 0 && <p className="muted">No hay noticias en esta categoría por ahora.</p>}
    </main>
  );
}
