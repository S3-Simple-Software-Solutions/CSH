/** Claves estables para zonas del Estadio Eladio Rosabal Cordero (vista 2D). */
export const ERC_LAYOUT = 'vector:erc-v1';
export const ERC_ESPECTACULO_LAYOUT = 'vector:erc-espectaculo-v1';

export const ERC_ZONE_KEYS = [
  'sol-norte',
  'sol-sur',
  'lateral-este',
  'lateral-oeste',
];

/** Tier + color por sector (escala dorado Herediano según precio). */
// Nota: las claves conservan su nombre histórico (sol-norte, etc.) como
// identificador de POSICIÓN en el mapa; la etiqueta visible es la real del
// estadio. Norte queda a la izquierda, Este arriba, Sur a la derecha, Oeste abajo.
export const ERC_ZONE_META = {
  'sol-norte': { label: 'Sol Este', short: 'SE', tier: 'General', color: '#b8923f', labelX: 500, labelY: 108 },
  'sol-sur': { label: 'Oeste', short: 'O', tier: 'General', color: '#c9a961', labelX: 500, labelY: 612 },
  'lateral-oeste': { label: 'Norte', short: 'N', tier: 'Preferente', color: '#d4a84b', labelX: 128, labelY: 360 },
  'lateral-este': { label: 'Sur', short: 'S', tier: 'Preferente', color: '#e0b85c', labelX: 872, labelY: 360 },
};

/** Sectores demo con precios y stock. */
export const ERC_SECTORES = [
  { nombre: 'Sol Este', precio: 8000, stock: 500, key: 'sol-norte' },
  { nombre: 'Oeste', precio: 8000, stock: 500, key: 'sol-sur' },
  { nombre: 'Sur', precio: 10000, stock: 400, key: 'lateral-este' },
  { nombre: 'Norte', precio: 10000, stock: 400, key: 'lateral-oeste' },
];

export function nombreToZoneKey(nombre) {
  const n = String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  // Etiquetas reales del estadio \u2192 clave de posici\u00f3n en el mapa. Ojo: "oeste"
  // contiene "este", por eso se eval\u00faa antes que el "este" suelto.
  if (n.includes('sol este')) return 'sol-norte';          // arriba
  if (n.includes('oeste') || n.includes('poniente')) return 'sol-sur';   // abajo
  if (n.includes('norte')) return 'lateral-oeste';         // izquierda
  if (n.includes('sur')) return 'lateral-este';            // derecha
  if (n.includes('este') || n.includes('oriente')) return 'sol-norte';   // arriba
  return null;
}

export function isErcVectorLayout(evento) {
  const url = evento?.mapImageUrl ?? '';
  return url === ERC_LAYOUT || url.startsWith('vector:erc');
}

export function isErcEspectaculoLayout(evento) {
  const url = evento?.mapImageUrl ?? '';
  return url === ERC_ESPECTACULO_LAYOUT || evento?.formato === 'espectaculo';
}

/** Metadatos visuales por zona de gramilla (colores verdes/dorados). */
export const GRAMILLA_ZONE_META = {
  'gramilla-1': { label: 'Gramilla A', short: 'GA', tier: 'Gramilla', color: '#5a9e40' },
  'gramilla-2': { label: 'Gramilla B', short: 'GB', tier: 'Gramilla', color: '#3e8c62' },
  'gramilla-3': { label: 'Gramilla C', short: 'GC', tier: 'Gramilla', color: '#2e7d50' },
  'gramilla-4': { label: 'Gramilla D', short: 'GD', tier: 'Gramilla', color: '#c9a961' },
};

export const GRAMILLA_SECTORES = [
  { nombre: 'Gramilla A', precio: 15000, stock: 300, key: 'gramilla-1' },
  { nombre: 'Gramilla B', precio: 15000, stock: 300, key: 'gramilla-2' },
  { nombre: 'Gramilla C', precio: 15000, stock: 300, key: 'gramilla-3' },
  { nombre: 'Gramilla D', precio: 15000, stock: 300, key: 'gramilla-4' },
];

export function zoneColor(key) {
  return ERC_ZONE_META[key]?.color ?? '#c9a961';
}

/**
 * Orientación del bowl para el selector de butacas: de qué lado queda la cancha
 * según la tribuna, para que cada grada se vea "mirando" a la cancha (no un cine).
 * La fila A (más cercana a la cancha) queda del lado que devuelve esta función.
 */
export function orientationForZone(key) {
  switch (key) {
    case 'sol-norte': return 'field-bottom';  // tribuna arriba → cancha abajo
    case 'sol-sur': return 'field-top';        // tribuna abajo → cancha arriba
    case 'lateral-oeste': return 'field-right'; // tribuna izquierda → cancha a la derecha
    case 'lateral-este': return 'field-left';   // tribuna derecha → cancha a la izquierda
    default: return 'field-bottom';             // gramilla / desconocido
  }
}

export function mapaFromZoneKey(key) {
  const meta = ERC_ZONE_META[key];
  if (!meta) return null;
  return {
    shape: 'zone',
    points: { key },
    color: meta.color,
    labelX: meta.labelX / 1000,
    labelY: meta.labelY / 720,
  };
}
