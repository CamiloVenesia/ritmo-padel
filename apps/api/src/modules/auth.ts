import { Router, type Request, type Response, type NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { config } from '../lib/config.js';
import { HttpError } from '../lib/errors.js';

export type Session = { id: string; fullName: string; email: string; role: 'player' | 'admin' };
declare global { namespace Express { interface Request { session?: Session } } }
const sessionKey = new TextEncoder().encode(config.SESSION_SECRET);
const cookieName = 'ritmo_session';
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false, message: { code: 'TOO_MANY_ATTEMPTS', message: 'Demasiados intentos. Volvé a probar en unos minutos.' } });
const credentialSchema = z.object({ email: z.email().max(160).transform(v => v.toLowerCase().trim()), password: z.string().min(8).max(100) });
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
async function makeSession(id: string) {
  const jti = randomUUID();
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(id).setJti(jti).setIssuedAt().setExpirationTime('7d').sign(sessionKey);
  await query(`INSERT INTO app_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now() + interval '7 days')`, [jti,id,hashToken(token)]);
  return token;
}
const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: config.NODE_ENV === 'production', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
const publicSession = (row: any): Session => ({ id: row.id, fullName: row.full_name, email: row.email, role: row.role });

export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[cookieName];
  if (!token) return next();
  let id: string | undefined;
  let jti: string | undefined;
  try {
    const verified = await jwtVerify(token, sessionKey, { algorithms: ['HS256'] });
    id = verified.payload.sub;
    jti = verified.payload.jti;
  } catch { return next(); }
  if (!id || !jti) return next();
  try {
    const user = await query(`SELECT u.id,u.full_name,u.email,u.role FROM app_users u JOIN app_sessions s ON s.user_id=u.id WHERE u.id=$1 AND u.active=true AND s.id=$2 AND s.token_hash=$3 AND s.revoked_at IS NULL AND s.expires_at>now()`, [id,jti,hashToken(token)]);
    if (user.rowCount) req.session = publicSession(user.rows[0]);
    return next();
  } catch (err) { return next(err); }
}
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.session) return next(new HttpError(401, 'AUTH_REQUIRED', 'Iniciá sesión para continuar.'));
  return next();
}
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.session) return next(new HttpError(401, 'AUTH_REQUIRED', 'Iniciá sesión para continuar.'));
  if (req.session.role !== 'admin') return next(new HttpError(403, 'FORBIDDEN', 'No tenés permiso para esta operación.'));
  return next();
}
export const authRouter = Router();
authRouter.post('/register', loginLimiter, async (req, res) => {
  const input = credentialSchema.extend({ fullName: z.string().trim().min(2).max(100) }).parse(req.body);
  const hash = await bcrypt.hash(input.password, 12);
  const result = await query(`INSERT INTO app_users(full_name,email,password_hash,role) VALUES ($1,$2,$3,'player') RETURNING id,full_name,email,role`, [input.fullName, input.email, hash]);
  res.cookie(cookieName, await makeSession(result.rows[0].id), cookieOptions);
  res.status(201).json({ user: publicSession(result.rows[0]) });
});
authRouter.post('/login', loginLimiter, async (req, res) => {
  const input = credentialSchema.parse(req.body);
  const result = await query(`SELECT id,full_name,email,role,password_hash FROM app_users WHERE email=$1 AND active=true`, [input.email]);
  const user = result.rows[0];
  if (!user || !await bcrypt.compare(input.password, user.password_hash)) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos.');
  res.cookie(cookieName, await makeSession(user.id), cookieOptions);
  res.json({ user: publicSession(user) });
});
authRouter.get('/me', (req, res) => res.json({ user: req.session ?? null }));
authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[cookieName];
  if (typeof token === 'string') await query(`UPDATE app_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL`, [hashToken(token)]);
  res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: config.NODE_ENV === 'production', path: '/' });
  res.json({ ok: true });
});
