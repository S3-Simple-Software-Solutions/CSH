import { pool, query } from '../../core/db';
import { genId, slugify } from '../../core/id';
import type { Categoria } from './jugadores.types';

export async function ensureJugadoresSchema(): Promise<void> {
  await pool.query(`
    create table if not exists jugadores (
      id text primary key,
      slug text unique not null,
      nombre text not null,
      dorsal integer,
      posicion text,
      categoria text not null default 'Jugadores',
      nacionalidad text not null default 'CRC',
      foto_path text,
      destacado boolean not null default false,
      orden integer not null default 0,
      activo boolean not null default true,
      creado_at timestamptz not null default now()
    );
    alter table jugadores add column if not exists destacado boolean not null default false;
    alter table jugadores add column if not exists orden integer not null default 0;
    alter table jugadores add column if not exists activo boolean not null default true;
  `);

  const { count } = (await query<{ count: number }>('select count(*)::int as count from jugadores'))[0];
  if (count === 0) await seedJugadores();
}

type SeedPlayer = { nombre: string; dorsal?: number; posicion?: string; categoria: Categoria; nacionalidad?: string; foto?: string; destacado?: boolean; orden?: number };

async function seedJugadores(): Promise<void> {
  const jugadores: SeedPlayer[] = [
    // Porteros
    { nombre: 'Dany Carvajal', dorsal: 31, posicion: 'Portero', categoria: 'Porteros', foto: '/brand/players/dany-carvajal.jpg', destacado: true, orden: 0 },
    { nombre: 'Anthony Walker', dorsal: 92, posicion: 'Portero', categoria: 'Porteros', foto: '/brand/players/anthony-walker.jpg', orden: 1 },
    // Defensas
    { nombre: 'Getsel Montes', dorsal: 38, posicion: 'Defensa Central', categoria: 'Defensas', nacionalidad: 'HON', foto: '/brand/players/getsel-montes.jpg', orden: 2 },
    { nombre: 'Sergio Rodríguez', dorsal: 24, posicion: 'Defensa Central', categoria: 'Defensas', nacionalidad: 'MEX', foto: '/brand/players/sergio-rodriguez.jpg', orden: 3 },
    { nombre: 'Everardo Rubio', dorsal: 23, posicion: 'Defensa Central', categoria: 'Defensas', nacionalidad: 'MEX', foto: '/brand/players/everardo-rubio.jpg', orden: 4 },
    { nombre: 'Keyner Brown', dorsal: 99, posicion: 'Defensa Central', categoria: 'Defensas', foto: '/brand/players/keyner-brown.jpg', destacado: true, orden: 5 },
    { nombre: 'Yurguin Román', dorsal: 55, posicion: 'Lateral Izquierdo', categoria: 'Defensas', foto: '/brand/players/yurguin-roman.jpg', orden: 6 },
    { nombre: 'Darril Araya', dorsal: 16, posicion: 'Lateral Izquierdo', categoria: 'Defensas', foto: '/brand/players/darril-araya.jpg', orden: 7 },
    { nombre: 'Haxzel Quirós', dorsal: 5, posicion: 'Lateral Derecho', categoria: 'Defensas', foto: '/brand/players/haxzel-quiros.jpg', orden: 8 },
    // Mediocampistas
    { nombre: 'Eduardo Juárez', dorsal: 26, posicion: 'Volante de Contención', categoria: 'Mediocampistas', foto: '/brand/players/eduardo-juarez.jpg', orden: 9 },
    { nombre: 'Allan Cruz', dorsal: 8, posicion: 'Mediocentro', categoria: 'Mediocampistas', foto: '/brand/players/allan-cruz.jpg', orden: 10 },
    { nombre: 'Aarón Murillo', dorsal: 22, posicion: 'Mediocentro', categoria: 'Mediocampistas', foto: '/brand/players/aaron-murillo.jpg', orden: 11 },
    // Mediocampistas Ofensivos
    { nombre: 'Elías Aguilar', dorsal: 10, posicion: 'Enganche', categoria: 'Mediocampistas Ofensivos', foto: '/brand/players/elias-aguilar.jpg', destacado: true, orden: 12 },
    { nombre: 'Randall Leal', dorsal: 97, posicion: 'Extremo Izquierdo', categoria: 'Mediocampistas Ofensivos', foto: '/brand/players/randall-leal.jpg', orden: 13 },
    { nombre: 'Ronaldo Araya', dorsal: 11, posicion: 'Extremo Izquierdo', categoria: 'Mediocampistas Ofensivos', foto: '/brand/players/ronaldo-araya.jpg', orden: 14 },
    { nombre: 'Keysher Fuller', dorsal: 37, posicion: 'Extremo Derecho', categoria: 'Mediocampistas Ofensivos', foto: '/brand/players/keysher-fuller.jpg', destacado: true, orden: 15 },
    { nombre: 'Emerson Bravo', dorsal: 25, posicion: 'Extremo Derecho', categoria: 'Mediocampistas Ofensivos', foto: '/brand/players/emerson-bravo.jpg', orden: 16 },
    // Delanteros
    { nombre: 'José González', dorsal: 62, posicion: 'Centro Delantero', categoria: 'Delanteros', nacionalidad: 'MEX', foto: '/brand/players/jose-gonzalez.jpg', orden: 17 },
    { nombre: 'Marcel Hernández', dorsal: 9, posicion: 'Centro Delantero', categoria: 'Delanteros', nacionalidad: 'CUB', foto: '/brand/players/marcel-hernandez.jpg', destacado: true, orden: 18 },
    // Staff
    { nombre: 'José Giacone', posicion: 'Director Técnico', categoria: 'Staff', orden: 19 },
    { nombre: 'Diego Giacone', posicion: 'Asistente Técnico', categoria: 'Staff', orden: 20 },
    { nombre: 'Douglas Brenes', posicion: 'Asistente de Video', categoria: 'Staff', orden: 21 },
    { nombre: 'Miguel Segura', posicion: 'Entrenador de Porteros', categoria: 'Staff', orden: 22 },
    { nombre: 'Manuel Víquez', posicion: 'Preparador Físico', categoria: 'Staff', orden: 23 },
    { nombre: 'Randall Alemán', posicion: 'Fisioterapeuta', categoria: 'Staff', orden: 24 },
  ];

  for (const j of jugadores) {
    await pool.query(
      `insert into jugadores (id, slug, nombre, dorsal, posicion, categoria, nacionalidad, foto_path, destacado, orden)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (slug) do nothing`,
      [
        genId('JUG'),
        slugify(j.nombre),
        j.nombre,
        j.dorsal ?? null,
        j.posicion ?? null,
        j.categoria,
        j.nacionalidad ?? 'CRC',
        j.foto ?? null,
        j.destacado ?? false,
        j.orden ?? 0,
      ],
    );
  }
}
