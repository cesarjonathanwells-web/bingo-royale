import { BingoBallBody } from "@/components/3d/BingoBallBody";
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
      <BingoBallBody letter={letter} color={color} className={cn("font-extrabold", sizeClasses[size])}>
        {/* Inner white circle */}
        <div
          className={cn(
            "relative z-10 rounded-full flex flex-col items-center justify-center leading-none",
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
      </BingoBallBody>
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
