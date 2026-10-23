
export type Court = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  surface: string;
  location: string;
  accent: string;
  features: string[];
  active: boolean;
  basePriceCents: number;
  peakPriceCents: number;
};

export type Slot = {
  time: string;
  ends: string;
  available: boolean;
  priceCents: number;
};

export type CourtWithSlots = Court & {
  slots: Slot[];
};

export type Availability = {
  date: string;
  durationMinutes: number;
  courts: CourtWithSlots[];
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  role: 'player' | 'admin';
};

export type Booking = {
  id: string;
  courtId: string;
  courtName?: string;
  startsAt: string;
  endsAt: string;
  status: 'confirmed' | 'cancelled';
  priceCents: number;
  createdAt: string;
};

export type AdminBooking = Booking & {
  playerName: string;
  playerEmail: string;
};

export type AdminBlock = {
  id: string;
  courtName: string;
  courtId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

export type AdminOverview = {
  stats: {
    courts: number;
    next24h: number;
    monthBookings: number;
    monthRevenueCents: number;
  };
  bookings: AdminBooking[];
  blocks: AdminBlock[];
};

export type AdminAgenda = {
  bookings: AdminBooking[];
  blocks: AdminBlock[];
};

export type BlockInput = {
  courtId: string;
  date: string;
  start: string;
  end: string;
  reason: string;
};

export class ClientError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
