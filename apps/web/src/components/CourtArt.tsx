
import { useId } from 'react';
import '../styles/court-interactions.css';

type CourtArtProps = {
  variant?: 'hero' | 'card';
  accent?: string;
};

type CourtAccent = 'lime' | 'teal' | 'amber' | 'blue';

const PALETTE: Record<CourtAccent, string> = {
  lime: '#d0fa5b',
  teal: '#70eddb',
  amber: '#ffc37e',
  blue: '#86a7ff',
};

const DESCRIPTIONS: Record<CourtAccent, string> = {
  lime: 'Cancha Arena con iluminación LED',
  teal: 'Cancha Pulse con iluminación dinámica',
  amber: 'Cancha Terra con césped sintético',
  blue: 'Cancha Sky con paredes panorámicas',
};

// Posiciones predecibles, sin generar valores aleatorios.
const GRASS_BLADES = Array.from({ length: 40 }, (_, index) => ({
  x: 148 + (index % 10) * 46 + (Math.floor(index / 10) % 2) * 12,
  y: 225 + Math.floor(index / 10) * 43,
}));

function normalizeAccent(accent: string): CourtAccent {
  if (accent === 'teal' || accent === 'amber' || accent === 'blue') {
    return accent;
  }

  return 'lime';
}

export function CourtArt({
  variant = 'hero',
  accent = 'lime',
}: CourtArtProps) {
  const id = useId().replace(/:/g, '');
  const tone = normalizeAccent(accent);
  const color = PALETTE[tone];
  const interactive = variant === 'card';

  return (
    <svg
      className={`court-art court-art--${variant} court-art--${tone}`}
      role="img"
      aria-label={
        interactive
          ? DESCRIPTIONS[tone]
          : 'Ilustración isométrica de una cancha de pádel'
      }
      viewBox="0 0 700 535"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={`${id}-floor`}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop stopColor="#1e6968" />
          <stop offset=".58" stopColor="#164d51" />
          <stop offset="1" stopColor="#0a3839" />
        </linearGradient>

        <linearGradient
          id={`${id}-side`}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop stopColor="#071d1b" />
          <stop offset="1" stopColor="#04100e" />
        </linearGradient>

        <radialGradient id={`${id}-glow`}>
          <stop stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>

        <linearGradient
          id={`${id}-glass`}
          x1="0"
          y1="0"
          x2="0.4"
          y2="1"
        >
          <stop stopColor="#dcecff" stopOpacity=".24" />
          <stop offset="1" stopColor="#86a7ff" stopOpacity=".04" />
        </linearGradient>

        <linearGradient
          id={`${id}-beam`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop stopColor={color} stopOpacity=".55" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>

        <clipPath id={`${id}-court-clip`}>
          <path d="M106 291L356 159L631 304L382 438Z" />
        </clipPath>

        <filter
          id={`${id}-shadow`}
          x="-30%"
          y="-70%"
          width="160%"
          height="240%"
        >
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      {/* Sombra e iluminación ambiental */}
      <ellipse
        className="court-art__ground-shadow"
        cx="348"
        cy="384"
        rx="333"
        ry="135"
        fill={color}
        opacity=".11"
        filter={`url(#${id}-shadow)`}
      />

      <ellipse
        className="court-art__atmosphere"
        cx="370"
        cy="218"
        rx="315"
        ry="190"
        fill={`url(#${id}-glow)`}
      />

      {/* Estructura isométrica original */}
      <g className="court-art__structure">
        <path
          d="M106 291L356 159L631 304L382 443Z"
          fill="#000"
          opacity=".4"
          transform="translate(2 19)"
        />

        <path
          d="M106 291L382 438L382 453L106 307Z"
          fill={`url(#${id}-side)`}
          stroke="#35645c"
          strokeWidth="1.5"
        />

        <path
          d="M382 438L631 304L631 320L382 453Z"
          fill="#0b2826"
          stroke="#35645c"
          strokeWidth="1.5"
        />

        <path
          d="M106 291L356 159L631 304L382 438Z"
          fill={`url(#${id}-floor)`}
          stroke={color}
          strokeWidth="3"
        />
      </g>

      {/* TERRA 03: césped que crece */}
      {interactive && tone === 'amber' && (
        <g clipPath={`url(#${id}-court-clip)`}>
          <path
            className="court-art__turf-bloom"
            d="M106 291L356 159L631 304L382 438Z"
            fill="#9ced69"
          />

          <g className="court-art__grass">
            {GRASS_BLADES.map(({ x, y }, index) => (
              <path
                className="court-art__grass-blade"
                key={index}
                d={`M${x} ${y + 12} l-3 -12 M${x} ${y + 12} l4 -10`}
                fill="none"
                stroke={
                  index % 3 === 0 ? '#dbff9b' : '#a6e778'
                }
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ))}
          </g>
        </g>
      )}

      {/* Líneas de juego */}
      <g className="court-art__markings">
        <path
          d="M130 290L356 171L606 303L381 424Z"
          fill="none"
          stroke="#a2d0c6"
          strokeWidth="2"
          opacity=".8"
        />

        <path
          d="M252 227L500 359M239 359L490 226"
          fill="none"
          stroke="#e2fff0"
          strokeWidth="2.3"
          opacity=".9"
        />

        <path
          d="M184 251L432 384M305 185L555 318"
          fill="none"
          stroke="#d9f8e5"
          strokeWidth="1.7"
          opacity=".72"
        />
      </g>

      {/* ARENA 01: reflectores que se encienden */}
      {interactive && tone === 'lime' && (
        <g className="court-art__arena-light">
          <path
            d="M126 76L35 304L376 407L175 93Z"
            fill={`url(#${id}-beam)`}
          />

          <path
            d="M593 88L370 380L667 340L616 100Z"
            fill={`url(#${id}-beam)`}
          />

          <path
            className="court-art__arena-outline"
            d="M106 291L356 159L631 304L382 438Z"
            fill="none"
            stroke={color}
            strokeWidth="6"
          />
        </g>
      )}

      {/* PULSE 02: ondas de energía */}
      {interactive && tone === 'teal' && (
        <g
          className="court-art__pulse-field"
          clipPath={`url(#${id}-court-clip)`}
        >
          <ellipse
            className="court-art__pulse court-art__pulse--one"
            cx="375"
            cy="300"
            rx="60"
            ry="34"
            fill="none"
            stroke={color}
            strokeWidth="4"
          />

          <ellipse
            className="court-art__pulse court-art__pulse--two"
            cx="375"
            cy="300"
            rx="98"
            ry="51"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />

          <ellipse
            className="court-art__pulse court-art__pulse--three"
            cx="375"
            cy="300"
            rx="140"
            ry="75"
            fill="none"
            stroke={color}
            strokeWidth="2"
          />

          <circle
            className="court-art__pulse-center"
            cx="375"
            cy="300"
            r="13"
            fill={color}
          />
        </g>
      )}

      {/* Cerramientos y mallas */}
      <g className="court-art__fence">
        <path
          d="M106 291L106 180L356 52L631 196L631 304"
          fill="none"
          stroke="#b7e7c7"
          strokeOpacity=".75"
          strokeWidth="2.5"
        />

        <path
          d="M356 52L356 159M106 180L382 326M631 196L382 326"
          fill="none"
          stroke="#9fcdb9"
          strokeOpacity=".4"
          strokeWidth="1.8"
        />

        <path
          d="M106 227L382 373L631 242M106 262L382 408L631 278"
          fill="none"
          stroke="#c0e6d1"
          strokeOpacity=".16"
          strokeWidth="1"
        />

        <path
          d="M177 144V330M250 107V368M444 99V201M525 143V250M560 158V266"
          stroke="#c1e8cd"
          strokeOpacity=".24"
          strokeWidth="1.6"
        />

        <path
          d="M106 291L356 159L631 304"
          fill="none"
          stroke="#efffec"
          strokeOpacity=".68"
          strokeWidth="1"
        />
      </g>

      {/* SKY 04: paneles de vidrio que se elevan */}
      {interactive && tone === 'blue' && (
        <g className="court-art__sky-glass" aria-hidden="true">
          <g className="court-art__sky-panel court-art__sky-panel--left">
            <path
              d="M109 181L354 55L354 160L109 288Z"
              fill={`url(#${id}-glass)`}
              stroke="#b4caff"
              strokeWidth="2.5"
            />

            <path
              d="M230 120L230 225"
              stroke="#e5efff"
              strokeOpacity=".48"
              strokeWidth="2"
            />
          </g>

          <g className="court-art__sky-panel court-art__sky-panel--right">
            <path
              d="M358 55L628 197L628 300L358 158Z"
              fill={`url(#${id}-glass)`}
              stroke="#b4caff"
              strokeWidth="2.5"
            />

            <path
              d="M492 125L492 229"
              stroke="#e5efff"
              strokeOpacity=".48"
              strokeWidth="2"
            />
          </g>

          <path
            className="court-art__sky-edge"
            d="M106 180L356 52L631 196"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Pelota */}
      <g className="court-art__ball">
        <circle
          cx="455"
          cy="242"
          r="7"
          fill={color}
          opacity=".9"
        />

        <circle
          cx="455"
          cy="242"
          r="15"
          fill={color}
          opacity=".12"
        />
      </g>

      {/* Reflectores de la estructura */}
      <g className="court-art__lamps">
        <path
          d="M126 190V74M593 206V86"
          stroke="#adced0"
          strokeWidth="4"
        />

        <path
          className="court-art__lamp-strip"
          d="M108 74h36M576 86h36"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
        />

        <path
          className="court-art__lamp-halo"
          d="M126 74L145 219M593 86L550 263"
          stroke={color}
          strokeWidth="29"
          opacity=".12"
        />

        {interactive && tone === 'lime' && (
          <g className="court-art__lamp-bulbs">
            <circle
              cx="126"
              cy="74"
              r="20"
              fill={color}
              opacity=".5"
            />

            <circle
              cx="593"
              cy="86"
              r="20"
              fill={color}
              opacity=".5"
            />
          </g>
        )}
      </g>

      <text
        x="343"
        y="496"
        textAnchor="middle"
        fill={color}
        opacity=".7"
        fontFamily="monospace"
        fontSize="13"
        letterSpacing="7"
      >
        BUILT FOR THE GAME
      </text>
    </svg>
  );
}
