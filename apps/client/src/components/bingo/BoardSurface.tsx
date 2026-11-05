import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./board-experience.css";

export interface BoardFeedbackProps {
  currentNumber?: number | null;
  calledNumbers?: ReadonlySet<number>;
  winningCells?: ReadonlySet<number>;
  nearWinCells?: ReadonlySet<number>;
}

interface BoardSurfaceProps {
  children: ReactNode;
  completed?: boolean;
  nearWin?: boolean;
  className?: string;
}

/** A quiet resting frame; a brief light sweep rewards a newly marked pattern. */
export function BoardSurface({ children, completed = false, nearWin = false, className }: BoardSurfaceProps) {
  const reduceMotion = usePrefersReducedMotion();
  const previous = useRef(completed);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    const fresh = completed && !previous.current;
    previous.current = completed;
    if (!fresh || reduceMotion) {
      setCelebrating(false);
      return;
    }
    setCelebrating(true);
    const timer = window.setTimeout(() => setCelebrating(false), 1000);
    return () => window.clearTimeout(timer);
  }, [completed, reduceMotion]);

  return (
    <div className={cn("bingo-board @container w-full mx-auto rounded-xl sm:rounded-2xl overflow-hidden glass-card", className)}
      data-completed={completed || undefined} data-near-win={nearWin && !completed || undefined}
      data-celebrating={celebrating || undefined}>
      <span className="bingo-board__sheen" aria-hidden="true" />
      <span className="bingo-board__sparkles" aria-hidden="true">✦</span>
      {children}
    </div>
  );
}
