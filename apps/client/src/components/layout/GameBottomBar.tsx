import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GameBottomBarProps {
  onClaim: () => void;
  disabled?: boolean;
  ready?: boolean;
}

export function GameBottomBar({ onClaim, disabled = false, ready = false }: GameBottomBarProps) {
  const { t } = useTranslation("game");
  const reduceMotion = usePrefersReducedMotion();

  return (
    <div
      className="shrink-0 px-2 pt-1 pb-2"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        background: "linear-gradient(to top, rgba(5,5,17,0.9), transparent)",
      }}
    >
      <motion.button
        onClick={onClaim}
        disabled={disabled}
        className={cn(
          "w-full py-3.5 rounded-xl",
          "font-gaming text-2xl tracking-[0.2em] text-white uppercase",
          "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500",
          "shadow-lg shadow-amber-500/25",
          "select-none cursor-pointer",
          "border border-yellow-300/40",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          ready && !disabled && "board-claim-ready",
        )}
        style={{
          textShadow: "0 0 15px rgba(255, 215, 0, 0.7), 0 0 40px rgba(255, 215, 0, 0.3), 0 2px 4px rgba(0,0,0,0.4)",
        }}
        aria-description={ready ? t("game.patternMarked") : undefined}
        whileHover={!disabled && !reduceMotion ? {
          scale: 1.02,
          boxShadow: "0 0 30px rgba(255,215,0,0.4), 0 0 60px rgba(255,215,0,0.15), 0 8px 25px rgba(245,158,11,0.3)",
        } : undefined}
        whileTap={!disabled && !reduceMotion ? { scale: 0.96 } : undefined}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
        }}
      >
        {t("game.bingo")}
      </motion.button>
    </div>
  );
}

