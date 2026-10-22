
import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CourtArt } from './CourtArt';
import '../styles/hero-court-3d.css';

const LIME = '#d0fb67';

type Cursor = {
  ndcX: number;
  ndcY: number;
  active: boolean;
};

type BeamProps = {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  emissive?: boolean;
};

function Beam({
  position,
  size,
  color = '#345e50',
  emissive = false,
}: BeamProps) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      {emissive ? (
        <meshBasicMaterial color={color} toneMapped={false} />
      ) : (
        <meshStandardMaterial
          color={color}
          metalness={0.48}
          roughness={0.46}
        />
      )}
    </mesh>
  );
}

function createHalo() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;

  const context = canvas.getContext('2d');

  if (context) {
    const gradient = context.createRadialGradient(
      64, 64, 0, 64, 64, 64,
    );

    gradient.addColorStop(0, 'rgba(239,255,165,1)');
    gradient.addColorStop(0.18, 'rgba(198,255,103,.82)');
    gradient.addColorStop(0.5, 'rgba(167,255,88,.34)');
    gradient.addColorStop(1, 'rgba(167,255,88,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }

  return new THREE.CanvasTexture(canvas);
}

function Enclosure() {
  return (
    <group>
      {[-4.65, 4.65].map((x) => (
        <group key={`lateral-${x}`}>
          <mesh position={[x, 1.64, 0]}>
            <boxGeometry args={[0.035, 3.22, 16.6]} />
            <meshPhysicalMaterial
              color="#9cded7"
              transparent
              opacity={0.17}
              depthWrite={false}
              roughness={0.08}
              side={THREE.DoubleSide}
            />
          </mesh>

          {[-8.3, -4.15, 0, 4.15, 8.3].map((z) => (
            <Beam
              key={`${x}-${z}`}
              position={[x, 1.65, z]}
              size={[0.105, 3.3, 0.105]}
              color="#78958a"
            />
          ))}

          <Beam
            position={[x, 3.3, 0]}
            size={[0.11, 0.12, 16.7]}
            color="#a3c0ad"
          />
        </group>
      ))}

      {[-8.3, 8.3].map((z) => (
        <group key={`fondo-${z}`}>
          <mesh position={[0, 1.64, z]}>
            <boxGeometry args={[9.28, 3.22, 0.035]} />
            <meshPhysicalMaterial
              color="#a9e9dd"
              transparent
              opacity={0.17}
              depthWrite={false}
              roughness={0.08}
              side={THREE.DoubleSide}
            />
          </mesh>

          {[-4.65, -2.325, 0, 2.325, 4.65].map((x) => (
            <Beam
              key={`${z}-${x}`}
              position={[x, 1.65, z]}
              size={[0.105, 3.3, 0.105]}
              color="#78958a"
            />
          ))}

          <Beam
            position={[0, 3.3, z]}
            size={[9.35, 0.12, 0.1]}
            color="#a3c0ad"
          />
        </group>
      ))}
    </group>
  );
}

function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group>
      <Beam
        position={[x, 2.5, z]}
        size={[0.12, 5, 0.12]}
        color="#7b9985"
      />

      <Beam
        position={[x, 5.07, z]}
        size={[1.16, 0.17, 0.58]}
        color="#0d201b"
      />

      <Beam
        position={[x, 4.94, z]}
        size={[1.04, 0.045, 0.4]}
        color="#f0ffc7"
        emissive
      />

      <pointLight
        position={[x, 4.75, z]}
        intensity={4}
        distance={11}
        decay={2}
        color="#ecffd4"
      />
    </group>
  );
}

