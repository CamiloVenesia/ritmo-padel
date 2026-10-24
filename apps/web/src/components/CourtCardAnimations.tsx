
import { useLayoutEffect } from 'react';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DURATION = 2400;

let revealId = 0;

type Motion = {
  card: HTMLElement;
  svg: SVGSVGElement;
  progress: number;
  target: 0 | 1;
  frame: number | null;
  lastTime: number;
  pulseTime: number;
  isPulse: boolean;
  lights: SVGElement[];
  bulbs: SVGElement[];
  outline: SVGElement | null;
  halo: SVGElement | null;
  strip: SVGElement | null;
  turf: SVGElement | null;
  reveal: SVGClipPathElement | null;
  revealRect: SVGRectElement | null;
  blades: SVGElement[];
  leftGlass: SVGElement | null;
  rightGlass: SVGElement | null;
  skyEdge: SVGElement | null;
  rings: SVGElement[];
  center: SVGElement | null;
};

const clamp = (value: number) =>
  Math.max(0, Math.min(1, value));

function smooth(value: number) {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
}

function portion(
  progress: number,
  from: number,
  to: number,
) {
  return smooth((progress - from) / (to - from));
}

function opacity(
  element: SVGElement | null | undefined,
  value: number,
) {
  if (element) {
    element.style.opacity = String(value);
  }
}

function paint(motion: Motion) {
  const p = motion.progress;

  // ARENA: reflectores que se encienden por etapas.
  if (motion.lights.length > 0) {
    opacity(
      motion.lights[0],
      0.9 * portion(p, 0, 0.68),
    );

    opacity(
      motion.lights[1],
      0.9 * portion(p, 0.18, 0.86),
    );

    opacity(
      motion.bulbs[0],
      0.7 * portion(p, 0, 0.68),
    );

    opacity(
      motion.bulbs[1],
      0.7 * portion(p, 0.18, 0.86),
    );

    opacity(
      motion.outline,
      0.18 + 0.72 * portion(p, 0.42, 1),
    );

    opacity(
      motion.halo,
      0.04 + 0.45 * portion(p, 0.3, 1),
    );

    opacity(
      motion.strip,
      0.38 + 0.62 * portion(p, 0.2, 0.95),
    );
  }

  // TERRA: la superficie verde avanza gradualmente.
  if (motion.revealRect) {
    const revealed = portion(p, 0.02, 0.92);

    motion.revealRect.setAttribute(
      'width',
      String(700 * revealed),
    );

    opacity(motion.turf, 0.27);

    // Las hojas brotan por columnas y filas.
    motion.blades.forEach((blade, index) => {
      const column = index % 10;
      const row = Math.floor(index / 10);

      const from =
        0.08 + column * 0.055 + row * 0.023;

      const grow = portion(
        p,
        from,
        Math.min(1, from + 0.35),
      );

      opacity(blade, grow * 0.93);

      blade.style.transform =
        `scaleY(${(0.03 + 0.97 * grow).toFixed(4)})`;
    });
  }

  // SKY: elevación independiente de ambos cristales.
  if (motion.leftGlass || motion.rightGlass) {
    const left = portion(p, 0, 0.72);
    const right = portion(p, 0.2, 0.95);

    opacity(motion.leftGlass, 0.88 * left);
    opacity(motion.rightGlass, 0.88 * right);

    if (motion.leftGlass) {
      motion.leftGlass.style.transform =
        `translateY(${(72 * (1 - left)).toFixed(2)}px)`;
    }

    if (motion.rightGlass) {
      motion.rightGlass.style.transform =
        `translateY(${(72 * (1 - right)).toFixed(2)}px)`;
    }

    opacity(
      motion.skyEdge,
      0.08 + 0.92 * portion(p, 0.52, 1),
    );
  }

  // PULSE: ondas continuas mientras la tarjeta está activa.
  if (motion.isPulse) {
    const strength = portion(p, 0, 0.3);

    motion.rings.forEach((ring, index) => {
      const phase =
        ((motion.pulseTime / 1950 - index / 3) % 1 + 1) % 1;

      const fade =
        Math.sin(Math.PI * phase) ** 1.5;

      opacity(ring, 0.75 * fade * strength);

      ring.style.transform =
        `scale(${(0.67 + phase * 0.72).toFixed(4)})`;
    });

    opacity(
      motion.center,
      strength *
        (0.42 + 0.26 * Math.sin(motion.pulseTime / 250)),
    );
  }
}

