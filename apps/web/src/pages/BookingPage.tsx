
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, CalendarPlus,
  Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  Info, LockKeyhole, MapPin, RefreshCw, ShieldCheck, Sparkles,
  Sun, Sunset, Moon, TicketCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { displayDate, money, offsetDate } from '../lib/format';
import { CourtArt } from '../components/CourtArt';
import type { Booking, CourtWithSlots, Slot } from '../lib/types';
import '../styles/booking-premium.css';

type TimePeriod = 'morning' | 'afternoon' | 'evening';
type Receipt = {
  booking: Booking;
  courtName: string;
  date: string;
  time: string;
  ends: string;
};

const PERIODS: { id: TimePeriod; label: string; detail: string; icon: typeof Sun }[] = [
  { id: 'morning', label: 'Mañana', detail: '08:00–12:00', icon: Sun },
  { id: 'afternoon', label: 'Tarde', detail: '12:00–18:00', icon: Sunset },
  { id: 'evening', label: 'Noche', detail: '18:00–23:00', icon: Moon },
];

function periodOf(time: string): TimePeriod {
  if (time < '12:00') return 'morning';
  if (time < '18:00') return 'afternoon';
  return 'evening';
}

function validDay(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value >= offsetDate(0) && value <= offsetDate(14);
}

function icsEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function downloadCalendar(receipt: Receipt) {
  const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const event = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RITMO PADEL//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${receipt.booking.id}@ritmo-padel`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(receipt.booking.startsAt)}`,
    `DTEND:${stamp(receipt.booking.endsAt)}`,
    `SUMMARY:${icsEscape(`Pádel · ${receipt.courtName}`)}`,
    `DESCRIPTION:${icsEscape(api.isDemo ? 'Reserva de demostración de RITMO PÁDEL. No es una reserva real.' : 'Reserva confirmada en RITMO PÁDEL.')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const url = URL.createObjectURL(new Blob([event], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `ritmo-padel-${receipt.date}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BookingPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const day = validDay(params.get('date')) ? params.get('date')! : offsetDate(0);
  const requestedCourt = params.get('court');
  const requestedTime = params.get('time');
  const allDays = useMemo(() => Array.from({ length: 15 }, (_, i) => offsetDate(i)), []);
  const initialIndex = Math.max(0, allDays.indexOf(day));
  const [weekStart, setWeekStart] = useState(Math.min(8, Math.floor(initialIndex / 4) * 4));
  const [period, setPeriod] = useState<TimePeriod>(periodOf(requestedTime ?? '15:00'));
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [formError, setFormError] = useState('');
  const submitting = useRef(false);

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: api.me });
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['availability', day],
    queryFn: () => api.availability(day),
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const courts = data?.courts ?? [];
  const selectedCourt = useMemo(
    () => courts.find((court) => court.id === requestedCourt) ?? courts[0],
    [courts, requestedCourt],
  );
  const selectedSlot = selectedCourt?.slots.find((slot) => slot.time === requestedTime && slot.available);
  const staleTime = Boolean(requestedTime && selectedCourt && !selectedSlot);
  const visibleDays = allDays.slice(weekStart, weekStart + 7);
  const availableCount = selectedCourt?.slots.filter((slot) => slot.available).length ?? 0;
  const filteredSlots = selectedCourt?.slots.filter((slot) => periodOf(slot.time) === period) ?? [];
  const periodCounts = useMemo(
    () => Object.fromEntries(PERIODS.map(({ id }) => [id, selectedCourt?.slots.filter((slot) => slot.available && periodOf(slot.time) === id).length ?? 0])) as Record<TimePeriod, number>,
    [selectedCourt],
  );

  function updateSelection(key: 'date' | 'court' | 'time', value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'date' || key === 'court') next.delete('time');
    setParams(next);
    setFormError('');
    setReceipt(null);
  }

  const mutation = useMutation({
    mutationFn: api.createBooking,
    onSuccess: async (result, variables) => {
      const court = courts.find((item) => item.id === variables.courtId);
      const slot = court?.slots.find((item) => item.time === variables.time);
      setReceipt({
        booking: result.booking,
        courtName: court?.name ?? 'Cancha de pádel',
        date: variables.date,
        time: variables.time,
        ends: slot?.ends ?? new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires', hour12: false }).format(new Date(result.booking.endsAt)),
      });
      setFormError('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['availability', variables.date] }),
        client.invalidateQueries({ queryKey: ['my-bookings'] }),
      ]);
    },
    onError: (failure: Error, variables) => {
      setFormError(failure.message);
      void client.invalidateQueries({ queryKey: ['availability', variables.date] });
    },
    onSettled: () => { submitting.current = false; },
  });

  function confirm() {
    if (!selectedCourt || !selectedSlot || submitting.current) return;
    if (!session?.user) {
      const next = `/reservar?date=${encodeURIComponent(day)}&court=${encodeURIComponent(selectedCourt.id)}&time=${encodeURIComponent(selectedSlot.time)}`;
      navigate(`/acceso?next=${encodeURIComponent(next)}`);
      return;
    }
    submitting.current = true;
    setFormError('');
    mutation.mutate({ courtId: selectedCourt.id, date: day, time: selectedSlot.time });
  }

  return (
    <div className="booking-page booking-premium page-bg">
      <div className="container booking-container">
        <header className="page-intro booking-premium__intro">
          <Link to="/" className="back-link"><ArrowLeft size={16} /> VOLVER AL CLUB</Link>
          <div className="eyebrow"><span className="eyebrow-line" /> RESERVAS / 001</div>
          <h1>ES TU TURNO<span>.</span></h1>
          <p>Elegí tu cancha, encontrá el momento ideal y asegurá tu próximo partido.</p>
          <div className="booking-premium__progress" aria-label="Proceso de reserva en tres pasos">
            <span><Check size={13} /> Elegí el día</span><span className="booking-premium__progress-line" />
            <span><Check size={13} /> Seleccioná la cancha</span><span className="booking-premium__progress-line" />
            <span><TicketCheck size={14} /> Confirmá el turno</span>
          </div>
        </header>

        {receipt ? (
          <section className="success-panel booking-receipt" aria-live="polite">
            <div className="booking-receipt__check"><CheckCircle2 size={35} /></div>
            <span className="booking-receipt__eyebrow">{api.isDemo ? 'RESERVA DE DEMOSTRACIÓN' : 'RESERVA CONFIRMADA'}</span>
            <h2>TODO LISTO<br /><span>PARA JUGAR.</span></h2>
            <p>Ya tenés tu próximo partido preparado.</p>
            <div className="booking-receipt__ticket">
              <div className="booking-receipt__ticket-head"><span>RITMO PÁDEL / MATCH PASS</span><Sparkles size={19} /></div>
              <strong>{receipt.courtName}</strong>
              <div className="booking-receipt__details">
                <div><span>FECHA</span><b>{displayDate(receipt.date)}</b></div>
                <div><span>HORARIO</span><b>{receipt.time}–{receipt.ends} hs</b></div>
                <div><span>DURACIÓN</span><b>90 minutos</b></div>
                <div><span>IMPORTE</span><b>{money(receipt.booking.priceCents)}</b></div>
              </div>
              <small>ID DE RESERVA: {receipt.booking.id}</small>
            </div>
            {api.isDemo && <p className="booking-receipt__demo">Modo demo: el turno es ficticio y se guarda solo en este navegador. No se realizó ningún cobro.</p>}
            <div className="booking-receipt__actions">
              <Link to="/mis-reservas" className="btn btn-lime">Mis reservas <ArrowUpRight size={18} /></Link>
              <button className="btn booking-receipt__calendar" type="button" onClick={() => downloadCalendar(receipt)}><CalendarPlus size={18} /> Agregar al calendario</button>
              <button className="booking-receipt__again" type="button" onClick={() => { setReceipt(null); updateSelection('time', ''); }}>Reservar otro turno <ArrowRight size={16} /></button>
            </div>
          </section>
        ) : (
          <div className="booking-layout">
            <div className="booking-main">
              {/* FECHA */}
              <section className="booking-step booking-premium__step">
                <div className="booking-step__header"><div><span>01 / EL DÍA</span><h2>¿CUÁNDO JUGAMOS?</h2></div><CalendarDays size={23} /></div>
                <div className="booking-premium__date-heading">
                  <div><strong>{displayDate(visibleDays[0] ?? day, { month: 'long', year: 'numeric' })}</strong><span>Disponibilidad para los próximos 15 días</span></div>
                  <div className="booking-premium__date-controls">
                    <button type="button" disabled={weekStart === 0} onClick={() => setWeekStart(Math.max(0, weekStart - 4))} aria-label="Fechas anteriores"><ChevronLeft size={19} /></button>
                    <button type="button" disabled={weekStart + 7 >= allDays.length} onClick={() => setWeekStart(Math.min(8, weekStart + 4))} aria-label="Fechas siguientes"><ChevronRight size={19} /></button>
                  </div>
                </div>
                <div className="booking-premium__date-strip" role="group" aria-label="Seleccionar fecha">
                  {visibleDays.map((date) => (
                    <button
                      type="button"
                      key={date}
                      aria-pressed={day === date}
                      aria-label={displayDate(date)}
                      className={`booking-premium__date ${day === date ? 'is-selected' : ''}`}
                      onClick={() => updateSelection('date', date)}
                    >
                      <span>{displayDate(date, { weekday: 'short' }).replace('.', '')}</span>
                      <strong>{Number(date.slice(-2))}</strong>
                      <small>{date === offsetDate(0) ? 'HOY' : displayDate(date, { month: 'short' }).replace('.', '')}</small>
                    </button>
                  ))}
                </div>
                <div className="booking-premium__date-footer"><span><span className="booking-premium__status-dot" /> Día seleccionado: {displayDate(day)}</span></div>
              </section>

              {/* CANCHAS */}
              <section className="booking-step booking-premium__step">
                <div className="booking-step__header"><div><span>02 / LA CANCHA</span><h2>ELEGÍ TU LUGAR.</h2></div><MapPin size={23} /></div>
                {isPending ? (
                  <div className="skeleton-grid">{[1, 2, 3, 4].map((index) => <div key={index} className="skeleton skeleton-court" />)}</div>
                ) : isError && !data ? (
                  <div className="inline-error" role="alert">{(error as Error).message}<button type="button" className="text-cta" onClick={() => void refetch()}><RefreshCw size={16} /> Reintentar</button></div>
                ) : (
                  <div className="booking-premium__courts">
                    {courts.map((court: CourtWithSlots, index) => {
                      const active = selectedCourt?.id === court.id;
                      const count = court.slots.filter((slot) => slot.available).length;
                      return (
                        <button
                          type="button"
                          key={court.id}
                          className={`booking-premium__court booking-premium__court--${court.accent} ${active ? 'is-selected' : ''}`}
                          aria-pressed={active}
                          onClick={() => updateSelection('court', court.id)}
                        >
                          <span className="booking-premium__court-image"><CourtArt variant="card" accent={court.accent} /></span>
                          <span className="booking-premium__court-text"><small>CANCHA 0{index + 1} · {court.location.split(' · ')[0]}</small><strong>{court.name}</strong><span>{court.surface}</span><em>{count} horarios disponibles</em></span>
                          <span className="booking-premium__court-check">{active ? <Check size={15} /> : <ArrowUpRight size={15} />}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {isFetching && !isPending && <p className="booking-premium__updating" role="status"><RefreshCw size={13} /> Actualizando disponibilidad…</p>}
              </section>

              {/* HORARIOS */}
              <section className="booking-step booking-premium__step">
                <div className="booking-step__header"><div><span>03 / EL HORARIO</span><h2>EL MOMENTO JUSTO.</h2></div><Clock3 size={23} /></div>
                <p className="booking-premium__hint"><Info size={16} /> Cada turno dura 90 minutos. Los precios pueden variar según el horario.</p>
                <div className="booking-premium__periods" role="group" aria-label="Filtrar horarios por momento del día">
                  {PERIODS.map(({ id, label, detail, icon: Icon }) => (
                    <button key={id} type="button" className={period === id ? 'is-selected' : ''} aria-pressed={period === id} onClick={() => setPeriod(id)}>
                      <Icon size={18} /><span><strong>{label}</strong><small>{detail}</small></span><em>{periodCounts[id]}</em>
                    </button>
                  ))}
                </div>
                <div className="booking-premium__availability"><strong>{availableCount} turnos disponibles</strong><span><i /> Disponible <i /> No disponible <i /> Seleccionado</span></div>
                {isPending ? (
                  <div className="booking-premium__slots">{Array.from({ length: 8 }, (_, index) => <div className="skeleton skeleton-slot" key={index} />)}</div>
                ) : isError && !data ? (
                  <div className="booking-premium__empty">No pudimos cargar los horarios. Usá «Reintentar» en la sección anterior.</div>
                ) : (
                  <div className="booking-premium__slots">
                    {filteredSlots.map((slot: Slot) => {
                      const active = selectedSlot?.time === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          aria-pressed={active}
                          aria-label={`${slot.time} a ${slot.ends}, ${slot.available ? money(slot.priceCents) : 'no disponible'}`}
                          className={`booking-premium__slot ${active ? 'is-selected' : ''}`}
                          onClick={() => updateSelection('time', slot.time)}
                        >
                          <span className="booking-premium__slot-time">{slot.time}<ArrowRight size={12} />{slot.ends}</span>
                          <small>{slot.available ? money(slot.priceCents) : 'No disponible'}</small>
                          {active && <CheckCircle2 size={16} className="booking-premium__slot-check" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!isPending && filteredSlots.length === 0 && <div className="booking-premium__empty">No hay horarios en esta franja. Probá con otro momento del día.</div>}
                {staleTime && <p role="alert" className="booking-premium__notice">El horario seleccionado ya no está disponible. Elegí otro turno.</p>}
                <div className="booking-premium__times-footer"><ShieldCheck size={16} /> La disponibilidad se vuelve a verificar al confirmar.</div>
              </section>
            </div>

            {/* RESUMEN */}
            <aside className="booking-aside">
              <div className="summary-card booking-premium__summary">
                <div className="summary-card__top"><span>YOUR MATCH / 001</span><div className="summary-icon">✳</div></div>
                <h2>TU PRÓXIMO<br />PARTIDO.</h2>
                <div className="booking-premium__summary-banner"><Sparkles size={17} /><span>{selectedCourt?.subtitle ?? 'Elegí tu cancha'}</span><span className="booking-premium__summary-pill">90 MIN</span></div>
                <div className="summary-rows">
                  <div><span>CANCHA</span><strong>{selectedCourt?.name ?? 'Por elegir'}</strong></div>
                  <div><span>FECHA</span><strong>{displayDate(day, { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
                  <div><span>HORARIO</span><strong key={selectedSlot?.time ?? 'empty'} className="booking-premium__changing">{selectedSlot ? `${selectedSlot.time}–${selectedSlot.ends} hs` : 'Elegí un horario'}</strong></div>
                  <div><span>DURACIÓN</span><strong>90 minutos</strong></div>
                </div>
                <div className="summary-total"><span>TOTAL ESTIMADO</span><strong key={selectedSlot?.priceCents ?? 'none'} className="booking-premium__changing">{selectedSlot ? money(selectedSlot.priceCents) : '—'}</strong></div>
                <button className="btn btn-lime btn-summary booking-premium__confirm" type="button" disabled={!selectedSlot || mutation.isPending} onClick={confirm}>
                  {mutation.isPending ? 'Confirmando reserva…' : session?.user ? 'Confirmar reserva' : 'Continuar para reservar'}
                  <ArrowRight size={19} />
                </button>
                {formError && <div className="inline-error booking-premium__form-error" role="alert">{formError}</div>}
                <div className="summary-trust"><ShieldCheck size={16} /><span>Disponibilidad validada antes de confirmar</span></div>
                <div className="summary-trust"><LockKeyhole size={16} /><span>No solicitamos datos de tarjetas</span></div>
                {api.isDemo && <div className="summary-demo">MODO DEMO · Reservas ficticias guardadas en este navegador. No se realiza ningún cobro.</div>}
              </div>
              <div className="aside-note"><span>✳</span><p>El mejor plan empieza con un mensaje: <strong>«¿A qué hora jugamos?»</strong></p></div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
