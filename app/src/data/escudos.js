// Escudos de equipos. Mapea por nombre normalizado (sin acentos ni sufijos como
// "FC" / "Club Sport" / "Deportivo") a la ruta del escudo en /brand/escudos.
// Equipos sin escudo conocido caen al placeholder generico.

export const ESCUDO_GENERICO = '/brand/escudos/_generico.svg';

const ESCUDOS = {
  herediano: '/brand/logo-shield.png',
  saprissa: '/brand/escudos/saprissa.png',
  cartagines: '/brand/escudos/cartagines.svg',
  puntarenas: '/brand/escudos/puntarenas.svg',
};

function normalizar(nombre) {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[._-]/g, ' ')
    .replace(/\b(f\s*c|club sport|c\s*s|deportivo|sad|s\s*a\s*d|sociedad anonima deportiva)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

export function escudoFor(nombre) {
  return ESCUDOS[normalizar(nombre)] || ESCUDO_GENERICO;
}
