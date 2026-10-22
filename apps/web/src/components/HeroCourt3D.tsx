
import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CourtArt } from './CourtArt';
import '../styles/hero-court-3d.css';

type Cursor = { x: number; y: number; active: boolean };

type BlockProps = {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  glow?: boolean;
};

const LIME = '#cfff65';
const UP = new THREE.Vector3(0, 1, 0);

const TOWERS: [number, number][] = [
  [-5.25, -7.25],
  [5.25, -7.25],
  [-5.25, 7.25],
  [5.25, 7.25],
];

function Block({
  position,
  size,
  color,
  glow = false,
}: BlockProps) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />

      {glow ? (
        <meshBasicMaterial color={color} toneMapped={false} />
      ) : (
        <meshStandardMaterial
          color={color}
          metalness={0.42}
          roughness={0.46}
        />
      )}
    </mesh>
  );
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');

  canvas.width = canvas.height = 128;

  const ctx = canvas.getContext('2d');

  if (ctx) {
    const gradient = ctx.createRadialGradient(
      64, 64, 0, 64, 64, 64,
    );

    gradient.addColorStop(0, 'rgba(242,255,180,1)');
    gradient.addColorStop(0.22, 'rgba(211,255,105,.76)');
    gradient.addColorStop(0.55, 'rgba(172,255,92,.23)');
    gradient.addColorStop(1, 'rgba(172,255,92,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }

  return new THREE.CanvasTexture(canvas);
}

function GlassWalls() {
  return (
    <group>
      {[-4.65, 4.65].map((x) => (
        <group key={`side-${x}`}>
          <mesh position={[x, 1.66, 0]}>
            <boxGeometry args={[0.025, 3.2, 16.5]} />

            <meshPhysicalMaterial
              color="#9ee6d4"
              transparent
              opacity={0.18}
              roughness={0.07}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {[-8.25, -4.12, 0, 4.12, 8.25].map((z) => (
            <Block
              key={`${x}-${z}`}
              position={[x, 1.7, z]}
              size={[0.1, 3.4, 0.1]}
              color="#578a79"
            />
          ))}

          <Block
            position={[x, 3.38, 0]}
            size={[0.1, 0.09, 16.65]}
            color="#8fb8a1"
          />
        </group>
      ))}

      {[-8.25, 8.25].map((z) => (
        <group key={`end-${z}`}>
          <mesh position={[0, 1.66, z]}>
            <boxGeometry args={[9.25, 3.2, 0.025]} />

            <meshPhysicalMaterial
              color="#9ee6d4"
              transparent
              opacity={0.18}
              roughness={0.07}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {[-4.65, -2.32, 0, 2.32, 4.65].map((x) => (
            <Block
              key={`${z}-${x}`}
              position={[x, 1.7, z]}
              size={[0.1, 3.4, 0.1]}
              color="#578a79"
            />
          ))}

          <Block
            position={[0, 3.38, z]}
            size={[9.35, 0.09, 0.1]}
            color="#8fb8a1"
          />
        </group>
      ))}
    </group>
  );
}

/*
 * Cada torre tiene:
 * - Un reflector físico.
 * - Un haz exterior de luz.
 * - Un haz interior más intenso.
 * - Un círculo de iluminación sobre el terreno.
 *
 * Los conos siempre apuntan desde su torre
 * hacia el objetivo que controla el mouse.
 */
function LightTower({
  x,
  z,
  aim,
  glowMap,
  brightness,
}: {
  x: number;
  z: number;
  aim: React.RefObject<THREE.Vector3>;
  glowMap: THREE.Texture;
  brightness: React.RefObject<number>;
}) {
  const source = useMemo(
    () => new THREE.Vector3(x, 4.95, z),
    [x, z],
  );

  const destination = useMemo(
    () => new THREE.Vector3(),
    [],
  );

  const direction = useMemo(
    () => new THREE.Vector3(),
    [],
  );

  const midpoint = useMemo(
    () => new THREE.Vector3(),
    [],
  );

  const lightTarget = useMemo(
    () => new THREE.Object3D(),
    [],
  );

  const outer = useRef<
    THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>
  >(null);

  const inner = useRef<
    THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>
  >(null);

  const floorGlow = useRef<
    THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  >(null);

  const spotlight = useRef<THREE.SpotLight>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    destination.copy(aim.current);

    lightTarget.position.lerp(
      destination,
      1 - Math.exp(-9 * dt),
    );

    lightTarget.updateMatrixWorld();

    const distance = direction
      .subVectors(source, lightTarget.position)
      .length();

    direction.normalize();

    midpoint
      .copy(source)
      .add(lightTarget.position)
      .multiplyScalar(0.5);

    // Orientar ambos conos hacia el objetivo.
    for (const cone of [outer.current, inner.current]) {
      if (!cone) continue;

      cone.position.copy(midpoint);

      cone.quaternion.setFromUnitVectors(
        UP,
        direction,
      );

      cone.scale.set(1, distance, 1);
    }

    const opacity = brightness.current;

    if (outer.current) {
      outer.current.material.opacity = 0.14 * opacity;
    }

    if (inner.current) {
      inner.current.material.opacity = 0.23 * opacity;
    }

    if (spotlight.current) {
      spotlight.current.intensity = 28 * opacity;
    }

    if (floorGlow.current) {
      floorGlow.current.position.x =
        lightTarget.position.x;

      floorGlow.current.position.z =
        lightTarget.position.z;

      floorGlow.current.material.opacity =
        0.65 * opacity;
    }
  });

  return (
    <group>
      {/* Torre metálica */}
      <Block
        position={[x, 2.55, z]}
        size={[0.13, 5.1, 0.13]}
        color="#617f71"
      />

      {/* Cabezal del reflector */}
      <Block
        position={[x, 5.1, z]}
        size={[1.12, 0.22, 0.68]}
        color="#11271f"
      />

      {/* Superficie luminosa */}
      <Block
        position={[x, 4.94, z]}
        size={[0.95, 0.06, 0.43]}
        color="#eeffca"
        glow
      />

      <pointLight
        position={[x, 4.88, z]}
        intensity={3}
        distance={8}
        color="#e9ffbf"
      />

      {/* Objetivo móvil de la iluminación */}
      <primitive object={lightTarget} />

      <spotLight
        ref={spotlight}
        position={[x, 4.95, z]}
        target={lightTarget}
        color="#dfff93"
        angle={0.28}
        penumbra={0.84}
        distance={19}
        intensity={0}
        decay={2}
      />

      {/* Haz exterior volumétrico */}
      <mesh ref={outer} renderOrder={6}>
        <coneGeometry args={[1.65, 1, 28, 1, true]} />

        <meshBasicMaterial
          color="#baff85"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Núcleo luminoso del rayo */}
      <mesh ref={inner} renderOrder={7}>
        <coneGeometry args={[0.74, 1, 24, 1, true]} />

        <meshBasicMaterial
          color="#eaffc7"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Reflejo sobre el césped */}
      <mesh
        ref={floorGlow}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.14, 0]}
        renderOrder={8}
      >
        <planeGeometry args={[3.3, 3.3]} />

        <meshBasicMaterial
          map={glowMap}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Arena({
  cursor,
  reducedMotion,
}: {
  cursor: React.RefObject<Cursor>;
  reducedMotion: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const walls = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);

  const aim = useRef(
    new THREE.Vector3(0, 0.14, 0),
  );

  const brightness = useRef(0);

  const raycaster = useMemo(
    () => new THREE.Raycaster(),
    [],
  );

  const mouse = useMemo(
    () => new THREE.Vector2(),
    [],
  );

  const floorPlane = useMemo(
    () => new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -0.14,
    ),
    [],
  );

  const worldHit = useMemo(
    () => new THREE.Vector3(),
    [],
  );

  const localHit = useMemo(
    () => new THREE.Vector3(),
    [],
  );

  const texture = useMemo(
    makeGlowTexture,
    [],
  );

  const elapsed = useRef(0);

  useEffect(
    () => () => texture.dispose(),
    [texture],
  );

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;

    const t = elapsed.current;

    /*
     * GIRO CINEMATOGRÁFICO:
     * 360° en 3.1 segundos.
     * Comienza rápido y termina suavemente.
     */
    const progress = reducedMotion
      ? 1
      : Math.min(1, t / 3.1);

    const easeOut =
      1 - Math.pow(1 - progress, 3);

    const turn =
      Math.PI * 2 * (1 - easeOut);

    if (root.current) {
      root.current.rotation.y =
        turn + (
          progress === 1 && cursor.current.active
            ? cursor.current.x * 0.055
            : 0
        );

      root.current.position.y = reducedMotion
        ? 0
        : Math.sin(t * 0.75) * 0.045;

      root.current.scale.setScalar(
        reducedMotion
          ? 1
          : 0.92 + 0.08 * easeOut,
      );

      root.current.updateWorldMatrix(
        true,
        false,
      );
    }

    /*
     * Las paredes se elevan durante
     * la presentación.
     */
    const rise = reducedMotion
      ? 1
      : Math.min(
          1,
          Math.max(0, (t - 0.35) / 1.8),
        );

    if (walls.current) {
      walls.current.position.y =
        -3.4 * Math.pow(1 - rise, 3);
    }

    brightness.current = reducedMotion
      ? 1
      : Math.min(
          1,
          Math.max(0, (t - 0.45) / 1.15),
        );

    /*
     * PUNTO BAJO EL CURSOR:
     * proyectamos el mouse al mundo 3D
     * y lo convertimos a coordenadas locales.
     *
     * Así los rayos siguen apuntando
     * correctamente aunque la cancha gire.
     */
    let desiredX = reducedMotion
      ? 0
      : Math.sin(t * 0.3) * 0.9;

    let desiredZ = reducedMotion
      ? 0
      : Math.cos(t * 0.24) * 1.45;

    if (cursor.current.active && root.current) {
      mouse.set(
        cursor.current.x,
        cursor.current.y,
      );

      raycaster.setFromCamera(
        mouse,
        camera,
      );

      if (
        raycaster.ray.intersectPlane(
          floorPlane,
          worldHit,
        )
      ) {
        localHit.copy(worldHit);

        root.current.worldToLocal(localHit);

        desiredX = THREE.MathUtils.clamp(
          localHit.x,
          -4.05,
          4.05,
        );

        desiredZ = THREE.MathUtils.clamp(
          localHit.z,
          -7.5,
          7.5,
        );
      }
    }

    aim.current.x = THREE.MathUtils.damp(
      aim.current.x,
      desiredX,
      7,
      dt,
    );

    aim.current.z = THREE.MathUtils.damp(
      aim.current.z,
      desiredZ,
      7,
      dt,
    );

    // Pelota en movimiento.
    if (ball.current && !reducedMotion) {
      ball.current.position.set(
        1.2 + Math.cos(t * 0.9) * 0.6,
        0.65 + Math.abs(Math.sin(t * 1.7)) * 0.95,
        -0.8 + Math.sin(t * 0.9) * 1.2,
      );
    }
  });

  return (
    <>
      <ambientLight
        color="#c5e9dc"
        intensity={0.92}
      />

      <directionalLight
        position={[8, 15, 9]}
        intensity={2}
        color="#efffe7"
      />

      <pointLight
        position={[-10, 8, -9]}
        intensity={20}
        distance={32}
        color="#63dbb7"
      />

      {/* Todo gira dentro del mismo grupo */}
      <group ref={root}>
        {/* Base flotante */}
        <Block
          position={[0, -0.64, 0]}
          size={[10.4, 0.9, 17.55]}
          color="#0c3026"
        />

        <Block
          position={[0, -1.12, 0]}
          size={[10.5, 0.075, 17.7]}
          color={LIME}
          glow
        />

        <Block
          position={[0, -0.18, 0]}
          size={[9.5, 0.36, 16.9]}
          color="#0e5a51"
        />

        {/* Superficie de juego */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.035, 0]}
        >
          <planeGeometry args={[9.2, 16.38]} />

          <meshStandardMaterial
            color="#187d71"
            roughness={0.92}
          />
        </mesh>

        {/* Líneas laterales */}
        {[-4.32, 4.32].map((x) => (
          <Block
            key={`side-${x}`}
            position={[x, 0.096, 0]}
            size={[0.06, 0.016, 15.72]}
            color="#e7fff3"
            glow
          />
        ))}

        {/* Líneas de fondo y servicio */}
        {[-7.83, 7.83, -5.06, 5.06].map((z) => (
          <Block
            key={`line-${z}`}
            position={[0, 0.096, z]}
            size={[8.72, 0.016, 0.065]}
            color="#e7fff3"
            glow
          />
        ))}

        {/* Líneas centrales */}
        {[-2.53, 2.53].map((z) => (
          <Block
            key={`center-${z}`}
            position={[0, 0.096, z]}
            size={[0.065, 0.016, 5.06]}
            color="#e7fff3"
            glow
          />
        ))}

        {/* Contorno LED */}
        {[-4.59, 4.59].map((x) => (
          <Block
            key={`edge-x-${x}`}
            position={[x, 0.11, 0]}
            size={[0.07, 0.045, 16.5]}
            color={LIME}
            glow
          />
        ))}

        {[-8.24, 8.24].map((z) => (
          <Block
            key={`edge-z-${z}`}
            position={[0, 0.11, z]}
            size={[9.26, 0.045, 0.07]}
            color={LIME}
            glow
          />
        ))}

        {/* Red */}
        <mesh position={[0, 0.82, 0]}>
          <planeGeometry args={[9.25, 1.42, 38, 8]} />

          <meshBasicMaterial
            color="#d0e7d7"
            transparent
            opacity={0.4}
            wireframe
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        <Block
          position={[0, 1.55, 0]}
          size={[9.32, 0.07, 0.07]}
          color="#f4fff2"
          glow
        />

        {[-4.63, 4.63].map((x) => (
          <Block
            key={`net-${x}`}
            position={[x, 0.84, 0]}
            size={[0.11, 1.68, 0.11]}
            color="#18392c"
          />
        ))}

        {/* Cristales y cuatro torres de iluminación */}
        <group ref={walls}>
          <GlassWalls />

          {TOWERS.map(([x, z]) => (
            <LightTower
              key={`${x}-${z}`}
              x={x}
              z={z}
              aim={aim}
              glowMap={texture}
              brightness={brightness}
            />
          ))}
        </group>

        {/* Pelota animada */}
        <mesh
          ref={ball}
          position={[1.25, 1.0, -0.8]}
        >
          <sphereGeometry args={[0.18, 20, 20]} />

          <meshStandardMaterial
            color="#dfff62"
            emissive="#96c53d"
            emissiveIntensity={0.34}
          />
        </mesh>
      </group>
    </>
  );
}

