
import { lazy, Suspense, useEffect } from 'react';
import {
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import {
  SiteHeader,
  SiteFooter,
} from './components/SiteHeader';

import { CourtCardAnimations } from './components/CourtCardAnimations';
import { HomePage } from './pages/HomePage';

const BookingPage = lazy(() =>
  import('./pages/BookingPage').then((module) => ({
    default: module.BookingPage,
  })),
);

const MyBookingsPage = lazy(() =>
  import('./pages/MyBookingsPage').then((module) => ({
    default: module.MyBookingsPage,
  })),
);

const AccessPage = lazy(() =>
  import('./pages/AccessPage').then((module) => ({
    default: module.AccessPage,
  })),
);

const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((module) => ({
    default: module.AdminPage,
  })),
);

const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({
    default: module.NotFoundPage,
  })),
);

function ScrollTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'instant',
    });
  }, [pathname]);

  return null;
}

function PageFallback() {
  return (
    <div
      className="container"
      role="status"
      aria-live="polite"
      style={{
        minHeight: '50vh',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <p>Cargando contenido...</p>
    </div>
  );
}

export function App() {
  return (
    <>
      <ScrollTop />

      <SiteHeader />

      <main id="main" tabIndex={-1}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route
              path="/"
              element={<HomePage />}
            />

            <Route
              path="/reservar"
              element={<BookingPage />}
            />

            <Route
              path="/mis-reservas"
              element={<MyBookingsPage />}
            />

            <Route
              path="/acceso"
              element={<AccessPage />}
            />

            <Route
              path="/admin"
              element={<AdminPage />}
            />

            <Route
              path="*"
              element={<NotFoundPage />}
            />
          </Routes>
        </Suspense>
      </main>

      <CourtCardAnimations />

      <SiteFooter />
    </>
  );
}
