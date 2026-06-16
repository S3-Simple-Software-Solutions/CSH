export type EstadoNoticia = 'borrador' | 'publicado';
export type CategoriaNoticia = 'Noticias' | 'Refuerzos' | 'Comunicados' | 'Crónicas' | 'Cantera' | 'Femenino' | 'Entradas';

export const CATEGORIAS_NOTICIA: CategoriaNoticia[] = ['Noticias', 'Refuerzos', 'Comunicados', 'Crónicas', 'Cantera', 'Femenino', 'Entradas'];

export interface Noticia {
  id: string;
  slug: string;
  titulo: string;
  categoria: CategoriaNoticia;
  fuente: string;
  resumen: string;
  imagenPath: string | null;
  estado: EstadoNoticia;
  fecha: string;
  creadoAt: string;
}

export interface NoticiaRow {
  id: string;
  slug: string;
  titulo: string;
  categoria: string;
  fuente: string;
  resumen: string;
  imagen_path: string | null;
  estado: string;
  fecha: string;
  creado_at: string;
}
