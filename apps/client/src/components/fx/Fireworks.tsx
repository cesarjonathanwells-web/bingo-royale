import { useEffect, useRef, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Canvas fireworks system for win celebrations                       */
/* ------------------------------------------------------------------ */

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  trail: { x: number; y: number; alpha: number }[];
}

interface Rocket {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  color: string;
  exploded: boolean;
}

const COLORS = [
  "#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA",
  "#F59E0B", "#3B82F6", "#EF4444", "#22C55E",
  "#EC4899", "#06B6D4", "#F97316", "#8B5CF6",
];

export function Fireworks({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const rocketsRef = useRef<Rocket[]>([]);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(active);

  activeRef.current = active;

  const launchRocket = useCallback((w: number, h: number) => {
    rocketsRef.current.push({
      x: Math.random() * w * 0.6 + w * 0.2,
      y: h,
      vy: -(Math.random() * 4 + 6),
      targetY: Math.random() * h * 0.4 + h * 0.1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      exploded: false,
    });
  }, []);

  const explode = useCallback((x: number, y: number, color: string) => {
    const count = 60 + Math.floor(Math.random() * 40);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = Math.random() * 4 + 1.5;
      sparksRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.5 + 0.8,
        color,
        alpha: 1,
        decay: 0.008 + Math.random() * 0.008,
        trail: [],
      });
    }

    // Crossette (secondary bursts)
    if (Math.random() > 0.5) {
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const speed = Math.random() * 2 + 3;
        const secondaryColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        sparksRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 1.5 + 1.5,
          color: secondaryColor,
          alpha: 1,
          decay: 0.012 + Math.random() * 0.006,
          trail: [],
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let frameCount = 0;

    const animate = () => {
      if (!activeRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // Semi-transparent clear for trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      frameCount++;

      // Launch rockets periodically
      if (frameCount % 25 === 0) {
        launchRocket(canvas.width, canvas.height);
      }
      if (frameCount % 40 === 0) {
        launchRocket(canvas.width, canvas.height);
      }

      // Update rockets
      for (const rocket of rocketsRef.current) {
        if (rocket.exploded) continue;

        rocket.y += rocket.vy;
        rocket.vy += 0.02; // slight drag

        // Draw rocket trail
        ctx.beginPath();
        ctx.arc(rocket.x, rocket.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = rocket.color;
        ctx.fill();

        // Trail sparks
        ctx.beginPath();
        ctx.arc(
          rocket.x + (Math.random() - 0.5) * 3,
          rocket.y + Math.random() * 8,
          1,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = "rgba(255,200,50,0.6)";
        ctx.fill();

        if (rocket.y <= rocket.targetY) {
          rocket.exploded = true;
          explode(rocket.x, rocket.y, rocket.color);
        }
      }

      // Clean up exploded rockets
      rocketsRef.current = rocketsRef.current.filter((r) => !r.exploded);

      // Update sparks
      for (const spark of sparksRef.current) {
        if (spark.alpha <= 0) continue;

        // Store trail
        spark.trail.push({ x: spark.x, y: spark.y, alpha: spark.alpha * 0.5 });
        if (spark.trail.length > 5) spark.trail.shift();

        // Draw trail
        for (const t of spark.trail) {
          ctx.beginPath();
          ctx.arc(t.x, t.y, spark.radius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = spark.color;
          ctx.globalAlpha = t.alpha * 0.3;
          ctx.fill();
        }

        // Draw spark
        ctx.globalAlpha = spark.alpha;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
        ctx.fillStyle = spark.color;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.radius * 3, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(
          spark.x, spark.y, 0,
          spark.x, spark.y, spark.radius * 3,
        );
        grad.addColorStop(0, spark.color + "40");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.globalAlpha = 1;

        // Physics
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vx *= 0.98;
        spark.vy *= 0.98;
        spark.vy += 0.04; // gravity
        spark.alpha -= spark.decay;
        spark.radius *= 0.997;
      }

      // Clean up dead sparks
      sparksRef.current = sparksRef.current.filter((s) => s.alpha > 0);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      sparksRef.current = [];
      rocketsRef.current = [];
    };
  }, [active, launchRocket, explode]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
