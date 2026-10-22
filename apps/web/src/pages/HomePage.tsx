import { useEffect, useRef } from 'react';
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from 'react';

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Layers,
  MapPin,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

import { CourtArt } from '../components/CourtArt';
import { HeroCourt3D } from '../components/HeroCourt3D';
import { api } from '../lib/api';
import { money } from '../lib/format';

import '../styles/home-motion.css';

const features = [
  {
    title: '4 CANCHAS',
    description:
      'Indoor y outdoor. Todas listas para tu próximo desafío.',
    icon: <Layers size={22} aria-hidden="true" />,
  },
  {
    title: '15 HS DE JUEGO',
    description:
      'De 08 a 23 hs. Vos elegís el momento.',
    icon: <Clock3 size={22} aria-hidden="true" />,
  },
  {
    title: 'RESERVA ÁGIL',
    description:
      'Sin mensajes, sin vueltas. Tu cancha en pocos clics.',
    icon: <Zap size={22} aria-hidden="true" />,
  },
  {
    title: 'CUPO REAL',
    description:
      'La disponibilidad se valida antes de confirmar.',
    icon: <ShieldCheck size={22} aria-hidden="true" />,
  },
];

const steps = [
  {
    number: '01',
    title: 'ELEGÍ TU CANCHA',
    description:
      'Compará las cuatro canchas y quedate con tu favorita.',
    icon: <Layers aria-hidden="true" />,
  },
  {
    number: '02',
    title: 'ENCONTRÁ TU HORARIO',
    description:
      'Mirá los turnos disponibles y elegí cuándo jugar.',
    icon: <Clock3 aria-hidden="true" />,
  },
  {
    number: '03',
    title: 'CONFIRMÁ Y LISTO',
    description:
      'Guardá tu reserva desde tu cuenta. El partido te espera.',
    icon: <Sparkles aria-hidden="true" />,
  },
];

/*
 * Activa entradas suaves al aparecer en pantalla.
 * El contenido permanece visible si la animación
 * está desactivada.
 */
function useHomeReveal() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;

    if (!root || !('IntersectionObserver' in window)) {
      return;
    }

    if (
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
    ) {
      return;
    }

    const elements =
      root.querySelectorAll<HTMLElement>('[data-reveal]');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -24px 0px',
      },
    );

    root.classList.add('motion-ready');

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      root.classList.remove('motion-ready');

      elements.forEach((element) => {
        element.classList.remove('is-visible');
      });
    };
  }, []);

  return rootRef;
}

/*
 * Movimiento muy leve del contenedor principal.
 * La iluminación real 3D se controla dentro
 * del componente HeroCourt3D.
 */
function handleStagePointerMove(
  event: ReactPointerEvent<HTMLDivElement>,
) {
  if (event.pointerType !== 'mouse') return;

  if (
    window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
  ) {
    return;
  }

  const rect =
    event.currentTarget.getBoundingClientRect();

  const x =
    (event.clientX - rect.left) / rect.width;

  const y =
    (event.clientY - rect.top) / rect.height;

  const stage = event.currentTarget;

  stage.style.setProperty(
    '--pointer-x',
    `${(x * 100).toFixed(1)}%`,
  );

  stage.style.setProperty(
    '--pointer-y',
    `${(y * 100).toFixed(1)}%`,
  );

  stage.style.setProperty(
    '--tilt-x',
    `${((0.5 - y) * 3).toFixed(2)}deg`,
  );

  stage.style.setProperty(
    '--tilt-y',
    `${((x - 0.5) * 3).toFixed(2)}deg`,
  );
}

function handleStagePointerLeave(
  event: ReactPointerEvent<HTMLDivElement>,
) {
  const stage = event.currentTarget;

  stage.style.removeProperty('--pointer-x');
  stage.style.removeProperty('--pointer-y');
  stage.style.removeProperty('--tilt-x');
  stage.style.removeProperty('--tilt-y');
}

