
import { describe, expect, it } from 'vitest';
import {
  bookingCalendar,
  bookingFilter,
  canCancelBooking,
  sortedBookings,
} from './booking-history';
import type { Booking } from './types';

const base: Booking = {
  id: 'ab12-34',
  courtId: 'c1',
  courtName: 'ARENA 01',
  startsAt: '2026-10-30T19:00:00-03:00',
  endsAt: '2026-10-30T20:30:00-03:00',
  createdAt: '2026-10-22T19:00:00-03:00',
  status: 'confirmed',
  priceCents: 2200000,
};

const now = new Date(
  '2026-10-22T19:00:00-03:00',
).getTime();

describe('historial de reservas', () => {
  it('separa próximas, finalizadas y canceladas', () => {
    expect(
      bookingFilter(base, now),
    ).toBe('upcoming');

    expect(
      bookingFilter(
        {
          ...base,
          endsAt: '2026-10-21T20:30:00-03:00',
        },
        now,
      ),
    ).toBe('completed');

    expect(
      bookingFilter(
        { ...base, status: 'cancelled' },
        now,
      ),
    ).toBe('cancelled');
  });

  it('solo permite cancelar hasta dos horas antes', () => {
    const start = new Date(
      base.startsAt,
    ).getTime();

    expect(
      canCancelBooking(
        base,
        start - 2 * 60 * 60 * 1000,
      ),
    ).toBe(true);

    expect(
      canCancelBooking(
        base,
        start - 2 * 60 * 60 * 1000 + 1,
      ),
    ).toBe(false);

    expect(
      canCancelBooking(
        { ...base, status: 'cancelled' },
        now,
      ),
    ).toBe(false);
  });

  it('ordena próximos de menor a mayor fecha', () => {
    const later = {
      ...base,
      id: 'later',
      startsAt: '2026-11-01T19:00:00-03:00',
      endsAt: '2026-11-01T20:30:00-03:00',
    };

    expect(
      sortedBookings(
        [later, base],
        'upcoming',
        now,
      ).map(b => b.id),
    ).toEqual([base.id, later.id]);
  });

  it('genera un calendario válido con fechas UTC y aviso de demo', () => {
    const calendar = bookingCalendar(
      base,
      true,
      new Date('2026-10-22T19:00:00Z'),
    );

    expect(calendar).toContain(
      'DTSTART:20261030T220000Z',
    );

    expect(calendar).toContain(
      'DTEND:20261030T233000Z',
    );

    expect(calendar).toContain(
      'Reserva de demostración',
    );

    expect(calendar).toMatch(
      /END:VCALENDAR\r\n$/,
    );
  });
});
