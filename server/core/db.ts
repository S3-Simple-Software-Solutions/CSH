import { Pool } from 'pg';
import { env } from '../config/env';

export const USE_DB = env.USE_DB;

export const pool: Pool | null = USE_DB ? new Pool({ connectionString: env.DATABASE_URL }) : null;

export function getPool(): Pool {
  if (!pool) throw new Error('PostgreSQL no esta configurado (DATABASE_URL ausente)');
  return pool;
}

export async function query<T = any>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await getPool().query(sql, params as any[]);
  return result.rows as T[];
}
