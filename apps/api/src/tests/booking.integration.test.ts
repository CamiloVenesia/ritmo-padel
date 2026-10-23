
/**
 * RITMO PÁDEL
 * Bloque 6 — Integración y seguridad
 *
 * Pruebas HTTP contra PostgreSQL real.
 *
 * Ejecutar:
 * npm run test:integration
 *
 * Utiliza exclusivamente la base local ritmo_test.
 */

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DateTime } from 'luxon';

import { app } from '../app.js';
import { config } from '../lib/config.js';
import { migrate } from '../db/migrate.js';
import { pool, query } from '../lib/db.js';

type TestAccount = {
  id: string;
  email: string;
  cookie: string;
};

let courtId = '';

let player: TestAccount;
let secondPlayer: TestAccount;
let admin: TestAccount;

let setupCompleted = false;

const origin = config.PUBLIC_ORIGIN;

const futureDate = (days: number) =>
  DateTime.now()
    .setZone(config.CLUB_TIMEZONE)
    .plus({ days })
    .toISODate()!;

/* ==========================================
   PROTECCIÓN DE LA BASE DE PRUEBAS
========================================== */

function assertIsolatedDatabase() {
  const url = new URL(config.DATABASE_URL);

  const database = decodeURIComponent(
    url.pathname.slice(1),
  );

  const safeHosts = [
    'localhost',
    '127.0.0.1',
    '::1',
  ];

  if (
    config.NODE_ENV !== 'test' ||
    database !== 'ritmo_test' ||
    !safeHosts.includes(url.hostname)
  ) {
    throw new Error(
      'Pruebas bloqueadas: usar NODE_ENV=test y una base local llamada ritmo_test.',
    );
  }
}

/* ==========================================
   UTILIDADES
========================================== */

async function register(
  fullName: string,
): Promise<TestAccount> {
  const email =
    `prueba-${randomUUID()}@example.test`;

  const response = await request(app)
    .post('/api/auth/register')
    .set('Origin', origin)
    .send({
      fullName,
      email,
      password: 'ClaveSoloParaPruebas!2026',
    });

  expect(
    response.status,
    JSON.stringify(response.body),
  ).toBe(201);

  const receivedCookies =
    response.headers['set-cookie'];

  const cookie = Array.isArray(receivedCookies)
    ? receivedCookies[0]
    : receivedCookies;

  if (!cookie || !response.body.user?.id) {
    throw new Error(
      'No se pudo crear la sesión de pruebas.',
    );
  }

  return {
    id: response.body.user.id as string,
    email,
    cookie,
  };
}

function reserve(
  account: TestAccount,
  days: number,
  time: string,
) {
  return request(app)
    .post('/api/bookings')
    .set('Origin', origin)
    .set('Cookie', account.cookie)
    .send({
      courtId,
      date: futureDate(days),
      time,
    });
}

/* ==========================================
   PREPARACIÓN DEL ENTORNO
========================================== */

beforeAll(async () => {
  assertIsolatedDatabase();

  const identity = await query<{
    current_database: string;
  }>('SELECT current_database()');

  if (
    identity.rows[0]?.current_database !==
    'ritmo_test'
  ) {
    throw new Error(
      'La conexión no apunta a la base de pruebas.',
    );
  }

  await migrate();

  const court = await query<{ id: string }>(`
    INSERT INTO courts (
      slug,
      name,
      subtitle,
      surface,
      location_label,
      base_price_cents,
      peak_price_cents
    )
    VALUES (
      $1,
      'TEST SEGURIDAD',
      'Integración',
      'Sintético',
      'Pruebas locales',
      10000,
      15000
    )
    RETURNING id
  `, [`test-${randomUUID()}`]);

  courtId = court.rows[0].id;

  player = await register('Jugador Uno');

  secondPlayer = await register(
    'Jugador Dos',
  );

  admin = await register(
    'Administrador Prueba',
  );

  await query(
    "UPDATE app_users SET role='admin' WHERE id=$1",
    [admin.id],
  );

  setupCompleted = true;
}, 30_000);

/* ==========================================
   LIMPIEZA
========================================== */

