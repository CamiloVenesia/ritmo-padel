import { app } from './app.js';
import { config } from './lib/config.js';
import { pool } from './lib/db.js';
import { migrate } from './db/migrate.js';
import { logger } from './lib/logger.js';

async function start() {
  await migrate();
  const server = app.listen(config.PORT, '0.0.0.0', () => logger.info({ port: config.PORT }, 'RITMO API ready'));
  const shutdown = () => { logger.info('Shutting down'); server.close(() => pool.end().finally(() => process.exit(0))); setTimeout(() => process.exit(1), 10_000).unref(); };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
start().catch(err => { logger.fatal({ err }, 'Could not start API'); process.exit(1); });
