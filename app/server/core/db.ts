import { Pool } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export async function query<T = any>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(sql, params as any[]);
  return result.rows as T[];
}
