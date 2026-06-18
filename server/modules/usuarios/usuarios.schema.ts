import { env } from '../../config/env';
import { pool, query } from '../../core/db';
import { ENV_ADMIN_USER_ID } from './usuarios.data';
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
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

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
        (id, username, email, password_hash, full_name, display_role, area, status, sponsor, password_managed_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set
         username = excluded.username,
         email = excluded.email,
         full_name = excluded.full_name,
         display_role = excluded.display_role,
         area = excluded.area,
         status = excluded.status,
         sponsor = excluded.sponsor,
         password_managed_by = excluded.password_managed_by,
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
