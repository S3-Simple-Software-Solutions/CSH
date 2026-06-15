import { env } from '../../config/env';

export interface AdminUser {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
  role: string;
  area: string;
  status: string;
  parkingRole: 'admin' | 'socio' | 'invitado';
  couponRole: 'admin' | 'patrocinador' | 'socio';
  sponsor?: string;
}

export const ADMIN_USERS: AdminUser[] = [
  { id: 'u-001', name: 'Administrador CSH', username: env.ADMIN_USER, email: env.ADMIN_EMAIL, password: env.ADMIN_PASS || env.AUTH_PASS, role: 'Super admin', area: 'Administracion', status: 'Activo', parkingRole: 'admin', couponRole: 'admin' },
  { id: 'u-002', name: 'Operaciones Estadio', username: 'operaciones', email: 'operaciones@herediano.com', password: 'operaciones1921', role: 'Operador', area: 'Parqueo', status: 'Demo', parkingRole: 'admin', couponRole: 'socio' },
  { id: 'u-003', name: 'Comercial CSH', username: 'comercial', email: 'comercial@herediano.com', password: 'comercial1921', role: 'Patrocinador', area: 'Patrocinadores', status: 'Demo', parkingRole: 'socio', couponRole: 'patrocinador', sponsor: 'Reebok' },
  { id: 'u-004', name: 'Socio Demo', username: 'socio1', email: 'socio1@herediano.com', password: 'socio1921', role: 'Socio', area: 'Socios', status: 'Demo', parkingRole: 'socio', couponRole: 'socio' },
];

export function findUserById(id: string | null | undefined): AdminUser | undefined {
  return ADMIN_USERS.find((u) => u.id === id);
}
