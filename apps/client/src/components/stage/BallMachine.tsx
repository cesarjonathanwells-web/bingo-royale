import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  BALL_RADIUS, agitate, createMachine, numberBalls, setSimmer, stepMachine, type Machine,
} from "@/lib/machine-physics";
import { cn } from "@/lib/utils";

/** Where the globe sits inside the rendered artwork (fractions of its width/height). */
export const MACHINE_ART = {
  aspect: 900 / 920,
  globeX: 0.406,
  globeY: 0.4315,
  /** Globe radius as a fraction of the artwork's width. */
  globeRadius: 0.2806,
  /** Top of the rail the delivered ball rests on, as a fraction of the height. */
  railY: 0.8795,
  /** Centre of the chute mouth. */
  mouthX: 0.8294,
  mouthY: 0.8149,
} as const;

const BALL_ART = ["b", "i", "n", "g", "o"] as const;
const BALL_FALLBACK = ["#3b82f6", "#ef4444", "#a78bfa", "#22c55e", "#f59e0b"];
const images = new Map<string, HTMLImageElement>();

function ballImage(key: string, onLoad: () => void): HTMLImageElement | null {
  let image = images.get(key);
  if (!image) {
    image = new Image();
    image.decoding = "async";
    image.src = `/images/unreal-balls/${key}.png`;
    images.set(key, image);
  }
  if (!image.complete) image.addEventListener("load", onLoad, { once: true });
  return image.complete && image.naturalWidth > 0 ? image : null;
}

interface BallMachineProps {
  /** Numbers called so far; each new call stirs the machine. */
  called: readonly number[];
  /** 75-ball uses the five column colours; 90-ball balls are all amber. */
  is75: boolean;
  /** False while the game is paused: the balls settle and stay still. */
  running: boolean;
  className?: string;
}

