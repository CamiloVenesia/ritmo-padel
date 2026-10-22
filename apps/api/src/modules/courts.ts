import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { buildSlots, dateRange } from './slots.js';

export const publicRouter = Router();
const formatCourt = (row: any) => ({
  id: row.id, slug: row.slug, name: row.name, subtitle: row.subtitle, surface: row.surface,
  location: row.location_label, accent: row.accent, features: row.features, active: row.active,
  basePriceCents: row.base_price_cents, peakPriceCents: row.peak_price_cents
});
publicRouter.get('/courts', async (_req, res) => {
  const result = await query('SELECT * FROM courts WHERE active=true ORDER BY sort_order');
  res.json({ courts: result.rows.map(formatCourt) });
});
publicRouter.get('/availability', async (req, res) => {
  const { date } = z.object({ date: z.string() }).parse(req.query);
  dateRange(date);
  const slots = buildSlots(date);
  const courts = await query('SELECT * FROM courts WHERE active=true ORDER BY sort_order');
  if (!slots.length) return res.json({ date, durationMinutes: 90, courts: courts.rows.map(row => ({ ...formatCourt(row), slots: [] })) });
  const earliest = slots[0].startsAt, latest = slots[slots.length - 1].endsAt;
  const taken = await query(`SELECT court_id,starts_at,ends_at FROM bookings WHERE status='confirmed' AND starts_at < $2 AND ends_at > $1
    UNION ALL SELECT court_id,starts_at,ends_at FROM court_blocks WHERE starts_at < $2 AND ends_at > $1`, [earliest, latest]);
  const response = courts.rows.map(row => ({
    ...formatCourt(row),
    slots: slots.map(slot => {
      const overlap = taken.rows.some(t => t.court_id === row.id && new Date(t.starts_at) < new Date(slot.endsAt) && new Date(t.ends_at) > new Date(slot.startsAt));
      return { time: slot.time, ends: slot.ends, available: !overlap, priceCents: slot.peak ? row.peak_price_cents : row.base_price_cents };
    })
  }));
  res.set('Cache-Control', 'no-store');
  res.json({ date, durationMinutes: 90, courts: response });
});
