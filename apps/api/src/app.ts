
import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { rateLimit } from 'express-rate-limit';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { errorHandler, HttpError } from './lib/errors.js';
import { attachSession } from './modules/auth.js';
import { authRouter } from './modules/auth.js';
import { publicRouter } from './modules/courts.js';
import { bookingRouter } from './modules/bookings.js';
import { adminRouter } from './modules/admin.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy:
      config.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://fonts.googleapis.com',
              ],
              fontSrc: [
                "'self'",
                'https://fonts.gstatic.com',
              ],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(compression());

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req: IncomingMessage) =>
        req.url === '/api/health',
    },
    redact: [
      'req.headers.cookie',
      'req.headers.authorization',
    ],
  }),
);

app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 180,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

// Cookies de sesión en el mismo origen.
// Se rechazan peticiones mutantes desde otros orígenes.
app.use('/api', (req, res, next) => {
  if (
    !['POST', 'PUT', 'PATCH', 'DELETE'].includes(
      req.method,
    )
  ) {
    return next();
  }

  const origin = req.get('origin');

  if (
    origin &&
    origin !== config.PUBLIC_ORIGIN
  ) {
    return next(
      new HttpError(
        403,
        'INVALID_ORIGIN',
        'Origen no permitido.',
      ),
    );
  }

  if (
    config.NODE_ENV === 'production' &&
    !origin
  ) {
    return next(
      new HttpError(
        403,
        'INVALID_ORIGIN',
        'Falta cabecera Origin.',
      ),
    );
  }

  next();
});

app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ritmo-api',
  });
});

app.use('/api', attachSession);
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/admin', adminRouter);

app.use('/api', (_req, _res, next) =>
  next(
    new HttpError(
      404,
      'NOT_FOUND',
      'Recurso no encontrado.',
    ),
  ),
);

// Express puede servir también el frontend compilado.
const webDist = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../apps/web/dist',
);

if (existsSync(webDist)) {
  app.use(
    express.static(webDist, {
      index: false,
      maxAge: '1h',
    }),
  );

  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next(
        new HttpError(
          404,
          'NOT_FOUND',
          'Recurso no encontrado.',
        ),
      );
    }

    const html = await readFile(
      resolve(webDist, 'index.html'),
      'utf8',
    );

    const origin = config.PUBLIC_ORIGIN.replace(
      /\/$/,
      '',
    );

    res.set('Cache-Control', 'no-cache');

    res.type('html').send(
      html
        .replace(
          'content="/og-cover.png"',
          `content="${origin}/og-cover.png"`,
        )
        .replace(
          '<!-- RITMO_OG_URL -->',
          `<meta property="og:url" content="${origin}" /><link rel="canonical" href="${origin}" />`,
        ),
    );
  });
}

app.use(errorHandler);
