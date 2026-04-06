import { useEffect, useRef, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Canvas-based ink splat particle system for daub feedback            */
/* ------------------------------------------------------------------ */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  rotation: number;
  rotSpeed: number;
}

interface DabSplashProps {
  /** Triggers on every change — pass a counter or timestamp */
  trigger: number;
  /** Center X in pixels relative to the container */
  x: number;
  /** Center Y in pixels relative to the container */
  y: number;
  /** Splash color */
  color: string;
  /** Container width */
  width: number;
  /** Container height */
  height: number;
}

export function DabSplash({ trigger, x, y, color, width, height }: DabSplashProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  const spawn = useCallback(() => {
    const particles: Particle[] = [];

    // Central splat
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 3 + 2;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 4 + 2,
        color,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.015,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
      });
    }

    // Tiny droplets
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 3;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2 + 0.5,
        color,
        alpha: 0.8,
        decay: 0.03 + Math.random() * 0.02,
        rotation: 0,
        rotSpeed: 0,
      });
    }

    // Ring / shockwave dots
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * 1.5,
        vy: Math.sin(angle) * 1.5,
        radius: Math.random() * 3 + 3,
        color: lightenColor(color, 40),
        alpha: 0.6,
        decay: 0.025,
        rotation: 0,
        rotSpeed: 0,
      });
    }

    particlesRef.current = particles;
  }, [x, y, color]);

  useEffect(() => {
    if (trigger === 0) return;
    spawn();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      const particles = particlesRef.current;
      let alive = false;

      for (const p of particles) {
        if (p.alpha <= 0) continue;
        alive = true;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        // Draw ink splat shape
        ctx.beginPath();
        ctx.fillStyle = p.color;
        // Irregular blob shape
        for (let a = 0; a < Math.PI * 2; a += 0.3) {
          const r = p.radius * (0.8 + Math.sin(a * 3) * 0.2);
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Physics
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.vy += 0.08; // gravity
        p.alpha -= p.decay;
        p.rotation += p.rotSpeed;
        p.radius *= 0.98;
      }

      if (alive) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trigger, spawn, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none z-20"
      style={{ mixBlendMode: "screen" }}
    />
  );
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 255) + Math.round((255 * percent) / 100));
  const g = Math.min(255, ((num >> 8) & 255) + Math.round((255 * percent) / 100));
  const b = Math.min(255, (num & 255) + Math.round((255 * percent) / 100));
  return `rgb(${r},${g},${b})`;
}
