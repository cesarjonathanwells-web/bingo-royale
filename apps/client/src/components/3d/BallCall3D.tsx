import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getLetterForNumber, BALL_COLORS } from "@bingo/shared";

/* ------------------------------------------------------------------ */
/*  CSS animated ball call — replaces WebGL version                    */
/* ------------------------------------------------------------------ */

interface BallCall3DProps {
  number: number | null;
  is75?: boolean;
  className?: string;
}

export function BallCall3D({ number, is75 = true, className }: BallCall3DProps) {
  const { letter, color } = useMemo(() => {
    if (!number) return { letter: "", color: "#f59e0b" };
    if (!is75 || number > 75) return { letter: "", color: "#f59e0b" };
    const l = getLetterForNumber(number);
    return { letter: l, color: BALL_COLORS[l] ?? "#f59e0b" };
  }, [number, is75]);

  if (!number) return null;

  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={number}
          className="flex items-center justify-center"
          initial={{ y: -40, scale: 0.3, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 25,
            mass: 0.8,
          }}
        >
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center relative"
            style={{
              background: `radial-gradient(circle at 32% 28%, ${lighten(color, 50)}, ${color} 50%, ${darken(color, 30)} 100%)`,
              boxShadow: `
                0 4px 15px ${color}66,
                0 0 25px ${color}33,
                inset 0 -3px 6px ${darken(color, 25)}80,
                inset 0 2px 6px ${lighten(color, 35)}50
              `,
            }}
          >
            {/* Specular highlight */}
            <div
              className="absolute rounded-full"
              style={{
                width: "40%",
                height: "22%",
                top: "12%",
                left: "18%",
                background: "radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.1) 50%, transparent 80%)",
              }}
            />

            {/* Inner white circle */}
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex flex-col items-center justify-center z-10"
              style={{
                background: "radial-gradient(circle at 48% 38%, #ffffff, #f4f4f4 60%, #e8e8e8 85%, #ddd 100%)",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.12)",
              }}
            >
              {is75 && number <= 75 && (
                <span
                  className="font-bold leading-none"
                  style={{ color, fontSize: "7px" }}
                >
                  {letter}
                </span>
              )}
              <span
                className="font-extrabold leading-none"
                style={{ color: "#0f1330", fontSize: "13px" }}
              >
                {number}
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Color helpers                                                      */
/* ------------------------------------------------------------------ */

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
