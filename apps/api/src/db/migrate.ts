import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export async function migrate() {
  const connection = await pool.connect();
  try {
    await connection.query('SELECT pg_advisory_lock(772041)');
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const name = '001_init';
    const exists = await connection.query('SELECT name FROM schema_migrations WHERE name=$1', [name]);
    if (exists.rowCount) return;
    const sql = await readFile(join(dirname(fileURLToPath(import.meta.url)), '../../../..', 'apps/api/src/db/001_init.sql'), 'utf8');
    await connection.query('BEGIN');
    try {
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      await connection.query('COMMIT');
      logger.info('Base de datos migrada');
    } catch (err) { await connection.query('ROLLBACK'); throw err; }
  } finally { await connection.query('SELECT pg_advisory_unlock(772041)'); connection.release(); }
}

if (process.argv[1] && /migrate\.(ts|js)$/.test(process.argv[1])) {
  migrate().then(() => pool.end()).catch(async err => { logger.error({ err }, 'Migration failed'); await pool.end(); process.exitCode = 1; });
}
