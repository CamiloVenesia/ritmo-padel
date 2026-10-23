
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';

import { api } from '../lib/api';
import {
  clubZone,
  displayDate,
  displayDateTime,
  money,
  offsetDate,
} from '../lib/format';

import type {
  AdminBooking,
  AdminBlock,
} from '../lib/types';

import '../styles/admin-dashboard.css';

type Section = 'agenda' | 'reservas' | 'bloqueos';

type BookingStatus =
  | 'all'
  | 'confirmed'
  | 'cancelled';

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);

  return new Date(
    Date.UTC(y, m - 1, d + days),
  ).toISOString().slice(0, 10);
};

const dateOf = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: clubZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));

const hour = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', {
    timeZone: clubZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const period = (item: {
  startsAt: string;
  endsAt: string;
}) => `${hour(item.startsAt)}–${hour(item.endsAt)}`;

const isFuture = (booking: AdminBooking) =>
  booking.status === 'confirmed' &&
  new Date(booking.startsAt).getTime() > Date.now();

export function AdminPage() {
  const qc = useQueryClient();

  const [section, setSection] =
    useState<Section>('agenda');

  const [week, setWeek] =
    useState(offsetDate(0));

  const [day, setDay] =
    useState(offsetDate(0));

  const [search, setSearch] = useState('');

  const [status, setStatus] =
    useState<BookingStatus>('all');

  const [courtFilter, setCourtFilter] =
    useState('all');

  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState(offsetDate(1));
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:30');

  const [reason, setReason] =
    useState('Mantenimiento programado');

  const [cancelTarget, setCancelTarget] =
    useState<AdminBooking | null>(null);

  const [notice, setNotice] = useState('');

  const closeRef = useRef<HTMLButtonElement>(null);

  const session = useQuery({
    queryKey: ['session'],
    queryFn: api.me,
  });

  const authorized =
    session.data?.user?.role === 'admin';

  const overview = useQuery({
    queryKey: ['admin-overview'],
    queryFn: api.adminOverview,
    enabled: authorized,
  });

  const courts = useQuery({
    queryKey: ['courts'],
    queryFn: api.courts,
    enabled: authorized,
  });

  const weekEnd = addDays(week, 6);

  const agenda = useQuery({
    queryKey: [
      'admin-agenda',
      week,
      weekEnd,
    ],
    queryFn: () =>
      api.adminAgenda(week, weekEnd),
    enabled: authorized,
  });

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({
        queryKey: ['admin-overview'],
      }),
      qc.invalidateQueries({
        queryKey: ['admin-agenda'],
      }),
      qc.invalidateQueries({
        queryKey: ['availability'],
      }),
      qc.invalidateQueries({
        queryKey: ['my-bookings'],
      }),
    ]);
  };

  const block = useMutation({
    mutationFn: api.blockCourt,

    onSuccess: async () => {
      setNotice(
        'Horario bloqueado. La agenda y la disponibilidad se actualizaron.',
      );

      await refreshAll();
    },
  });

  const unblock = useMutation({
    mutationFn: api.removeBlock,

    onSuccess: async () => {
      setNotice(
        'Bloqueo eliminado correctamente.',
      );

      await refreshAll();
    },
  });

  const cancel = useMutation({
    mutationFn: api.adminCancelBooking,

    onSuccess: async () => {
      setCancelTarget(null);

      setNotice(
        'Reserva cancelada. El horario volvió a estar disponible.',
      );

      await refreshAll();
    },
  });

  useEffect(() => {
    if (!cancelTarget) return;

    closeRef.current?.focus();

    const escape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !cancel.isPending
      ) {
        setCancelTarget(null);
      }
    };

    document.addEventListener(
      'keydown',
      escape,
    );

    return () =>
      document.removeEventListener(
        'keydown',
        escape,
      );
  }, [cancelTarget, cancel.isPending]);

  function changeWeek(distance: number) {
    const next = addDays(
      week,
      distance * 7,
    );

    if (next < offsetDate(0)) return;

    setWeek(next);
    setDay(next);
  }

  const allCourts = courts.data?.courts ?? [];
  const recent = overview.data?.bookings ?? [];

  const normalized = search
    .trim()
    .toLocaleLowerCase('es-AR');

  const filtered = recent.filter(
    b =>
      (status === 'all' ||
        b.status === status) &&
      (courtFilter === 'all' ||
        b.courtId === courtFilter) &&
      (
        !normalized ||
        [
          b.playerName,
          b.playerEmail,
          b.courtName || '',
          b.id,
        ].some(v =>
          v.toLocaleLowerCase('es-AR')
            .includes(normalized),
        )
      ),
  );

  const visibleBookings = (
    agenda.data?.bookings ?? []
  ).filter(
    b =>
      b.status === 'confirmed' &&
      dateOf(b.startsAt) === day,
  );

  const visibleBlocks = (
    agenda.data?.blocks ?? []
  ).filter(
    b => dateOf(b.startsAt) === day,
  );

  const activeBlocks = (
    overview.data?.blocks ?? []
  ).filter(
    b =>
      new Date(b.endsAt).getTime() >
      Date.now(),
  );

  const stats = overview.data?.stats;

  const refreshing =
    overview.isFetching ||
    agenda.isFetching;

  if (session.isPending) {
    return (
      <div className="container page-loader">
        Verificando permisos…
      </div>
    );
  }

  if (session.isError) {
    return (
      <div className="page-bg admin-v2">
        <div
          className="container admin-v2__error"
          role="alert"
        >
          <h2>
            No se pudo verificar la sesión.
          </h2>

          <button
            className="btn btn-dark"
            onClick={() =>
              void session.refetch()
            }
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="page-bg admin-not-authorized">
        <div className="container account-empty">
          <LockKeyhole size={35} />

          <h2>ÁREA RESTRINGIDA.</h2>

          <p>
            Este espacio es exclusivo para
            administradores del club.
          </p>

          <Link
            to="/acceso?next=%2Fadmin"
            className="btn btn-lime"
          >
            Iniciar sesión
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg admin-page admin-v2">
      <div className="container">
        <header className="page-intro admin-v2__intro">
          <Link to="/" className="back-link">
            <ArrowLeft size={16} />
            VOLVER AL CLUB
          </Link>

          <div className="eyebrow">
            <span className="eyebrow-line" />
            BACKOFFICE / 001
          </div>

          <h1>
            CONTROL TOTAL<span>.</span>
          </h1>

          <p>
            Organizá la agenda, administrá reservas
            y prepará cada cancha para el próximo partido.
          </p>
        </header>

        <section className="admin-v2__banner">
          <div>
            <span>
              <Activity size={16} />
              OPERACIONES DEL CLUB
            </span>

            <h2>
              TODO EL CLUB.
              <br />
              <em>UNA SOLA VISTA.</em>
            </h2>

            <small>
              {api.isDemo
                ? 'MODO DEMOSTRACIÓN · Los cambios se guardan en este navegador.'
                : 'MODO REAL · Cambios registrados por el servidor.'}
            </small>
          </div>

          <button
            type="button"
            className="btn btn-lime"
            disabled={refreshing}
            onClick={() => void refreshAll()}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? 'admin-v2__spin'
                  : ''
              }
            />
            Actualizar datos
          </button>
        </section>

        {overview.isError && (
          <div
            className="inline-error"
            role="alert"
          >
            {(overview.error as Error).message}

            <button
              type="button"
              onClick={() =>
                void overview.refetch()
              }
            >
              Reintentar
            </button>
          </div>
        )}

        {courts.isError && (
          <div
            className="inline-error"
            role="alert"
          >
            No se pudieron cargar las canchas.

            <button
              type="button"
              onClick={() =>
                void courts.refetch()
              }
            >
              Reintentar
            </button>
          </div>
        )}

        {notice && (
          <div
            className="admin-v2__notice"
            role="status"
          >
            <CheckCircle2 size={18} />
            {notice}

            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setNotice('')}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div
          className="admin-v2__kpis"
          aria-label="Indicadores del club"
        >
          <div>
            <span>CANCHAS ACTIVAS</span>

            <strong>
              {stats
                ? String(stats.courts).padStart(2, '0')
                : '—'}
            </strong>

            <LayoutDashboard size={23} />
          </div>

          <div>
            <span>PRÓXIMAS 24 HORAS</span>

            <strong>
              {stats
                ? String(stats.next24h).padStart(2, '0')
                : '—'}
            </strong>

            <CalendarDays size={23} />
          </div>

          <div>
            <span>RESERVAS DEL MES</span>

            <strong>
              {stats
                ? String(stats.monthBookings).padStart(2, '0')
                : '—'}
            </strong>

            <TrendingUp size={23} />
          </div>

          <div>
            <span>VALOR RESERVADO DEL MES</span>

            <strong className="admin-v2__money">
              {stats
                ? money(stats.monthRevenueCents)
                : '—'}
            </strong>

            <CircleDollarSign size={23} />
          </div>
        </div>

        <p className="admin-v2__kpi-note">
          Valor reservado no significa dinero cobrado.
          No hay pasarela de pagos conectada.
        </p>

        <div
          className="admin-v2__tabs"
          role="group"
          aria-label="Secciones administrativas"
        >
          <button
            type="button"
            className={
              section === 'agenda'
                ? 'is-active'
                : ''
            }
            aria-pressed={section === 'agenda'}
            onClick={() => setSection('agenda')}
          >
            <CalendarDays size={17} />
            Agenda semanal
          </button>

          <button
            type="button"
            className={
              section === 'reservas'
                ? 'is-active'
                : ''
            }
            aria-pressed={section === 'reservas'}
            onClick={() => setSection('reservas')}
          >
            <SlidersHorizontal size={17} />
            Reservas
          </button>

          <button
            type="button"
            className={
              section === 'bloqueos'
                ? 'is-active'
                : ''
            }
            aria-pressed={section === 'bloqueos'}
            onClick={() => setSection('bloqueos')}
          >
            <LockKeyhole size={17} />
            Bloqueos
            <span>{activeBlocks.length}</span>
          </button>
        </div>

        {section === 'agenda' && (
          <section
            className="admin-v2__panel"
            aria-label="Agenda semanal"
          >
            <div className="admin-v2__section-head">
              <div>
                <span>AGENDA / 002</span>
                <h2>EL CLUB EN MOVIMIENTO.</h2>
              </div>

              <div className="admin-v2__week-controls">
                <button
                  type="button"
                  aria-label="Semana anterior"
                  disabled={week <= offsetDate(0)}
                  onClick={() => changeWeek(-1)}
                >
                  <ChevronLeft size={20} />
                </button>

                <strong>
                  {displayDate(week, {
                    day: 'numeric',
                    month: 'short',
                  })}
                  {' — '}
                  {displayDate(weekEnd, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </strong>

                <button
                  type="button"
                  aria-label="Semana siguiente"
                  onClick={() => changeWeek(1)}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="admin-v2__days">
              {Array.from(
                { length: 7 },
                (_, i) => {
                  const dateValue = addDays(week, i);

                  const count = (
                    agenda.data?.bookings ?? []
                  ).filter(
                    b =>
                      b.status === 'confirmed' &&
                      dateOf(b.startsAt) === dateValue,
                  ).length;

                  return (
                    <button
                      type="button"
                      key={dateValue}
                      aria-pressed={
                        day === dateValue
                      }
                      className={
                        day === dateValue
                          ? 'is-active'
                          : ''
                      }
                      onClick={() =>
                        setDay(dateValue)
                      }
                    >
                      <span>
                        {displayDate(dateValue, {
                          weekday: 'short',
                        })}
                      </span>

                      <strong>
                        {dateValue.slice(-2)}
                      </strong>

                      <small>
                        {count} reserva
                        {count === 1 ? '' : 's'}
                      </small>
                    </button>
                  );
                },
              )}
            </div>

            {agenda.isError ? (
              <div
                className="admin-v2__state"
                role="alert"
              >
                No se pudo cargar la agenda.

                <button
                  onClick={() =>
                    void agenda.refetch()
                  }
                >
                  Reintentar
                </button>
              </div>
            ) : agenda.isPending || courts.isPending ? (
              <div
                className="admin-v2__state"
                role="status"
              >
                Cargando agenda…
              </div>
            ) : (
              <>
                <div className="admin-v2__agenda-summary">
                  <strong>
                    {displayDate(day, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </strong>

                  <span>
                    {visibleBookings.length} reservas
                    confirmadas · {visibleBlocks.length}{' '}
                    bloqueos
                  </span>
                </div>

                <div className="admin-v2__court-grid">
                  {allCourts.map(court => {
                    const bookings =
                      visibleBookings.filter(
                        b => b.courtId === court.id,
                      );

                    const blocks =
                      visibleBlocks.filter(
                        b => b.courtId === court.id,
                      );

                    const entries = [
                      ...bookings.map(b => ({
                        kind: 'booking' as const,
                        item: b,
                      })),
                      ...blocks.map(b => ({
                        kind: 'block' as const,
                        item: b,
                      })),
                    ].sort(
                      (a, b) =>
                        a.item.startsAt.localeCompare(
                          b.item.startsAt,
                        ),
                    );

                    return (
                      <article
                        className="admin-v2__court"
                        key={court.id}
                      >
                        <div className="admin-v2__court-head">
                          <span
                            className={`admin-v2__court-dot admin-v2__court-dot--${court.accent}`}
                          />

                          <div>
                            <h3>{court.name}</h3>
                            <small>{court.surface}</small>
                          </div>

                          <b>
                            {bookings.length} TURNOS
                          </b>
                        </div>

                        <div className="admin-v2__court-events">
                          {entries.length === 0 ? (
                            <p>
                              Sin turnos ni bloqueos
                              registrados en esta fecha.
                            </p>
                          ) : (
                            entries.map(
                              ({ kind, item }) => (
                                <div
                                  key={`${kind}-${item.id}`}
                                  className={`admin-v2__event admin-v2__event--${kind}`}
                                >
                                  <span>
                                    <Clock3 size={13} />
                                    {period(item)}
                                  </span>

                                  <strong>
                                    {kind === 'booking'
                                      ? (
                                          item as AdminBooking
                                        ).playerName
                                      : 'CANCHA BLOQUEADA'}
                                  </strong>

                                  <small>
                                    {kind === 'booking'
                                      ? 'Reserva confirmada'
                                      : (
                                          item as AdminBlock
                                        ).reason}
                                  </small>
                                </div>
                              ),
                            )
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                <p className="admin-v2__hint">
                  <ShieldCheck size={16} />
                  Se muestran reservas y bloqueos registrados;
                  un espacio vacío no garantiza disponibilidad.
                  Consultá Reservar para los turnos disponibles.
                </p>
              </>
            )}
          </section>
        )}

        {section === 'reservas' && (
          <section
            className="admin-v2__panel"
            aria-label="Gestión de reservas"
          >
            <div className="admin-v2__section-head">
              <div>
                <span>REGISTROS / 003</span>
                <h2>GESTIÓN DE RESERVAS.</h2>
              </div>

              <small>
                Últimos {recent.length} registros recibidos
              </small>
            </div>

            <div className="admin-v2__filters">
              <label className="admin-v2__search">
                <Search size={17} />

                <input
                  aria-label="Buscar jugador, correo, cancha o ID"
                  placeholder="Buscar jugador, email o reserva"
                  value={search}
                  onChange={e =>
                    setSearch(e.target.value)
                  }
                />
              </label>

              <label>
                <span>ESTADO</span>

                <select
                  value={status}
                  onChange={e =>
                    setStatus(
                      e.target.value as BookingStatus,
                    )
                  }
                >
                  <option value="all">Todos</option>
                  <option value="confirmed">
                    Confirmadas
                  </option>
                  <option value="cancelled">
                    Canceladas
                  </option>
                </select>
              </label>

              <label>
                <span>CANCHA</span>

                <select
                  value={courtFilter}
                  onChange={e =>
                    setCourtFilter(e.target.value)
                  }
                >
                  <option value="all">Todas</option>

                  {allCourts.map(c => (
                    <option
                      value={c.id}
                      key={c.id}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {overview.isPending ? (
              <div
                className="admin-v2__state"
                role="status"
              >
                Cargando reservas…
              </div>
            ) : (
              <div className="admin-v2__records">
                {filtered.length === 0 ? (
                  <div className="admin-v2__state">
                    No hay reservas con estos filtros.
                  </div>
                ) : (
                  filtered.map(b => (
                    <article
                      className="admin-v2__record"
                      key={b.id}
                    >
                      <div>
                        <span
                          className={`admin-v2__chip admin-v2__chip--${b.status}`}
                        >
                          {b.status === 'confirmed'
                            ? 'CONFIRMADA'
                            : 'CANCELADA'}
                        </span>

                        <h3>{b.playerName}</h3>
                        <p>{b.playerEmail}</p>

                        <small>
                          {b.courtName} ·{' '}
                          {displayDateTime(
                            b.startsAt,
                          )}{' '}
                          · {period(b)}
                        </small>

                        <code>
                          #
                          {b.id
                            .slice(0, 8)
                            .toUpperCase()}
                        </code>
                      </div>

                      <div className="admin-v2__record-right">
                        <strong>
                          {money(b.priceCents)}
                        </strong>

                        {isFuture(b) ? (
                          <button
                            className="admin-v2__danger-outline"
                            type="button"
                            onClick={() => {
                              cancel.reset();
                              setCancelTarget(b);
                            }}
                          >
                            <XCircle size={16} />
                            Cancelar turno
                          </button>
                        ) : (
                          <span>
                            {b.status === 'cancelled'
                              ? 'Cancelada'
                              : 'Turno iniciado o finalizado'}
                          </span>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
          </section>
        )}

        {section === 'bloqueos' && (
          <div className="admin-v2__blocks-layout">
            <section className="admin-v2__panel">
              <div className="admin-v2__section-head">
                <div>
                  <span>GESTIÓN / 004</span>
                  <h2>BLOQUEAR CANCHA.</h2>
                </div>

                <Plus size={22} />
              </div>

              <form
                className="admin-v2__form"
                onSubmit={e => {
                  e.preventDefault();

                  setNotice('');

                  block.mutate({
                    courtId,
                    date,
                    start,
                    end,
                    reason: reason.trim(),
                  });
                }}
              >
                <label>
                  CANCHA

                  <select
                    required
                    value={courtId}
                    onChange={e =>
                      setCourtId(e.target.value)
                    }
                  >
                    <option value="">
                      Seleccionar cancha
                    </option>

                    {allCourts
                      .filter(c => c.active)
                      .map(c => (
                        <option
                          value={c.id}
                          key={c.id}
                        >
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  FECHA

                  <input
                    type="date"
                    required
                    min={offsetDate(0)}
                    value={date}
                    onChange={e =>
                      setDate(e.target.value)
                    }
                  />
                </label>

                <div className="admin-v2__form-pair">
                  <label>
                    DESDE

                    <input
                      type="time"
                      required
                      value={start}
                      onChange={e =>
                        setStart(e.target.value)
                      }
                    />
                  </label>

                  <label>
                    HASTA

                    <input
                      type="time"
                      required
                      value={end}
                      onChange={e =>
                        setEnd(e.target.value)
                      }
                    />
                  </label>
                </div>

                <label>
                  MOTIVO

                  <input
                    required
                    minLength={3}
                    maxLength={180}
                    value={reason}
                    onChange={e =>
                      setReason(e.target.value)
                    }
                  />
                </label>

                <p>
                  El bloqueo no puede superponerse
                  con una reserva confirmada ni
                  con otro bloqueo.
                </p>

                {block.isError && (
                  <div
                    className="inline-error"
                    role="alert"
                  >
                    {block.error.message}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-lime"
                  disabled={
                    block.isPending ||
                    !courtId
                  }
                >
                  {block.isPending
                    ? 'Guardando…'
                    : 'Bloquear horario'}

                  <LockKeyhole size={16} />
                </button>
              </form>
            </section>

            <section className="admin-v2__panel">
              <div className="admin-v2__section-head">
                <div>
                  <span>ESTADO / 005</span>
                  <h2>BLOQUEOS ACTIVOS.</h2>
                </div>

                <span>
                  {activeBlocks.length}
                </span>
              </div>

              <div className="admin-v2__blocks-list">
                {unblock.isError && (
                  <div
                    className="inline-error"
                    role="alert"
                  >
                    {unblock.error.message}
                  </div>
                )}

                {overview.isPending ? (
                  <p>Cargando bloqueos…</p>
                ) : activeBlocks.length === 0 ? (
                  <p>
                    No hay bloqueos activos.
                    Podés crear uno desde el formulario.
                  </p>
                ) : (
                  activeBlocks.map(b => (
                    <div
                      className="admin-v2__block"
                      key={b.id}
                    >
                      <div>
                        <strong>
                          {b.courtName}
                        </strong>

                        <span>
                          {displayDateTime(
                            b.startsAt,
                          )}{' '}
                          · {period(b)}
                        </span>

                        <small>
                          {b.reason}
                        </small>
                      </div>

                      <button
                        type="button"
                        aria-label={`Desbloquear ${b.courtName} el ${displayDateTime(b.startsAt)}`}
                        disabled={unblock.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Quitar el bloqueo de ${b.courtName}?`,
                            )
                          ) {
                            unblock.mutate(b.id);
                          }
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        <div className="admin-v2__footer">
          <ShieldCheck size={16} />

          {api.isDemo
            ? 'Demo local: sin datos reales ni cobros. Bloqueos y cancelaciones de prueba se conservan en este navegador.'
            : 'Las acciones se autorizan en el backend y quedan registradas en auditoría.'}
        </div>
      </div>

      {cancelTarget && (
        <div
          className="admin-v2__overlay"
          onMouseDown={e => {
            if (
              e.target === e.currentTarget &&
              !cancel.isPending
            ) {
              setCancelTarget(null);
            }
          }}
        >
          <section
            className="admin-v2__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-cancel-title"
          >
            <button
              type="button"
              ref={closeRef}
              className="admin-v2__dialog-close"
              disabled={cancel.isPending}
              aria-label="Cerrar"
              onClick={() =>
                setCancelTarget(null)
              }
            >
              <X size={19} />
            </button>

            <XCircle size={35} />

            <h2 id="admin-cancel-title">
              ¿CANCELAR RESERVA?
            </h2>

            <p>
              Se cancelará el turno de{' '}
              <strong>
                {cancelTarget.playerName}
              </strong>{' '}
              en{' '}
              <strong>
                {cancelTarget.courtName}
              </strong>{' '}
              el{' '}
              {displayDateTime(
                cancelTarget.startsAt,
              )}.
              Esta acción no se puede deshacer.
            </p>

            {cancel.isError && (
              <div
                className="inline-error"
                role="alert"
              >
                {cancel.error.message}
              </div>
            )}

            <div>
              <button
                type="button"
                className="admin-v2__cancel-confirm"
                disabled={cancel.isPending}
                onClick={() =>
                  cancel.mutate(
                    cancelTarget.id,
                  )
                }
              >
                {cancel.isPending
                  ? 'Cancelando…'
                  : 'Confirmar cancelación'}
              </button>

              <button
                type="button"
                className="admin-v2__cancel-back"
                disabled={cancel.isPending}
                onClick={() =>
                  setCancelTarget(null)
                }
              >
                Conservar reserva
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
