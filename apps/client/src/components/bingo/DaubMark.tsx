import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./daub-feedback.css";

interface DaubMarkProps {
  marked: boolean;
  color: string;
  seed: number | string;
  className?: string;
}

const INK_EDGES = [
  "49% 51% 46% 54% / 48% 45% 55% 52%",
  "46% 54% 51% 49% / 53% 48% 52% 47%",
  "52% 48% 54% 46% / 46% 53% 47% 54%",
];

function seedHash(seed: number | string): number {
  let hash = 2166136261;
  for (const character of String(seed)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Existing marks mount silently; only a newly confirmed mark gets an impact. */
export function DaubMark({ marked, color, seed, className }: DaubMarkProps) {
  const reducedMotion = usePrefersReducedMotion();
  const previous = useRef({ marked, seed });
  const burstId = useRef(0);
  const [freshBurst, setFreshBurst] = useState<number | null>(null);
  const hash = seedHash(seed);
  const fresh = freshBurst !== null;

  useLayoutEffect(() => {
    const sameCell = previous.current.seed === seed;
    const newlyMarked = sameCell && marked && !previous.current.marked;
    previous.current = { marked, seed };
    if (!marked || !sameCell || reducedMotion) {
      setFreshBurst(null);
      return;
    }
    if (!newlyMarked) return;
    burstId.current += 1;
    setFreshBurst(burstId.current);
  }, [marked, seed, reducedMotion]);

  useEffect(() => {
    if (freshBurst === null) return;
    const timer = window.setTimeout(() => setFreshBurst(null), 680);
    return () => window.clearTimeout(timer);
  }, [freshBurst]);

  if (!marked) return null;

  return (
    <span className={cn("daub-mark-layer", fresh && "daub-mark-layer--fresh", className)} aria-hidden="true"
      style={{ "--daub-color": color, "--daub-rotation": `${(hash % 19) - 9}deg` } as CSSProperties}>
      <span key={`ink-${freshBurst ?? "settled"}`} className={cn("daub-ink", fresh && "daub-ink--fresh")}
        style={{ borderRadius: INK_EDGES[hash % INK_EDGES.length] }} />
      {fresh && !reducedMotion && <span key={`burst-${freshBurst}`} className="daub-burst">
        <span className="daub-impact-ring" />
        {Array.from({ length: 6 }, (_, index) => {
          const angle = (index * Math.PI * 2 / 6) + ((hash % 30) * Math.PI / 180);
          const distance = 37 + ((hash >>> (index * 3)) % 13);
          return <span key={index} className="daub-particle" style={{
            "--particle-x": `${Math.cos(angle) * distance}%`,
            "--particle-y": `${Math.sin(angle) * distance}%`,
            "--particle-delay": `${index % 3 * 12}ms`,
            "--particle-size": `${2.5 + index % 2}px`,
          } as CSSProperties}><i /></span>;
        })}
      </span>}
    </span>
  );
}
