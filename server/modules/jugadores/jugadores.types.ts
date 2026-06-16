export type Categoria = 'Porteros' | 'Defensas' | 'Mediocampistas' | 'Mediocampistas Ofensivos' | 'Delanteros' | 'Staff';

export interface Jugador {
  id: string;
  slug: string;
  nombre: string;
  dorsal: number | null;
  posicion: string | null;
  categoria: Categoria;
  nacionalidad: string;
  fotoPath: string | null;
  destacado: boolean;
  orden: number;
  activo: boolean;
  creadoAt: string;
}

export interface JugadorRow {
  id: string;
  slug: string;
  nombre: string;
  dorsal: number | null;
  posicion: string | null;
  categoria: string;
  nacionalidad: string;
  foto_path: string | null;
  destacado: boolean;
  orden: number;
  activo: boolean;
  creado_at: string;
}