function createMotion(
  card: HTMLElement,
): Motion | null {
  const svg = card.querySelector<SVGSVGElement>(
    'svg.court-art--card',
  );

  if (!svg) return null;

  const select = (selector: string) =>
    svg.querySelector<SVGElement>(selector);

  const turf = select('.court-art__turf-bloom');

  let reveal: SVGClipPathElement | null = null;
  let revealRect: SVGRectElement | null = null;

  // Máscara SVG real para revelar el terreno de TERRA.
  if (turf) {
    const defs = svg.querySelector('defs');

    if (defs) {
      reveal = document.createElementNS(
        SVG_NS,
        'clipPath',
      );

      revealRect = document.createElementNS(
        SVG_NS,
        'rect',
      );

      const id =
        `ritmo-court-growth-${++revealId}`;

      reveal.setAttribute('id', id);

      reveal.setAttribute(
        'clipPathUnits',
        'userSpaceOnUse',
      );

      revealRect.setAttribute('x', '0');
      revealRect.setAttribute('y', '0');
      revealRect.setAttribute('width', '0');
      revealRect.setAttribute('height', '535');

      reveal.appendChild(revealRect);
      defs.appendChild(reveal);

      turf.style.clipPath = `url(#${id})`;
    }
  }

  const blades = Array.from(
    svg.querySelectorAll<SVGElement>(
      '.court-art__grass-blade',
    ),
  );

  for (const blade of blades) {
    blade.style.transformBox = 'fill-box';
    blade.style.transformOrigin = 'center bottom';
  }

  const rings = Array.from(
    svg.querySelectorAll<SVGElement>(
      '.court-art__pulse',
    ),
  );

  for (const ring of rings) {
    ring.style.transformBox = 'fill-box';
    ring.style.transformOrigin = 'center';
  }

  const motion: Motion = {
    card,
    svg,
    progress: 0,
    target: 0,
    frame: null,
    lastTime: 0,
    pulseTime: 0,

    isPulse: card.classList.contains(
      'home-court--teal',
    ),

    lights: Array.from(
      svg.querySelectorAll<SVGElement>(
        '.court-art__arena-light > path:not(.court-art__arena-outline)',
      ),
    ),

    bulbs: Array.from(
      svg.querySelectorAll<SVGElement>(
        '.court-art__lamp-bulbs > circle',
      ),
    ),

    outline: select('.court-art__arena-outline'),
    halo: select('.court-art__lamp-halo'),
    strip: select('.court-art__lamp-strip'),

    turf,
    reveal,
    revealRect,
    blades,

    leftGlass: select(
      '.court-art__sky-panel--left',
    ),

    rightGlass: select(
      '.court-art__sky-panel--right',
    ),

    skyEdge: select('.court-art__sky-edge'),

    rings,
    center: select('.court-art__pulse-center'),
  };

  // Aplicamos el estado apagado inmediatamente.
  paint(motion);

  return motion;
}

function animate(motion: Motion) {
  if (motion.frame !== null) return;

  motion.lastTime = 0;

  const tick = (now: number) => {
    const delta = motion.lastTime
      ? Math.min(64, now - motion.lastTime)
      : 0;

    motion.lastTime = now;

    const direction =
      motion.target === 1 ? 1 : -1;

    motion.progress = clamp(
      motion.progress +
        (delta / DURATION) * direction,
    );

    if (motion.target === 1 && motion.isPulse) {
      motion.pulseTime += delta;
    }

    paint(motion);

    const needsFrame =
      motion.progress !== motion.target ||
      (motion.target === 1 && motion.isPulse);

    if (needsFrame) {
      motion.frame = requestAnimationFrame(tick);
    } else {
      motion.frame = null;
      motion.lastTime = 0;
    }
  };

  motion.frame = requestAnimationFrame(tick);
}

