import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function assert(condition: unknown, status: number, code: string, message: string): asserts condition {
  if (!condition) throw new HttpError(status, code, message);
}
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Revisá los datos ingresados.', issues: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
  if (error instanceof HttpError) return res.status(error.status).json({ code: error.code, message: error.message });
  const pgCode = (error as { code?: string })?.code;
  if (pgCode === '23P01') return res.status(409).json({ code: 'SLOT_TAKEN', message: 'Ese horario se acaba de ocupar. Elegí otro.' });
  if (pgCode === '23505') return res.status(409).json({ code: 'ALREADY_EXISTS', message: 'El registro ya existe.' });
  logger.error({ err: error }, 'Unhandled request error');
  return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado. Probá de nuevo.' });
};
