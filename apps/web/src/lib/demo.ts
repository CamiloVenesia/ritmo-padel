
import type {
  AdminAgenda,
  AdminBlock,
  AdminBooking,
  AdminOverview,
  Availability,
  BlockInput,
  Booking,
  Court,
  User,
} from './types';

import { ClientError } from './types';
import {
  localDate,
  offsetDate,
  toMinutes,
} from './format';

const KEY_BOOKINGS = 'ritmo-demo-bookings-v1';
const KEY_USER = 'ritmo-demo-user-v1';
const KEY_BLOCKS = 'ritmo-demo-admin-blocks-v1';
const KEY_CANCELLED = 'ritmo-demo-admin-cancelled-v1';

const pause = (ms = 220) =>
  new Promise(resolve => setTimeout(resolve, ms));

export const isDemo =
  import.meta.env.VITE_DATA_MODE !== 'live';

const COURTS: Court[] = [
  {
    id: 'demo-arena',
    slug: 'arena',
    name: 'ARENA 01',
    subtitle: 'La central',
    surface: 'Césped WPT',
    location: 'Indoor · Planta baja',
    accent: 'lime',
    features: [
      'Panorámica',
      'Indoor',
      'Iluminación LED',
    ],
    basePriceCents: 2200000,
    peakPriceCents: 2800000,
    active: true,
  },
  {
    id: 'demo-pulse',
    slug: 'pulse',
    name: 'PULSE 02',
    subtitle: 'La eléctrica',
    surface: 'Césped Mondo',
    location: 'Indoor · Planta baja',
    accent: 'teal',
    features: [
      'Panorámica',
      'Indoor',
      'Premium',
    ],
    basePriceCents: 2200000,
    peakPriceCents: 2800000,
    active: true,
  },
  {
    id: 'demo-terra',
    slug: 'terra',
    name: 'TERRA 03',
    subtitle: 'El clásico',
    surface: 'Césped sintético',
    location: 'Outdoor · Patio norte',
    accent: 'amber',
    features: [
      'Outdoor',
      'Vestuarios',
      'Clásica',
    ],
    basePriceCents: 1800000,
    peakPriceCents: 2300000,
    active: true,
  },
  {
    id: 'demo-sky',
    slug: 'sky',
    name: 'SKY 04',
    subtitle: 'Bajo las estrellas',
    surface: 'Césped Mondo',
    location: 'Outdoor · Terraza',
    accent: 'blue',
    features: [
      'Outdoor',
      'Panorámica',
      'Premium',
    ],
    basePriceCents: 2400000,
    peakPriceCents: 3000000,
    active: true,
  },
];

function readArray<T>(key: string): T[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(key) || '[]',
    );

    return Array.isArray(parsed)
      ? parsed as T[]
      : [];
  } catch {
    return [];
  }
}

const storedBookings = () =>
  readArray<Booking>(KEY_BOOKINGS);

const saveBookings = (list: Booking[]) =>
  localStorage.setItem(
    KEY_BOOKINGS,
    JSON.stringify(list),
  );

const storedBlocks = () =>
  readArray<AdminBlock>(KEY_BLOCKS);

const saveBlocks = (list: AdminBlock[]) =>
  localStorage.setItem(
    KEY_BLOCKS,
    JSON.stringify(list),
  );

const cancelledFixtures = () =>
  readArray<string>(KEY_CANCELLED);

const isoFrom = (date: string, time: string) =>
  `${date}T${time}:00-03:00`;

const overlap = (
  a: { startsAt: string; endsAt: string },
  b: { startsAt: string; endsAt: string },
) =>
  new Date(a.startsAt).getTime() <
    new Date(b.endsAt).getTime() &&
  new Date(a.endsAt).getTime() >
    new Date(b.startsAt).getTime();

