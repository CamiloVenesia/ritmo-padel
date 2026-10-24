
import { app } from './app.js';
import { config } from './lib/config.js';
import { pool, query } from './lib/db.js';
import { migrate } from './db/migrate.js';
import { logger } from './lib/logger.js';

async function validateProductionDatabase() {
  if (config.NODE_ENV !== 'production') {
    return;
  }

  const demoEmails = [
    'jugador@ritmopadel.test',
    'admin@ritmopadel.test',
  ];

  const result = await query(
    `SELECT id
     FROM app_users
     WHERE LOWER(email) = ANY($1::text[])
       AND active = true
     LIMIT 1`,
    [demoEmails],
  );

  if (result.rowCount) {
    throw new Error(
      'Inicio de producción bloqueado: existen cuentas de demostración activas.',
    );
  }

  logger.info(
    'Base de datos de producción validada.',
  );
}

async function start() {
  await migrate();

  await validateProductionDatabase();

  const server = app.listen(
    config.PORT,
    '0.0.0.0',
    () => {
      logger.info(
        { port: config.PORT },
        'RITMO API ready',
      );
    },
  );

  const shutdown = () => {
    logger.info('Shutting down');

    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start().catch((error) => {
  logger.fatal(
    { err: error },
    'Could not start API',
  );

  void pool.end().finally(() => {
    process.exit(1);
  });
});
