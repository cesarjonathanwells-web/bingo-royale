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
    <div className={cn("relative select-none shrink-0", animate && "animate-ball-entrance", className)}>
      <div
        className={cn(
          "relative rounded-full flex items-center justify-center font-extrabold",
          sizeClasses[size],
        )}
        style={{
          background: `radial-gradient(circle at 30% 25%, ${lighten(color, 50)}, ${lighten(color, 20)} 30%, ${color} 60%, ${darken(color, 35)} 100%)`,
          boxShadow: `0 4px 12px ${color}66, 0 2px 4px rgba(0,0,0,0.3), inset 0 -2px 4px ${darken(color, 20)}80, inset 0 2px 4px ${lighten(color, 30)}60`,
        }}
      >
        {/* Specular highlight */}
        <div
          className="absolute rounded-full"
          style={{
            width: size === "lg" ? "24px" : size === "md" ? "16px" : "10px",
            height: size === "lg" ? "12px" : size === "md" ? "8px" : "5px",
            top: size === "lg" ? "8px" : size === "md" ? "5px" : "3px",
            left: size === "lg" ? "14px" : size === "md" ? "10px" : "7px",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 70%)",
          }}
        />

        {/* Inner white circle */}
        <div
          className={cn(
            "rounded-full flex flex-col items-center justify-center leading-none",
            innerSizeClasses[size],
          )}
          style={{
            background: "radial-gradient(circle at 50% 40%, #ffffff, #f0f0f0 70%, #e0e0e0 100%)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.3)",
          }}
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
      {/* Drop shadow below ball */}
      <div
        className="mx-auto rounded-full"
        style={{
          width: size === "lg" ? "60%" : "55%",
          height: size === "lg" ? "6px" : size === "md" ? "4px" : "3px",
          marginTop: size === "lg" ? "4px" : "2px",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.2) 0%, transparent 70%)",
        }}
      />
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
