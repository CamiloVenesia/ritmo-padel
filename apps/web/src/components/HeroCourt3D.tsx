
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { ReactNode, Ref } from 'react';

import { CourtArt } from './CourtArt';

import '../styles/hero-court-3d.css';

// El código pesado de Three.js se descarga únicamente
// cuando se necesita mostrar la escena.
const HeroCourt3DScene = lazy(() =>
  import('./HeroCourt3DScene').then((module) => ({
    default: module.HeroCourt3D,
  })),
);

type HeroFallbackProps = {
  anchorRef?: Ref<HTMLDivElement>;
};

function HeroFallback({
  anchorRef,
}: HeroFallbackProps) {
  return (
    <div
      ref={anchorRef}
      className="hero-3d"
      role="img"
      aria-label="Cancha de pádel de RITMO PÁDEL"
    >
      <div
        className="hero-3d__fallback"
        aria-hidden="true"
      >
        <CourtArt variant="hero" />
      </div>
    </div>
  );
}

// Un error al descargar la escena no debe provocar
// que desaparezca toda la página principal.
class SceneLoadBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(
      '[RITMO 3D] No se pudo cargar la escena:',
      error,
    );
  }

  render() {
    if (this.state.failed) {
      return <HeroFallback />;
    }

    return this.props.children;
  }
}

export function HeroCourt3D() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;

    if (!anchor) {
      return;
    }

    let scheduled = false;
    let idleId: number | undefined;
    let timerId: number | undefined;

    const scheduleScene = () => {
      if (scheduled) {
        return;
      }

      scheduled = true;

      // Primero permitimos que el navegador
      // pinte el contenido principal.
      if (
        typeof window.requestIdleCallback === 'function'
      ) {
        idleId = window.requestIdleCallback(
          () => {
            setShouldLoad(true);
          },
          {
            timeout: 800,
          },
        );
      } else {
        // Compatibilidad con navegadores que
        // todavía no implementan requestIdleCallback.
        timerId = window.setTimeout(() => {
          setShouldLoad(true);
        }, 150);
      }
    };

    // Si IntersectionObserver no está disponible,
    // cargamos la escena igualmente.
    if (
      typeof IntersectionObserver === 'undefined'
    ) {
      scheduleScene();

      return () => {
        if (idleId !== undefined) {
          window.cancelIdleCallback(idleId);
        }

        if (timerId !== undefined) {
          window.clearTimeout(timerId);
        }
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some(
          (entry) => entry.isIntersecting,
        );

        if (visible) {
          scheduleScene();
          observer.disconnect();
        }
      },
      {
        // Inicia la preparación antes de que
        // la escena entre completamente en pantalla.
        rootMargin: '240px 0px',
        threshold: 0,
      },
    );

    observer.observe(anchor);

    return () => {
      observer.disconnect();

      if (idleId !== undefined) {
        window.cancelIdleCallback(idleId);
      }

      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  if (!shouldLoad) {
    return <HeroFallback anchorRef={anchorRef} />;
  }

  return (
    <SceneLoadBoundary>
      <Suspense fallback={<HeroFallback />}>
        <HeroCourt3DScene />
      </Suspense>
    </SceneLoadBoundary>
  );
}
