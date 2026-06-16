import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Share2, Copy, Check } from 'lucide-react';
import { NewsCard } from '../components/site.jsx';

function ShareButtons({ titulo, url }) {
  const [copied, setCopied] = useState(false);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(titulo + ' ' + url)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(titulo)}&url=${encodeURIComponent(url)}`;

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="share-bar">
      <span className="share-label"><Share2 size={14} /> Compartir</span>
      <a href={waUrl} target="_blank" rel="noopener noreferrer" className="share-btn wa">WhatsApp</a>
      <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="share-btn fb">Facebook</a>
      <a href={xUrl} target="_blank" rel="noopener noreferrer" className="share-btn x">X</a>
      <button className="share-btn copy" onClick={copyLink}>
        {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar link</>}
      </button>
    </div>
  );
}

export default function NoticiaDetalle() {
  const { slug } = useParams();
  const [noticia, setNoticia] = useState(null);
  const [relacionadas, setRelacionadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/api/noticias/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setNotFound(true); setLoading(false); return; }
        setNoticia(d.noticia);
        setRelacionadas((d.relacionadas || []).map((n) => ({ ...n, imagen: n.imagenPath })));
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  if (loading) return <main className="page section"><p className="muted">Cargando…</p></main>;

  if (notFound) {
    return (
      <main className="page section">
        <p className="eyebrow">Sala de prensa</p>
        <h1>Noticia no encontrada</h1>
        <p className="muted">Esta noticia no existe o ya no está disponible.</p>
        <Link className="btn ghost" to="/noticias">← Volver a noticias</Link>
      </main>
    );
  }

  const fecha = new Date(noticia.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' });
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const parrafos = noticia.cuerpo ? noticia.cuerpo.split(/\n\n+/).filter(Boolean) : [];

  return (
    <main className="noticia-detalle">
      {/* Hero image */}
      {noticia.imagenPath && (
        <div className="noticia-hero">
          <img src={noticia.imagenPath} alt={noticia.titulo} />
        </div>
      )}

      <article className="page section noticia-body">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link to="/">Inicio</Link>
          <span>/</span>
          <Link to="/noticias">Noticias</Link>
          <span>/</span>
          <span>{noticia.titulo}</span>
        </nav>

        {/* Header */}
        <span className="pill" style={{ marginBottom: '1rem', display: 'inline-flex' }}>{noticia.categoria}</span>
        <h1 className="noticia-titulo">{noticia.titulo}</h1>
        <p className="noticia-meta muted">{noticia.fuente} · {fecha}</p>

        {/* Resumen destacado */}
        {noticia.resumen && <p className="noticia-resumen">{noticia.resumen}</p>}

        {/* Cuerpo */}
        {parrafos.length > 0 && (
          <div className="noticia-cuerpo">
            {parrafos.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}

        {/* Compartir */}
        <ShareButtons titulo={noticia.titulo} url={pageUrl} />
      </article>

      {/* Te puede interesar */}
      {relacionadas.length > 0 && (
        <section className="page section">
          <h2 className="noticia-relacionadas-title">Te puede interesar</h2>
          <div className="news-grid">
            {relacionadas.map((n) => <NewsCard key={n.id} n={n} />)}
          </div>
        </section>
      )}
    </main>
  );
}
