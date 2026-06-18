import { env } from '../../config/env';
import { pool, query } from '../../core/db';
import { ENV_ADMIN_USER_ID, UserProfile } from './usuarios.data';
import { hashPassword } from './usuarios.passwords';

type PasswordOwner = 'env' | 'database';

interface SeedUser {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
  role: string;
  area: string;
  status: string;
  sponsor?: string;
  passwordManagedBy: PasswordOwner;
  roles: string[];
  profile?: UserProfile;
}

const PROVINCIAS = ['San Jose', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limon'];

// Genera un perfil de staff deterministico (sin metricas de socio) a partir del username.
function staffProfile(seed: SeedUser): UserProfile {
  let h = 0;
  for (const ch of seed.username) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const yy = 2024 + (h % 2);
  const mm = String(1 + (h % 12)).padStart(2, '0');
  const dd = String(1 + (h % 27)).padStart(2, '0');
  return {
    category: 'staff',
    personal: {
      telefono: `+506 8${String(100 + (h % 900)).slice(0, 3)}-${String(1000 + (h % 9000)).slice(0, 4)}`,
      cedula: `${1 + (h % 7)}-${String(1000 + (h % 9000)).slice(0, 4)}-${String(1000 + ((h >> 3) % 9000)).slice(0, 4)}`,
      nacimiento: `19${85 + (h % 15)}-${mm}-${dd}`,
      provincia: PROVINCIAS[h % PROVINCIAS.length],
      genero: h % 2 ? 'Femenino' : 'Masculino',
    },
    app: {
      registrado: `${yy}-${mm}-${dd}`,
      ultimoAcceso: '2026-06-17',
      plataforma: h % 2 ? 'Web' : 'iOS',
      notificaciones: true,
      sesiones30d: 18 + (h % 40),
    },
    metricas: null,
  };
}

const ROLE_ROWS = [
  ['system:admin', 'Super admin', 'system', 'Acceso total al sistema'],
  ['system:demo', 'Demo', 'system', 'Cuenta demostrativa'],
  ['site:authenticated', 'Usuario autenticado', 'site', 'Puede iniciar sesion en la app'],
  ['parking:admin', 'Administrador de parqueo', 'parking', 'Administra espacios, reservas y croquis'],
  ['parking:socio', 'Socio de parqueo', 'parking', 'Puede reservar parqueo como socio'],
  ['parking:invitado', 'Invitado de parqueo', 'parking', 'Acceso minimo de parqueo'],
  ['coupon:admin', 'Administrador de cuponera', 'coupon', 'Administra todos los beneficios'],
  ['coupon:patrocinador', 'Patrocinador', 'coupon', 'Administra beneficios propios'],
  ['coupon:socio', 'Socio de cuponera', 'coupon', 'Puede usar beneficios'],
  ['events:admin', 'Administrador de eventos', 'events', 'Administra eventos y entradas'],
  ['events:operador', 'Operador de puerta', 'events', 'Opera ingresos y ve ventas'],
  ['events:comercial', 'Comercial', 'events', 'Ve reportes de ventas'],
] as const;

function defaultUsers(): SeedUser[] {
  return [
    {
      id: ENV_ADMIN_USER_ID,
      name: 'Administrador CSH',
      username: env.ADMIN_USER,
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASS || env.AUTH_PASS,
      role: 'Super admin',
      area: 'Administracion',
      status: 'Activo',
      passwordManagedBy: 'env',
      roles: ['system:admin', 'site:authenticated', 'parking:admin', 'coupon:admin', 'events:admin'],
    },
    {
      id: 'demo-superadmin',
      name: 'Super Admin Demo',
      username: 'superadmin',
      email: 'superadmin@herediano.com',
      password: 'superadmin1921',
      role: 'Super admin',
      area: 'Administracion',
      status: 'Demo',
      passwordManagedBy: 'database',
      roles: ['system:demo', 'site:authenticated', 'parking:admin', 'coupon:admin', 'events:admin'],
    },
    {
      id: 'demo-parqueo',
      name: 'Admin de Parqueo',
      username: 'parqueo',
      email: 'parqueo@herediano.com',
      password: 'parqueo1921',
      role: 'Admin de parqueo',
      area: 'Parqueo',
      status: 'Demo',
      passwordManagedBy: 'database',
      roles: ['system:demo', 'site:authenticated', 'parking:admin', 'coupon:socio'],
    },
    {
      id: 'demo-cuponera',
      name: 'Admin de Cuponera',
      username: 'cuponera',
      email: 'cuponera@herediano.com',
      password: 'cuponera1921',
      role: 'Admin de cuponera',
      area: 'Cuponera',
      status: 'Demo',
      passwordManagedBy: 'database',
      roles: ['system:demo', 'site:authenticated', 'parking:socio', 'coupon:admin'],
    },
    {
      id: 'demo-patrocinador',
      name: 'Patrocinador Demo',
      username: 'patrocinador',
      email: 'patrocinador@herediano.com',
      password: 'patrocinador1921',
      role: 'Patrocinador',
      area: 'Patrocinadores',
      status: 'Demo',
      sponsor: 'Reebok',
      passwordManagedBy: 'database',
      roles: ['system:demo', 'site:authenticated', 'parking:socio', 'coupon:patrocinador'],
    },
    {
      id: 'demo-entradas',
      name: 'Admin de Entradas',
      username: 'entradas',
      email: 'entradas@herediano.com',
      password: 'entradas1921',
      role: 'Gestor de eventos',
      area: 'Entradas',
      status: 'Demo',
      passwordManagedBy: 'database',
      roles: ['system:demo', 'site:authenticated', 'parking:socio', 'coupon:socio', 'events:admin'],
    },
    {
      id: 'demo-operador',
      name: 'Operador de Puerta',
      username: 'operador',
      email: 'operador@herediano.com',
      password: 'operador1921',
      role: 'Operador',
      area: 'Entradas',
      status: 'Demo',
      passwordManagedBy: 'database',
      roles: ['system:demo', 'site:authenticated', 'parking:socio', 'coupon:socio', 'events:operador'],
    },
    {
      id: 'demo-comercial',
      name: 'Comercial CSH',
      username: 'comercial',
      email: 'comercial@herediano.com',
      password: 'comercial1921',
      role: 'Comercial',
      area: 'Entradas',
      status: 'Demo',
      passwordManagedBy: 'database',
      roles: ['system:demo', 'site:authenticated', 'parking:socio', 'coupon:socio', 'events:comercial'],
    },
    {
      id: 'demo-taquilla',
      name: 'Taquilla Estadio',
      username: 'taquilla',
      email: 'taquilla@herediano.com',
      password: 'taquilla1921',
      role: 'Taquilla',
      area: 'Entradas',
      status: 'Demo',
      passwordManagedBy: 'database',
      roles: ['system:demo', 'site:authenticated', 'parking:invitado', 'coupon:socio', 'events:operador'],
    },
    {
      id: 'demo-socio',
      name: 'Socio Demo',
      username: 'socio',
      email: 'socio@herediano.com',
      password: 'socio1921',
      role: 'Socio',
      area: 'Socios',
      status: 'Demo',
      passwordManagedBy: 'database',
      roles: ['system:demo', 'site:authenticated', 'parking:socio', 'coupon:socio'],
      profile: {
        category: 'socio',
        personal: { telefono: '+506 8712-4490', cedula: '1-1455-0982', nacimiento: '1990-03-12', provincia: 'San Jose', genero: 'Masculino' },
        app: { registrado: '2023-07-02', ultimoAcceso: '2026-06-16', plataforma: 'Android', notificaciones: true, sesiones30d: 41 },
        metricas: { numeroMiembro: 'CSH-0042', membresia: 'Platino', antiguedadMeses: 35, partidosAsistidos: 58, entradasCompradas: 64, gastoTotalCrc: 742000, cuponesUsados: 21, reservasParqueo: 33, puntosFidelidad: 4820, asistenciaPct: 86 },
      },
    },
    {
      id: 'demo-invitado',
      name: 'Invitado Demo',
      username: 'invitado',
      email: 'invitado@herediano.com',
      password: 'invitado1921',
      role: 'Invitado',
      area: 'General',
      status: 'Demo',
      passwordManagedBy: 'database',
      roles: ['system:demo', 'site:authenticated', 'parking:invitado', 'coupon:socio'],
    },
    {
      id: 'socio-laura',
      name: 'Laura Jimenez Ramirez',
      username: 'ljimenez',
      email: 'laura.jimenez@gmail.com',
      password: 'socio1921',
      role: 'Socio',
      area: 'Socios',
      status: 'Activo',
      passwordManagedBy: 'database',
      roles: ['site:authenticated', 'parking:socio', 'coupon:socio'],
      profile: {
        category: 'socio',
        personal: { telefono: '+506 8830-1177', cedula: '4-0210-0533', nacimiento: '1995-11-28', provincia: 'Heredia', genero: 'Femenino' },
        app: { registrado: '2024-01-18', ultimoAcceso: '2026-06-17', plataforma: 'iOS', notificaciones: true, sesiones30d: 52 },
        metricas: { numeroMiembro: 'CSH-0188', membresia: 'Oro', antiguedadMeses: 29, partidosAsistidos: 44, entradasCompradas: 49, gastoTotalCrc: 531000, cuponesUsados: 17, reservasParqueo: 28, puntosFidelidad: 3610, asistenciaPct: 79 },
      },
    },
    {
      id: 'socio-carlos',
      name: 'Carlos Mora Quesada',
      username: 'cmora',
      email: 'carlos.mora@outlook.com',
      password: 'socio1921',
      role: 'Socio',
      area: 'Socios',
      status: 'Activo',
      passwordManagedBy: 'database',
      roles: ['site:authenticated', 'parking:socio', 'coupon:socio'],
      profile: {
        category: 'socio',
        personal: { telefono: '+506 7045-9921', cedula: '2-0688-0145', nacimiento: '1982-06-05', provincia: 'Alajuela', genero: 'Masculino' },
        app: { registrado: '2022-09-09', ultimoAcceso: '2026-06-15', plataforma: 'Web', notificaciones: false, sesiones30d: 23 },
        metricas: { numeroMiembro: 'CSH-0007', membresia: 'Platino', antiguedadMeses: 45, partidosAsistidos: 71, entradasCompradas: 80, gastoTotalCrc: 968000, cuponesUsados: 30, reservasParqueo: 52, puntosFidelidad: 6240, asistenciaPct: 91 },
      },
    },
    {
      id: 'fan-mariana',
      name: 'Mariana Solis Campos',
      username: 'msolis',
      email: 'mariana.solis@gmail.com',
      password: 'aficion1921',
      role: 'Aficionado',
      area: 'Aficionados',
      status: 'Activo',
      passwordManagedBy: 'database',
      roles: ['site:authenticated', 'parking:invitado', 'coupon:socio'],
      profile: {
        category: 'aficionado',
        personal: { telefono: '+506 8456-7012', cedula: '1-1788-0420', nacimiento: '2000-02-14', provincia: 'San Jose', genero: 'Femenino' },
        app: { registrado: '2025-02-20', ultimoAcceso: '2026-06-17', plataforma: 'Android', notificaciones: true, sesiones30d: 34 },
        metricas: { antiguedadMeses: 16, partidosAsistidos: 12, entradasCompradas: 14, gastoTotalCrc: 138000, cuponesUsados: 6, reservasParqueo: 2, puntosFidelidad: 980, asistenciaPct: 48 },
      },
    },
    {
      id: 'fan-diego',
      name: 'Diego Vargas Leon',
      username: 'dvargas',
      email: 'diego.vargas@gmail.com',
      password: 'aficion1921',
      role: 'Aficionado',
      area: 'Aficionados',
      status: 'Activo',
      passwordManagedBy: 'database',
      roles: ['site:authenticated', 'parking:invitado', 'coupon:socio'],
      profile: {
        category: 'aficionado',
        personal: { telefono: '+506 8901-2233', cedula: '6-0399-0710', nacimiento: '1998-09-30', provincia: 'Puntarenas', genero: 'Masculino' },
        app: { registrado: '2024-08-11', ultimoAcceso: '2026-06-14', plataforma: 'iOS', notificaciones: true, sesiones30d: 27 },
        metricas: { antiguedadMeses: 22, partidosAsistidos: 19, entradasCompradas: 23, gastoTotalCrc: 211000, cuponesUsados: 9, reservasParqueo: 5, puntosFidelidad: 1530, asistenciaPct: 57 },
      },
    },
    {
      id: 'fan-kendall',
      name: 'Kendall Rojas Nunez',
      username: 'krojas',
      email: 'kendall.rojas@hotmail.com',
      password: 'aficion1921',
      role: 'Aficionado',
      area: 'Aficionados',
      status: 'Activo',
      passwordManagedBy: 'database',
      roles: ['site:authenticated', 'parking:invitado', 'coupon:socio'],
      profile: {
        category: 'aficionado',
        personal: { telefono: '+506 7188-6644', cedula: '7-0155-0288', nacimiento: '2003-12-19', provincia: 'Limon', genero: 'Masculino' },
        app: { registrado: '2025-10-03', ultimoAcceso: '2026-06-16', plataforma: 'Android', notificaciones: false, sesiones30d: 15 },
        metricas: { antiguedadMeses: 8, partidosAsistidos: 5, entradasCompradas: 6, gastoTotalCrc: 54000, cuponesUsados: 2, reservasParqueo: 0, puntosFidelidad: 420, asistenciaPct: 31 },
      },
    },
  ];
}

export async function ensureUsuariosSchema(): Promise<void> {
  await pool.query(`
    create table if not exists app_roles (
      id text primary key,
      name text not null,
      scope text not null,
      description text
    );

    create table if not exists app_users (
      id text primary key,
      username text not null unique,
      email text not null unique,
      password_hash text not null,
      full_name text not null,
      display_role text not null,
      area text not null,
      status text not null default 'Activo',
      sponsor text,
      password_managed_by text not null default 'database' check (password_managed_by in ('env','database')),
      profile jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table app_users add column if not exists profile jsonb;

    create table if not exists app_user_roles (
      user_id text not null references app_users(id) on delete cascade,
      role_id text not null references app_roles(id) on delete cascade,
      granted_at timestamptz not null default now(),
      primary key (user_id, role_id)
    );

    create index if not exists idx_app_users_username_lower on app_users (lower(username));
    create index if not exists idx_app_users_email_lower on app_users (lower(email));
    create index if not exists idx_app_user_roles_role on app_user_roles(role_id);

    create table if not exists admin_passwords (
      user_id text primary key,
      password text not null,
      updated_at timestamptz not null default now()
    );
  `);

  await seedRoles();
  await seedUsers();
  await migrateLegacyPasswordOverrides();
}

async function seedRoles(): Promise<void> {
  for (const [id, name, scope, description] of ROLE_ROWS) {
    await pool.query(
      `insert into app_roles (id, name, scope, description)
       values ($1, $2, $3, $4)
       on conflict (id) do update
       set name = excluded.name, scope = excluded.scope, description = excluded.description`,
      [id, name, scope, description],
    );
  }
}

async function seedUsers(): Promise<void> {
  for (const user of defaultUsers()) {
    await pool.query(
      `insert into app_users
        (id, username, email, password_hash, full_name, display_role, area, status, sponsor, password_managed_by, profile)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set
         username = excluded.username,
         email = excluded.email,
         full_name = excluded.full_name,
         display_role = excluded.display_role,
         area = excluded.area,
         status = excluded.status,
         sponsor = excluded.sponsor,
         password_managed_by = excluded.password_managed_by,
         profile = excluded.profile,
         password_hash = case
           when excluded.password_managed_by = 'env' then excluded.password_hash
           else app_users.password_hash
         end,
         updated_at = now()`,
      [
        user.id,
        user.username,
        user.email,
        hashPassword(user.password),
        user.name,
        user.role,
        user.area,
        user.status,
        user.sponsor || null,
        user.passwordManagedBy,
        JSON.stringify(user.profile ?? staffProfile(user)),
      ],
    );

    await pool.query('delete from app_user_roles where user_id = $1', [user.id]);
    for (const roleId of user.roles) {
      await pool.query('insert into app_user_roles (user_id, role_id) values ($1, $2) on conflict do nothing', [user.id, roleId]);
    }
  }
}

async function migrateLegacyPasswordOverrides(): Promise<void> {
  const rows = await query<{ user_id: string; password: string }>('select user_id, password from admin_passwords');
  for (const row of rows) {
    if (row.user_id === ENV_ADMIN_USER_ID) continue;
    await pool.query('update app_users set password_hash = $2, password_managed_by = $3, updated_at = now() where id = $1', [
      row.user_id,
      hashPassword(row.password),
      'database',
    ]);
  }
  await pool.query('delete from admin_passwords');
}
