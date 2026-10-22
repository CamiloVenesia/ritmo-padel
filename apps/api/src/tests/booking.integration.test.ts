/**
 * Integración real contra PostgreSQL, NO se ejecuta en el test unitario común.
 * Requiere una BD llamada ritmo_test y DATABASE_URL apuntando a ella.
 * Ejecutar `npm run test:integration` después de crear la BD y arrancar Postgres.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../app.js';
import { migrate } from '../db/migrate.js';
import { pool, query } from '../lib/db.js';

const prefix = 'ritmo_test';
let courtId: string;
let userId: string;
let sessionCookie: string;
let email: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('/ritmo_test')) throw new Error('Este test solo puede ejecutarse contra la BD ritmo_test');
  await migrate();
  email = `${randomUUID()}@example.test`;
  const slug = `${prefix}_${randomUUID().replaceAll('-', '')}`;
  const court = await query(`INSERT INTO courts(slug,name,subtitle,surface,location_label,base_price_cents,peak_price_cents)
    VALUES($1,'TEST 01','Integración','Sintético','Test',10000,15000) RETURNING id`, [slug]);
  courtId = court.rows[0].id;
  const signedUp = await request(app).post('/api/auth/register').set('Origin','http://localhost:5173')
    .send({ fullName:'Test Integration',email,password:'StrongTestPassword!2026' });
  expect(signedUp.status).toBe(201);
  userId = signedUp.body.user.id;
  sessionCookie = signedUp.headers['set-cookie'][0];
},30_000);

afterAll(async () => {
  if (userId) await query('DELETE FROM audit_events WHERE actor_id=$1', [userId]);
  if (userId) await query('DELETE FROM bookings WHERE user_id=$1', [userId]);
  if (userId) await query('DELETE FROM app_users WHERE id=$1', [userId]);
  if (courtId) await query('DELETE FROM courts WHERE id=$1', [courtId]);
  await pool.end();
});

describe('Integración PostgreSQL — seguridad y exclusión', () => {
  it('rechaza una ruta privada sin sesión', async () => {
    const response = await request(app).get('/api/bookings/me');
    expect(response.status).toBe(401);
  });
  it('mantiene la sesión en cookie HttpOnly', async () => {
    const response = await request(app).get('/api/auth/me').set('Cookie',sessionCookie);
    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(email);
    expect(sessionCookie).toContain('HttpOnly');
  });
  it('imposibilita dos reservas solapadas aun en peticiones simultáneas', async () => {
    const first = new Date(Date.now() + 5*86400000);
    first.setUTCHours(15,0,0,0);
    const start = first.toISOString();
    const end = new Date(first.getTime() + 90*60000).toISOString();
    const insert = () => query(`INSERT INTO bookings(court_id,user_id,starts_at,ends_at,price_cents) VALUES($1,$2,$3,$4,10000) RETURNING id`, [courtId,userId,start,end]);
    const results = await Promise.allSettled([insert(),insert()]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const rejected=results.find(r=>r.status==='rejected');
    expect((rejected as PromiseRejectedResult).reason.code).toBe('23P01');
  });
  it('impide consultar administración con cuenta de jugador', async () => {
    const response = await request(app).get('/api/admin/overview').set('Cookie',sessionCookie);
    expect(response.status).toBe(403);
  });
  it('revoca la sesión del lado del servidor cuando se cierra sesión', async () => {
    const logout = await request(app).post('/api/auth/logout').set('Origin','http://localhost:5173').set('Cookie',sessionCookie);
    expect(logout.status).toBe(200);
    const after = await request(app).get('/api/auth/me').set('Cookie',sessionCookie);
    expect(after.body.user).toBeNull();
  });
});
