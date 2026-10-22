import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, query } from '../lib/db.js';
import { migrate } from './migrate.js';
import { logger } from '../lib/logger.js';

async function main() {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: fullName } = z.object({
    ADMIN_EMAIL: z.email(), ADMIN_PASSWORD: z.string().min(14), ADMIN_NAME: z.string().min(2).max(100)
  }).parse(process.env);
  await migrate();
  const hash = await bcrypt.hash(password, 12);
  // No cambia silenciosamente credenciales ni permisos de una cuenta existente.
  const result = await query(`INSERT INTO app_users(full_name,email,password_hash,role) VALUES($1,$2,$3,'admin') ON CONFLICT(email) DO NOTHING RETURNING id`, [fullName, email.toLowerCase(), hash]);
  if (!result.rowCount) throw new Error('El email ya existe. Elegí un email diferente.');
  logger.info('Cuenta administradora creada. Borrá ADMIN_PASSWORD del entorno después.');
}
main().then(()=>pool.end()).catch(async err=>{ logger.error({err},'Admin bootstrap failed');await pool.end();process.exitCode=1;});
