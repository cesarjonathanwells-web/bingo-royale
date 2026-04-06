import { useMemo, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { GameState, BingoVariant } from "@bingo/shared";
import { NumberBall } from "./NumberBall";
import { cn } from "@/lib/utils";

const BallCall3D = lazy(() =>
  import("@/components/3d/BallCall3D").then((m) => ({ default: m.BallCall3D })),
);

interface BallCallStripProps {
  gameState: GameState;
  variant: BingoVariant;
  onPress: () => void;
}

/**
 * Always-visible strip showing the current ball (25% larger) and
 * the last 3 called balls with progressive fade.
 * Tapping opens the full called numbers dropdown.
 */
export function BallCallStrip({
  gameState,
  variant,
  onPress,
}: BallCallStripProps) {
  const { t } = useTranslation("game");
  const is75 = variant === "75";

  const { currentNumber, previousThree } = useMemo(() => {
    const called = gameState.calledNumbers;
    const current = called.length > 0 ? called[called.length - 1]! : null;
    // Last 3 before the current, newest first
    const prev = called.length > 1
      ? called.slice(-4, -1).reverse()
      : [];
    return { currentNumber: current, previousThree: prev };
  }, [gameState.calledNumbers]);

  return (
    <button
      onClick={onPress}
      className={cn(
        "w-full flex items-center justify-center gap-3 px-3 py-1.5",
        "bg-[var(--color-bg-secondary)]/60 border-b border-[var(--color-border)]/40",
        "cursor-pointer select-none hover:bg-[var(--color-bg-secondary)]/80 transition-colors",
      )}
      aria-label={t("game.tapHistory")}
    >
      {/* Previous 3 balls - oldest to newest (left to right) */}
      <div className="flex items-center gap-2">
        <AnimatePresence mode="popLayout">
          {previousThree.length > 0
            ? [...previousThree].reverse().map((n, idx) => {
                const opacity = 0.35 + idx * 0.2;
                return (
                  <motion.div
                    key={n}
                    initial={{ scale: 0, opacity: 0, x: 30 }}
                    animate={{ scale: 1, opacity, x: 0 }}
                    exit={{ scale: 0, opacity: 0, x: -20 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <NumberBall number={n} is75={is75} size="sm" />
                  </motion.div>
                );
              })
            : Array.from({ length: 3 }, (_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-9 h-9 rounded-full bg-[var(--color-bg-tertiary)]/40 border border-[var(--color-border)]/30"
                  style={{ opacity: 0.35 + i * 0.2 }}
                />
              ))}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-[var(--color-border)]/40" />

      {/* Current ball - 3D animated */}
      <div className="relative">
        {currentNumber ? (
          <Suspense
            fallback={
              <div className="transform scale-125 origin-center animate-ball-pulse">
                <NumberBall number={currentNumber} is75={is75} size="sm" animate />
              </div>
            }
          >
            <BallCall3D
              number={currentNumber}
              is75={is75}
              className="w-20 sm:w-24 -my-6 sm:-my-7"
            />
          </Suspense>
        ) : (
          <div className="w-9 h-9 rounded-full bg-[var(--color-bg-tertiary)]/60 border border-[var(--color-border)] flex items-center justify-center">
            <span className="text-[8px] text-[var(--color-text-muted)]">--</span>
          </div>
        )}
      </div>
    </button>
  );
}