function sampleBookings(): AdminBooking[] {
  const people = [
    ['Luna Fernández', 'luna@demo.test'],
    ['Tomás Rivas', 'tomas@demo.test'],
    ['Micaela Díaz', 'mica@demo.test'],
    ['Nicolás Costa', 'nico@demo.test'],
    ['Julieta Sosa', 'juli@demo.test'],
    ['Facundo Vera', 'facu@demo.test'],
  ];

  const fixtures = [
    [0, 'demo-arena', 'ARENA 01', '18:00', 2800000],
    [1, 'demo-pulse', 'PULSE 02', '20:00', 2800000],
    [0, 'demo-terra', 'TERRA 03', '17:00', 1800000],
    [2, 'demo-sky', 'SKY 04', '19:30', 3000000],
    [1, 'demo-arena', 'ARENA 01', '11:00', 2200000],
    [3, 'demo-terra', 'TERRA 03', '16:30', 1800000],
  ] as const;

  const cancelled = cancelledFixtures();

  return fixtures.map(
    ([day, courtId, courtName, time, priceCents], i) => {
      const date = offsetDate(day);
      const endMinutes = toMinutes(time) + 90;

      const end =
        `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:` +
        `${String(endMinutes % 60).padStart(2, '0')}`;

      return {
        id: `fixture-${i + 1}`,
        courtId,
        courtName,
        startsAt: isoFrom(date, time),
        endsAt: isoFrom(date, end),
        status: cancelled.includes(`fixture-${i + 1}`)
          ? 'cancelled' as const
          : 'confirmed' as const,
        priceCents,
        createdAt: new Date().toISOString(),
        playerName: people[i][0],
        playerEmail: people[i][1],
      };
    },
  );
}

function allAdminBookings(): AdminBooking[] {
  const own = storedBookings().map(b => ({
    ...b,
    playerName: 'Alex Rivera',
    playerEmail: 'jugador@ritmo.demo',
  }));

  return [...sampleBookings(), ...own].sort(
    (a, b) => b.startsAt.localeCompare(a.startsAt),
  );
}

function assertAdmin() {
  if (demoUser()?.role !== 'admin') {
    throw new ClientError(
      'FORBIDDEN',
      'Ingresá como administrador para continuar.',
    );
  }
}

export async function demoCourts(): Promise<{
  courts: Court[];
}> {
  await pause();
  return { courts: COURTS };
}

export function demoUser(): User | null {
  try {
    return JSON.parse(
      localStorage.getItem(KEY_USER) || 'null',
    ) as User | null;
  } catch {
    return null;
  }
}

export async function demoLogin(
  fullName = 'Alex Rivera',
  role: User['role'] = 'player',
): Promise<{ user: User }> {
  await pause();

  const user: User = {
    id: role === 'admin'
      ? 'demo-admin'
      : 'demo-player',
    fullName,
    email: role === 'admin'
      ? 'admin@ritmo.demo'
      : 'jugador@ritmo.demo',
    role,
  };

  localStorage.setItem(
    KEY_USER,
    JSON.stringify(user),
  );

  return { user };
}

export async function demoLogout(): Promise<void> {
  localStorage.removeItem(KEY_USER);
  await pause(120);
}

export async function demoAvailability(
  date: string,
): Promise<Availability> {
  await pause();

  if (
    date < localDate() ||
    date > offsetDate(14)
  ) {
    throw new ClientError(
      'INVALID_DATE',
      'Fecha fuera del período habilitado.',
    );
  }

  const bookings = allAdminBookings().filter(
    b => b.status === 'confirmed',
  );

  const blocks = storedBlocks();

  return {
    date,
    durationMinutes: 90,
    courts: COURTS.map((court, ci) => ({
      ...court,

      slots: Array.from(
        { length: 28 },
        (_, i) => {
          const min = 480 + i * 30;

          const time =
            `${String(Math.floor(min / 60)).padStart(2, '0')}:` +
            `${String(min % 60).padStart(2, '0')}`;

          const end = min + 90;

          const ends =
            `${String(Math.floor(end / 60)).padStart(2, '0')}:` +
            `${String(end % 60).padStart(2, '0')}`;

          const interval = {
            startsAt: isoFrom(date, time),
            endsAt: isoFrom(date, ends),
          };

          const occupied =
            bookings.some(
              b =>
                b.courtId === court.id &&
                overlap(b, interval),
            ) ||
            blocks.some(
              b =>
                b.courtId === court.id &&
                overlap(b, interval),
            );

          const illustrative =
            (i + ci * 7 + Number(date.slice(-2))) % 17 === 0 ||
            (i + ci * 5) % 23 === 0;

          const expired =
            new Date(interval.startsAt).getTime() <
            Date.now() + 30 * 60_000;

          return {
            time,
            ends,
            available:
              !occupied &&
              !illustrative &&
              !expired,
            priceCents:
              min >= 1080
                ? court.peakPriceCents
                : court.basePriceCents,
          };
        },
      ),
    })),
  };
}

