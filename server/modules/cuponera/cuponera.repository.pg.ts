import { pool, query } from '../../core/db';
import type { Cupon, CuponEvento, CuponStats } from './cuponera.types';

interface CuponRow {
  id: string;
  sponsor_id: string | null;
  proveedor: string;
  logo: string;
  titulo: string;
  descripcion: string;
  codigo: string;
  categoria: string;
  descuento: number;
  vigencia: string;
  estado: string;
  usos: number;
  limite: number;
  actualizado_at: string;
}

interface CuponEventoRow {
  id: string;
  cupon_id: string | null;
  proveedor: string | null;
  estado: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

function toCupon(r: CuponRow): Cupon {
  return {
    id: r.id,
    sponsorId: r.sponsor_id,
    proveedor: r.proveedor,
    logo: r.logo,
    titulo: r.titulo,
    descripcion: r.descripcion,
    codigo: r.codigo,
    categoria: r.categoria,
    descuento: r.descuento,
    vigencia: r.vigencia,
    estado: r.estado as Cupon['estado'],
    usos: r.usos,
    limite: r.limite,
    actualizado: r.actualizado_at,
  };
}

function toEvento(r: CuponEventoRow): CuponEvento {
  return {
    id: r.id,
    cuponId: r.cupon_id || '',
    proveedor: r.proveedor || '',
    estado: r.estado || '',
    userId: r.user_id || '',
    userName: r.user_name || '',
    timestamp: r.created_at,
  };
}

export function couponStats(cupones: Cupon[]): CuponStats {
  const enabled = cupones.filter((c) => c.estado === 'habilitado').length;
  return {
    total: cupones.length,
    habilitados: enabled,
    retirados: cupones.length - enabled,
    usos: cupones.reduce((sum, c) => sum + Number(c.usos || 0), 0),
  };
}

export function publicCoupon(cupon: Cupon): Cupon {
  return { ...cupon };
}

export async function findCuponesPublicos(): Promise<Cupon[]> {
  const rows = await query<CuponRow>(
    `select * from cupones
     where estado='habilitado' and vigencia > now()
     order by proveedor asc`,
  );
  return rows.map(toCupon);
}

export async function findAllCupones(proveedorFilter?: string): Promise<Cupon[]> {
  const rows = proveedorFilter
    ? await query<CuponRow>('select * from cupones where proveedor=$1 order by proveedor asc, titulo asc', [proveedorFilter])
    : await query<CuponRow>('select * from cupones order by proveedor asc, titulo asc');
  return rows.map(toCupon);
}

export async function findCuponById(id: string): Promise<Cupon | null> {
  const rows = await query<CuponRow>('select * from cupones where id=$1', [id]);
  return rows[0] ? toCupon(rows[0]) : null;
}

export async function findRecentCuponEventos(limit = 50): Promise<CuponEvento[]> {
  const rows = await query<CuponEventoRow>(
    'select * from cupon_eventos order by created_at desc limit $1',
    [limit],
  );
  return rows.map(toEvento);
}

export async function insertCuponEvento(e: Omit<CuponEvento, 'timestamp'> & { timestamp?: string }): Promise<void> {
  await pool.query(
    `insert into cupon_eventos (id, cupon_id, proveedor, estado, user_id, user_name, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [e.id, e.cuponId, e.proveedor, e.estado, e.userId, e.userName, e.timestamp || new Date().toISOString()],
  );
}

export async function resolveSponsorLogo(proveedor: string): Promise<{ sponsorId: string | null; logo: string }> {
  const rows = await query<{ id: string; logo_path: string | null }>(
    'select id, logo_path from club_sponsors where nombre=$1 limit 1',
    [proveedor],
  );
  if (!rows[0]) return { sponsorId: null, logo: '' };
  return { sponsorId: rows[0].id, logo: rows[0].logo_path || '' };
}

export async function insertCupon(fields: {
  id: string;
  sponsorId: string | null;
  proveedor: string;
  logo: string;
  titulo: string;
  descripcion: string;
  codigo: string;
  categoria: string;
  descuento: number;
  vigencia: string;
  limite: number;
  estado?: Cupon['estado'];
}): Promise<Cupon> {
  const rows = await query<CuponRow>(
    `insert into cupones (id, sponsor_id, proveedor, logo, titulo, descripcion, codigo, categoria, descuento, vigencia, estado, limite)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
    [
      fields.id,
      fields.sponsorId,
      fields.proveedor,
      fields.logo,
      fields.titulo,
      fields.descripcion,
      fields.codigo,
      fields.categoria,
      fields.descuento,
      fields.vigencia,
      fields.estado || 'habilitado',
      fields.limite,
    ],
  );
  return toCupon(rows[0]);
}

export async function updateCupon(
  id: string,
  patch: Partial<{
    proveedor: string;
    logo: string;
    sponsorId: string | null;
    titulo: string;
    descripcion: string;
    codigo: string;
    categoria: string;
    descuento: number;
    vigencia: string;
    limite: number;
    estado: Cupon['estado'];
  }>,
): Promise<Cupon | null> {
  const current = await findCuponById(id);
  if (!current) return null;
  const rows = await query<CuponRow>(
    `update cupones set
      sponsor_id=$2, proveedor=$3, logo=$4, titulo=$5, descripcion=$6, codigo=$7,
      categoria=$8, descuento=$9, vigencia=$10, limite=$11, estado=$12, actualizado_at=now()
     where id=$1 returning *`,
    [
      id,
      patch.sponsorId !== undefined ? patch.sponsorId : current.sponsorId,
      patch.proveedor ?? current.proveedor,
      patch.logo ?? current.logo,
      patch.titulo ?? current.titulo,
      patch.descripcion ?? current.descripcion,
      patch.codigo ?? current.codigo,
      patch.categoria ?? current.categoria,
      patch.descuento ?? current.descuento,
      patch.vigencia ?? current.vigencia,
      patch.limite ?? current.limite,
      patch.estado ?? current.estado,
    ],
  );
  return rows[0] ? toCupon(rows[0]) : null;
}

export async function deleteCupon(id: string): Promise<boolean> {
  const result = await pool.query('delete from cupones where id=$1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export const CUPON_CATEGORIAS = ['Indumentaria', 'Alimentos', 'Finanzas', 'Hidratacion', 'Automotriz', 'Entretenimiento', 'Otros'];