afterAll(async () => {
  try {
    if (courtId) {
      await query(
        'DELETE FROM court_blocks WHERE court_id=$1',
        [courtId],
      );

      await query(
        'DELETE FROM bookings WHERE court_id=$1',
        [courtId],
      );
    }

    const ids = [
      player?.id,
      secondPlayer?.id,
      admin?.id,
    ].filter(
      (value): value is string =>
        Boolean(value),
    );

    if (ids.length) {
      await query(
        `DELETE FROM audit_events
         WHERE actor_id = ANY($1::uuid[])`,
        [ids],
      );

      await query(
        `DELETE FROM app_users
         WHERE id = ANY($1::uuid[])`,
        [ids],
      );
    }

    if (courtId) {
      await query(
        'DELETE FROM courts WHERE id=$1',
        [courtId],
      );
    }
  } finally {
    await pool.end();
  }
});

/* ==========================================
   INTEGRACIÓN Y SEGURIDAD
========================================== */

describe(
  'Bloque 6: integración y seguridad real',
  () => {

    it(
      'comprueba que se creó el entorno aislado',
      () => {
        expect(setupCompleted).toBe(true);
      },
    );

    it(
      'protege rutas privadas sin autenticación',
      async () => {
        const bookings = await request(app)
          .get('/api/bookings/me');

        const adminArea = await request(app)
          .get('/api/admin/overview');

        expect(bookings.status).toBe(401);
        expect(adminArea.status).toBe(401);
      },
    );

    it(
      'emite cookie HttpOnly y reconoce la sesión en PostgreSQL',
      async () => {
        expect(player.cookie).toContain(
          'HttpOnly',
        );

        const response = await request(app)
          .get('/api/auth/me')
          .set('Cookie', player.cookie);

        expect(response.status).toBe(200);

        expect(
          response.body.user.email,
        ).toBe(player.email);

        expect(
          response.body.user.role,
        ).toBe('player');
      },
    );

    it(
      'impide acceso administrativo a un jugador autenticado',
      async () => {
        const overview = await request(app)
          .get('/api/admin/overview')
          .set('Cookie', player.cookie);

        const agenda = await request(app)
          .get('/api/admin/agenda')
          .query({
            from: futureDate(5),
            to: futureDate(6),
          })
          .set('Cookie', player.cookie);

        const createBlock = await request(app)
          .post('/api/admin/blocks')
          .set('Origin', origin)
          .set('Cookie', player.cookie)
          .send({
            courtId,
            date: futureDate(5),
            start: '12:00',
            end: '13:30',
            reason: 'Mantenimiento',
          });

        expect(overview.status).toBe(403);
        expect(agenda.status).toBe(403);
        expect(createBlock.status).toBe(403);
      },
    );

    it(
      'rechaza un origen externo en operaciones mutantes',
      async () => {
        const response = await request(app)
          .post('/api/bookings')
          .set(
            'Origin',
            'https://sitio-ajeno.invalid',
          )
          .set('Cookie', player.cookie)
          .send({
            courtId,
            date: futureDate(5),
            time: '09:00',
          });

        expect(response.status).toBe(403);

        expect(response.body.code).toBe(
          'INVALID_ORIGIN',
        );
      },
    );

    it(
      'valida los datos antes de escribir en PostgreSQL',
      async () => {
        const response = await request(app)
          .post('/api/bookings')
          .set('Origin', origin)
          .set('Cookie', player.cookie)
          .send({
            courtId,
            date: 'fecha-invalida',
            time: '99:99',
          });

        expect(response.status).toBe(400);
      },
    );

    it(
      'crea una reserva y solo permite verla al propietario',
      async () => {
        const created = await reserve(
          player,
          5,
          '10:00',
        );

        expect(
          created.status,
          JSON.stringify(created.body),
        ).toBe(201);

        expect(
          created.body.booking.priceCents,
        ).toBe(10000);

        const owner = await request(app)
          .get('/api/bookings/me')
          .set('Cookie', player.cookie);

        const other = await request(app)
          .get('/api/bookings/me')
          .set('Cookie', secondPlayer.cookie);

        expect(
          owner.body.bookings.some(
            (b: { id: string }) =>
              b.id === created.body.booking.id,
          ),
        ).toBe(true);

        expect(
          other.body.bookings.some(
            (b: { id: string }) =>
              b.id === created.body.booking.id,
          ),
        ).toBe(false);

        const forbiddenCancellation =
          await request(app)
            .patch(
              `/api/bookings/${created.body.booking.id}/cancel`,
            )
            .set('Origin', origin)
            .set(
              'Cookie',
              secondPlayer.cookie,
            );

        expect(
          forbiddenCancellation.status,
        ).toBe(404);
      },
    );

    it(
      'impide reservas simultáneas para el mismo turno',
      async () => {
        const [first, second] =
          await Promise.all([
            reserve(player, 6, '16:00'),
            reserve(
              secondPlayer,
              6,
              '16:00',
            ),
          ]);

        expect(
          [first.status, second.status].sort(),
        ).toEqual([201, 409]);

        const overlapping = await reserve(
          secondPlayer,
          6,
          '16:30',
        );

        expect(
          overlapping.status,
        ).toBe(409);

        expect(
          overlapping.body.code,
        ).toBe('SLOT_TAKEN');
      },
    );

    it(
      'sincroniza bloqueos administrativos con reservas y disponibilidad',
      async () => {
        const date = futureDate(7);

        const blocked = await request(app)
          .post('/api/admin/blocks')
          .set('Origin', origin)
          .set('Cookie', admin.cookie)
          .send({
            courtId,
            date,
            start: '14:00',
            end: '15:30',
            reason: 'Mantenimiento preventivo',
          });

        expect(
          blocked.status,
          JSON.stringify(blocked.body),
        ).toBe(201);

        const availability =
          await request(app)
            .get('/api/public/availability')
            .query({ date });

        expect(
          availability.status,
        ).toBe(200);

        const court =
          availability.body.courts.find(
            (c: { id: string }) =>
              c.id === courtId,
          );

        const slot = court?.slots.find(
          (s: { time: string }) =>
            s.time === '14:00',
        );

        expect(slot?.available).toBe(false);

        const attempt = await reserve(
          player,
          7,
          '14:00',
        );

        expect(attempt.status).toBe(409);

        const unblocked =
          await request(app)
            .delete(
              `/api/admin/blocks/${blocked.body.id}`,
            )
            .set('Origin', origin)
            .set('Cookie', admin.cookie);

        expect(unblocked.status).toBe(200);

        const freeAgain = await reserve(
          player,
          7,
          '14:00',
        );

        expect(freeAgain.status).toBe(201);
      },
    );

    it(
      'cancela administrativamente y libera un turno',
      async () => {
        const created = await reserve(
          player,
          8,
          '13:00',
        );

        expect(created.status).toBe(201);

        const cancelled =
          await request(app)
            .patch(
              `/api/admin/bookings/${created.body.booking.id}/cancel`,
            )
            .set('Origin', origin)
            .set('Cookie', admin.cookie);

        expect(cancelled.status).toBe(200);

        const booking = await query<{
          status: string;
        }>(
          `SELECT status
           FROM bookings
           WHERE id=$1`,
          [created.body.booking.id],
        );

        expect(
          booking.rows[0]?.status,
        ).toBe('cancelled');

        const newlyAvailable = await reserve(
          secondPlayer,
          8,
          '13:00',
        );

        expect(
          newlyAvailable.status,
        ).toBe(201);
      },
    );

    it(
      'evita bloquear horarios con una reserva confirmada',
      async () => {
        const created = await reserve(
          player,
          9,
          '11:00',
        );

        expect(created.status).toBe(201);

        const blocked =
          await request(app)
            .post('/api/admin/blocks')
            .set('Origin', origin)
            .set('Cookie', admin.cookie)
            .send({
              courtId,
              date: futureDate(9),
              start: '11:00',
              end: '12:30',
              reason: 'Mantenimiento imprevisto',
            });

        expect(blocked.status).toBe(409);

        expect(blocked.body.code).toBe(
          'SLOT_TAKEN',
        );
      },
    );

    it(
      'permite al propietario cancelar y libera el horario',
      async () => {
        const created = await reserve(
          player,
          10,
          '10:00',
        );

        expect(created.status).toBe(201);

        const cancelled =
          await request(app)
            .patch(
              `/api/bookings/${created.body.booking.id}/cancel`,
            )
            .set('Origin', origin)
            .set('Cookie', player.cookie);

        expect(cancelled.status).toBe(200);

        expect(
          cancelled.body.booking.status,
        ).toBe('cancelled');

        const anotherBooking =
          await reserve(
            secondPlayer,
            10,
            '10:00',
          );

        expect(
          anotherBooking.status,
        ).toBe(201);
      },
    );

    it(
      'revoca la sesión del servidor al cerrar sesión',
      async () => {
        const logout = await request(app)
          .post('/api/auth/logout')
          .set('Origin', origin)
          .set(
            'Cookie',
            secondPlayer.cookie,
          );

        expect(logout.status).toBe(200);

        const after = await request(app)
          .get('/api/auth/me')
          .set(
            'Cookie',
            secondPlayer.cookie,
          );

        expect(
          after.body.user,
        ).toBeNull();
      },
    );
  },
);
