import { useMemo } from "react";
import { getLetterForNumber, BALL_COLORS } from "@bingo/shared";
import { cn } from "@/lib/utils";

type BallSize = "sm" | "md" | "lg";

interface NumberBallProps {
  number: number;
  /** Whether this is a 75-ball game (shows letter prefix) */
  is75?: boolean;
  size?: BallSize;
  animate?: boolean;
  className?: string;
}

const sizeClasses: Record<BallSize, string> = {
  sm: "w-9 h-9 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-20 h-20 text-2xl",
};

const innerSizeClasses: Record<BallSize, string> = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-14 h-14 text-lg",
};

export function NumberBall({
  number,
  is75 = true,
  size = "md",
  animate = false,
  className,
}: NumberBallProps) {
  const { letter, color } = useMemo(() => {
    if (!is75 || number > 75) {
      return { letter: "", color: "#6366f1" };
    }
    const l = getLetterForNumber(number);
    return { letter: l, color: BALL_COLORS[l] ?? "#6366f1" };
  }, [number, is75]);

  return (
    <div
      className={cn(
        "relative rounded-full flex items-center justify-center font-extrabold shadow-lg select-none shrink-0",
        sizeClasses[size],
        animate && "animate-ball-entrance",
        className,
      )}
      style={{
        background: `radial-gradient(circle at 35% 35%, ${lighten(color, 40)}, ${color} 60%, ${darken(color, 30)} 100%)`,
      }}
    >
      {/* Inner white circle */}
      <div
        className={cn(
          "rounded-full bg-white/90 flex flex-col items-center justify-center leading-none",
          innerSizeClasses[size],
        )}
      >
        {is75 && number <= 75 && (
          <span
            className="font-bold leading-none"
            style={{
              color,
              fontSize: size === "lg" ? "10px" : size === "md" ? "8px" : "6px",
            }}
          >
            {letter}
          </span>
        )}
        <span
          className="font-extrabold leading-none"
          style={{
            color: "#1e293b",
            fontSize:
              size === "lg"
                ? "18px"
                : size === "md"
                  ? "13px"
                  : "10px",
          }}
        >
          {number}
        </span>
      </div>
    </div>
  );
}

function lighten(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 255) + Math.round((255 * percent) / 100));
  const g = Math.min(255, ((num >> 8) & 255) + Math.round((255 * percent) / 100));
  const b = Math.min(255, (num & 255) + Math.round((255 * percent) / 100));
  return `rgb(${r}, ${g}, ${b})`;
}

function darken(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((num >> 16) & 255) - Math.round((255 * percent) / 100));
  const g = Math.max(0, ((num >> 8) & 255) - Math.round((255 * percent) / 100));
  const b = Math.max(0, (num & 255) - Math.round((255 * percent) / 100));
  return `rgb(${r}, ${g}, ${b})`;
}
