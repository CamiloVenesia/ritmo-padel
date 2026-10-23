
import { Router } from 'express';
import { z } from 'zod';
import { DateTime } from 'luxon';

import { pool, query } from '../lib/db.js';
import { assert, HttpError } from '../lib/errors.js';
import { requireAdmin } from './auth.js';
import { config } from '../lib/config.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

const toBooking = (b: any) => ({
  id: b.id,
  courtId: b.court_id,
  courtName: b.court_name,
  playerName: b.player_name,
  playerEmail: b.player_email,
  startsAt: b.starts_at,
  endsAt: b.ends_at,
  priceCents: b.price_cents,
  status: b.status,
  createdAt: b.created_at,
});

const toBlock = (b: any) => ({
  id: b.id,
  courtId: b.court_id,
  courtName: b.court_name,
  startsAt: b.starts_at,
  endsAt: b.ends_at,
  reason: b.reason,
});

const bookingFrom = `
  FROM bookings b
  JOIN courts c ON c.id=b.court_id
  JOIN app_users u ON u.id=b.user_id
`;

adminRouter.get('/overview', async (_req, res) => {
  const [counts, bookings, blocks] = await Promise.all([
    query(`
      SELECT
        (
          SELECT count(*)::int
          FROM courts
          WHERE active=true
        ) AS courts,

        (
          SELECT count(*)::int
          FROM bookings
          WHERE status='confirmed'
            AND starts_at>=now()
            AND starts_at<now()+interval '24 hours'
        ) AS next24h,

        (
          SELECT count(*)::int
          FROM bookings
          WHERE status='confirmed'
            AND starts_at>=date_trunc('month',now())
            AND starts_at<
              date_trunc('month',now())+interval '1 month'
        ) AS month_bookings,

        (
          SELECT coalesce(sum(price_cents),0)::bigint
          FROM bookings
          WHERE status='confirmed'
            AND starts_at>=date_trunc('month',now())
            AND starts_at<
              date_trunc('month',now())+interval '1 month'
        ) AS month_revenue
    `),

    query(`
      SELECT
        b.*,
        c.name AS court_name,
        u.full_name AS player_name,
        u.email AS player_email
      ${bookingFrom}
      WHERE b.starts_at>=now()-interval '30 days'
      ORDER BY b.starts_at DESC
      LIMIT 150
    `),

    query(`
      SELECT b.*,c.name AS court_name
      FROM court_blocks b
      JOIN courts c ON c.id=b.court_id
      WHERE b.ends_at>now()
      ORDER BY b.starts_at
      LIMIT 100
    `),
  ]);

  res.set('Cache-Control', 'no-store');

  res.json({
    stats: {
      courts: counts.rows[0].courts,
      next24h: counts.rows[0].next24h,
      monthBookings: counts.rows[0].month_bookings,
      monthRevenueCents:
        Number(counts.rows[0].month_revenue),
    },

    bookings: bookings.rows.map(toBooking),
    blocks: blocks.rows.map(toBlock),
  });
});

adminRouter.get('/agenda', async (req, res) => {
  const { from, to } = z.object({
    from: z.iso.date(),
    to: z.iso.date(),
  }).parse(req.query);

  const start = DateTime.fromISO(from, {
    zone: config.CLUB_TIMEZONE,
  }).startOf('day');

  const finish = DateTime.fromISO(to, {
    zone: config.CLUB_TIMEZONE,
  })
    .plus({ days: 1 })
    .startOf('day');

  assert(
    start.isValid &&
      finish.isValid &&
      finish > start &&
      finish.diff(start, 'days').days <= 8,
    400,
    'INVALID_RANGE',
    'Seleccioná una semana válida.',
  );

  const [bookings, blocks] = await Promise.all([
    query(`
      SELECT
        b.*,
        c.name AS court_name,
        u.full_name AS player_name,
        u.email AS player_email
      ${bookingFrom}
      WHERE b.starts_at<$2
        AND b.ends_at>$1
      ORDER BY b.starts_at
      LIMIT 1000
    `, [
      start.toUTC().toISO(),
      finish.toUTC().toISO(),
    ]),

    query(`
      SELECT b.*,c.name AS court_name
      FROM court_blocks b
      JOIN courts c ON c.id=b.court_id
      WHERE b.starts_at<$2
        AND b.ends_at>$1
      ORDER BY b.starts_at
      LIMIT 1000
    `, [
      start.toUTC().toISO(),
      finish.toUTC().toISO(),
    ]),
  ]);

  res.set('Cache-Control', 'no-store');

  res.json({
    bookings: bookings.rows.map(toBooking),
    blocks: blocks.rows.map(toBlock),
  });
});

