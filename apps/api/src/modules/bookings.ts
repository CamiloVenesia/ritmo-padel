import { Router } from 'express';
import { z } from 'zod';
import { query, pool } from '../lib/db.js';
import { assert, HttpError } from '../lib/errors.js';
import { requireAuth } from './auth.js';
import { findSlot } from './slots.js';

export const bookingRouter = Router();
bookingRouter.use(requireAuth);
const toBooking = (row: any) => ({
  id: row.id, courtId: row.court_id, courtName: row.court_name,
  startsAt: row.starts_at, endsAt: row.ends_at,
  status: row.status, priceCents: row.price_cents, createdAt: row.created_at
});

bookingRouter.get('/me', async (req, res) => {
  const bookings = await query(`SELECT b.*,c.name AS court_name FROM bookings b JOIN courts c ON c.id=b.court_id WHERE b.user_id=$1 ORDER BY b.starts_at DESC LIMIT 100`, [req.session!.id]);
  res.set('Cache-Control', 'no-store');
  res.json({ bookings: bookings.rows.map(toBooking) });
});
bookingRouter.post('/', async (req, res) => {
  const input = z.object({ courtId: z.uuid(), date: z.string(), time: z.string().regex(/^\d{2}:\d{2}$/) }).parse(req.body);
  const slot = findSlot(input.date, input.time);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializa altas y bloqueos para la misma cancha. La exclusión GiST sigue siendo la garantía final.
    const court = await client.query('SELECT * FROM courts WHERE id=$1 AND active=true FOR UPDATE', [input.courtId]);
    assert(court.rowCount, 404, 'COURT_NOT_FOUND', 'La cancha no está disponible.');
    const blocked = await client.query(`SELECT 1 FROM court_blocks WHERE court_id=$1 AND starts_at < $3 AND ends_at > $2 LIMIT 1`, [input.courtId, slot.startsAt, slot.endsAt]);
    if (blocked.rowCount) throw new HttpError(409, 'SLOT_TAKEN', 'La cancha no está disponible en ese horario.');
    const price = slot.peak ? court.rows[0].peak_price_cents : court.rows[0].base_price_cents;
    const created = await client.query(`INSERT INTO bookings(court_id,user_id,starts_at,ends_at,price_cents) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.courtId, req.session!.id, slot.startsAt, slot.endsAt, price]);
    await client.query(`INSERT INTO audit_events(actor_id,action,entity_id) VALUES($1,'booking.created',$2)`, [req.session!.id, created.rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json({ booking: toBooking({ ...created.rows[0], court_name: court.rows[0].name }) });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
});
bookingRouter.patch('/:id/cancel', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM bookings WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, req.session!.id]);
    assert(existing.rowCount, 404, 'BOOKING_NOT_FOUND', 'Reserva no encontrada.');
    assert(existing.rows[0].status === 'confirmed', 409, 'ALREADY_CANCELLED', 'La reserva ya está cancelada.');
    assert(new Date(existing.rows[0].starts_at).getTime() - Date.now() >= 2 * 60 * 60 * 1000, 409, 'CANCELLATION_WINDOW', 'Podés cancelar hasta 2 horas antes del turno.');
    const updated = await client.query(`UPDATE bookings SET status='cancelled',cancelled_at=now() WHERE id=$1 RETURNING *`, [id]);
    await client.query(`INSERT INTO audit_events(actor_id,action,entity_id) VALUES($1,'booking.cancelled',$2)`, [req.session!.id, id]);
    await client.query('COMMIT');
    res.json({ booking: toBooking(updated.rows[0]) });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
});
