// Plantilla Club Sport Herediano — snapshot capturado del sitio oficial (jun 2026).
// Fotos locales en /brand/players/<slug>.jpg

const P = (slug, nombre, dorsal, posicion, nacionalidad) => ({
  slug, nombre, dorsal, posicion, nacionalidad,
  foto: `/brand/players/${slug}.jpg`,
});

export const squad = [
  {
    categoria: 'Porteros',
    jugadores: [
      P('dany-carvajal', 'Dany Carvajal', 31, 'Portero', 'CRC'),
      P('anthony-walker', 'Anthony Walker', 92, 'Portero', 'CRC'),
    ],
  },
  {
    categoria: 'Defensas',
    jugadores: [
      P('getsel-montes', 'Getsel Montes', 38, 'Defensa Central', 'HON'),
      P('sergio-rodriguez', 'Sergio Rodríguez', 24, 'Defensa Central', 'MEX'),
      P('everardo-rubio', 'Everardo Rubio', 23, 'Defensa Central', 'MEX'),
      P('keyner-brown', 'Keyner Brown', 99, 'Defensa Central', 'CRC'),
      P('yurguin-roman', 'Yurguin Román', 55, 'Lateral Izquierdo', 'CRC'),
      P('darril-araya', 'Darril Araya', 16, 'Lateral Izquierdo', 'CRC'),
      P('haxzel-quiros', 'Haxzel Quirós', 5, 'Lateral Derecho', 'CRC'),
    ],
  },
  {
    categoria: 'Mediocampistas',
    jugadores: [
      P('eduardo-juarez', 'Eduardo Juárez', 26, 'Volante de Contención', 'CRC'),
      P('allan-cruz', 'Allan Cruz', 8, 'Mediocentro', 'CRC'),
      P('aaron-murillo', 'Aarón Murillo', 22, 'Mediocentro', 'CRC'),
    ],
  },
  {
    categoria: 'Mediocampistas Ofensivos',
    jugadores: [
      P('elias-aguilar', 'Elías Aguilar', 10, 'Enganche', 'CRC'),
      P('randall-leal', 'Randall Leal', 97, 'Extremo Izquierdo', 'CRC'),
      P('ronaldo-araya', 'Ronaldo Araya', 11, 'Extremo Izquierdo', 'CRC'),
      P('keysher-fuller', 'Keysher Fuller', 37, 'Extremo Derecho', 'CRC'),
      P('emerson-bravo', 'Emerson Bravo', 25, 'Extremo Derecho', 'CRC'),
    ],
  },
  {
    categoria: 'Delanteros',
    jugadores: [
      P('jose-gonzalez', 'José González', 62, 'Centro Delantero', 'MEX'),
      P('marcel-hernandez', 'Marcel Hernández', 9, 'Centro Delantero', 'CUB'),
    ],
  },
];

export const staff = [
  { nombre: 'José Giacone', rol: 'Director Técnico' },
  { nombre: 'Diego Giacone', rol: 'Asistente Técnico' },
  { nombre: 'Douglas Brenes', rol: 'Asistente de Video' },
  { nombre: 'Miguel Segura', rol: 'Entrenador de Porteros' },
  { nombre: 'Manuel Víquez', rol: 'Preparador Físico' },
  { nombre: 'Randall Alemán', rol: 'Fisioterapeuta' },
];

export const featuredPlayers = ['dany-carvajal', 'keyner-brown', 'elias-aguilar', 'keysher-fuller', 'marcel-hernandez'];
