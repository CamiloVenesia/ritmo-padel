import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { buildSlots, dateRange, findSlot } from '../modules/slots.js';

describe('Booking slots', () => {
  const now = DateTime.fromISO('2026-10-21T10:00:00-03:00');
  it('generates 90-minute consecutive slots', () => {
    const slots = buildSlots('2026-10-22', now);
    expect(slots[0].time).toBe('08:00');
    expect(slots[0].ends).toBe('09:30');
    expect(slots.at(-1)?.ends).toBe('23:00');
    expect(slots.length).toBe(28);
  });
  it('does not include expired times', () => {
    const slots = buildSlots('2026-10-21', now);
    expect(slots.every(s => DateTime.fromISO(s.startsAt).toMillis() >= now.plus({ minutes:30 }).toMillis())).toBe(true);
  });
  it('uses peak pricing after 18:00', () => {
    expect(findSlot('2026-10-22','18:00',now).peak).toBe(true);
    expect(findSlot('2026-10-22','17:30',now).peak).toBe(false);
  });
  it('rejects out-of-window dates and invalid starts', () => {
    expect(() => dateRange('2026-02-31',now)).toThrow();
    expect(() => dateRange('2026-10-01',now)).toThrow();
    expect(() => dateRange('2026-12-22',now)).toThrow();
    expect(() => findSlot('2026-10-22','22:30',now)).toThrow();
  });
});