export async function demoBookings(): Promise<{
  bookings: Booking[];
}> {
  await pause();

  return {
    bookings: storedBookings().sort(
      (a, b) =>
        b.startsAt.localeCompare(a.startsAt),
    ),
  };
}

export async function demoCreateBooking(input: {
  courtId: string;
  date: string;
  time: string;
}): Promise<{ booking: Booking }> {
  const user = demoUser();

  if (!user) {
    throw new ClientError(
      'AUTH_REQUIRED',
      'Entrá como jugador para continuar.',
    );
  }

  const available = await demoAvailability(input.date);

  const court = available.courts.find(
    c => c.id === input.courtId,
  );

  const slot = court?.slots.find(
    s => s.time === input.time,
  );

  if (!court || !slot || !slot.available) {
    throw new ClientError(
      'SLOT_TAKEN',
      'Ese horario ya no está disponible.',
    );
  }

  const booking: Booking = {
    id: crypto.randomUUID(),
    courtId: court.id,
    courtName: court.name,
    startsAt: isoFrom(input.date, input.time),
    endsAt: isoFrom(input.date, slot.ends),
    status: 'confirmed',
    priceCents: slot.priceCents,
    createdAt: new Date().toISOString(),
  };

  saveBookings([
    ...storedBookings(),
    booking,
  ]);

  await pause();

  return { booking };
}

export async function demoCancelBooking(
  id: string,
): Promise<void> {
  const bookings = storedBookings();
  const target = bookings.find(b => b.id === id);

  if (!target) {
    throw new ClientError(
      'BOOKING_NOT_FOUND',
      'Reserva no encontrada.',
    );
  }

  if (target.status === 'cancelled') {
    throw new ClientError(
      'ALREADY_CANCELLED',
      'Esta reserva ya fue cancelada.',
    );
  }

  if (
    new Date(target.startsAt).getTime() -
    Date.now() < 2 * 3600_000
  ) {
    throw new ClientError(
      'CANCELLATION_WINDOW',
      'Podés cancelar hasta 2 horas antes.',
    );
  }

  saveBookings(
    bookings.map(b =>
      b.id === id
        ? { ...b, status: 'cancelled' }
        : b,
    ),
  );

  await pause();
}

export async function demoAdmin(): Promise<AdminOverview> {
  assertAdmin();
  await pause();

  const bookings = allAdminBookings();
  const month = localDate().slice(0, 7);

  const monthly = bookings.filter(
    b =>
      b.status === 'confirmed' &&
      b.startsAt.slice(0, 7) === month,
  );

  return {
    stats: {
      courts: COURTS.filter(
        c => c.active,
      ).length,

      next24h: bookings.filter(
        b =>
          b.status === 'confirmed' &&
          new Date(b.startsAt).getTime() > Date.now() &&
          new Date(b.startsAt).getTime() <
            Date.now() + 86400000,
      ).length,

      monthBookings: monthly.length,

      monthRevenueCents: monthly.reduce(
        (sum, b) => sum + b.priceCents,
        0,
      ),
    },

    bookings,
    blocks: storedBlocks(),
  };
}

