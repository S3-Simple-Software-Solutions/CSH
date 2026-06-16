import { pool, query } from '../../core/db';
import { genId } from '../../core/id';

export async function ensurePartidosSchema(): Promise<void> {
  await pool.query(`
    create table if not exists partidos (
      id text primary key,
      competicion text not null,
      tipo text not null default 'proximo',
      equipo_local text not null,
      equipo_visita text not null,
      logo_visita_path text,
      fecha timestamptz not null,
      estadio text,
      goles_local integer,
      goles_visita integer,
      estado text not null default 'programado',
      creado_at timestamptz not null default now()
    );
    create index if not exists idx_partidos_tipo_fecha on partidos(tipo, fecha);
  `);

  const { count } = (await query<{ count: number }>('select count(*)::int as count from partidos'))[0];
  if (count === 0) await seedPartidos();
}

async function seedPartidos(): Promise<void> {
  const proximos = [
    {
      competicion: 'Liga Promerica · Apertura 2026 · Fase Regular · J01',
      equipo_local: 'Herediano',
      equipo_visita: 'Puntarenas FC',
      fecha: '2026-07-26T19:00:00-06:00',
      estadio: 'Estadio Carlos Alvarado · Santa Bárbara',
      tipo: 'proximo',
      estado: 'programado',
    },
  ];

  const resultados = [
    { competicion: 'Clausura 2026 · Final (vuelta)', equipo_local: 'Herediano', equipo_visita: 'Saprissa', fecha: '2026-05-16T20:00:00-06:00', goles_local: 2, goles_visita: 0, tipo: 'resultado', estado: 'jugado' },
    { competicion: 'Clausura 2026 · Final (ida)', equipo_local: 'Saprissa', equipo_visita: 'Herediano', fecha: '2026-05-13T20:00:00-06:00', goles_local: 1, goles_visita: 2, tipo: 'resultado', estado: 'jugado' },
    { competicion: 'Clausura 2026 · Semifinal (vuelta)', equipo_local: 'Herediano', equipo_visita: 'Cartaginés', fecha: '2026-05-11T18:00:00-06:00', goles_local: 0, goles_visita: 0, tipo: 'resultado', estado: 'jugado' },
    { competicion: 'Clausura 2026 · Semifinal (ida)', equipo_local: 'Cartaginés', equipo_visita: 'Herediano', fecha: '2026-05-07T20:00:00-06:00', goles_local: 0, goles_visita: 1, tipo: 'resultado', estado: 'jugado' },
  ];

  for (const p of [...proximos, ...resultados]) {
    await pool.query(
      `insert into partidos (id, competicion, tipo, equipo_local, equipo_visita, fecha, estadio, goles_local, goles_visita, estado)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        genId('PAR'),
        p.competicion,
        p.tipo,
        p.equipo_local,
        p.equipo_visita,
        p.fecha,
        (p as any).estadio ?? null,
        (p as any).goles_local ?? null,
        (p as any).goles_visita ?? null,
        p.estado,
      ],
    );
  }
}
