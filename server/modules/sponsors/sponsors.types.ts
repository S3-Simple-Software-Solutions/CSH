export interface Sponsor {
  id: string;
  nombre: string;
  logoPath: string | null;
  orden: number;
  activo: boolean;
  esApparel: boolean;
  creadoAt: string;
}

export interface SponsorRow {
  id: string;
  nombre: string;
  logo_path: string | null;
  orden: number;
  activo: boolean;
  es_apparel: boolean;
  creado_at: string;
}
