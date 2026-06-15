import { ApiError } from '../../core/errors';
import type { AdminUser } from '../usuarios/usuarios.data';
import { canManageCoupons } from '../usuarios/usuarios.service';
import { couponStats, publicCoupon, readCuponeraData, writeCuponeraData } from './cuponera.repository';

export function getPublicCuponera() {
  const data = readCuponeraData();
  const cupones = data.cupones.filter((c) => c.estado === 'habilitado').map(publicCoupon);
  return { cupones, stats: couponStats(data.cupones) };
}

export function getAdminCuponera(user: AdminUser) {
  const data = readCuponeraData();
  const scope = user.couponRole === 'patrocinador' ? user.sponsor : '';
  const cupones = data.cupones.filter((c) => !scope || c.proveedor === scope).map(publicCoupon);
  return {
    cupones,
    eventos: data.eventos.slice().reverse().slice(0, 50),
    stats: couponStats(cupones),
    role: user.couponRole || 'socio',
    sponsor: scope || '',
  };
}

export function setCuponEstado(user: AdminUser, cuponId: string, estado: string) {
  if (!canManageCoupons(user)) throw new ApiError(403, 'Sin permiso para administrar cupones');
  if (!['habilitado', 'retirado'].includes(estado)) throw new ApiError(400, 'Estado invalido');
  const data = readCuponeraData();
  const cupon = data.cupones.find((c) => c.id === cuponId);
  if (!cupon) throw new ApiError(404, 'Cupon no encontrado');
  if (user.couponRole === 'patrocinador' && cupon.proveedor !== user.sponsor) throw new ApiError(403, 'Solo puedes gestionar cupones de tu patrocinador');
  cupon.estado = estado as 'habilitado' | 'retirado';
  cupon.actualizado = new Date().toISOString();
  data.eventos.push({ id: `CE-${Date.now().toString(36)}`, cuponId: cupon.id, proveedor: cupon.proveedor, estado, userId: user.id, userName: user.name, timestamp: cupon.actualizado });
  writeCuponeraData(data);
  return { cupon: publicCoupon(cupon), stats: couponStats(data.cupones) };
}