function clean(motion: Motion) {
  if (motion.frame !== null) {
    cancelAnimationFrame(motion.frame);
  }

  motion.reveal?.remove();

  motion.svg
    .querySelectorAll<SVGElement>(
      '.court-art__arena-light > path, ' +
      '.court-art__lamp-bulbs > circle, ' +
      '.court-art__arena-outline, ' +
      '.court-art__lamp-halo, ' +
      '.court-art__lamp-strip, ' +
      '.court-art__turf-bloom, ' +
      '.court-art__grass-blade, ' +
      '.court-art__sky-panel, ' +
      '.court-art__sky-edge, ' +
      '.court-art__pulse, ' +
      '.court-art__pulse-center',
    )
    .forEach((element) => {
      element.style.removeProperty('opacity');
      element.style.removeProperty('transform');
      element.style.removeProperty('transform-box');
      element.style.removeProperty('transform-origin');
      element.style.removeProperty('clip-path');
    });
}

export function CourtCardAnimations() {
  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const canHover = window.matchMedia(
      '(hover: hover) and (pointer: fine)',
    ).matches;

    if (reducedMotion || !canHover) return;

    const motions = new Map<HTMLElement, Motion>();

    // Localiza las tarjetas aunque aparezcan después
    // de una consulta asíncrona de React Query.
    function prepare() {
      document
        .querySelectorAll<HTMLElement>(
          '.home-page .home-court',
        )
        .forEach((card) => {
          if (motions.has(card)) return;

          const motion = createMotion(card);

          if (motion) {
            motions.set(card, motion);
          }
        });

      // Limpieza de tarjetas desmontadas.
      for (const [card, motion] of motions) {
        if (!card.isConnected) {
          clean(motion);
          motions.delete(card);
        }
      }
    }

    prepare();

    const observer = new MutationObserver(prepare);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    function getCard(target: EventTarget | null) {
      if (!(target instanceof Element)) return null;

      return target.closest<HTMLElement>(
        '.home-page .home-court',
      );
    }

    function setTarget(
      card: HTMLElement,
      value: 0 | 1,
    ) {
      prepare();

      const motion = motions.get(card);
      if (!motion) return;

      motion.target = value;
      animate(motion);
    }

    function over(event: PointerEvent) {
      if (event.pointerType === 'touch') return;

      const card = getCard(event.target);
      if (!card) return;

      if (
        event.relatedTarget instanceof Node &&
        card.contains(event.relatedTarget)
      ) {
        return;
      }

      setTarget(card, 1);
    }

    function out(event: PointerEvent) {
      if (event.pointerType === 'touch') return;

      const card = getCard(event.target);
      if (!card) return;

      if (
        event.relatedTarget instanceof Node &&
        card.contains(event.relatedTarget)
      ) {
        return;
      }

      if (!card.matches(':focus-within')) {
        setTarget(card, 0);
      }
    }

    function focus(event: FocusEvent) {
      const card = getCard(event.target);

      if (card) {
        setTarget(card, 1);
      }
    }

    function blur(event: FocusEvent) {
      const card = getCard(event.target);
      if (!card) return;

      if (
        event.relatedTarget instanceof Node &&
        card.contains(event.relatedTarget)
      ) {
        return;
      }

      if (!card.matches(':hover')) {
        setTarget(card, 0);
      }
    }

    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);

    return () => {
      observer.disconnect();

      document.removeEventListener(
        'pointerover',
        over,
      );

      document.removeEventListener(
        'pointerout',
        out,
      );

      document.removeEventListener(
        'focusin',
        focus,
      );

      document.removeEventListener(
        'focusout',
        blur,
      );

      motions.forEach(clean);
      motions.clear();
    };
  }, []);

  return null;
}
