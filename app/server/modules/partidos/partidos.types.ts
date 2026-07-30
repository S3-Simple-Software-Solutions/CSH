export type TipoPartido = 'proximo' | 'resultado';
export type EstadoPartido = 'programado' | 'jugado' | 'cancelado' | 'pospuesto';

export interface Partido {
  id: string;
  competicion: string;
  tipo: TipoPartido;
  equipoLocal: string;
  equipoVisita: string;
  logoVisitaPath: string | null;
  fecha: string;
  estadio: string | null;
  golesLocal: number | null;
  golesVisita: number | null;
  estado: EstadoPartido;
  creadoAt: string;
}

export interface PartidoRow {
  id: string;
  competicion: string;
  tipo: string;
  equipo_local: string;
  equipo_visita: string;
  logo_visita_path: string | null;
  fecha: string;
  estadio: string | null;
  goles_local: number | null;
  goles_visita: number | null;
  estado: string;
  creado_at: string;
}
