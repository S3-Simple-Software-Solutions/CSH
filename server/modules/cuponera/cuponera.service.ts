import { genId } from '../../core/id';
import { ApiError } from '../../core/errors';
import type { AdminUser } from '../usuarios/usuarios.data';
import { canManageCoupons } from '../usuarios/usuarios.service';
import {
  CUPON_CATEGORIAS,
  couponStats,
  deleteCupon,
  findAllCupones,
  findCuponById,
  findCuponesPublicos,
  findRecentCuponEventos,
  insertCupon,
  insertCuponEvento,
  publicCoupon,
  resolveSponsorLogo,
  updateCupon,
} from './cuponera.repository';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertCanManageCupon(user: AdminUser, cuponProveedor: string): void {
  if (!canManageCoupons(user)) throw new ApiError(403, 'Sin permiso para administrar cupones');
  if (user.couponRole === 'patrocinador' && cuponProveedor !== user.sponsor) {
    throw new ApiError(403, 'Solo puedes gestionar cupones de tu patrocinador');
  }
}

export async function getPublicCuponera() {
  const cupones = (await findCuponesPublicos()).map(publicCoupon);
  return { cupones, stats: couponStats(cupones) };
}

export async function getAdminCuponera(user: AdminUser) {
  const scope = user.couponRole === 'patrocinador' ? user.sponsor : '';
  const cupones = (await findAllCupones(scope || undefined)).map(publicCoupon);
  const eventos = await findRecentCuponEventos(50);
  return {
    cupones,
    eventos,
    stats: couponStats(cupones),
    role: user.couponRole || 'socio',
    sponsor: scope || '',
    categorias: CUPON_CATEGORIAS,
  };
}

export async function setCuponEstado(user: AdminUser, cuponId: string, estado: string) {
  const cupon = await findCuponById(cuponId);
  if (!cupon) throw new ApiError(404, 'Cupon no encontrado');
  assertCanManageCupon(user, cupon.proveedor);
  if (!['habilitado', 'retirado'].includes(estado)) throw new ApiError(400, 'Estado invalido');
  const updated = await updateCupon(cuponId, { estado: estado as 'habilitado' | 'retirado' });
  if (!updated) throw new ApiError(404, 'Cupon no encontrado');
  await insertCuponEvento({
    id: genId('CE'),
    cuponId: updated.id,
    proveedor: updated.proveedor,
    estado,
    userId: user.id,
    userName: user.name,
  });
  const all = await findAllCupones(user.couponRole === 'patrocinador' ? user.sponsor : undefined);
  return { cupon: publicCoupon(updated), stats: couponStats(all.map(publicCoupon)) };
}

export async function createCupon(user: AdminUser, body: Record<string, unknown>) {
  if (!canManageCoupons(user)) throw new ApiError(403, 'Sin permiso para administrar cupones');
  const proveedor = String(body.proveedor || '').trim();
  if (!proveedor) throw new ApiError(400, 'Proveedor obligatorio');
  if (user.couponRole === 'patrocinador' && proveedor !== user.sponsor) {
    throw new ApiError(403, 'Solo puedes crear cupones de tu patrocinador');
  }
  const titulo = String(body.titulo || '').trim();
  const codigo = String(body.codigo || '').trim().toUpperCase();
  if (!titulo || !codigo) throw new ApiError(400, 'Titulo y codigo son obligatorios');
  const { sponsorId, logo } = await resolveSponsorLogo(proveedor);
  const cupon = await insertCupon({
    id: genId('CUP'),
    sponsorId,
    proveedor,
    logo: logo || String(body.logo || ''),
    titulo,
    descripcion: String(body.descripcion || '').trim(),
    codigo,
    categoria: String(body.categoria || 'Otros').trim(),
    descuento: Number(body.descuento || 0),
    vigencia: String(body.vigencia || new Date(Date.now() + 30 * 86400000).toISOString()),
    limite: Math.max(1, Number(body.limite || 100)),
    estado: 'habilitado',
  });
  await insertCuponEvento({
    id: genId('CE'),
    cuponId: cupon.id,
    proveedor: cupon.proveedor,
    estado: 'creado',
    userId: user.id,
    userName: user.name,
  });
  const all = await findAllCupones(user.couponRole === 'patrocinador' ? user.sponsor : undefined);
  return { cupon: publicCoupon(cupon), stats: couponStats(all.map(publicCoupon)) };
}

export async function patchCupon(user: AdminUser, cuponId: string, body: Record<string, unknown>) {
  const cupon = await findCuponById(cuponId);
  if (!cupon) throw new ApiError(404, 'Cupon no encontrado');
  assertCanManageCupon(user, cupon.proveedor);
  const proveedor = body.proveedor !== undefined ? String(body.proveedor).trim() : cupon.proveedor;
  if (user.couponRole === 'patrocinador' && proveedor !== user.sponsor) {
    throw new ApiError(403, 'Solo puedes editar cupones de tu patrocinador');
  }
  const sponsor = proveedor !== cupon.proveedor ? await resolveSponsorLogo(proveedor) : { sponsorId: cupon.sponsorId, logo: cupon.logo };
  const updated = await updateCupon(cuponId, {
    proveedor,
    sponsorId: sponsor.sponsorId,
    logo: sponsor.logo || cupon.logo,
    ...(body.titulo !== undefined && { titulo: String(body.titulo).trim() }),
    ...(body.descripcion !== undefined && { descripcion: String(body.descripcion).trim() }),
    ...(body.codigo !== undefined && { codigo: String(body.codigo).trim().toUpperCase() }),
    ...(body.categoria !== undefined && { categoria: String(body.categoria).trim() }),
    ...(body.descuento !== undefined && { descuento: Number(body.descuento) }),
    ...(body.vigencia !== undefined && { vigencia: String(body.vigencia) }),
    ...(body.limite !== undefined && { limite: Math.max(1, Number(body.limite)) }),
  });
  if (!updated) throw new ApiError(404, 'Cupon no encontrado');
  const all = await findAllCupones(user.couponRole === 'patrocinador' ? user.sponsor : undefined);
  return { cupon: publicCoupon(updated), stats: couponStats(all.map(publicCoupon)) };
}

export async function removeCupon(user: AdminUser, cuponId: string) {
  if (user.couponRole !== 'admin') throw new ApiError(403, 'Solo administradores pueden eliminar cupones');
  const cupon = await findCuponById(cuponId);
  if (!cupon) throw new ApiError(404, 'Cupon no encontrado');
  const ok = await deleteCupon(cuponId);
  if (!ok) throw new ApiError(404, 'Cupon no encontrado');
  const all = await findAllCupones();
  return { stats: couponStats(all.map(publicCoupon)) };
}
