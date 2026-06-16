import { pool, query } from '../../core/db';
import { genId } from '../../core/id';

export async function ensureNoticiasSchema(): Promise<void> {
  await pool.query(`
    create table if not exists noticias (
      id text primary key,
      slug text unique not null,
      titulo text not null,
      categoria text not null default 'Noticias',
      fuente text not null default 'Prensa CSH',
      resumen text not null default '',
      imagen_path text,
      estado text not null default 'publicado',
      fecha date not null default current_date,
      creado_at timestamptz not null default now()
    );
    alter table noticias add column if not exists fuente text not null default 'Prensa CSH';
    alter table noticias add column if not exists cuerpo text not null default '';
    create index if not exists idx_noticias_estado_fecha on noticias(estado, fecha desc);
  `);

  const { count } = (await query<{ count: number }>('select count(*)::int as count from noticias'))[0];
  if (count === 0) await seedNoticias();
}

async function seedNoticias(): Promise<void> {
  const articles = [
    { slug: 'farmacia-jireh-llega-al-nuevo-eladio-rosabal-cordero', titulo: 'Farmacia Jireh llega al nuevo ESTADIO Eladio Rosabal Cordero', categoria: 'Noticias', fecha: '2026-06-12', imagen_path: '/brand/news/img-2373.png', resumen: 'Un nuevo aliado comercial se suma al renovado templo florense de cara a la temporada.' },
    { slug: 'carta-de-jafet-soto-hacia-el-club-sport-herediano-en-su-105-aniversario', titulo: 'Carta de Jafet Soto hacia el Club Sport Herediano en su 105 aniversario', categoria: 'Comunicados', fecha: '2026-06-12', imagen_path: '/brand/news/celebraci-n.jpeg', resumen: 'El gerente deportivo dirige unas palabras a la afición rojiamarilla en una fecha histórica.' },
    { slug: 'cronograma-de-actividades-aniversario-12-de-junio', titulo: 'CRONOGRAMA DE ACTIVIDADES 12 de junio: 105 ANIVERSARIO', categoria: 'Noticias', fecha: '2026-06-10', imagen_path: '/brand/news/dsc06400.jpg', resumen: 'Todas las actividades programadas para celebrar los 105 años del Team.' },
    { slug: 'reggy-rivera-bienvenido-al-campeon-nacional', titulo: 'Reggy Rivera: Bienvenido al Campeón Nacional', categoria: 'Refuerzos', fecha: '2026-05-26', imagen_path: '/brand/news/reggy.jpeg', resumen: 'El club incorpora a un nuevo refuerzo para encarar la temporada.' },
    { slug: 'abner-hudson-bienvenido-al-campeon-nacional', titulo: 'Abner Hudson: Bienvenido al Campeón Nacional', categoria: 'Refuerzos', fecha: '2026-05-26', imagen_path: '/brand/news/abner.jpeg', resumen: 'Otra cara nueva se suma al plantel campeón.' },
    { slug: 'llega-la-ii-edicion-del-campa-fut-y-recreacion-junto-a-solo-cracks', titulo: 'Llega la II Edición del Campa FUT y Recreación junto a Solo Cracks', categoria: 'Noticias', fecha: '2026-06-05', imagen_path: '/brand/news/whatsapp-image-2026-06-05-at-10-50-28-am.jpeg', resumen: 'Una nueva edición del campamento recreativo para los más pequeños.' },
    { slug: 'aaron-suarez-bienvenido-al-campeon-nacional', titulo: 'Aarón Suárez: Bienvenido al Campeón Nacional', categoria: 'Refuerzos', fecha: '2026-05-19', imagen_path: null, resumen: 'El campeón nacional sigue reforzándose con miras a los nuevos retos.' },
    { slug: 'ariel-arauz-regresa-al-campeon-nacional', titulo: 'Ariel Arauz regresa al Campeón Nacional', categoria: 'Noticias', fecha: '2026-05-19', imagen_path: null, resumen: 'Un viejo conocido vuelve a vestir la rojiamarilla.' },
    { slug: 'comunicado-oficial-lineamientos-para-final-nacional', titulo: 'Comunicado oficial: Lineamientos para final Nacional', categoria: 'Comunicados', fecha: '2026-05-18', imagen_path: null, resumen: 'Información oficial del club de cara a la gran final del campeonato.' },
  ];

  for (const a of articles) {
    await pool.query(
      `insert into noticias (id, slug, titulo, categoria, resumen, imagen_path, fecha, estado)
       values ($1,$2,$3,$4,$5,$6,$7,'publicado')
       on conflict (slug) do nothing`,
      [genId('NOT'), a.slug, a.titulo, a.categoria, a.resumen, a.imagen_path, a.fecha],
    );
  }
}