export async function demoAdminAgenda(
  from: string,
  to: string,
): Promise<AdminAgenda> {
  assertAdmin();
  await pause(120);

  const within = (b: {
    startsAt: string;
    endsAt: string;
  }) =>
    b.startsAt.slice(0, 10) <= to &&
    b.endsAt.slice(0, 10) >= from;

  return {
    bookings: allAdminBookings().filter(within),
    blocks: storedBlocks().filter(within),
  };
}

export async function demoAdminCancelBooking(
  id: string,
): Promise<void> {
  assertAdmin();

  const target = allAdminBookings().find(
    b => b.id === id,
  );

  if (!target) {
    throw new ClientError(
      'BOOKING_NOT_FOUND',
      'Reserva no encontrada.',
    );
  }

  if (target.status !== 'confirmed') {
    throw new ClientError(
      'ALREADY_CANCELLED',
      'Esta reserva ya está cancelada.',
    );
  }

  if (
    new Date(target.startsAt).getTime() <= Date.now()
  ) {
    throw new ClientError(
      'BOOKING_STARTED',
      'El turno ya comenzó.',
    );
  }

  if (id.startsWith('fixture-')) {
    localStorage.setItem(
      KEY_CANCELLED,
      JSON.stringify([
        ...new Set([
          ...cancelledFixtures(),
          id,
        ]),
      ]),
    );
  } else {
    saveBookings(
      storedBookings().map(b =>
        b.id === id
          ? { ...b, status: 'cancelled' }
          : b,
      ),
    );
  }

  await pause();
}

export async function demoBlockCourt(
  input: BlockInput,
): Promise<void> {
  assertAdmin();

  const court = COURTS.find(
    c =>
      c.id === input.courtId &&
      c.active,
  );

  if (!court) {
    throw new ClientError(
      'COURT_NOT_FOUND',
      'Seleccioná una cancha válida.',
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    !/^\d{2}:\d{2}$/.test(input.start) ||
    !/^\d{2}:\d{2}$/.test(input.end)
  ) {
    throw new ClientError(
      'INVALID_BLOCK',
      'Fecha y horas inválidas.',
    );
  }

  const period = {
    startsAt: isoFrom(input.date, input.start),
    endsAt: isoFrom(input.date, input.end),
  };

  const length =
    new Date(period.endsAt).getTime() -
    new Date(period.startsAt).getTime();

  if (
    !Number.isFinite(length) ||
    length <= 0 ||
    length > 15 * 3600_000 ||
    new Date(period.startsAt).getTime() < Date.now()
  ) {
    throw new ClientError(
      'INVALID_BLOCK',
      'El intervalo debe ser futuro y de hasta 15 horas.',
    );
  }

  const reason = input.reason.trim();

  if (
    reason.length < 3 ||
    reason.length > 180
  ) {
    throw new ClientError(
      'INVALID_REASON',
      'El motivo debe tener entre 3 y 180 caracteres.',
    );
  }

  if (
    allAdminBookings().some(
      b =>
        b.courtId === court.id &&
        b.status === 'confirmed' &&
        overlap(b, period),
    )
  ) {
    throw new ClientError(
      'SLOT_TAKEN',
      'Hay una reserva confirmada en ese horario.',
    );
  }

  if (
    storedBlocks().some(
      b =>
        b.courtId === court.id &&
        overlap(b, period),
    )
  ) {
    throw new ClientError(
      'BLOCK_OVERLAP',
      'El horario ya tiene un bloqueo.',
    );
  }

  saveBlocks([
    ...storedBlocks(),
    {
      id: crypto.randomUUID(),
      courtId: court.id,
      courtName: court.name,
      ...period,
      reason,
    },
  ]);

  await pause();
}

export async function demoRemoveBlock(
  id: string,
): Promise<void> {
  assertAdmin();

  const blocks = storedBlocks();

  if (!blocks.some(b => b.id === id)) {
    throw new ClientError(
      'BLOCK_NOT_FOUND',
      'Bloqueo no encontrado.',
    );
  }

  saveBlocks(
    blocks.filter(b => b.id !== id),
  );

  await pause();
}
