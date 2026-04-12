// Postgres client — raw SQL for pgvector compatibility
import postgres from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;

export function getSql(): ReturnType<typeof postgres> {
  if (!_sql) {
    const url = process.env['DATABASE_URL'];
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 30,
    });
  }
  return _sql;
}

export async function checkDbHealth(): Promise<boolean> {
  try {
    const sql = getSql();
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
