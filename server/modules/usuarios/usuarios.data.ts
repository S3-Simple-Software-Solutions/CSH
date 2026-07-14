export interface AdminUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  area: string;
  status: string;
  parkingRole: 'admin' | 'socio' | 'invitado';
  couponRole: 'admin' | 'patrocinador' | 'socio';
  eventsRole: 'admin' | 'operador' | 'comercial' | 'ninguno';
  restaurantRole: 'admin' | 'owner' | 'ninguno';
  sponsor?: string;
  passwordManagedByEnv?: boolean;
  isSuperAdmin?: boolean;
}

export type UserCategory = 'staff' | 'socio' | 'aficionado';

export interface UserPersonalInfo {
  telefono: string;
  cedula: string;
  nacimiento: string;
  provincia: string;
  genero: string;
}

export interface UserAppInfo {
  registrado: string;
  ultimoAcceso: string;
  plataforma: string;
  notificaciones: boolean;
  sesiones30d: number;
}

/** Metricas medibles para socios y aficionados (base de analitica). */
export interface UserMetrics {
  numeroMiembro?: string;
  membresia?: string;
  antiguedadMeses: number;
  partidosAsistidos: number;
  entradasCompradas: number;
  gastoTotalCrc: number;
  cuponesUsados: number;
  reservasParqueo: number;
  puntosFidelidad: number;
  asistenciaPct: number;
}

export interface UserProfile {
  category: UserCategory;
  personal: UserPersonalInfo;
  app: UserAppInfo;
  metricas: UserMetrics | null;
}

export const ENV_ADMIN_USER_ID = 'u-001';
