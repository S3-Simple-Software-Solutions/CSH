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
  sponsor?: string;
  passwordManagedByEnv?: boolean;
}

export const ENV_ADMIN_USER_ID = 'u-001';
