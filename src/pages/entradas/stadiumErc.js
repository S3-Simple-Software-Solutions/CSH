/** Claves estables para zonas del Estadio Eladio Rosabal Cordero (vista 2D). */
export const ERC_LAYOUT = 'vector:erc-v1';

export const ERC_ZONE_KEYS = [
  'sol-norte',
  'sol-sur',
  'lateral-este',
  'lateral-oeste',
  'palco',
  'socio',
];

/** Colores base del club — variaciones dorado/ámbar para distinguir zonas. */
export const ERC_ZONE_META = {
  'sol-norte': { label: 'Sol Norte', short: 'SN', color: '#d4a84b', labelX: 500, labelY: 95 },
  'sol-sur': { label: 'Sol Sur', short: 'SS', color: '#c9a961', labelX: 500, labelY: 625 },
  'lateral-este': { label: 'Lateral Este', short: 'LE', color: '#e8c468', labelX: 865, labelY: 360 },
  'lateral-oeste': { label: 'Lateral Oeste', short: 'LO', color: '#b8923f', labelX: 135, labelY: 260 },
  'palco': { label: 'Palco', short: 'P', color: '#f0d078', labelX: 500, labelY: 360 },
  'socio': { label: 'Socio', short: 'S', color: '#a67c32', labelX: 135, labelY: 480 },
};

/** Sectores demo con precios y stock. */
export const ERC_SECTORES = [
  { nombre: 'Sol Norte', precio: 8000, stock: 500, key: 'sol-norte' },
  { nombre: 'Sol Sur', precio: 8000, stock: 500, key: 'sol-sur' },
  { nombre: 'Lateral Este', precio: 10000, stock: 400, key: 'lateral-este' },
  { nombre: 'Lateral Oeste', precio: 10000, stock: 400, key: 'lateral-oeste' },
  { nombre: 'Palco', precio: 25000, stock: 50, key: 'palco' },
  { nombre: 'Socio', precio: 5000, stock: 200, key: 'socio' },
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
  if (n.includes('palco')) return 'palco';
  if (n.includes('socio')) return 'socio';
  return null;
}

export function isErcVectorLayout(evento) {
  const url = evento?.mapImageUrl ?? '';
  return url === ERC_LAYOUT || url.startsWith('vector:erc');
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
