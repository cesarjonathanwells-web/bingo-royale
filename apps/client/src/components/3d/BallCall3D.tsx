import { useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getLetterForNumber, BALL_COLORS } from "@bingo/shared";

/* ------------------------------------------------------------------ */
/*  Shared resources                                                   */
/* ------------------------------------------------------------------ */

const BALL_SPHERE = new THREE.SphereGeometry(0.6, 32, 32);
const RING_GEO = new THREE.RingGeometry(0.65, 0.9, 32);
const PARTICLE_GEO = new THREE.BoxGeometry(1, 1, 1);

/* ------------------------------------------------------------------ */
/*  Texture cache — avoids recreating on every ball call               */
/* ------------------------------------------------------------------ */

const textureCache = new Map<string, THREE.CanvasTexture>();

function getBallTexture(color: string, letter: string, num: number): THREE.CanvasTexture {
  const key = `${color}-${letter}-${num}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  // Outer color
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight baked in
  const specGrad = ctx.createRadialGradient(85, 75, 10, 128, 128, 128);
  specGrad.addColorStop(0, "rgba(255,255,255,0.35)");
  specGrad.addColorStop(0.25, "rgba(255,255,255,0.08)");
  specGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();

  // White inner circle
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(128, 128, 68, 0, Math.PI * 2);
  ctx.fill();

  // Letter
  ctx.fillStyle = color;
  ctx.font = "bold 26px 'Russo One', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 128, 94);

  // Number
  ctx.fillStyle = "#0f1330";
  ctx.font = "bold 48px 'Russo One', sans-serif";
  ctx.fillText(String(num), 128, 146);

  const tex = new THREE.CanvasTexture(canvas);
  textureCache.set(key, tex);
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Animated ball — resets via ref, no Canvas remount                   */
/* ------------------------------------------------------------------ */

interface AnimatedBallProps {
  number: number;
  color: string;
  letter: string;
  trigger: number;
}

function AnimatedBall({ number, color, letter, trigger }: AnimatedBallProps) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const settledRef = useRef(false);

  const texture = useMemo(
    () => getBallTexture(color, letter, number),
    [color, letter, number],
  );

  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  // Reset animation when trigger changes
  useEffect(() => {
    progressRef.current = 0;
    settledRef.current = false;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(0);
    }
  }, [trigger]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (!settledRef.current) {
      progressRef.current += delta * 2.5;
      const t = Math.min(progressRef.current, 1);
      const bounce = easeOutBounce(t);

      groupRef.current.position.y = 2.5 - bounce * 2.5;

      // Spin during fall, land at Y=PI so texture center faces camera
      groupRef.current.rotation.y = Math.PI + t * Math.PI * 4;
      groupRef.current.rotation.x = t * Math.PI * 2;

      const scale = t < 0.3 ? t / 0.3 : 1;
      groupRef.current.scale.setScalar(scale);

      if (t >= 1) {
        settledRef.current = true;
        // Snap to face camera — Y=PI because UV center maps to -Z
        groupRef.current.rotation.set(0, Math.PI, 0);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={BALL_SPHERE}>
        <meshStandardMaterial
          map={texture}
          roughness={0.12}
          metalness={0.15}
          envMapIntensity={0.8}
        />
      </mesh>
      {/* Glow ring */}
      <mesh geometry={RING_GEO} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={color}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Burst particles — reused dummy, resets via trigger                  */
/* ------------------------------------------------------------------ */

function BurstParticles({ color, trigger }: { color: string; trigger: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: 16 }, () => ({
      dir: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5 + 0.5,
        (Math.random() - 0.5) * 2,
      ).normalize(),
      speed: Math.random() * 2 + 1,
      rotSpeed: Math.random() * 5,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  useEffect(() => {
    progressRef.current = 0;
  }, [trigger]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    progressRef.current += delta;
    const t = progressRef.current;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const life = Math.max(0, 1 - t / 1.2);
      const dist = t * p.speed;
      dummy.position.copy(p.dir).multiplyScalar(dist);
      dummy.position.y -= t * t * 2;
      dummy.rotation.set(t * p.rotSpeed, t * p.rotSpeed * 0.7, 0);
      dummy.scale.setScalar(0.04 * life);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[PARTICLE_GEO, undefined, 16]}>
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported component — single persistent Canvas, no remounting       */
/* ------------------------------------------------------------------ */

interface BallCall3DProps {
  number: number | null;
  is75?: boolean;
  className?: string;
}

export function BallCall3D({ number, is75 = true, className }: BallCall3DProps) {
  const triggerRef = useRef(0);
  const currentNumberRef = useRef<number | null>(null);

  // Derive ball visual props
  const ballProps = useMemo(() => {
    if (!number) return null;
    if (!is75 || number > 75) {
      return { letter: "", color: "#f59e0b", number };
    }
    const l = getLetterForNumber(number);
    return { letter: l, color: BALL_COLORS[l] ?? "#f59e0b", number };
  }, [number, is75]);

  // Increment trigger when a new number arrives
  if (number !== null && number !== currentNumberRef.current) {
    currentNumberRef.current = number;
    triggerRef.current += 1;
  }

  if (!ballProps) return null;

  return (
    <div className={className} style={{ aspectRatio: "1", maxHeight: "80px" }}>
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={1} />

        <AnimatedBall
          number={ballProps.number}
          color={ballProps.color}
          letter={ballProps.letter}
          trigger={triggerRef.current}
        />
        <BurstParticles color={ballProps.color} trigger={triggerRef.current} />
      </Canvas>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function easeOutBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}