function CourtScene({
  cursor,
  reducedMotion,
}: {
  cursor: React.RefObject<Cursor>;
  reducedMotion: boolean;
}) {
  const arena = useRef<THREE.Group>(null);
  const enclosure = useRef<THREE.Group>(null);
  const beam = useRef<THREE.SpotLight>(null);
  const movingBall = useRef<THREE.Mesh>(null);

  const floorLight = useRef<
    THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >
  >(null);

  const target = useMemo(
    () => new THREE.Object3D(),
    [],
  );

  const halo = useMemo(createHalo, []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  const plane = useMemo(
    () =>
      new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -0.16,
      ),
    [],
  );

  const projected = useMemo(
    () => new THREE.Vector3(),
    [],
  );

  const ndc = useMemo(
    () => new THREE.Vector2(),
    [],
  );

  const seconds = useRef(0);
  const reveal = useRef(reducedMotion ? 1 : 0);
  const smooth = useRef({ x: 0, z: 0 });

  useEffect(
    () => () => halo.dispose(),
    [halo],
  );

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    seconds.current += dt;

    const t = seconds.current;

    reveal.current = reducedMotion
      ? 1
      : Math.min(1, reveal.current + dt / 1.8);

    const entrance =
      1 - (1 - reveal.current) ** 3;

    // Sin mouse: iluminación ambiental suave.
    // Con movimiento reducido: el foco permanece quieto.
    let desiredX = reducedMotion
      ? 0
      : Math.sin(t * 0.43) * 1.4;

    let desiredZ = reducedMotion
      ? 0
      : Math.cos(t * 0.32) * 2.1;

    // Con mouse: calcular el punto real sobre el suelo 3D.
    if (cursor.current.active) {
      ndc.set(
        cursor.current.ndcX,
        cursor.current.ndcY,
      );

      raycaster.setFromCamera(ndc, camera);

      const hit = raycaster.ray.intersectPlane(
        plane,
        projected,
      );

      if (hit) {
        desiredX = THREE.MathUtils.clamp(
          hit.x,
          -4,
          4,
        );

        desiredZ = THREE.MathUtils.clamp(
          hit.z,
          -7.5,
          7.5,
        );
      }
    }

    smooth.current.x = THREE.MathUtils.damp(
      smooth.current.x,
      desiredX,
      6,
      dt,
    );

    smooth.current.z = THREE.MathUtils.damp(
      smooth.current.z,
      desiredZ,
      6,
      dt,
    );

    // Posición del objetivo del reflector.
    target.position.set(
      smooth.current.x,
      0.16,
      smooth.current.z,
    );

    target.updateMatrixWorld();

    // Halo sobre la cancha.
    if (floorLight.current) {
      floorLight.current.position.x =
        smooth.current.x;

      floorLight.current.position.z =
        smooth.current.z;

      floorLight.current.material.opacity =
        THREE.MathUtils.damp(
          floorLight.current.material.opacity,
          cursor.current.active ? 0.98 : 0.53,
          4,
          dt,
        );

      const desiredScale =
        cursor.current.active ? 1.1 : 0.8;

      floorLight.current.scale.setScalar(
        THREE.MathUtils.damp(
          floorLight.current.scale.x,
          desiredScale,
          4,
          dt,
        ),
      );
    }

    // Reflector físico 3D.
    if (beam.current) {
      beam.current.position.set(
        smooth.current.x + 0.8,
        9.5,
        smooth.current.z + 0.4,
      );

      beam.current.intensity = THREE.MathUtils.damp(
        beam.current.intensity,
        (cursor.current.active ? 100 : 58) * entrance,
        3,
        dt,
      );
    }

    // Animación inicial de los cristales.
    if (enclosure.current) {
      enclosure.current.position.y =
        -3.45 * (1 - entrance);
    }

    // Flotación ambiental.
    if (arena.current) {
      arena.current.position.y = reducedMotion
        ? 0
        : Math.sin(t * 0.8) * 0.045;
    }

    // Pelota animada.
    if (movingBall.current && !reducedMotion) {
      movingBall.current.position.set(
        1.25 + Math.cos(t * 0.9) * 0.8,
        0.36 + Math.abs(Math.sin(t * 1.8)) * 1.15,
        -0.9 + Math.sin(t * 0.9) * 1.35,
      );
    }

    // Movimiento de cámara muy sutil.
    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      14.5 + (
        cursor.current.active && !reducedMotion
          ? cursor.current.ndcX * 0.6
          : 0
      ),
      2,
      dt,
    );

    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      17.5,
      2,
      dt,
    );

    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      24 + (
        cursor.current.active && !reducedMotion
          ? -cursor.current.ndcY * 0.6
          : 0
      ),
      2,
      dt,
    );

    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight
        intensity={0.68}
        color="#b9e6d0"
      />

      <directionalLight
        intensity={1.8}
        position={[7, 12, 8]}
        color="#e4ffe1"
      />

      <pointLight
        intensity={14}
        position={[-8, 7, -6]}
        color="#58ccb7"
        distance={30}
        decay={2}
      />

      <primitive object={target} />

      <spotLight
        ref={beam}
        target={target}
        position={[1, 9.5, 0]}
        intensity={0}
        angle={0.43}
        penumbra={0.85}
        distance={22}
        decay={2}
        color={LIME}
      />

      <group ref={arena}>
        {/* Base flotante */}
        <Beam
          position={[0, -0.65, 0]}
          size={[10.35, 0.95, 17.5]}
          color="#102c24"
        />

        <Beam
          position={[0, -1.12, 0]}
          size={[10.48, 0.08, 17.64]}
          color={LIME}
          emissive
        />

        <Beam
          position={[0, -0.18, 0]}
          size={[9.52, 0.34, 16.95]}
          color="#104d46"
        />

        {/* Superficie */}
        <mesh
          position={[0, 0.035, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[9.24, 16.45]} />

          <meshStandardMaterial
            color="#147568"
            roughness={0.95}
            metalness={0}
          />
        </mesh>

        {/* Líneas laterales */}
        {[-4.34, 4.34].map((x) => (
          <Beam
            key={`side-${x}`}
            position={[x, 0.095, 0]}
            size={[0.065, 0.022, 15.72]}
            color="#f3ffed"
            emissive
          />
        ))}

        {/* Líneas de fondo y servicio */}
        {[-7.86, 7.86, -5.1, 5.1].map((z) => (
          <Beam
            key={`end-${z}`}
            position={[0, 0.095, z]}
            size={[8.78, 0.022, 0.065]}
            color="#f3ffed"
            emissive
          />
        ))}

        {/* Líneas centrales */}
        {[-2.55, 2.55].map((z) => (
          <Beam
            key={`mid-${z}`}
            position={[0, 0.095, z]}
            size={[0.065, 0.022, 5.1]}
            color="#f3ffed"
            emissive
          />
        ))}

        {/* LED del perímetro */}
        {[-4.59, 4.59].map((x) => (
          <Beam
            key={`led-side-${x}`}
            position={[x, 0.11, 0]}
            size={[0.07, 0.07, 16.48]}
            color={LIME}
            emissive
          />
        ))}

        {[-8.23, 8.23].map((z) => (
          <Beam
            key={`led-end-${z}`}
            position={[0, 0.11, z]}
            size={[9.26, 0.07, 0.07]}
            color={LIME}
            emissive
          />
        ))}

        {/* Red */}
        <mesh position={[0, 0.86, 0]}>
          <planeGeometry args={[9.25, 1.46, 40, 8]} />

          <meshBasicMaterial
            color="#d7f0df"
            wireframe
            opacity={0.33}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        <Beam
          position={[0, 1.6, 0]}
          size={[9.3, 0.07, 0.07]}
          color="#f3fff6"
          emissive
        />

        {[-4.58, 4.58].map((x) => (
          <Beam
            key={`net-${x}`}
            position={[x, 0.87, 0]}
            size={[0.1, 1.74, 0.12]}
            color="#183128"
          />
        ))}

        {/* Paredes y reflectores */}
        <group ref={enclosure}>
          <Enclosure />

          {[-5.2, 5.2].flatMap((x) =>
            [-7.28, 7.28].map((z) => (
              <Lamp
                key={`${x}-${z}`}
                x={x}
                z={z}
              />
            )),
          )}
        </group>

        {/* Pelota */}
        <mesh
          ref={movingBall}
          position={[1.25, 0.8, -0.9]}
        >
          <sphereGeometry args={[0.2, 18, 18]} />

          <meshStandardMaterial
            color="#e5ff68"
            emissive="#92c343"
            emissiveIntensity={0.35}
          />
        </mesh>

        {/* Luz móvil directamente sobre el terreno */}
        <mesh
          ref={floorLight}
          position={[0, 0.16, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={10}
        >
          <planeGeometry args={[6.4, 6.4]} />

          <meshBasicMaterial
            map={halo}
            color="#eaffb7"
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
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
    console.error(
      '[RITMO 3D] No se pudo dibujar la escena:',
      error,
    );

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
    ndcX: 0,
    ndcY: 0,
    active: false,
  });

  const [mode, setMode] = useState<
    'webgl' | 'fallback' | 'checking'
  >('checking');

  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    setReducedMotion(reduced);

    try {
      const probe = document.createElement('canvas');

      setMode(
        probe.getContext('webgl2')
          ? 'webgl'
          : 'fallback',
      );
    } catch {
      setMode('fallback');
    }

    /*
     * No desactivamos la interacción por movimiento reducido.
     * Esa preferencia solo elimina el movimiento decorativo.
     */
    const updatePosition = (
      clientX: number,
      clientY: number,
    ) => {
      const element = root.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();

      const inside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;

      cursor.current.active = inside;

      if (!inside) {
        delete element.dataset.pointer;
        return;
      }

      const canvasRect =
        element
          .querySelector('canvas')
          ?.getBoundingClientRect() ?? rect;

      if (!canvasRect.width || !canvasRect.height) {
        return;
      }

      const u = THREE.MathUtils.clamp(
        (clientX - canvasRect.left) / canvasRect.width,
        0,
        1,
      );

      const v = THREE.MathUtils.clamp(
        (clientY - canvasRect.top) / canvasRect.height,
        0,
        1,
      );

      cursor.current.ndcX = u * 2 - 1;
      cursor.current.ndcY = 1 - v * 2;

      element.dataset.pointer = 'active';

      element.style.setProperty(
        '--cursor-x',
        `${(u * 100).toFixed(1)}%`,
      );

      element.style.setProperty(
        '--cursor-y',
        `${(v * 100).toFixed(1)}%`,
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') {
        updatePosition(event.clientX, event.clientY);
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      updatePosition(event.clientX, event.clientY);
    };

    const onBlur = () => {
      cursor.current.active = false;

      if (root.current) {
        delete root.current.dataset.pointer;
      }
    };

    window.addEventListener(
      'pointermove',
      onPointerMove,
      { passive: true },
    );

    window.addEventListener(
      'mousemove',
      onMouseMove,
      { passive: true },
    );

    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener(
        'pointermove',
        onPointerMove,
      );

      window.removeEventListener(
        'mousemove',
        onMouseMove,
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
      data-reduced-motion={
        reducedMotion ? 'true' : 'false'
      }
      role="img"
      aria-label="Cancha de pádel 3D con iluminación interactiva"
    >
      {/* Respaldo si WebGL no está disponible */}
      <div
        className="hero-3d__fallback"
        aria-hidden="true"
      >
        <CourtArt variant="hero" />
      </div>

      {/* Reflejo visible independiente del motor 3D */}
      <div
        className="hero-3d__cursor-glow"
        aria-hidden="true"
      />

      {mode === 'webgl' && (
        <SceneBoundary
          onFailure={() => {
            setReady(false);
            setMode('fallback');
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
                position: [14.5, 17.5, 24],
                fov: 38,
                near: 0.1,
                far: 80,
              }}
              gl={{
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance',
              }}
              onCreated={() => setReady(true)}
            >
              <CourtScene
                cursor={cursor}
                reducedMotion={reducedMotion}
              />
            </Canvas>
          </div>
        </SceneBoundary>
      )}

      {mode === 'webgl' && (
        <div
          className="hero-3d__hint"
          aria-hidden="true"
        >
          <span className="hero-3d__hint-dot" />

          <span className="hero-3d__hint-idle">
            MOVÉ EL MOUSE · CONTROLÁ LAS LUCES
          </span>

          <span className="hero-3d__hint-active">
            LUZ SIGUIENDO EL MOUSE
          </span>
        </div>
      )}
    </div>
  );
}
