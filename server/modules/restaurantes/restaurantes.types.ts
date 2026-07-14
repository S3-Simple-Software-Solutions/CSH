// Tipos del módulo de restaurantes (pedidos de comida en el estadio).
// Dinero siempre en colones enteros (columnas *_crc).

export type RestauranteEstado = 'activo' | 'suspendido';
export type EntregaTipo = 'pickup' | 'asiento';

// Ciclo de vida de la orden:
//  pendiente_pago →(webhook paid)→ pendiente → en_preparacion → listo → entregada
//  pendiente/en_preparacion → rechazada (con motivo)
//  pendiente_pago →(webhook expired)→ cancelada
export type OrdenEstado =
  | 'pendiente_pago'
  | 'pendiente'
  | 'en_preparacion'
  | 'listo'
  | 'entregada'
  | 'rechazada'
  | 'cancelada';

export interface Restaurante {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  imagenUrl: string;
  abierto: boolean;
  estado: RestauranteEstado;
  tiempoPrepMin: number;
  ownerUserId: string;
  creadoAt: string;
}

export interface MenuCategoria {
  id: string;
  restauranteId: string;
  nombre: string;
  orden: number;
}

export interface MenuItem {
  id: string;
  restauranteId: string;
  categoriaId: string | null;
  nombre: string;
  descripcion: string;
  precioCrc: number;
  imagenUrl: string;
  disponible: boolean;
  orden: number;
}

export interface OrdenLinea {
  itemId: string;
  nombre: string;
  precioCrc: number;
  cantidad: number;
}

export interface Entrega {
  tipo: EntregaTipo;
  seccion: string;
  fila: string;
  asiento: string;
}

// Pago normalizado por la pasarela (misma forma que PagoEntrada).
export interface PagoRestaurante {
  transaccion: string;
  monto: number;
  timestamp: string;
  metodo: string;
}

export interface OrdenRestaurante {
  id: string;
  restauranteId: string;
  restauranteNombre: string;
  codigo: string;
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  entrega: Entrega;
  notas: string;
  lineas: OrdenLinea[];
  subtotalCrc: number;
  feeCrc: number;
  totalCrc: number;
  estado: OrdenEstado;
  rechazoMotivo: string;
  creadoAt: string;
  pagadaAt: string | null;
  entregadaAt: string | null;
}

export interface RestauranteConfig {
  feeCrcDefault: number;
}