export function HomePage() {
  const homeRef = useHomeReveal();

  const {
    data,
    isError: cannotLoadCourts,
  } = useQuery({
    queryKey: ['courts'],
    queryFn: api.courts,
  });

  return (
    <div className="home-page" ref={homeRef}>
      {/* HERO */}
      <section className="hero home-hero">
        <div
          className="hero-grid"
          aria-hidden="true"
        />

        <div
          className="hero-orbit hero-orbit--1"
          aria-hidden="true"
        />

        <div
          className="hero-orbit hero-orbit--2"
          aria-hidden="true"
        />

        <div
          className="home-hero__beam"
          aria-hidden="true"
        />

        <div className="container hero-inner">
          <div className="hero-copy">
            <div className="eyebrow eyebrow--hero home-hero__eyebrow">
              <span className="eyebrow-line" />
              THE GAME STARTS HERE
              <span className="eyebrow-num">
                / 001
              </span>
            </div>

            <h1>
              <span className="hero-title-line hero-title-line--one">
                EL JUEGO
              </span>

              <span className="hero-title-line hero-title-line--two">
                SE VIVE
              </span>

              <span className="hero-title-line hero-title-line--accent">
                EN SERIO
                <span className="hero-period">.</span>
              </span>
            </h1>

            <p className="hero-lead home-hero__lead">
              Hay partidos que se juegan. Y otros que se recuerdan.
              Encontrá tu cancha, elegí tu horario y que ruede la
              pelota.
            </p>

            <div className="hero-buttons home-hero__actions">
              <Link
                to="/reservar"
                className="btn btn-lime btn-xl home-motion-btn"
              >
                <span>Reservá tu cancha</span>
                <ArrowUpRight
                  size={21}
                  aria-hidden="true"
                />
              </Link>

              <a
                href="#club"
                className="btn btn-outline btn-xl home-motion-btn"
              >
                <span>Conocé el club</span>
                <ArrowDown
                  size={19}
                  aria-hidden="true"
                />
              </a>
            </div>

            <div className="hero-proof home-hero__proof">
              <span className="proof-pulse" />
              <span>CANCHAS DISPONIBLES TODOS LOS DÍAS</span>
              <span className="hero-proof__divider" />
              <span>08:00 — 23:00 HS</span>
            </div>
          </div>

          {/* ESCENARIO 3D */}
          <div
            className="hero-stage home-hero__stage"
            onPointerMove={handleStagePointerMove}
            onPointerLeave={handleStagePointerLeave}
          >
            <div
              className="hero-stage__glow"
              aria-hidden="true"
            />

            <div
              className="home-hero__spotlight"
              aria-hidden="true"
            />

            <div
              className="home-hero__scanner"
              aria-hidden="true"
            />

            <div
              className="home-hero__corner home-hero__corner--tl"
              aria-hidden="true"
            />

            <div
              className="home-hero__corner home-hero__corner--br"
              aria-hidden="true"
            />

            <div className="stage-top">
              <span className="stage-icon">✳</span>
              READY TO PLAY
              <span className="stage-number">
                34° 55' S
              </span>
            </div>

            {/* Nueva cancha 3D */}
            <HeroCourt3D />

            <div className="stage-bottom">
              <div>
                <span className="stage-label">
                  PLAY BETTER
                </span>
                <strong>SE JUEGA EN RITMO.</strong>
              </div>

              <div className="stage-rotation">
                R <span>✳</span>
              </div>
            </div>

            <div className="stage-float">
              SIN EXCUSAS
              <br />
              <strong>JUST PADEL.</strong>
            </div>
          </div>
        </div>

        <div className="hero-bottom">
          <div className="container hero-bottom-inner">
            <span>01 / 04 — EL CLUB</span>
            <span>DONDE EL PÁDEL ENCUENTRA SU RITMO</span>

            <a
              href="#club"
              aria-label="Explorar el club"
            >
              <ArrowDown
                size={20}
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      </section>

      {/* CINTA */}
      <div className="ticker" aria-hidden="true">
        <div>
          GAME ON <span>✳</span> NO MORE EXCUSES{' '}
          <span>✳</span> PLAY HARD <span>✳</span> REPEAT{' '}
          <span>✳</span> GAME ON <span>✳</span> NO MORE
          EXCUSES <span>✳</span> PLAY HARD <span>✳</span>
          REPEAT <span>✳</span>
        </div>
      </div>

      {/* EL CLUB */}
      <section
        className="section section-light"
        id="club"
      >
        <div className="container">
          <div
            className="section-kicker"
            data-reveal
          >
            <span className="kicker-num">
              01 — EL CLUB
            </span>
            <span>ROSARIO · ARGENTINA</span>
          </div>

          <div className="section-title-row">
            <h2 data-reveal>
              NO ES SOLO
              <br />
              <em>OTRO PARTIDO.</em>
            </h2>

            <div
              className="section-side"
              data-reveal
            >
              <p>
                Cuatro canchas que piden juego, una
                comunidad que no sabe frenar y una
                sola regla: disfrutar cada punto.
              </p>

              <Link
                to="/reservar"
                className="text-cta home-text-cta"
              >
                Encontrá tu cancha
                <ArrowUpRight
                  size={19}
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>

          <div className="feature-strip home-feature-strip">
            {features.map((feature, index) => (
              <div
                className="home-feature"
                data-reveal
                key={feature.title}
                style={
                  {
                    '--reveal-delay': `${index * 70}ms`,
                  } as CSSProperties
                }
              >
                <div className="feature-icon">
                  {feature.icon}
                </div>

                <h3>{feature.title}</h3>
                <p>{feature.description}</p>

                <span
                  className="home-feature__index"
                  aria-hidden="true"
                >
                  0{index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LAS CANCHAS */}
      <section
        className="section section-courts"
        id="canchas"
      >
        <div className="container">
          <div
            className="section-kicker section-kicker--dark"
            data-reveal
          >
            <span className="kicker-num">
              02 — LAS CANCHAS
            </span>
            <span>THE COURT IS CALLING</span>
          </div>

          <div className="courts-head">
            <h2 data-reveal>
              ENCONTRÁ
              <br />
              <em>TU TERRENO.</em>
            </h2>

            <p data-reveal>
              Cuatro escenarios. Una sola pasión.
              Elegí dónde vas a dejarlo todo.
            </p>
          </div>

          {cannotLoadCourts && (
            <div
              className="inline-error"
              role="alert"
            >
              No pudimos cargar las canchas.
              Revisá tu conexión y volvé a intentarlo.
            </div>
          )}

          <div className="home-court-grid">
            {(data?.courts ?? []).map(
              (court, index) => (
                <Link
                  key={court.id}
                  className={`home-court home-court--${court.accent}`}
                  to={`/reservar?court=${court.id}`}
                >
                  <div className="home-court__top">
                    <span>
                      0{index + 1} /{' '}
                      {court.location.split(' · ')[0]}
                    </span>

                    <ArrowUpRight
                      size={21}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="home-court__art">
                    <CourtArt
                      variant="card"
                      accent={court.accent}
                    />
                  </div>

                  <div className="home-court__body">
                    <span>{court.surface}</span>
                    <h3>{court.name}</h3>

                    <div>
                      <span>
                        DESDE{' '}
                        {money(court.basePriceCents)}
                        {' '}/ 90 MIN
                      </span>

                      <span className="home-court__arrow">
                        <ArrowRight
                          size={18}
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              ),
            )}
          </div>

          <div
            className="courts-bottom"
            data-reveal
          >
            <span>
              04 CANCHAS · EXPERIENCIAS ÚNICAS
            </span>

            <Link
              to="/reservar"
              className="text-cta text-cta--light home-text-cta"
            >
              Ver disponibilidad
              <ArrowUpRight
                size={19}
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </section>

      {/* CÓMO RESERVAR */}
      <section className="section section-how">
        <div className="container">
          <div
            className="section-kicker"
            data-reveal
          >
            <span className="kicker-num">
              03 — ES ASÍ DE FÁCIL
            </span>
            <span>MENOS CLICS. MÁS PARTIDOS.</span>
          </div>

          <div className="how-grid">
            <div
              className="how-intro"
              data-reveal
            >
              <h2>
                TRES PASOS.
                <br />
                <em>Y A JUGAR.</em>
              </h2>

              <p>
                Tu próximo partido no tiene
                por qué empezar en un grupo
                de WhatsApp.
              </p>

              <Link
                className="btn btn-dark home-motion-btn"
                to="/reservar"
              >
                <span>Reservar ahora</span>
                <ArrowUpRight
                  size={18}
                  aria-hidden="true"
                />
              </Link>
            </div>

            <div className="steps home-steps">
              {steps.map((step, index) => (
                <div
                  className="step home-step"
                  key={step.number}
                  data-reveal
                  style={
                    {
                      '--reveal-delay': `${index * 85}ms`,
                    } as CSSProperties
                  }
                >
                  <span className="step-n">
                    {step.number}
                  </span>

                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>

                  <span className="step-icon">
                    {step.icon}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="final-cta home-final-cta">
        <div className="container final-cta-inner">
          <div
            className="final-cta__symbol"
            aria-hidden="true"
          >
            ✳
          </div>

          <p data-reveal>TE TOCA A VOS</p>

          <h2 data-reveal>
            EL PRÓXIMO
            <br />
            <span>PUNTO ES TUYO.</span>
          </h2>

          <div data-reveal>
            <Link
              to="/reservar"
              className="btn btn-black btn-xl home-motion-btn"
            >
              <span>Elegir cancha</span>
              <ArrowUpRight
                size={21}
                aria-hidden="true"
              />
            </Link>
          </div>

          <span
            className="final-cta__meta"
            data-reveal
          >
            <MapPin
              size={14}
              aria-hidden="true"
            />
            UN CLUB. INFINITAS GANAS DE JUGAR.
          </span>
        </div>
      </section>
    </div>
  );
}