/** Zonas del layout vectorial ERC v1 (servidor). */
export const ERC_LAYOUT = 'vector:erc-v1';

export const ERC_ZONE_KEYS = [
  'sol-norte',
  'sol-sur',
  'lateral-este',
  'lateral-oeste',
] as const;

export type ErcZoneKey = typeof ERC_ZONE_KEYS[number];

export const ERC_SECTORES = [
  { nombre: 'Sol Norte', precio: 8000, stock: 500, key: 'sol-norte', color: '#b8923f' },
  { nombre: 'Sol Sur', precio: 8000, stock: 500, key: 'sol-sur', color: '#c9a961' },
  { nombre: 'Lateral Este', precio: 10000, stock: 400, key: 'lateral-este', color: '#e0b85c' },
  { nombre: 'Lateral Oeste', precio: 10000, stock: 400, key: 'lateral-oeste', color: '#d4a84b' },
];

export const GRAMILLA_ZONE_KEYS = ['gramilla-1', 'gramilla-2', 'gramilla-3', 'gramilla-4'] as const;
export type GramilllaZoneKey = typeof GRAMILLA_ZONE_KEYS[number];

/** Colores default por zona de gramilla (tono verde/dorado distinto de tribunas). */
export const GRAMILLA_SECTORES: Record<GramilllaZoneKey, { nombre: string; color: string; precio: number; stock: number }> = {
  'gramilla-1': { nombre: 'Gramilla A', color: '#5a9e40', precio: 15000, stock: 300 },
  'gramilla-2': { nombre: 'Gramilla B', color: '#3e8c62', precio: 15000, stock: 300 },
  'gramilla-3': { nombre: 'Gramilla C', color: '#2e7d50', precio: 15000, stock: 300 },
  'gramilla-4': { nombre: 'Gramilla D', color: '#c9a961', precio: 15000, stock: 300 },
};

export function isValidZoneKey(key: string): boolean {
  return (ERC_ZONE_KEYS as readonly string[]).includes(key) || /^gramilla-[1-4]$/.test(key);
}

export function mapaFromZoneKey(key: string): { shape: 'zone'; points: { key: string }; color: string } | null {
  const tribuna = ERC_SECTORES.find((x) => x.key === key);
  if (tribuna) return { shape: 'zone', points: { key }, color: tribuna.color };
  const gKey = key as GramilllaZoneKey;
  if (GRAMILLA_SECTORES[gKey]) return { shape: 'zone', points: { key }, color: GRAMILLA_SECTORES[gKey].color };
  return null;
}
