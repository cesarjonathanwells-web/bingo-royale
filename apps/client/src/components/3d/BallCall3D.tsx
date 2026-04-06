import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { getLetterForNumber, BALL_COLORS } from "@bingo/shared";

/* ------------------------------------------------------------------ */
/*  Animated 3D ball that drops/bounces in when a number is called     */
/* ------------------------------------------------------------------ */

interface AnimatedBallProps {
  number: number;
  color: string;
  letter: string;
  onAnimationComplete?: () => void;
}

function AnimatedBall({ number, color, letter, onAnimationComplete }: AnimatedBallProps) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const [settled, setSettled] = useState(false);

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight
    const specGrad = ctx.createRadialGradient(90, 80, 10, 128, 128, 128);
    specGrad.addColorStop(0, "rgba(255,255,255,0.35)");
    specGrad.addColorStop(0.3, "rgba(255,255,255,0.08)");
    specGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(128, 128, 68, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = "bold 26px 'Russo One', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, 128, 94);

    ctx.fillStyle = "#0f1330";
    ctx.font = "bold 48px 'Russo One', sans-serif";
    ctx.fillText(String(number), 128, 146);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [color, letter, number]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    progressRef.current += delta * 2.5;
    const t = Math.min(progressRef.current, 1);

    // Bounce easing: drops from above, bounces twice
    const bounce = easeOutBounce(t);

    // Start from above, land at center
    groupRef.current.position.y = 3 - bounce * 3;

    // Spin during fall
    groupRef.current.rotation.y = t * Math.PI * 3;
    groupRef.current.rotation.x = t * Math.PI * 1.5;

    // Scale pop
    const scale = t < 0.3 ? t / 0.3 : 1;
    groupRef.current.scale.setScalar(scale);

    if (t >= 1 && !settled) {
      setSettled(true);
      onAnimationComplete?.();
    }

    // Gentle idle rotation after settling
    if (settled) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <sphereGeometry args={[0.8, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.12}
          metalness={0.15}
          envMapIntensity={1.0}
        />
      </mesh>
      {/* Glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[0.85, 1.2, 32]} />
        <meshBasicMaterial
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
/*  Burst particles on ball arrival                                    */
/* ------------------------------------------------------------------ */

function BurstParticles({ color, trigger }: { color: string; trigger: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef(0);

  const particles = useMemo(() => {
    return Array.from({ length: 20 }, () => ({
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
    const dummy = new THREE.Object3D();

    particles.forEach((p, i) => {
      const life = Math.max(0, 1 - t / 1.2);
      const dist = t * p.speed;
      dummy.position.copy(p.dir).multiplyScalar(dist);
      dummy.position.y -= t * t * 2; // gravity
      dummy.rotation.set(t * p.rotSpeed, t * p.rotSpeed * 0.7, 0);
      dummy.scale.setScalar(0.04 * life);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 20]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported component                                                 */
/* ------------------------------------------------------------------ */

interface BallCall3DProps {
  number: number | null;
  is75?: boolean;
  className?: string;
}

export function BallCall3D({ number, is75 = true, className }: BallCall3DProps) {
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (number !== null && number !== displayNumber) {
      setDisplayNumber(number);
      setAnimKey((k) => k + 1);
    }
  }, [number, displayNumber]);

  const { letter, color } = useMemo(() => {
    if (!displayNumber) return { letter: "", color: "#f59e0b" };
    if (!is75 || displayNumber > 75) {
      return { letter: "", color: "#f59e0b" };
    }
    const l = getLetterForNumber(displayNumber);
    return { letter: l, color: BALL_COLORS[l] ?? "#f59e0b" };
  }, [displayNumber, is75]);

  if (!displayNumber) return null;

  return (
    <div className={className} style={{ height: "120px" }}>
      <Canvas
        key={animKey}
        camera={{ position: [0, 0, 4], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} />
        <pointLight position={[0, 2, 3]} intensity={0.5} color={color} />

        <Environment preset="city" />

        <AnimatedBall
          number={displayNumber}
          color={color}
          letter={letter}
        />
        <BurstParticles color={color} trigger={animKey} />
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
