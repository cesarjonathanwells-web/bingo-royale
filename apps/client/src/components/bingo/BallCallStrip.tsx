import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { GameState, BingoVariant } from "@bingo/shared";
import { BallCall3D } from "@/components/3d/BallCall3D";
import { BallMachine } from "@/components/stage/BallMachine";
import { NumberBall } from "./NumberBall";
import { cn } from "@/lib/utils";
import "./call-stage.css";

interface BallCallStripProps {
  gameState: GameState;
  variant: BingoVariant;
  onPress: () => void;
  /** "strip" sits in the header; "panel" is the large stage beside the card on wide screens. */
  layout?: "strip" | "panel";
}

/**
 * The call stage: the ball machine, the current ball rolling out of its chute,
 * and the most recent calls lined up newest first.
 * Tapping opens the full called numbers dropdown.
 */
export function BallCallStrip({
  gameState,
  variant,
  onPress,
  layout = "strip",
}: BallCallStripProps) {
  const { t } = useTranslation("game");
  const reducedMotion = usePrefersReducedMotion();
  const is75 = variant === "75";
  const total = is75 ? 75 : 90;
  const panel = layout === "panel";
  const called = gameState.calledNumbers;

  const { currentNumber, previous } = useMemo(() => {
    const current = called.length > 0 ? called[called.length - 1]! : null;
    // Calls before the current one, newest first.
    const earlier = called.length > 1 ? called.slice(panel ? -6 : -4, -1).reverse() : [];
    return { currentNumber: current, previous: earlier };
  }, [called, panel]);

  const history = (
    <span className="call-stage__history">
      <AnimatePresence mode="popLayout" initial={false}>
        {previous.map((n, idx) => (
          <motion.span
            key={n}
            className="call-stage__past"
            layout={!reducedMotion}
            initial={reducedMotion ? false : { scale: 0.6, opacity: 0, x: -24 }}
            animate={{ scale: 1, opacity: 1 - idx * (panel ? 0.14 : 0.22), x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0, x: 16 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 32 }}
          >
            <NumberBall number={n} is75={is75} size={panel ? "md" : "sm"} />
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );

  return (
    <button
      onClick={onPress}
      className={cn(
        "game-call-strip call-stage cursor-pointer select-none transition-colors",
        panel ? "call-stage--panel" : cn(
          "w-full px-3 bg-[var(--color-bg-secondary)]/60 border-b border-[var(--color-border)]/40",
          "hover:bg-[var(--color-bg-secondary)]/80",
        ),
      )}
      aria-label={t("game.tapHistory")}
    >
      <span className="call-stage__inner">
        <BallMachine
          className="call-stage__machine"
          called={called}
          is75={is75}
          running={!gameState.paused}
        />
        <span className="call-stage__rail" aria-hidden="true" />

        {/* The current ball rolls out of the chute */}
        <span className="call-stage__current">
          {currentNumber ? (
            <BallCall3D number={currentNumber} is75={is75} stage />
          ) : (
            <span className="call-stage__waiting">{t("game.noNumberYet")}</span>
          )}
        </span>

        {!panel && history}
      </span>

      {panel && (
        <span className="call-stage__recent">
          {history}
          <span className="call-stage__count">
            {t("game.calledOf", { called: called.length, total })}
          </span>
        </span>
      )}
    </button>
  );
}
