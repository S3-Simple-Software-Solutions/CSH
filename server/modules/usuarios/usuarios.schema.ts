import { pool, query } from '../../core/db';
import { ADMIN_USERS, AdminUser, ENV_ADMIN_USER_ID } from './usuarios.data';

export async function ensureUsuariosSchema(): Promise<void> {
  await pool.query(`
    create table if not exists admin_passwords (
      user_id text primary key,
      password text not null,
      updated_at timestamptz not null default now()
    );
  `);
  await applyPasswordOverrides();
}

export async function applyPasswordOverrides(): Promise<void> {
  const rows = await query<{ user_id: string; password: string }>('select user_id, password from admin_passwords');
  applyPasswordOverrideRows(rows);
}

export function applyPasswordOverrideRows(rows: { user_id: string; password: string }[], users: AdminUser[] = ADMIN_USERS): void {
  for (const row of rows) {
    // The primary admin is controlled by HEREDIANO_ADMIN_PASS/HEREDIANO_PASS.
    // Ignoring persisted overrides prevents stale DB rows from locking it out.
    if (row.user_id === ENV_ADMIN_USER_ID) continue;
    const user = users.find((u) => u.id === row.user_id);
    if (user) user.password = row.password;
  }
}
