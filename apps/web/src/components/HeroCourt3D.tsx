import { lazy, Suspense } from 'react';
import { CourtArt } from './CourtArt';

import '../styles/hero-court-3d.css';

const HeroCourt3DScene = lazy(() =>
  import('./HeroCourt3DScene').then((module) => ({
    default: module.HeroCourt3D,
  })),
);

function HeroFallback() {
  return (
    <div
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

export function HeroCourt3D() {
  return (
    <Suspense fallback={<HeroFallback />}>
      <HeroCourt3DScene />
    </Suspense>
  );
}