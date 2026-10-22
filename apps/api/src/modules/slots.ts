import { DateTime } from 'luxon';
import { config } from '../lib/config.js';
import { HttpError } from '../lib/errors.js';

export const DURATION_MINUTES = 90;
export const STEP_MINUTES = 30;
export const DAYS_AHEAD = 14;
export const START_HOUR = 8;
export const CLOSE_HOUR = 23;

export function dateRange(date: string, now = DateTime.now()) {
  const requested = DateTime.fromISO(date, { zone: config.CLUB_TIMEZONE });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !requested.isValid || requested.toISODate() !== date) {
    throw new HttpError(400, 'INVALID_DATE', 'La fecha seleccionada no es válida.');
  }
  const today = now.setZone(config.CLUB_TIMEZONE).startOf('day');
  if (requested < today || requested > today.plus({ days: DAYS_AHEAD })) {
    throw new HttpError(400, 'INVALID_DATE', `Solo podés reservar dentro de los próximos ${DAYS_AHEAD} días.`);
  }
  return requested;
}

export function buildSlots(date: string, now = DateTime.now()) {
  const day = dateRange(date, now);
  const slots: { time: string; ends: string; startsAt: string; endsAt: string; peak: boolean }[] = [];
  for (let minute = START_HOUR * 60; minute + DURATION_MINUTES <= CLOSE_HOUR * 60; minute += STEP_MINUTES) {
    const start = day.plus({ minutes: minute });
    const end = start.plus({ minutes: DURATION_MINUTES });
    if (start.toUTC() < now.plus({ minutes: 30 })) continue;
    const time = start.toFormat('HH:mm');
    slots.push({ time, ends: end.toFormat('HH:mm'), startsAt: start.toUTC().toISO()!, endsAt: end.toUTC().toISO()!, peak: minute >= 18 * 60 });
  }
  return slots;
}
export function findSlot(date: string, time: string, now = DateTime.now()) {
  const slot = buildSlots(date, now).find(x => x.time === time);
  if (!slot) throw new HttpError(400, 'INVALID_SLOT', 'El horario ya no está disponible para reservar.');
  return slot;
}
