import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { BingoBallBody } from "./BingoBallBody";
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
  const reducedMotion = usePrefersReducedMotion();
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
          initial={reducedMotion ? false : { y: -40, scale: 0.3, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : {
            type: "spring",
            stiffness: 500,
            damping: 25,
            mass: 0.8,
          }}
        >
          <BingoBallBody letter={letter} color={color} active className="w-12 h-12 sm:w-14 sm:h-14">
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
          </BingoBallBody>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
