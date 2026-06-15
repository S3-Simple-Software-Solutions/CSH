import fs from 'fs';
import { CUPONERA_FILE, OFFICIAL_SPONSORS } from '../../config/constants';
import { Cupon, CuponeraData, CuponStats } from './cuponera.types';

function initCuponeraJsonShape(): CuponeraData {
  const offers = ['20% en articulo seleccionado', '2x1 en combo familiar', '15% pagando con tarjeta CSH', 'Upgrade gratis', '10% en tienda oficial', 'Bebida gratis', 'Envio sin costo'];
  const categories = ['Indumentaria', 'Alimentos', 'Finanzas', 'Hidratacion', 'Automotriz', 'Entretenimiento'];
  return {
    cupones: OFFICIAL_SPONSORS.map((s, index) => ({
      id: `CUP-${String(index + 1).padStart(3, '0')}`,
      proveedor: s.name,
      logo: s.path,
      titulo: offers[index % offers.length],
      descripcion: `Beneficio demo para socios CSH con ${s.name}.`,
      codigo: `CSH${String(s.name).replace(/\W/g, '').slice(0, 4).toUpperCase()}${10 + index}`,
      categoria: categories[index % categories.length],
      descuento: [20, 25, 15, 30, 10, 12, 18][index % 7],
      vigencia: new Date(Date.now() + (index + 14) * 86400000).toISOString(),
      estado: index === 2 ? 'retirado' : 'habilitado',
      usos: 40 + index * 9,
      limite: 120 + index * 20,
      actualizado: new Date().toISOString(),
    })),
    eventos: [],
  };
}

export function readCuponeraData(): CuponeraData {
  if (!fs.existsSync(CUPONERA_FILE)) {
    const initial = initCuponeraJsonShape();
    writeCuponeraData(initial);
    return initial;
  }
  try {
    const data = JSON.parse(fs.readFileSync(CUPONERA_FILE, 'utf8'));
    return {
      cupones: Array.isArray(data.cupones) ? data.cupones : [],
      eventos: Array.isArray(data.eventos) ? data.eventos : [],
    };
  } catch {
    const initial = initCuponeraJsonShape();
    writeCuponeraData(initial);
    return initial;
  }
}

export function writeCuponeraData(data: CuponeraData): void {
  fs.writeFileSync(CUPONERA_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

export function publicCoupon(cupon: Cupon): Cupon {
  return {
    id: cupon.id,
    proveedor: cupon.proveedor,
    logo: cupon.logo,
    titulo: cupon.titulo,
    descripcion: cupon.descripcion,
    codigo: cupon.codigo,
    categoria: cupon.categoria,
    descuento: cupon.descuento,
    vigencia: cupon.vigencia,
    estado: cupon.estado,
    usos: cupon.usos,
    limite: cupon.limite,
    actualizado: cupon.actualizado,
  };
}

export function couponStats(cupones: Cupon[]): CuponStats {
  const enabled = cupones.filter((c) => c.estado === 'habilitado').length;
  return { total: cupones.length, habilitados: enabled, retirados: cupones.length - enabled, usos: cupones.reduce((sum, c) => sum + Number(c.usos || 0), 0) };
}
