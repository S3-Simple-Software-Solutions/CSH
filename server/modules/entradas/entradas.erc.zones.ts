/** Zonas del layout vectorial ERC v1 (servidor). */
export const ERC_LAYOUT = 'vector:erc-v1';

export const ERC_ZONE_KEYS = [
  'sol-norte',
  'sol-sur',
  'lateral-este',
  'lateral-oeste',
  'palco',
  'socio',
] as const;

export type ErcZoneKey = typeof ERC_ZONE_KEYS[number];

export const ERC_SECTORES = [
  { nombre: 'Sol Norte', precio: 8000, stock: 500, key: 'sol-norte', color: '#d4a84b' },
  { nombre: 'Sol Sur', precio: 8000, stock: 500, key: 'sol-sur', color: '#c9a961' },
  { nombre: 'Lateral Este', precio: 10000, stock: 400, key: 'lateral-este', color: '#e8c468' },
  { nombre: 'Lateral Oeste', precio: 10000, stock: 400, key: 'lateral-oeste', color: '#b8923f' },
  { nombre: 'Palco', precio: 25000, stock: 50, key: 'palco', color: '#f0d078' },
  { nombre: 'Socio', precio: 5000, stock: 200, key: 'socio', color: '#a67c32' },
];

export function mapaFromZoneKey(key: string): { shape: 'zone'; points: { key: string }; color: string } | null {
  const s = ERC_SECTORES.find((x) => x.key === key);
  if (!s) return null;
  return { shape: 'zone', points: { key }, color: s.color };
}
