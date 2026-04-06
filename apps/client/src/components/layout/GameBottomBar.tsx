import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GameBottomBarProps {
  onClaim: () => void;
  disabled?: boolean;
}

export function GameBottomBar({ onClaim, disabled = false }: GameBottomBarProps) {
  const { t } = useTranslation("game");

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
        )}
        style={{
          textShadow: "0 0 15px rgba(255, 215, 0, 0.7), 0 0 40px rgba(255, 215, 0, 0.3), 0 2px 4px rgba(0,0,0,0.4)",
        }}
        whileHover={!disabled ? {
          scale: 1.02,
          boxShadow: "0 0 30px rgba(255,215,0,0.4), 0 0 60px rgba(255,215,0,0.15), 0 8px 25px rgba(245,158,11,0.3)",
        } : undefined}
        whileTap={!disabled ? { scale: 0.96 } : undefined}
        animate={!disabled ? {
          boxShadow: [
            "0 4px 15px rgba(245,158,11,0.25)",
            "0 4px 25px rgba(255,215,0,0.35), 0 0 40px rgba(255,215,0,0.1)",
            "0 4px 15px rgba(245,158,11,0.25)",
          ],
        } : undefined}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
          boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        {t("game.bingo")}
      </motion.button>
    </div>
  );
}
