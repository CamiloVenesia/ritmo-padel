
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarCheck2, CalendarDays,
  CalendarPlus, CheckCircle2, Clock3, Download, ExternalLink,
  History, LogOut, MapPin, RefreshCw, ShieldCheck, Ticket,
  X, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import {
  bookingCalendar,
  bookingFilter,
  canCancelBooking,
  sortedBookings,
  type BookingFilter,
} from '../lib/booking-history.ts';
import { clubZone, money } from '../lib/format';
import type { Booking } from '../lib/types';
import '../styles/my-bookings.css';

const FILTERS = [
  { key: 'upcoming', label: 'Próximas', icon: CalendarDays },
  { key: 'completed', label: 'Finalizadas', icon: History },
  { key: 'cancelled', label: 'Canceladas', icon: XCircle },
] as const satisfies ReadonlyArray<{
  key: BookingFilter;
  label: string;
  icon: LucideIcon;
}>;

type VisibleBookingFilter = (typeof FILTERS)[number]['key'];

const dayFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: clubZone,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: clubZone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const shortDayFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: clubZone,
  day: '2-digit',
  month: 'short',
});

function when(iso: string) {
  return dayFormat.format(new Date(iso));
}

function hours(booking: Booking) {
  return `${timeFormat.format(new Date(booking.startsAt))}–${timeFormat.format(new Date(booking.endsAt))}`;
}

function minutesOf(booking: Booking) {
  return Math.round(
    (new Date(booking.endsAt).getTime() -
      new Date(booking.startsAt).getTime()) / 60000,
  );
}

