import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Shared geometry — created once                                     */
/* ------------------------------------------------------------------ */

const SHARED_SPHERE = new THREE.SphereGeometry(0.55, 32, 32);

const BALL_DATA = [
  { number: 7, color: "#3b82f6", letter: "B", slot: -2 },
  { number: 22, color: "#ef4444", letter: "I", slot: -1 },
  { number: 38, color: "#a78bfa", letter: "N", slot: 0 },
  { number: 51, color: "#22c55e", letter: "G", slot: 1 },
  { number: 65, color: "#f59e0b", letter: "O", slot: 2 },
] as const;

/* ------------------------------------------------------------------ */
/*  Texture factory                                                    */
/* ------------------------------------------------------------------ */

function createBallTexture(color: string, letter: string, num: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight baked in
  const specGrad = ctx.createRadialGradient(85, 75, 10, 128, 128, 128);
  specGrad.addColorStop(0, "rgba(255,255,255,0.4)");
  specGrad.addColorStop(0.25, "rgba(255,255,255,0.1)");
  specGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(128, 128, 72, 0, Math.PI * 2);
  ctx.fill();

  const innerGrad = ctx.createRadialGradient(128, 118, 20, 128, 128, 72);
  innerGrad.addColorStop(0, "rgba(255,255,255,0)");
  innerGrad.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(128, 128, 72, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.font = "bold 28px 'Russo One', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 128, 96);

  ctx.fillStyle = "#0f1330";
  ctx.font = "bold 52px 'Russo One', sans-serif";
  ctx.fillText(String(num), 128, 148);

  return new THREE.CanvasTexture(canvas);
}

/* ------------------------------------------------------------------ */
/*  Single Ball — no Float, manual bob + wobble                        */
/* ------------------------------------------------------------------ */

interface Ball3DProps {
  slot: number;
  color: string;
  letter: string;
  number: number;
  index: number;
}

function Ball3D({ slot, color, letter, number, index }: Ball3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const vw = useThree((s) => s.viewport.width);
  const x = slot * (vw / 7);
  const baseY = (index % 2 === 0 ? 0.15 : -0.1) * (vw / 6);
  const phase = index * 1.4;

  const texture = useMemo(
    () => createBallTexture(color, letter, number),
    [color, letter, number],
  );
  useEffect(() => () => { texture.dispose(); }, [texture]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    // Float up/down only — face forward, no rotation
    meshRef.current.position.x = x;
    meshRef.current.position.y = baseY + Math.sin(t * 0.7 + phase) * 0.12;
    meshRef.current.position.z = 0;
  });

  return (
    <mesh ref={meshRef} geometry={SHARED_SPHERE}>
      <meshStandardMaterial
        map={texture}
        roughness={0.18}
        metalness={0.08}
        envMapIntensity={0.5}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Gold particles                                                     */
/* ------------------------------------------------------------------ */

function FloatingParticles({ count = 25 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 5,
      z: (Math.random() - 0.5) * 3 - 2,
      speed: Math.random() * 0.4 + 0.1,
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
        p.y + Math.cos(t * p.speed * 0.7 + p.offset) * 0.3,
        p.z,
      );
      dummy.scale.setScalar(0.015 + Math.sin(t * p.speed + p.offset) * 0.008);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#d4a24c" transparent opacity={0.25} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Adaptive camera                                                    */
/* ------------------------------------------------------------------ */

function AdaptiveCamera() {
  const camera = useThree((s) => s.camera);
  const vw = useThree((s) => s.viewport.width);
  useEffect(() => {
    camera.position.z = vw < 4 ? 6 : vw < 6 ? 5.2 : 4.5;
    camera.updateProjectionMatrix();
  }, [vw, camera]);
  return null;
}

/* ------------------------------------------------------------------ */
/*  Scene                                                              */
/* ------------------------------------------------------------------ */

export function BingoBallScene() {
  return (
    <div className="w-[90vw] max-w-3xl mx-auto" style={{ aspectRatio: "5 / 2" }}>
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
            slot={ball.slot}
            color={ball.color}
            letter={ball.letter}
            number={ball.number}
            index={i}
          />
        ))}

        <FloatingParticles count={25} />
      </Canvas>
    </div>
  );
}
