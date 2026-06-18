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
  eventsRole: 'admin' | 'operador' | 'comercial' | 'ninguno';
  sponsor?: string;
}

export const ENV_ADMIN_USER_ID = 'u-001';

// Conjunto de usuarios DEMO para pruebas con el cliente.
// Convención de contraseña: <usuario>1921 (p. ej. usuario "socio" -> "socio1921").
// Los ids 'demo-*' son únicos para que la tabla admin_passwords no sobreescriba
// estas contraseñas y los accesos documentados funcionen siempre.
export const ADMIN_USERS: AdminUser[] = [
  // Administrador real: credenciales por variables de entorno (no es un usuario demo).
  { id: ENV_ADMIN_USER_ID, name: 'Administrador CSH', username: env.ADMIN_USER, email: env.ADMIN_EMAIL, password: env.ADMIN_PASS || env.AUTH_PASS, role: 'Super admin', area: 'Administracion', status: 'Activo', parkingRole: 'admin', couponRole: 'admin', eventsRole: 'admin' },

  // Acceso total: parqueo + cuponera + entradas.
  { id: 'demo-superadmin', name: 'Super Admin Demo', username: 'superadmin', email: 'superadmin@herediano.com', password: 'superadmin1921', role: 'Super admin', area: 'Administracion', status: 'Demo', parkingRole: 'admin', couponRole: 'admin', eventsRole: 'admin' },

  // Parqueo: administra el módulo de parqueo.
  { id: 'demo-parqueo', name: 'Admin de Parqueo', username: 'parqueo', email: 'parqueo@herediano.com', password: 'parqueo1921', role: 'Admin de parqueo', area: 'Parqueo', status: 'Demo', parkingRole: 'admin', couponRole: 'socio', eventsRole: 'ninguno' },

  // Cuponera: administra cupones y beneficios.
  { id: 'demo-cuponera', name: 'Admin de Cuponera', username: 'cuponera', email: 'cuponera@herediano.com', password: 'cuponera1921', role: 'Admin de cuponera', area: 'Cuponera', status: 'Demo', parkingRole: 'socio', couponRole: 'admin', eventsRole: 'ninguno' },

  // Patrocinador: gestiona sus propios cupones.
  { id: 'demo-patrocinador', name: 'Patrocinador Demo', username: 'patrocinador', email: 'patrocinador@herediano.com', password: 'patrocinador1921', role: 'Patrocinador', area: 'Patrocinadores', status: 'Demo', parkingRole: 'socio', couponRole: 'patrocinador', eventsRole: 'ninguno', sponsor: 'Reebok' },

  // Entradas: administra el módulo de entradas/eventos.
  { id: 'demo-entradas', name: 'Admin de Entradas', username: 'entradas', email: 'entradas@herediano.com', password: 'entradas1921', role: 'Gestor de eventos', area: 'Entradas', status: 'Demo', parkingRole: 'socio', couponRole: 'socio', eventsRole: 'admin' },

  // Operador de puerta: opera el ingreso y ve ventas de entradas.
  { id: 'demo-operador', name: 'Operador de Puerta', username: 'operador', email: 'operador@herediano.com', password: 'operador1921', role: 'Operador', area: 'Entradas', status: 'Demo', parkingRole: 'socio', couponRole: 'socio', eventsRole: 'operador' },

  // Comercial: solo ve reportes de ventas de entradas.
  { id: 'demo-comercial', name: 'Comercial CSH', username: 'comercial', email: 'comercial@herediano.com', password: 'comercial1921', role: 'Comercial', area: 'Entradas', status: 'Demo', parkingRole: 'socio', couponRole: 'socio', eventsRole: 'comercial' },

  // Taquilla: opera entradas pero solo entra (invitado) al parqueo.
  { id: 'demo-taquilla', name: 'Taquilla Estadio', username: 'taquilla', email: 'taquilla@herediano.com', password: 'taquilla1921', role: 'Taquilla', area: 'Entradas', status: 'Demo', parkingRole: 'invitado', couponRole: 'socio', eventsRole: 'operador' },

  // Socio: público autenticado, sin acceso al panel (reserva parqueo, usa beneficios).
  { id: 'demo-socio', name: 'Socio Demo', username: 'socio', email: 'socio@herediano.com', password: 'socio1921', role: 'Socio', area: 'Socios', status: 'Demo', parkingRole: 'socio', couponRole: 'socio', eventsRole: 'ninguno' },

  // Invitado: acceso mínimo, solo navega el sitio autenticado.
  { id: 'demo-invitado', name: 'Invitado Demo', username: 'invitado', email: 'invitado@herediano.com', password: 'invitado1921', role: 'Invitado', area: 'General', status: 'Demo', parkingRole: 'invitado', couponRole: 'socio', eventsRole: 'ninguno' },
];

export function findUserById(id: string | null | undefined): AdminUser | undefined {
  return ADMIN_USERS.find((u) => u.id === id);
}
