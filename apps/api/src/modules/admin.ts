import { Router } from 'express';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { pool, query } from '../lib/db.js';
import { assert, HttpError } from '../lib/errors.js';
import { requireAdmin } from './auth.js';
import { config } from '../lib/config.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.get('/overview', async (_req, res) => {
  const [counts, bookings, blocks] = await Promise.all([
    query(`SELECT
      (SELECT count(*)::int FROM courts WHERE active=true) AS courts,
      (SELECT count(*)::int FROM bookings WHERE status='confirmed' AND starts_at >= now() AND starts_at < now() + interval '24 hours') AS next24h,
      (SELECT count(*)::int FROM bookings WHERE status='confirmed' AND starts_at >= date_trunc('month', now())) AS month_bookings,
      (SELECT coalesce(sum(price_cents),0)::bigint FROM bookings WHERE status='confirmed' AND starts_at >= date_trunc('month',now())) AS month_revenue`),
    query(`SELECT b.*,c.name AS court_name,u.full_name AS player_name,u.email AS player_email
      FROM bookings b JOIN courts c ON c.id=b.court_id JOIN app_users u ON u.id=b.user_id
      WHERE b.starts_at >= now() - interval '7 days' ORDER BY b.starts_at DESC LIMIT 100`),
    query(`SELECT b.*,c.name AS court_name FROM court_blocks b JOIN courts c ON c.id=b.court_id WHERE ends_at>now() ORDER BY starts_at LIMIT 50`)
  ]);
  res.set('Cache-Control', 'no-store');
  res.json({ stats: { courts: counts.rows[0].courts, next24h: counts.rows[0].next24h, monthBookings: counts.rows[0].month_bookings, monthRevenueCents: Number(counts.rows[0].month_revenue) },
    bookings: bookings.rows.map(b => ({ id:b.id, courtName:b.court_name, playerName:b.player_name, playerEmail:b.player_email, startsAt:b.starts_at, endsAt:b.ends_at, status:b.status, priceCents:b.price_cents })),
    blocks: blocks.rows.map(b => ({ id:b.id, courtName:b.court_name, courtId:b.court_id, startsAt:b.starts_at, endsAt:b.ends_at, reason:b.reason }))
  });
});
adminRouter.patch('/courts/:id', async (req,res) => {
  const id = z.uuid().parse(req.params.id);
  const input = z.object({ active: z.boolean().optional(), basePriceCents: z.number().int().min(0).max(50000000).optional(), peakPriceCents: z.number().int().min(0).max(50000000).optional() }).refine(v => Object.keys(v).length > 0).parse(req.body);
  const updated = await query(`UPDATE courts SET active=coalesce($2,active),base_price_cents=coalesce($3,base_price_cents),peak_price_cents=coalesce($4,peak_price_cents) WHERE id=$1 RETURNING id`,
    [id, input.active ?? null, input.basePriceCents ?? null, input.peakPriceCents ?? null]);
  assert(updated.rowCount,404,'COURT_NOT_FOUND','Cancha no encontrada.');
  await query(`INSERT INTO audit_events(actor_id,action,entity_id,metadata) VALUES($1,'court.updated',$2,$3::jsonb)`, [req.session!.id,id,JSON.stringify(input)]);
  res.json({ ok: true });
});
adminRouter.post('/blocks', async (req,res) => {
  const input = z.object({ courtId: z.uuid(), date: z.string(), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/), reason: z.string().trim().min(3).max(180) }).parse(req.body);
  const starts = DateTime.fromISO(`${input.date}T${input.start}`, { zone: config.CLUB_TIMEZONE });
  const ends = DateTime.fromISO(`${input.date}T${input.end}`, { zone: config.CLUB_TIMEZONE });
  if (!starts.isValid || !ends.isValid || ends <= starts || starts < DateTime.now() || ends.diff(starts,'hours').hours > 15) throw new HttpError(400,'INVALID_BLOCK','El intervalo de bloqueo no es válido.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const court = await client.query('SELECT id FROM courts WHERE id=$1 FOR UPDATE', [input.courtId]);
    assert(court.rowCount,404,'COURT_NOT_FOUND','Cancha no encontrada.');
    const overlap = await client.query(`SELECT 1 FROM bookings WHERE court_id=$1 AND status='confirmed' AND starts_at<$3 AND ends_at>$2 LIMIT 1`, [input.courtId, starts.toUTC().toISO(), ends.toUTC().toISO()]);
    if (overlap.rowCount) throw new HttpError(409,'SLOT_TAKEN','Hay reservas confirmadas en el intervalo.');
    const blocked = await client.query(`INSERT INTO court_blocks(court_id,starts_at,ends_at,reason,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id`, [input.courtId, starts.toUTC().toISO(), ends.toUTC().toISO(), input.reason, req.session!.id]);
    await client.query(`INSERT INTO audit_events(actor_id,action,entity_id) VALUES($1,'court.blocked',$2)`, [req.session!.id,blocked.rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json({ id: blocked.rows[0].id });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
});
adminRouter.delete('/blocks/:id', async (req,res) => {
  const id = z.uuid().parse(req.params.id);
  const deleted = await query('DELETE FROM court_blocks WHERE id=$1 RETURNING id', [id]);
  assert(deleted.rowCount,404,'BLOCK_NOT_FOUND','Bloqueo no encontrado.');
  await query(`INSERT INTO audit_events(actor_id,action,entity_id) VALUES($1,'court.unblocked',$2)`, [req.session!.id,id]);
  res.json({ ok:true });
});