class SceneBoundary extends Component<
  {
    children: ReactNode;
    onFailure: () => void;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[RITMO 3D] Error WebGL:', error);
    this.props.onFailure();
  }

  render() {
    return this.state.failed
      ? null
      : this.props.children;
  }
}

export function HeroCourt3D() {
  const root = useRef<HTMLDivElement>(null);

  const cursor = useRef<Cursor>({
    x: 0,
    y: 0,
    active: false,
  });

  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches,
    );

    try {
      const canvas = document.createElement('canvas');

      setSupported(
        Boolean(canvas.getContext('webgl2')),
      );
    } catch {
      setSupported(false);
    }

    /*
     * Escuchamos el mouse desde la ventana,
     * evitando interferencias con las capas
     * del Hero.
     */
    const onMove = (event: MouseEvent) => {
      const element = root.current;

      if (!element) return;

      const stage =
        element.closest<HTMLElement>('.hero-stage') ??
        element;

      const bounds = stage.getBoundingClientRect();

      const inside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;

      cursor.current.active = inside;

      if (!inside) {
        delete element.dataset.pointer;
        return;
      }

      const canvasRect =
        element
          .querySelector('canvas')
          ?.getBoundingClientRect() ??
        element.getBoundingClientRect();

      if (
        !canvasRect.width ||
        !canvasRect.height
      ) {
        return;
      }

      cursor.current.x = THREE.MathUtils.clamp(
        (
          (event.clientX - canvasRect.left) /
          canvasRect.width
        ) * 2 - 1,
        -1,
        1,
      );

      cursor.current.y = THREE.MathUtils.clamp(
        1 - (
          (event.clientY - canvasRect.top) /
          canvasRect.height
        ) * 2,
        -1,
        1,
      );

      element.dataset.pointer = 'active';
    };

    const onBlur = () => {
      cursor.current.active = false;
    };

    window.addEventListener(
      'mousemove',
      onMove,
      { passive: true },
    );

    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener(
        'mousemove',
        onMove,
      );

      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return (
    <div
      ref={root}
      className={`hero-3d ${
        ready ? 'hero-3d--ready' : ''
      }`}
      role="img"
      aria-label="Cancha de pádel 3D que gira 360 grados y tiene cuatro reflectores interactivos"
    >
      {/* Respaldo para navegadores sin WebGL */}
      <div
        className="hero-3d__fallback"
        aria-hidden="true"
      >
        <CourtArt variant="hero" />
      </div>

      {supported && (
        <SceneBoundary
          onFailure={() => {
            setSupported(false);
            setReady(false);
          }}
        >
          <div
            className="hero-3d__canvas"
            aria-hidden="true"
          >
            <Canvas
              dpr={[1, 1.5]}
              frameloop="always"
              camera={{
                position: [16, 19, 27],
                fov: 40,
                near: 0.1,
                far: 90,
              }}
              gl={{
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance',
              }}
              onCreated={() => setReady(true)}
            >
              <Arena
                cursor={cursor}
                reducedMotion={reducedMotion}
              />
            </Canvas>
          </div>
        </SceneBoundary>
      )}

      {supported && ready && (
        <div
          className="hero-3d__hint"
          aria-hidden="true"
        >
          <span className="hero-3d__hint-dot" />

          <span className="hero-3d__hint-idle">
            360° ARENA · MOVÉ EL MOUSE
          </span>

          <span className="hero-3d__hint-active">
            LOS 4 REFLECTORES SIGUEN TU MOUSE
          </span>
        </div>
      )}
    </div>
  );
}
