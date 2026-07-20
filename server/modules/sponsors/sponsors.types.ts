// Espacios publicitarios del club donde un patrocinador puede pautar.
// El id se guarda en club_sponsor_espacios; 'web' además decide si el logo
// aparece en el sitio público.
export const ESPACIOS_PAUTA = [
  { id: 'web', nombre: 'Página web' },
  { id: 'vallas_dentro', nombre: 'Vallas dentro del estadio' },
  { id: 'vallas_fuera', nombre: 'Vallas fuera del estadio' },
  { id: 'pantallas', nombre: 'Pantallas' },
  { id: 'entrada_estadio', nombre: 'Entrada del estadio' },
  { id: 'entrada_parqueo', nombre: 'Entrada del parqueo' },
] as const;

export type EspacioPautaId = typeof ESPACIOS_PAUTA[number]['id'];

export const ESPACIO_IDS: readonly string[] = ESPACIOS_PAUTA.map((e) => e.id);

export interface Sponsor {
  id: string;
  nombre: string;
  logoPath: string | null;
  orden: number;
  activo: boolean;
  esApparel: boolean;
  espacios: string[];
  creadoAt: string;
}

export interface SponsorRow {
  id: string;
  nombre: string;
  logo_path: string | null;
  orden: number;
  activo: boolean;
  es_apparel: boolean;
  espacios: string[] | null;
  creado_at: string;
}
