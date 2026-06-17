export interface Cupon {
  id: string;
  sponsorId?: string | null;
  proveedor: string;
  logo: string;
  titulo: string;
  descripcion: string;
  codigo: string;
  categoria: string;
  descuento: number;
  vigencia: string;
  estado: 'habilitado' | 'retirado';
  usos: number;
  limite: number;
  actualizado: string;
}

export interface CuponEvento {
  id: string;
  cuponId: string;
  proveedor: string;
  estado: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface CuponeraData {
  cupones: Cupon[];
  eventos: CuponEvento[];
}

export interface CuponStats {
  total: number;
  habilitados: number;
  retirados: number;
  usos: number;
}