function saveCalendar(booking: Booking) {
  const content = bookingCalendar(booking, api.isDemo);

  const url = URL.createObjectURL(
    new Blob([content], {
      type: 'text/calendar;charset=utf-8',
    }),
  );

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ritmo-padel-${booking.startsAt.slice(0, 10)}.ics`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MyBookingsPage() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<BookingFilter>('upcoming');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const modalCloseRef = useRef<HTMLButtonElement>(null);
  const cancelPendingRef = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  const {
    data: session,
    isPending: sessionPending,
    isError: sessionError,
    refetch: refetchSession,
  } = useQuery({
    queryKey: ['session'],
    queryFn: api.me,
  });

  const {
    data,
    isPending: bookingsPending,
    isError: bookingsError,
    error: bookingsErrorDetail,
    refetch: refetchBookings,
    isFetching,
  } = useQuery({
    queryKey: ['my-bookings', session?.user?.id],
    queryFn: api.myBookings,
    enabled: Boolean(session?.user),
  });

  const bookings = data?.bookings ?? [];
  const shown = sortedBookings(bookings, tab, now);

  const counts: Record<VisibleBookingFilter, number> = {
    upcoming: bookings.filter(
      (b) => bookingFilter(b, now) === 'upcoming',
    ).length,
    completed: bookings.filter(
      (b) => bookingFilter(b, now) === 'completed',
    ).length,
    cancelled: bookings.filter(
      (b) => bookingFilter(b, now) === 'cancelled',
    ).length,
  };

  const nextBooking = sortedBookings(bookings, 'upcoming', now)[0];

  const detail = bookings.find(
    (b) => b.id === detailsId,
  ) ?? null;

  const cancelTarget = bookings.find(
    (b) => b.id === cancelId,
  ) ?? null;

  const cancelMutation = useMutation({
    mutationFn: api.cancelBooking,

    onSuccess: async (_response, id) => {
      queryClient.setQueriesData<{ bookings: Booking[] }>(
        { queryKey: ['my-bookings'] },
        (old) =>
          old
            ? {
                bookings: old.bookings.map((b) =>
                  b.id === id
                    ? { ...b, status: 'cancelled' }
                    : b,
                ),
              }
            : old,
      );

      setCancelId(null);
      setDetailsId(null);

      setMessage(
        'Tu reserva se canceló correctamente. El turno volvió a estar disponible.',
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['my-bookings'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['availability'],
        }),
      ]);
    },
  });

  const logout = useMutation({
    mutationFn: api.logout,

    onSuccess: async () => {
      setDetailsId(null);
      setCancelId(null);

      queryClient.removeQueries({
        queryKey: ['my-bookings'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['session'],
      });
    },
  });

  cancelPendingRef.current = cancelMutation.isPending;

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      60_000,
    );

    return () => window.clearInterval(timer);
  }, []);

  const dialogVisible = Boolean(detail || cancelTarget);

  useEffect(() => {
    if (!dialogVisible) return;

    modalCloseRef.current?.focus();

    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        const dialog =
          modalCloseRef.current?.closest('[role="dialog"]');

        const elements = Array.from(
          dialog?.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        );

        if (elements.length) {
          if (
            event.shiftKey &&
            document.activeElement === elements[0]
          ) {
            elements[elements.length - 1].focus();
            event.preventDefault();
          } else if (
            !event.shiftKey &&
            document.activeElement ===
              elements[elements.length - 1]
          ) {
            elements[0].focus();
            event.preventDefault();
          }
        }
      }

      if (
        event.key === 'Escape' &&
        !cancelPendingRef.current
      ) {
        setDetailsId(null);
        setCancelId(null);
      }
    }

    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('keydown', onEscape);
      previousFocus.current?.focus();
    };
  }, [dialogVisible]);

  function openDetails(id: string) {
    previousFocus.current =
      document.activeElement as HTMLElement;

    setCalendarError('');
    setDetailsId(id);
  }

  function openCancel(id: string) {
    previousFocus.current =
      document.activeElement as HTMLElement;

    cancelMutation.reset();
    setCancelId(id);
  }

  function addToCalendar(booking: Booking) {
    try {
      setCalendarError('');
      saveCalendar(booking);
    } catch {
      setCalendarError(
        'No se pudo preparar el evento. Revisá los datos del turno.',
      );
    }
  }

  return (
    <div className="page-bg account-page my-bookings">
      <div className="container">
        <header className="page-intro my-bookings__intro">
          <Link to="/" className="back-link">
            <ArrowLeft size={16} />
            VOLVER AL CLUB
          </Link>

          <div className="eyebrow">
            <span className="eyebrow-line" />
            TU CUENTA / 001
          </div>

          <h1>
            TUS PARTIDOS<span>.</span>
          </h1>

          <p>
            Tus turnos, tus planes. Todo en un solo lugar.
          </p>
        </header>

        {sessionPending ? (
          <div className="my-bookings__loading" role="status">
            <span className="my-bookings__spinner" />
            Cargando tu cuenta…
          </div>
        ) : sessionError ? (
          <section className="my-bookings__empty" role="alert">
            <XCircle size={34} />

            <h2>NO PUDIMOS ABRIR TU CUENTA.</h2>

            <p>
              Comprobá tu conexión e intentá nuevamente.
            </p>

            <button
              className="btn btn-dark"
              type="button"
              onClick={() => void refetchSession()}
            >
              <RefreshCw size={17} />
              Reintentar
            </button>
          </section>
        ) : !session?.user ? (
          <section className="my-bookings__empty">
            <Ticket size={37} />

            <span>ACCESO A JUGADORES</span>

            <h2>PRIMERO, ENTRÁ AL CLUB.</h2>

            <p>
              Iniciá sesión para consultar tus reservas,
              descargar comprobantes y gestionar tus partidos.
            </p>

            <Link
              className="btn btn-lime"
              to="/acceso?next=%2Fmis-reservas"
            >
              Ingresar a mi cuenta
              <ArrowUpRight size={18} />
            </Link>
          </section>
        ) : (
          <>
            <section
              className="my-bookings__hero"
              aria-label="Resumen de tu actividad"
            >
              <div className="my-bookings__hero-copy">
                <span className="my-bookings__overline">
                  YOUR GAME / YOUR RULES
                </span>

                <p>
                  HOLA,{' '}
                  {session.user.fullName
                    .split(' ')[0]
                    .toUpperCase()}
                </p>

                <h2>
                  EL PRÓXIMO
                  <br />
                  <em>PARTIDO TE ESPERA.</em>
                </h2>

                <div className="my-bookings__hero-actions">
                  <Link
                    to="/reservar"
                    className="btn btn-lime"
                  >
                    Nueva reserva
                    <ArrowUpRight size={17} />
                  </Link>

                  <button
                    type="button"
                    className="my-bookings__logout"
                    disabled={logout.isPending}
                    onClick={() => logout.mutate()}
                  >
                    <LogOut size={16} />
                    {logout.isPending
                      ? 'Saliendo…'
                      : 'Cerrar sesión'}
                  </button>
                </div>
              </div>

              <div className="my-bookings__hero-next">
                <span>
                  <CalendarCheck2 size={15} />
                  PRÓXIMO TURNO
                </span>

                {nextBooking ? (
                  <>
                    <strong>
                      {shortDayFormat.format(
                        new Date(nextBooking.startsAt),
                      )}
                    </strong>

                    <b>
                      {nextBooking.courtName ||
                        'Cancha de pádel'}
                    </b>

                    <small>
                      {hours(nextBooking)} hs
                    </small>
                  </>
                ) : (
                  <>
                    <strong>—</strong>
                    <b>LA CANCHA TE ESPERA</b>
                    <small>Elegí tu próximo turno.</small>
                  </>
                )}
              </div>
            </section>

            <div
              className="my-bookings__stats"
              aria-label="Resumen de reservas"
            >
              <div>
                <span>PRÓXIMAS</span>
                <strong>{counts.upcoming}</strong>
                <CalendarDays size={19} />
              </div>

              <div>
                <span>FINALIZADAS</span>
                <strong>{counts.completed}</strong>
                <CheckCircle2 size={19} />
              </div>

              <div>
                <span>CANCELADAS</span>
                <strong>{counts.cancelled}</strong>
                <XCircle size={19} />
              </div>
            </div>

            <section
              className="my-bookings__section"
              aria-labelledby="my-bookings-heading"
            >
              <div className="my-bookings__section-top">
                <div>
                  <span>HISTORIAL / 002</span>

                  <h2 id="my-bookings-heading">
                    MIS RESERVAS.
                  </h2>
                </div>

                <button
                  type="button"
                  className="my-bookings__refresh"
                  disabled={isFetching}
                  onClick={() => void refetchBookings()}
                >
                  <RefreshCw
                    size={15}
                    className={isFetching ? 'is-spinning' : ''}
                  />
                  Actualizar
                </button>
              </div>

              <div
                className="my-bookings__filters"
                role="group"
                aria-label="Filtrar mis reservas"
              >
                {FILTERS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={tab === key}
                    className={
                      tab === key ? 'is-active' : ''
                    }
                    onClick={() => setTab(key)}
                  >
                    <Icon size={17} />

                    <span>{label}</span>

                    <strong>{counts[key]}</strong>
                  </button>
                ))}
              </div>

              {message && (
                <div
                  className="my-bookings__notice"
                  role="status"
                >
                  <CheckCircle2 size={17} />

                  {message}

                  <button
                    type="button"
                    aria-label="Cerrar aviso"
                    onClick={() => setMessage('')}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {logout.isError && (
                <div className="inline-error" role="alert">
                  {logout.error.message}
                </div>
              )}

              {bookingsPending ? (
                <div
                  className="my-bookings__loading"
                  role="status"
                >
                  <span className="my-bookings__spinner" />
                  Cargando reservas…
                </div>
              ) : bookingsError ? (
                <div
                  className="my-bookings__empty"
                  role="alert"
                >
                  <XCircle size={32} />

                  <h3>
                    NO PUDIMOS CARGAR TUS RESERVAS.
                  </h3>

                  <p>
                    {bookingsErrorDetail instanceof Error
                      ? bookingsErrorDetail.message
                      : 'Probá nuevamente.'}
                  </p>

                  <button
                    type="button"
                    className="btn btn-dark"
                    onClick={() => void refetchBookings()}
                  >
                    <RefreshCw size={16} />
                    Reintentar
                  </button>
                </div>
              ) : shown.length === 0 ? (
                <div className="my-bookings__empty">
                  <CalendarDays size={34} />

                  <h3>
                    {tab === 'upcoming'
                      ? 'TODAVÍA NO HAY PARTIDOS EN AGENDA.'
                      : tab === 'completed'
                        ? 'ACÁ APARECERÁN TUS PARTIDOS JUGADOS.'
                        : 'NO TENÉS RESERVAS CANCELADAS.'}
                  </h3>

                  <p>
                    {tab === 'upcoming'
                      ? 'Elegí una cancha y reservá tu próximo encuentro.'
                      : 'Podés revisar las demás categorías para consultar tus turnos.'}
                  </p>

                  {tab === 'upcoming' ? (
                    <Link
                      className="btn btn-lime"
                      to="/reservar"
                    >
                      Reservar cancha
                      <ArrowRight size={17} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-dark"
                      onClick={() => setTab('upcoming')}
                    >
                      Ver próximas
                      <ArrowRight size={17} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="my-bookings__list">
                  {shown.map((booking, index) => {
                    const cancellable =
                      canCancelBooking(booking, now);

                    const inProgress =
                      booking.status === 'confirmed' &&
                      new Date(booking.startsAt).getTime() <= now &&
                      new Date(booking.endsAt).getTime() > now;

                    return (
                      <article
                        className={`my-bookings__record my-bookings__record--${tab}`}
                        key={booking.id}
                      >
                        <div className="my-bookings__record-index">
                          {String(index + 1).padStart(2, '0')}
                        </div>

                        <div className="my-bookings__record-content">
                          <div className="my-bookings__record-meta">
                            <span
                              className={`my-bookings__status my-bookings__status--${tab}`}
                            >
                              {inProgress
                                ? 'EN CURSO'
                                : tab === 'upcoming'
                                  ? 'CONFIRMADA'
                                  : tab === 'completed'
                                    ? 'FINALIZADA'
                                    : 'CANCELADA'}
                            </span>

                            <span>
                              RESERVA #
                              {booking.id
                                .slice(0, 8)
                                .toUpperCase()}
                            </span>
                          </div>

                          <h3>
                            {booking.courtName ||
                              'Cancha de pádel'}
                          </h3>

                          <div className="my-bookings__record-facts">
                            <span>
                              <CalendarDays size={15} />
                              {when(booking.startsAt)}
                            </span>

                            <span>
                              <Clock3 size={15} />
                              {hours(booking)} hs
                            </span>

                            <span>
                              <MapPin size={15} />
                              RITMO PÁDEL
                            </span>
                          </div>
                        </div>

                        <div className="my-bookings__record-side">
                          <span>VALOR DEL TURNO</span>

                          <strong>
                            {money(booking.priceCents)}
                          </strong>

                          <div className="my-bookings__record-buttons">
                            <button
                              type="button"
                              onClick={() =>
                                openDetails(booking.id)
                              }
                            >
                              <Ticket size={15} />
                              Ver detalle
                            </button>

                            {cancellable && (
                              <button
                                className="my-bookings__cancel-link"
                                type="button"
                                onClick={() =>
                                  openCancel(booking.id)
                                }
                              >
                                <XCircle size={15} />
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="my-bookings__footer-note">
              <ShieldCheck size={17} />

              {api.isDemo
                ? 'MODO DEMO · Los turnos de prueba se guardan en este navegador y no generan reservas reales.'
                : 'La cancelación está permitida hasta dos horas antes del inicio. Sujeto a las reglas del club.'}
            </div>
          </>
        )}
      </div>

      {detail && (
        <div
          className="my-bookings__overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDetailsId(null);
            }
          }}
        >
          <section
            className="my-bookings__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-detail-title"
          >
            <button
              type="button"
              ref={modalCloseRef}
              className="my-bookings__dialog-close"
              aria-label="Cerrar comprobante"
              onClick={() => setDetailsId(null)}
            >
              <X size={20} />
            </button>

            <span className="my-bookings__dialog-kicker">
              RITMO PÁDEL / COMPROBANTE
            </span>

            <div className="my-bookings__dialog-symbol">
              <Ticket size={28} />
            </div>

            <h2 id="booking-detail-title">
              DETALLE DE TU
              <br />
              RESERVA.
            </h2>

            <span
              className={`my-bookings__status my-bookings__status--${bookingFilter(detail, now)}`}
            >
              {bookingFilter(detail, now) === 'upcoming'
                ? 'CONFIRMADA'
                : bookingFilter(detail, now) === 'completed'
                  ? 'FINALIZADA'
                  : 'CANCELADA'}
            </span>

            <dl className="my-bookings__detail-grid">
              <div>
                <dt>CANCHA</dt>
                <dd>
                  {detail.courtName ||
                    'Cancha de pádel'}
                </dd>
              </div>

              <div>
                <dt>FECHA</dt>
                <dd>{when(detail.startsAt)}</dd>
              </div>

              <div>
                <dt>HORARIO</dt>
                <dd>{hours(detail)} hs</dd>
              </div>

              <div>
                <dt>DURACIÓN</dt>
                <dd>{minutesOf(detail)} minutos</dd>
              </div>

              <div>
                <dt>VALOR DEL TURNO</dt>
                <dd>{money(detail.priceCents)}</dd>
              </div>

              <div>
                <dt>ESTADO</dt>
                <dd>
                  {detail.status === 'cancelled'
                    ? 'Cancelada'
                    : 'Confirmada'}
                </dd>
              </div>
            </dl>

            <div className="my-bookings__detail-id">
              <span>ID DE RESERVA</span>
              <code>{detail.id}</code>
            </div>

            {api.isDemo && (
              <p className="my-bookings__detail-demo">
                Comprobante de demostración.
                No acredita una reserva o un pago real.
              </p>
            )}

            {calendarError && (
              <div
                role="alert"
                className="inline-error"
              >
                {calendarError}
              </div>
            )}

            <div className="my-bookings__dialog-actions">
              {bookingFilter(detail, now) === 'upcoming' &&
                new Date(detail.startsAt).getTime() > now && (
                  <button
                    type="button"
                    className="btn btn-lime"
                    onClick={() =>
                      addToCalendar(detail)
                    }
                  >
                    <CalendarPlus size={17} />
                    Agregar al calendario
                    <Download size={15} />
                  </button>
                )}

              <button
                type="button"
                className="my-bookings__secondary"
                onClick={() => setDetailsId(null)}
              >
                Volver a mis reservas
                <ExternalLink size={15} />
              </button>
            </div>
          </section>
        </div>
      )}

      {cancelTarget && (
        <div
          className="my-bookings__overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !cancelMutation.isPending
            ) {
              setCancelId(null);
            }
          }}
        >
          <section
            className="my-bookings__dialog my-bookings__dialog--cancel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-cancel-title"
          >
            <button
              type="button"
              ref={modalCloseRef}
              className="my-bookings__dialog-close"
              aria-label="Cerrar confirmación"
              disabled={cancelMutation.isPending}
              onClick={() => setCancelId(null)}
            >
              <X size={20} />
            </button>

            <div className="my-bookings__dialog-symbol my-bookings__dialog-symbol--cancel">
              <XCircle size={28} />
            </div>

            <span className="my-bookings__dialog-kicker">
              GESTIÓN DE RESERVAS
            </span>

            <h2 id="booking-cancel-title">
              ¿CANCELAR
              <br />
              ESTE TURNO?
            </h2>

            <p>
              Vas a cancelar{' '}
              <strong>
                {cancelTarget.courtName || 'tu cancha'}
              </strong>{' '}
              del{' '}
              <strong>
                {when(cancelTarget.startsAt)}
              </strong>{' '}
              a las{' '}
              <strong>
                {hours(cancelTarget)} hs
              </strong>.
            </p>

            <p>
              Esta acción no se puede deshacer.
              Solo se permite cancelar con al menos
              2 horas de anticipación.
            </p>

            {cancelMutation.isError && (
              <div
                className="inline-error"
                role="alert"
              >
                {cancelMutation.error.message}
              </div>
            )}

            <div className="my-bookings__dialog-actions">
              <button
                type="button"
                className="my-bookings__danger"
                disabled={
                  cancelMutation.isPending ||
                  !canCancelBooking(cancelTarget, now)
                }
                onClick={() =>
                  cancelMutation.mutate(cancelTarget.id)
                }
              >
                {cancelMutation.isPending
                  ? 'Cancelando…'
                  : 'Sí, cancelar reserva'}
              </button>

              <button
                type="button"
                className="my-bookings__secondary"
                disabled={cancelMutation.isPending}
                onClick={() => setCancelId(null)}
              >
                Conservar mi turno
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
