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
export const ERC_ZONE_META = {
  'sol-norte': { label: 'Sol Norte', short: 'SN', tier: 'General', color: '#b8923f', labelX: 500, labelY: 108 },
  'sol-sur': { label: 'Sol Sur', short: 'SS', tier: 'General', color: '#c9a961', labelX: 500, labelY: 612 },
  'lateral-oeste': { label: 'Lateral Oeste', short: 'LO', tier: 'Preferente', color: '#d4a84b', labelX: 128, labelY: 360 },
  'lateral-este': { label: 'Lateral Este', short: 'LE', tier: 'Preferente', color: '#e0b85c', labelX: 872, labelY: 360 },
};

/** Sectores demo con precios y stock. */
export const ERC_SECTORES = [
  { nombre: 'Sol Norte', precio: 8000, stock: 500, key: 'sol-norte' },
  { nombre: 'Sol Sur', precio: 8000, stock: 500, key: 'sol-sur' },
  { nombre: 'Lateral Este', precio: 10000, stock: 400, key: 'lateral-este' },
  { nombre: 'Lateral Oeste', precio: 10000, stock: 400, key: 'lateral-oeste' },
];

export function nombreToZoneKey(nombre) {
  const n = String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (n.includes('sol norte') || (n.includes('norte') && !n.includes('sur'))) return 'sol-norte';
  if (n.includes('sol sur') || (n.includes('sur') && !n.includes('norte'))) return 'sol-sur';
  if (n.includes('lateral este') || n === 'este' || n.includes(' oriente')) return 'lateral-este';
  if (n.includes('lateral oeste') || n === 'oeste' || n.includes(' poniente')) return 'lateral-oeste';
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