adminRouter.patch(
  '/bookings/:id/cancel',
  async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const found = await client.query(
        'SELECT * FROM bookings WHERE id=$1 FOR UPDATE',
        [id],
      );

      assert(
        found.rowCount,
        404,
        'BOOKING_NOT_FOUND',
        'Reserva no encontrada.',
      );

      assert(
        found.rows[0].status === 'confirmed',
        409,
        'ALREADY_CANCELLED',
        'Esta reserva ya está cancelada.',
      );

      assert(
        new Date(
          found.rows[0].starts_at,
        ).getTime() > Date.now(),
        409,
        'BOOKING_STARTED',
        'No se puede cancelar un turno que ya comenzó.',
      );

      await client.query(`
        UPDATE bookings
        SET status='cancelled',
            cancelled_at=now()
        WHERE id=$1
      `, [id]);

      await client.query(`
        INSERT INTO audit_events(
          actor_id,
          action,
          entity_id,
          metadata
        )
        VALUES(
          $1,
          'booking.admin_cancelled',
          $2,
          $3::jsonb
        )
      `, [
        req.session!.id,
        id,
        JSON.stringify({
          reason: 'admin_action',
        }),
      ]);

      await client.query('COMMIT');

      res.json({ ok: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
);

adminRouter.patch('/courts/:id', async (req, res) => {
  const id = z.uuid().parse(req.params.id);

  const input = z.object({
    active: z.boolean().optional(),

    basePriceCents: z.number()
      .int()
      .min(0)
      .max(50000000)
      .optional(),

    peakPriceCents: z.number()
      .int()
      .min(0)
      .max(50000000)
      .optional(),
  })
    .refine(v => Object.keys(v).length > 0)
    .parse(req.body);

  const updated = await query(`
    UPDATE courts
    SET active=coalesce($2,active),
        base_price_cents=coalesce($3,base_price_cents),
        peak_price_cents=coalesce($4,peak_price_cents)
    WHERE id=$1
    RETURNING id
  `, [
    id,
    input.active ?? null,
    input.basePriceCents ?? null,
    input.peakPriceCents ?? null,
  ]);

  assert(
    updated.rowCount,
    404,
    'COURT_NOT_FOUND',
    'Cancha no encontrada.',
  );

  await query(`
    INSERT INTO audit_events(
      actor_id,
      action,
      entity_id,
      metadata
    )
    VALUES(
      $1,
      'court.updated',
      $2,
      $3::jsonb
    )
  `, [
    req.session!.id,
    id,
    JSON.stringify(input),
  ]);

  res.json({ ok: true });
});

adminRouter.post('/blocks', async (req, res) => {
  const input = z.object({
    courtId: z.uuid(),
    date: z.iso.date(),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    reason: z.string()
      .trim()
      .min(3)
      .max(180),
  }).parse(req.body);

  const starts = DateTime.fromISO(
    `${input.date}T${input.start}`,
    { zone: config.CLUB_TIMEZONE },
  );

  const ends = DateTime.fromISO(
    `${input.date}T${input.end}`,
    { zone: config.CLUB_TIMEZONE },
  );

  if (
    !starts.isValid ||
    !ends.isValid ||
    ends <= starts ||
    starts < DateTime.now() ||
    ends.diff(starts, 'hours').hours > 15
  ) {
    throw new HttpError(
      400,
      'INVALID_BLOCK',
      'El intervalo de bloqueo no es válido.',
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const court = await client.query(`
      SELECT id
      FROM courts
      WHERE id=$1 AND active=true
      FOR UPDATE
    `, [input.courtId]);

    assert(
      court.rowCount,
      404,
      'COURT_NOT_FOUND',
      'Cancha no encontrada o inactiva.',
    );

    const overlap = await client.query(`
      SELECT 1
      FROM bookings
      WHERE court_id=$1
        AND status='confirmed'
        AND starts_at<$3
        AND ends_at>$2
      LIMIT 1
    `, [
      input.courtId,
      starts.toUTC().toISO(),
      ends.toUTC().toISO(),
    ]);

    if (overlap.rowCount) {
      throw new HttpError(
        409,
        'SLOT_TAKEN',
        'Hay reservas confirmadas en el intervalo.',
      );
    }

    const otherBlock = await client.query(`
      SELECT 1
      FROM court_blocks
      WHERE court_id=$1
        AND starts_at<$3
        AND ends_at>$2
      LIMIT 1
    `, [
      input.courtId,
      starts.toUTC().toISO(),
      ends.toUTC().toISO(),
    ]);

    if (otherBlock.rowCount) {
      throw new HttpError(
        409,
        'BLOCK_OVERLAP',
        'Ya existe un bloqueo en ese horario.',
      );
    }

    const blocked = await client.query(`
      INSERT INTO court_blocks(
        court_id,
        starts_at,
        ends_at,
        reason,
        created_by
      )
      VALUES($1,$2,$3,$4,$5)
      RETURNING id
    `, [
      input.courtId,
      starts.toUTC().toISO(),
      ends.toUTC().toISO(),
      input.reason,
      req.session!.id,
    ]);

    await client.query(`
      INSERT INTO audit_events(
        actor_id,
        action,
        entity_id
      )
      VALUES(
        $1,
        'court.blocked',
        $2
      )
    `, [
      req.session!.id,
      blocked.rows[0].id,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      id: blocked.rows[0].id,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

adminRouter.delete(
  '/blocks/:id',
  async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const blocked = await client.query(
        'SELECT id FROM court_blocks WHERE id=$1 FOR UPDATE',
        [id],
      );

      assert(
        blocked.rowCount,
        404,
        'BLOCK_NOT_FOUND',
        'Bloqueo no encontrado.',
      );

      await client.query(
        'DELETE FROM court_blocks WHERE id=$1',
        [id],
      );

      await client.query(`
        INSERT INTO audit_events(
          actor_id,
          action,
          entity_id
        )
        VALUES(
          $1,
          'court.unblocked',
          $2
        )
      `, [
        req.session!.id,
        id,
      ]);

      await client.query('COMMIT');

      res.json({ ok: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
);
