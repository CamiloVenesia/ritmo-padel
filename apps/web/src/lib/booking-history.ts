
import type { Booking } from './types';

export type BookingFilter =
  | 'upcoming'
  | 'completed'
  | 'cancelled';

export const CANCELLATION_WINDOW_MS =
  2 * 60 * 60 * 1000;

export function bookingFilter(
  booking: Booking,
  now = Date.now(),
): BookingFilter {
  if (booking.status === 'cancelled') {
    return 'cancelled';
  }

  return new Date(booking.endsAt).getTime() > now
    ? 'upcoming'
    : 'completed';
}

export function canCancelBooking(
  booking: Booking,
  now = Date.now(),
): boolean {
  return (
    booking.status === 'confirmed' &&
    new Date(booking.startsAt).getTime() - now >=
      CANCELLATION_WINDOW_MS
  );
}

export function sortedBookings(
  bookings: Booking[],
  filter: BookingFilter,
  now = Date.now(),
): Booking[] {
  return bookings
    .filter(
      booking =>
        bookingFilter(booking, now) === filter,
    )
    .sort((a, b) =>
      filter === 'upcoming'
        ? new Date(a.startsAt).getTime() -
          new Date(b.startsAt).getTime()
        : new Date(b.startsAt).getTime() -
          new Date(a.startsAt).getTime(),
    );
}

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function icsTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function bookingCalendar(
  booking: Booking,
  demo: boolean,
  now = new Date(),
): string {
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start
  ) {
    throw new Error(
      'Las fechas del turno no son válidas.',
    );
  }

  const id = booking.id.replace(
    /[^a-zA-Z0-9_-]/g,
    '',
  );

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RITMO PADEL//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${id}@ritmo-padel`,
    `DTSTAMP:${icsTimestamp(now)}`,
    `DTSTART:${icsTimestamp(start)}`,
    `DTEND:${icsTimestamp(end)}`,
    `SUMMARY:${escapeCalendarText(
      `Pádel · ${booking.courtName || 'RITMO PÁDEL'}`,
    )}`,
    `DESCRIPTION:${escapeCalendarText(
      demo
        ? 'Reserva de demostración. No representa un turno real.'
        : `Reserva confirmada · ID ${booking.id}`,
    )}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.join('\r\n')}\r\n`;
}
