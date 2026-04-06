import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Single 3D Bingo Ball                                               */
/* ------------------------------------------------------------------ */

interface Ball3DProps {
  position: [number, number, number];
  color: string;
  letter: string;
  number: number;
  floatSpeed?: number;
  floatIntensity?: number;
  rotationSpeed?: number;
}

function Ball3D({
  position,
  color,
  letter,
  number,
  floatSpeed = 1,
  floatIntensity = 1,
  rotationSpeed = 0.3,
}: Ball3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  // Create canvas texture for ball face (letter + number)
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Draw the ball's outer color
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.fill();

    // White stripe/circle for number
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(128, 128, 72, 0, Math.PI * 2);
    ctx.fill();

    // Subtle inner shadow on white circle
    const grad = ctx.createRadialGradient(128, 118, 20, 128, 128, 72);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.06)");
    ctx.fillStyle = grad;
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
    ctx.fillText(String(number), 128, 148);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [color, letter, number]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * rotationSpeed;
      groupRef.current.rotation.x += delta * rotationSpeed * 0.3;
    }
  });

  return (
    <Float
      speed={floatSpeed}
      rotationIntensity={0.4}
      floatIntensity={floatIntensity}
      floatingRange={[-0.15, 0.15]}
    >
      <group ref={groupRef} position={position}>
        <mesh ref={meshRef} castShadow>
          <sphereGeometry args={[0.42, 64, 64]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.15}
            metalness={0.1}
            envMapIntensity={0.8}
          />
        </mesh>
        {/* Specular highlight sphere (inner glow) */}
        <mesh scale={[0.43, 0.43, 0.43]}>
          <sphereGeometry args={[0.42, 32, 32]} />
          <meshStandardMaterial
            transparent
            opacity={0.08}
            color="#ffffff"
            roughness={0}
            metalness={1}
          />
        </mesh>
      </group>
    </Float>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating particles in the background                               */
/* ------------------------------------------------------------------ */

function FloatingParticles({ count = 50 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6 - 2,
      ),
      speed: Math.random() * 0.5 + 0.1,
      offset: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const dummy = new THREE.Object3D();

    particles.forEach((p, i) => {
      dummy.position.set(
        p.position.x + Math.sin(t * p.speed + p.offset) * 0.3,
        p.position.y + Math.cos(t * p.speed * 0.7 + p.offset) * 0.4,
        p.position.z,
      );
      dummy.scale.setScalar(0.02 + Math.sin(t * p.speed + p.offset) * 0.01);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#d4a24c" transparent opacity={0.3} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Main scene exported for the Home page                              */
/* ------------------------------------------------------------------ */

const BALLS = [
  { number: 7, color: "#3b82f6", letter: "B", pos: [-1.8, 0.3, 0] as [number, number, number] },
  { number: 22, color: "#ef4444", letter: "I", pos: [-0.8, -0.2, 0.5] as [number, number, number] },
  { number: 38, color: "#a78bfa", letter: "N", pos: [0.0, 0.35, -0.3] as [number, number, number] },
  { number: 51, color: "#22c55e", letter: "G", pos: [0.8, -0.15, 0.3] as [number, number, number] },
  { number: 65, color: "#f59e0b", letter: "O", pos: [1.8, 0.25, -0.2] as [number, number, number] },
];

export function BingoBallScene() {
  return (
    <div className="w-full h-28 sm:h-48 lg:h-64">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <pointLight position={[-3, 2, 4]} intensity={0.6} color="#d4a24c" />
        <pointLight position={[3, -2, 3]} intensity={0.3} color="#a78bfa" />

        <Environment preset="city" />

        {BALLS.map((ball, i) => (
          <Ball3D
            key={ball.number}
            position={ball.pos}
            color={ball.color}
            letter={ball.letter}
            number={ball.number}
            floatSpeed={1.2 + i * 0.2}
            floatIntensity={0.8 + i * 0.1}
            rotationSpeed={0.2 + i * 0.08}
          />
        ))}

        <FloatingParticles count={40} />
      </Canvas>
    </div>
  );
}
