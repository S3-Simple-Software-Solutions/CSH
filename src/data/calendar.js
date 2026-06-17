// Calendario — snapshot del sitio oficial (jun 2026).
// El próximo partido tiene fecha ISO fija; el countdown se calcula en vivo.

export const nextMatch = {
  competicion: 'Liga Promerica · Apertura 2026 · Fase Regular · J01',
  local: { nombre: 'Herediano', code: 'CSH', logo: '/brand/logo-shield.png' },
  visita: { nombre: 'Puntarenas FC', code: 'PUN', logo: null },
  fechaISO: '2026-07-26T19:00:00-06:00',
  fechaLabel: 'DOM, 26 JUL',
  estadio: 'Estadio Carlos Alvarado · Santa Bárbara',
};

export const competitions = [
  {
    nombre: 'Liga Promerica — Apertura 2026',
    estado: 'Inicia la fase regular',
    equipos: ['Herediano', 'Alajuelense', 'Saprissa', 'Cartaginés', 'San Carlos', 'Pérez Zeledón', 'Puntarenas FC', 'Sporting FC', 'Liberia', 'Guadalupe FC'],
  },
  {
    nombre: 'Copa Centroamericana 2026 — Grupo B',
    estado: 'Fase de grupos',
    equipos: ['Herediano (CRC)', 'CD Marathón (HON)', 'Alianza FC (SLV)', 'Real Estelí FC (NCA)', 'Antigua GFC (GUA)'],
  },
];

export const standings = {
  ligaFPD: {
    nombre: 'Liga Promerica — Apertura 2026',
    equipos: [
      { equipo: 'Alajuelense', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Deportivo Saprissa', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Cartaginés', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Herediano', pj: 0, dg: 0, pts: 0 },
      { equipo: 'San Carlos', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Pérez Zeledón', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Puntarenas FC', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Sporting FC', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Liberia', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Guadalupe FC', pj: 0, dg: 0, pts: 0 },
    ],
  },
  copaCentroamericana: {
    nombre: 'Copa Centroamericana 2026 — Grupo B',
    equipos: [
      { equipo: 'Herediano', pj: 0, dg: 0, pts: 0 },
      { equipo: 'CD Marathón', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Alianza FC', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Real Estelí FC', pj: 0, dg: 0, pts: 0 },
      { equipo: 'Antigua GFC', pj: 0, dg: 0, pts: 0 },
    ],
  },
};

// Resultados recientes (estáticos).
export const recentResults = [
  { fecha: '2026-05-16', local: 'Herediano', golesL: 2, visita: 'Saprissa', golesV: 0, competicion: 'Clausura 2026 · Final (vuelta)' },
  { fecha: '2026-05-13', local: 'Saprissa', golesL: 1, visita: 'Herediano', golesV: 2, competicion: 'Clausura 2026 · Final (ida)' },
  { fecha: '2026-05-11', local: 'Herediano', golesL: 0, visita: 'Cartaginés', golesV: 0, competicion: 'Clausura 2026 · Semifinal (vuelta)' },
  { fecha: '2026-05-07', local: 'Cartaginés', golesL: 0, visita: 'Herediano', golesV: 1, competicion: 'Clausura 2026 · Semifinal (ida)' },
];