/** The ball machine: rendered artwork with live balls tumbling inside the globe. */
export function BallMachine({ called, is75, running, className }: BallMachineProps) {
  const reducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const built = useRef<{ machine: Machine; count: number; colors: number } | null>(null);
  const wakeRef = useRef<() => void>(() => {});
  const total = is75 ? 75 : 90;
  const callCount = called.length;
  // The globe shows up to 18 of the balls still to come, and empties at the end.
  const ballCount = Math.max(0, Math.min(18, total - callCount));
  const colors = is75 ? 5 : 1;

  // A new round or variant refills the globe; otherwise balls only leave it.
  if (!built.current || built.current.count < ballCount || built.current.colors !== colors) {
    built.current = { machine: createMachine(ballCount, 8, colors), count: ballCount, colors };
  }
  const machine = built.current.machine;
  if (machine.balls.length > ballCount) {
    machine.balls.length = ballCount;
    built.current.count = ballCount;
  }
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let last = 0;
    let visible = true;
    let disposed = false;

    const draw = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(canvas.clientWidth * scale);
      const height = Math.round(canvas.clientHeight * scale);
      if (width === 0 || height === 0) return;
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const radius = MACHINE_ART.globeRadius * width;
      const cx = MACHINE_ART.globeX * width;
      const cy = MACHINE_ART.globeY * height;
      context.clearRect(0, 0, width, height);
      context.save();
      context.beginPath();
      context.arc(cx, cy, radius * 0.985, 0, Math.PI * 2);
      context.clip();
      // Depth inside the glass.
      const depth = context.createRadialGradient(cx, cy - radius * 0.2, radius * 0.2, cx, cy, radius);
      const light = document.documentElement.classList.contains("light");
      depth.addColorStop(0, light ? "rgba(60, 70, 130, 0.03)" : "rgba(40, 46, 96, 0.10)");
      depth.addColorStop(1, light ? "rgba(40, 48, 100, 0.16)" : "rgba(4, 6, 20, 0.46)");
      context.fillStyle = depth;
      context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      for (const layer of [0, 1] as const) {
        for (const ball of machine.balls) {
          if (ball.layer !== layer) continue;
          const size = BALL_RADIUS * radius * (layer === 0 ? 0.94 : 1);
          // Back-layer balls sit half a ball over, so they show between the front ones.
          const x = cx + (ball.x + (layer === 0 ? 0.1 : 0)) * radius;
          const y = cy + (ball.y - (layer === 0 ? 0.07 : 0)) * radius;
          const key = is75 ? BALL_ART[ball.color % 5]! : "o";
          const image = ballImage(key, wake);
          // Soft contact shadow under each ball.
          context.fillStyle = "rgba(0, 0, 0, 0.28)";
          context.beginPath();
          context.ellipse(x + size * 0.08, y + size * 0.14, size, size, 0, 0, Math.PI * 2);
          context.fill();
          if (image) {
            context.drawImage(image, x - size, y - size, size * 2, size * 2);
          } else {
            context.fillStyle = is75 ? BALL_FALLBACK[ball.color % 5]! : BALL_FALLBACK[4]!;
            context.beginPath();
            context.arc(x, y, size, 0, Math.PI * 2);
            context.fill();
          }
          // The white number disc, foreshortened as the ball rolls.
          if (ball.nz > 0.05) {
            const discRadius = size * 0.52;
            context.save();
            context.beginPath();
            context.arc(x, y, size * 0.985, 0, Math.PI * 2);
            context.clip();
            context.translate(x + ball.nx * size * 0.9, y + ball.ny * size * 0.9);
            const toward = Math.atan2(ball.ny, ball.nx);
            context.rotate(toward);
            context.scale(Math.max(ball.nz, 0.04), 1);
            context.globalAlpha = Math.min(1, ball.nz * 4);
            context.fillStyle = "#f7f6f1";
            context.beginPath();
            context.arc(0, 0, discRadius, 0, Math.PI * 2);
            context.fill();
            if (ball.number && discRadius >= 5 * scale) {
              context.rotate(ball.spin - toward);
              context.fillStyle = "#12163a";
              context.font = `800 ${discRadius * (ball.number > 9 ? 1.02 : 1.2)}px Inter, system-ui, sans-serif`;
              context.textAlign = "center";
              context.textBaseline = "middle";
              context.fillText(String(ball.number), 0, discRadius * 0.06);
            }
            context.restore();
          }
          if (layer === 0) {
            context.fillStyle = "rgba(6, 8, 26, 0.34)";
            context.beginPath();
            context.arc(x, y, size, 0, Math.PI * 2);
            context.fill();
          }
        }
      }
      context.restore();
    };

    const tick = (now: number) => {
      frame = 0;
      if (disposed) return;
      const seconds = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      const moving = stepMachine(machine, seconds);
      draw();
      if (moving && visible && !document.hidden) frame = requestAnimationFrame(tick);
      else last = 0;
    };
    const wake = () => {
      if (disposed) return;
      if (reducedMotion) { draw(); return; }
      if (!frame) frame = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;

    const resize = new ResizeObserver(() => { draw(); wake(); });
    resize.observe(canvas);
    const watcher = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) wake();
    });
    watcher.observe(canvas);
    const onVisibility = () => { if (!document.hidden) wake(); };
    document.addEventListener("visibilitychange", onVisibility);
    draw();
    wake();

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      watcher.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [machine, is75, reducedMotion]);

  // Each call turns the blower up; between calls the pile pops gently.
  const previousCalls = useRef(callCount);
  useEffect(() => {
    // Balls only ever carry numbers that are still to be called.
    numberBalls(machine, new Set(called), total, is75);
    if (!reducedMotion) {
      setSimmer(machine, running);
      if (callCount > previousCalls.current && running) agitate(machine, 1);
    }
    previousCalls.current = callCount;
    wakeRef.current();
  }, [machine, called, callCount, total, is75, running, reducedMotion, ballCount]);

  return (
    <span className={cn("ball-machine", className)} aria-hidden="true">
      <img className="ball-machine__layer" src="/images/stage/machine-back.webp" alt="" draggable={false} />
      <canvas ref={canvasRef} className="ball-machine__layer" />
      <img className="ball-machine__layer" src="/images/stage/machine-front.webp" alt="" draggable={false} />
    </span>
  );
}
