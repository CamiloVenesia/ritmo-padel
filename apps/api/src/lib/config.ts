import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
dotenv.config({ path: resolve(root, '.env') });
import { z } from 'zod';

const parsed = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:5173'),
  CLUB_TIMEZONE: z.string().default('America/Argentina/Buenos_Aires')
}).safeParse(process.env);

if (!parsed.success) {
  console.error('Configuración inválida: revisá .env (DATABASE_URL, SESSION_SECRET, PUBLIC_ORIGIN).');
  throw new Error('Variables de entorno requeridas no configuradas');
}
export const config = parsed.data;
