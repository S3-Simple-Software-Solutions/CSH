import React, { useState } from 'react';
import { Check, ChevronDown, ExternalLink } from 'lucide-react';
import { SectionHeader } from '../components/site.jsx';
import { heroSocios, beneficios, comercios, pasos, faq } from '../data/socios.js';
import { externalLinks } from '../data/club.js';

export default function Socios() {
  const [openFaq, setOpenFaq] = useState(null);
  return (
    <main className="socios">
      <section className="page section">
        <p className="eyebrow">Hacete socio</p>
        <h1>{heroSocios.titulo}</h1>
        <p className="sub">{heroSocios.sub}</p>
        <a className="btn" href={externalLinks.citaSocios} target="_blank" rel="noreferrer">Agendá tu cita <ExternalLink size={15} /></a>
      </section>

      <section className="page section">
        <SectionHeader eyebrow="Beneficios" title="Ser parte del Team" />
        <div className="benefit-grid">
          {beneficios.map((b) => (
            <article className="benefit-card" key={b.titulo}>
              <Check size={18} className="benefit-ic" />
              <strong>{b.titulo}</strong>
              <span className="muted">{b.desc}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="page section">
        <SectionHeader eyebrow="Cómo afiliarte" title="En 3 pasos" center />
        <div className="steps">
          {pasos.map((p) => (
            <div className="step" key={p.n}>
              <span className="step-num">{p.n}</span>
              <strong>{p.titulo}</strong>
              <span className="muted">{p.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="page section">
        <SectionHeader eyebrow="Red de beneficios" title="Comercios afiliados" center />
        <div className="comercio-wall">
          {comercios.map((c) => <span className="pill" key={c}>{c}</span>)}
        </div>
      </section>

      <section className="page section">
        <SectionHeader eyebrow="Dudas" title="Preguntas frecuentes" />
        <div className="faq">
          {faq.map((f, i) => (
            <div className={`faq-item ${openFaq === i ? 'open' : ''}`} key={i}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                {f.q} <ChevronDown size={18} />
              </button>
              {openFaq === i && <p className="faq-a muted">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
