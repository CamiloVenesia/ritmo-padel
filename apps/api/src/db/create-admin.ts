
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { config } from '../lib/config.js';
import { pool } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { migrate } from './migrate.js';

const adminSchema = z.object({
  ADMIN_NAME: z.string().trim().min(2).max(100),

  ADMIN_EMAIL: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email().max(160)),

  ADMIN_PASSWORD: z
    .string()
    .min(20, 'La contraseña debe tener al menos 20 caracteres.')
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= 72,
      'La contraseña no puede superar 72 bytes.',
    ),
});

async function createFirstAdmin() {
  if (config.NODE_ENV !== 'production') {
    throw new Error(
      'La creación del administrador inicial solo está habilitada en producción.',
    );
  }

  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } =
    adminSchema.parse(process.env);

  await migrate();

  const passwordHash = await bcrypt.hash(
    ADMIN_PASSWORD,
    12,
  );

  const connection = await pool.connect();

  try {
    await connection.query('BEGIN');

    // Evita dos inicializaciones simultáneas.
    await connection.query(
      'SELECT pg_advisory_xact_lock($1)',
      [772042],
    );

    // El comando es exclusivamente para crear
    // el primer administrador del sistema.
    const existingAdmin = await connection.query(
      `SELECT id
       FROM app_users
       WHERE role = 'admin'
       LIMIT 1`,
    );

    if (existingAdmin.rowCount) {
      throw new Error(
        'Ya existe un administrador. No se creó otra cuenta.',
      );
    }

    await connection.query(
      `INSERT INTO app_users (
        full_name,
        email,
        password_hash,
        role,
        active
      )
      VALUES ($1, $2, $3, 'admin', true)`,
      [ADMIN_NAME, ADMIN_EMAIL, passwordHash],
    );

    await connection.query('COMMIT');

    logger.info(
      'Administrador inicial creado correctamente.',
    );
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}

async function main() {
  try {
    await createFirstAdmin();
  } catch (error) {
    logger.error(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Error inesperado',
      },
      'No se pudo crear el administrador inicial.',
    );

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
