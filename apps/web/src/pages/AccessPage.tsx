
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { api } from '../lib/api';
import { CourtArt } from '../components/CourtArt';
import '../styles/access-redesign.css';

export function AccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [signup, setSignup] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const next = params.get('next');
  const safeNext =
    next?.startsWith('/') && !next.startsWith('//')
      ? next
      : '/mis-reservas';

  const done = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['session'],
    });

    navigate(safeNext, { replace: true });
  };

  const mutation = useMutation({
    mutationFn: () =>
      signup
        ? api.register(fullName, email, password)
        : api.login(email, password),

    onSuccess: () => void done(),

    onError: (error: Error) => {
      setMessage(error.message);
    },
  });

  const enter = useMutation({
    mutationFn: api.demoEnter,
    onSuccess: () => void done(),
    onError: (error: Error) => {
      setMessage(error.message);
    },
  });

  const isBusy = mutation.isPending || enter.isPending;

  const toggleMode = () => {
    if (isBusy) return;

    setSignup((current) => !current);
    setMessage('');
    setShowPassword(false);
    setPassword('');
  };

  return (
    <div className="access-v2">
      <section
        className="access-v2__visual"
        aria-label="Bienvenido a RITMO PÁDEL"
      >
        <div className="access-v2__visual-glow" aria-hidden="true" />

        <Link to="/" className="access-v2__back">
          <ArrowLeft size={17} />
          <span>VOLVER AL CLUB</span>
        </Link>

        <div className="access-v2__story">
          <div className="access-v2__eyebrow">
            <span className="access-v2__eyebrow-line" />
            RITMO PÁDEL CLUB
          </div>

          <h2>
            EL JUEGO
            <span>TE ESPERA.</span>
          </h2>

          <p>
            Tu próxima cancha, tu próximo partido,
            tu mejor versión. Todo empieza acá.
          </p>
        </div>

        <div className="access-v2__court-stage">
          <div className="access-v2__stage-top">
            <span>
              <span className="access-v2__live-dot" />
              ALL IN. ALL GAME.
            </span>
            <span>01 — 04</span>
          </div>

          <div className="access-v2__court-art">
            <CourtArt variant="hero" />
          </div>

          <div className="access-v2__stage-bottom">
            <span>EL CLUB ES TUYO</span>
            <span>RITMO / 2026</span>
          </div>
        </div>

        <div className="access-v2__visual-footer">
          <span>NO ES SOLO PÁDEL. ES RITMO.</span>
          <span>ROSARIO, ARGENTINA</span>
        </div>
      </section>

      <section
        className="access-v2__content"
        aria-labelledby="access-title"
      >
        <div className="access-v2__card">
          <div className="access-v2__card-top">
            <span className="access-v2__card-label">
              <Sparkles size={15} />
              TU ESPACIO EN RITMO
            </span>

            <span className="access-v2__member-tag">
              MEMBERS
            </span>
          </div>

          <div className="access-v2__heading">
            <h1 id="access-title">
              {signup ? (
                <>
                  SUMATE
                  <span>AL CLUB.</span>
                </>
              ) : (
                <>
                  VOLVÉ
                  <span>AL JUEGO.</span>
                </>
              )}
            </h1>

            <p>
              {signup
                ? 'Creá tu cuenta y empezá a disfrutar de tu próximo partido.'
                : 'Qué bueno tenerte de vuelta. Ingresá para reservar y gestionar tus partidos.'}
            </p>
          </div>

          <form
            className="access-v2__form"
            onSubmit={(event) => {
              event.preventDefault();

              if (isBusy) return;

              setMessage('');
              mutation.mutate();
            }}
          >
            {signup && (
              <div className="access-v2__field">
                <label htmlFor="access-name">
                  Nombre completo
                </label>

                <div className="access-v2__input-wrap">
                  <UserRound
                    size={18}
                    className="access-v2__input-icon"
                    aria-hidden="true"
                  />

                  <input
                    id="access-name"
                    name="name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Tu nombre completo"
                    value={fullName}
                    onChange={(event) =>
                      setFullName(event.target.value)
                    }
                  />
                </div>
              </div>
            )}

            <div className="access-v2__field">
              <label htmlFor="access-email">
                Correo electrónico
              </label>

              <div className="access-v2__input-wrap">
                <Mail
                  size={18}
                  className="access-v2__input-icon"
                  aria-hidden="true"
                />

                <input
                  id="access-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="vos@ejemplo.com"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="access-v2__field">
              <label htmlFor="access-password">
                Contraseña
              </label>

              <div className="access-v2__input-wrap">
                <LockKeyhole
                  size={18}
                  className="access-v2__input-icon"
                  aria-hidden="true"
                />

                <input
                  id="access-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete={
                    signup
                      ? 'new-password'
                      : 'current-password'
                  }
                  placeholder={
                    signup
                      ? 'Mínimo 8 caracteres'
                      : 'Ingresá tu contraseña'
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                />

                <button
                  type="button"
                  className="access-v2__password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {message && (
              <div
                className="access-v2__error"
                role="alert"
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              className="access-v2__submit"
              disabled={isBusy}
            >
              <span>
                {mutation.isPending
                  ? 'Procesando...'
                  : signup
                    ? 'Crear mi cuenta'
                    : 'Ingresar a mi cuenta'}
              </span>

              <span className="access-v2__submit-icon">
                <ArrowRight size={19} />
              </span>
            </button>
          </form>

          <div className="access-v2__switch">
            <span>
              {signup
                ? '¿Ya tenés una cuenta?'
                : '¿Todavía no sos parte?'}
            </span>

            <button type="button" onClick={toggleMode}>
              {signup
                ? 'Iniciá sesión'
                : 'Registrate gratis'}
              <ArrowUpRight size={15} />
            </button>
          </div>

          {api.isDemo && (
            <div className="access-v2__demo">
              <div className="access-v2__demo-heading">
                <span>EXPLORÁ LA DEMO</span>
                <span>ACCESO RÁPIDO</span>
              </div>

              <div className="access-v2__demo-actions">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => enter.mutate('player')}
                >
                  Entrar como jugador
                  <ArrowUpRight size={16} />
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => enter.mutate('admin')}
                >
                  Panel administrador
                  <ArrowUpRight size={16} />
                </button>
              </div>

              <p>
                Acceso de demostración. No crea cuentas reales.
              </p>
            </div>
          )}

          <div className="access-v2__security">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              Tu sesión está protegida. En modo real
              utilizamos cookies seguras, sin almacenar
              tokens en localStorage.
            </span>
          </div>
        </div>

        <p className="access-v2__bottom-note">
          RITMO PÁDEL CLUB <span>✳</span> HECHO PARA JUGAR
        </p>
      </section>
    </div>
  );
}
