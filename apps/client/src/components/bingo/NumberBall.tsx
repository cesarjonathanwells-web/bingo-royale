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
      return { letter: "", color: "#f59e0b" };
    }
    const l = getLetterForNumber(number);
    return { letter: l, color: BALL_COLORS[l] ?? "#f59e0b" };
  }, [number, is75]);

  return (
    <div className={cn("relative select-none shrink-0", animate && "animate-ball-entrance", className)}>
      <div
        className={cn(
          "relative rounded-full flex items-center justify-center font-extrabold",
          sizeClasses[size],
        )}
        style={{
          background: `radial-gradient(circle at 28% 22%, ${lighten(color, 60)}, ${lighten(color, 25)} 25%, ${color} 55%, ${darken(color, 30)} 80%, ${darken(color, 45)} 100%)`,
          boxShadow: `0 6px 16px ${color}55, 0 2px 6px rgba(0,0,0,0.4), 0 12px 24px rgba(0,0,0,0.15), inset 0 -3px 6px ${darken(color, 25)}80, inset 0 2px 6px ${lighten(color, 35)}50`,
        }}
      >
        {/* Specular highlight - brighter white spot */}
        <div
          className="absolute rounded-full"
          style={{
            width: size === "lg" ? "28px" : size === "md" ? "18px" : "12px",
            height: size === "lg" ? "14px" : size === "md" ? "9px" : "6px",
            top: size === "lg" ? "7px" : size === "md" ? "4px" : "2px",
            left: size === "lg" ? "12px" : size === "md" ? "9px" : "6px",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 80%)",
          }}
        />

        {/* Inner white circle */}
        <div
          className={cn(
            "rounded-full flex flex-col items-center justify-center leading-none",
            innerSizeClasses[size],
          )}
          style={{
            background: "radial-gradient(circle at 48% 38%, #ffffff, #f4f4f4 60%, #e8e8e8 85%, #ddd 100%)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.4)",
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
              color: "#0f1330",
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
      {/* Drop shadow ellipse below ball */}
      <div
        className="mx-auto rounded-full"
        style={{
          width: size === "lg" ? "65%" : "58%",
          height: size === "lg" ? "8px" : size === "md" ? "5px" : "3px",
          marginTop: size === "lg" ? "3px" : "2px",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.08) 50%, transparent 75%)",
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
