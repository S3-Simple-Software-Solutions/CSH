import { pool, query } from '../../core/db';
import { ADMIN_USERS } from './usuarios.data';

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
  for (const row of rows) {
    const user = ADMIN_USERS.find((u) => u.id === row.user_id);
    if (user) user.password = row.password;
  }
}
