import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Shared resources — created once, reused across all balls           */
/* ------------------------------------------------------------------ */

const SHARED_SPHERE = new THREE.SphereGeometry(0.42, 32, 32);

const BALL_DATA = [
  { number: 7, color: "#3b82f6", letter: "B", xSlot: -2 },
  { number: 22, color: "#ef4444", letter: "I", xSlot: -1 },
  { number: 38, color: "#a78bfa", letter: "N", xSlot: 0 },
  { number: 51, color: "#22c55e", letter: "G", xSlot: 1 },
  { number: 65, color: "#f59e0b", letter: "O", xSlot: 2 },
] as const;

/* ------------------------------------------------------------------ */
/*  Texture factory — draws a bingo ball face onto a canvas            */
/* ------------------------------------------------------------------ */

function createBallTexture(color: string, letter: string, num: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  // Outer color
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight baked into the texture
  const specGrad = ctx.createRadialGradient(85, 75, 10, 128, 128, 128);
  specGrad.addColorStop(0, "rgba(255,255,255,0.4)");
  specGrad.addColorStop(0.25, "rgba(255,255,255,0.1)");
  specGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();

  // White inner circle
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(128, 128, 72, 0, Math.PI * 2);
  ctx.fill();

  // Subtle inner shadow
  const innerGrad = ctx.createRadialGradient(128, 118, 20, 128, 128, 72);
  innerGrad.addColorStop(0, "rgba(255,255,255,0)");
  innerGrad.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(128, 128, 72, 0, Math.PI * 2);
  ctx.fill();

  // Letter
  ctx.fillStyle = color;
  ctx.font = "bold 28px 'Russo One', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 128, 96);

  // Number
  ctx.fillStyle = "#0f1330";
  ctx.font = "bold 52px 'Russo One', sans-serif";
  ctx.fillText(String(num), 128, 148);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Single 3D Bingo Ball — uses shared geometry, disposes texture      */
/* ------------------------------------------------------------------ */

interface Ball3DProps {
  xSlot: number;
  color: string;
  letter: string;
  number: number;
  index: number;
}

function Ball3D({ xSlot, color, letter, number, index }: Ball3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Responsive positioning: derive X from viewport width
  const vw = useThree((s) => s.viewport.width);
  const x = xSlot * (vw / 7);
  const y = (index % 2 === 0 ? 0.2 : -0.15) * (vw / 6);

  // Each ball gets a unique phase offset so they wobble differently
  const phase = index * 1.3;

  // Create and dispose texture properly
  const texture = useMemo(
    () => createBallTexture(color, letter, number),
    [color, letter, number],
  );
  useEffect(() => () => { texture.dispose(); }, [texture]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      // Gentle wobble keeping the number face toward camera (±12°)
      groupRef.current.rotation.y = Math.sin(t * 0.8 + phase) * 0.2;
      groupRef.current.rotation.x = Math.sin(t * 0.6 + phase + 1) * 0.1;
    }
  });

  return (
    <Float
      speed={1.2 + index * 0.2}
      rotationIntensity={0.3}
      floatIntensity={0.6 + index * 0.08}
      floatingRange={[-0.1, 0.1]}
    >
      <group ref={groupRef} position={[x, y, 0]}>
        <mesh geometry={SHARED_SPHERE}>
          <meshStandardMaterial
            map={texture}
            roughness={0.18}
            metalness={0.08}
            envMapIntensity={0.6}
          />
        </mesh>
      </group>
    </Float>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating gold particles — InstancedMesh, reused dummy Object3D    */
/* ------------------------------------------------------------------ */

function FloatingParticles({ count = 30 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 6,
      z: (Math.random() - 0.5) * 4 - 2,
      speed: Math.random() * 0.5 + 0.1,
      offset: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      dummy.position.set(
        p.x + Math.sin(t * p.speed + p.offset) * 0.3,
        p.y + Math.cos(t * p.speed * 0.7 + p.offset) * 0.4,
        p.z,
      );
      dummy.scale.setScalar(0.02 + Math.sin(t * p.speed + p.offset) * 0.01);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#d4a24c" transparent opacity={0.3} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Adaptive camera — adjusts Z based on viewport to keep balls       */
/*  properly framed at any aspect ratio                                */
/* ------------------------------------------------------------------ */

function AdaptiveCamera() {
  const camera = useThree((s) => s.camera);
  const vw = useThree((s) => s.viewport.width);

  useEffect(() => {
    // Pull camera back on narrow viewports so balls aren't clipped
    const z = vw < 4 ? 6.5 : vw < 6 ? 5.5 : 5;
    camera.position.z = z;
    camera.updateProjectionMatrix();
  }, [vw, camera]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Main scene — responsive container, lightweight lighting            */
/* ------------------------------------------------------------------ */

export function BingoBallScene() {
  return (
    <div className="w-full" style={{ aspectRatio: "4 / 1", maxHeight: "14rem" }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <AdaptiveCamera />

        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} />
        <pointLight position={[-2, 1, 3]} intensity={0.4} color="#d4a24c" />

        {BALL_DATA.map((ball, i) => (
          <Ball3D
            key={ball.number}
            xSlot={ball.xSlot}
            color={ball.color}
            letter={ball.letter}
            number={ball.number}
            index={i}
          />
        ))}

        <FloatingParticles count={30} />
      </Canvas>
    </div>
  );
}
