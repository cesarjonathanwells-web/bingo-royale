import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface GameBottomBarProps {
  onClaim: () => void;
  disabled?: boolean;
}

export function GameBottomBar({ onClaim, disabled = false }: GameBottomBarProps) {
  const { t } = useTranslation("game");

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-2 pt-1 pb-1 bg-[var(--color-bg-primary)]/90 backdrop-blur-lg safe-bottom"
      style={{ minHeight: "52px", borderTop: '1px solid rgba(255, 215, 0, 0.2)' }}
    >
      <button
        onClick={onClaim}
        disabled={disabled}
        className={cn(
          "w-full py-3 rounded-xl",
          "text-xl font-black tracking-wider text-white uppercase",
          "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600",
          "hover:from-amber-300 hover:via-yellow-400 hover:to-amber-500",
          "active:scale-[0.97] transition-all duration-150",
          "animate-bingo-glow animate-gold-pulse",
          "select-none cursor-pointer",
          "border-t border-yellow-300/30",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        )}
        style={{
          textShadow: "0 0 10px rgba(255, 215, 0, 0.5), 0 2px 4px rgba(0,0,0,0.3)",
        }}
      >
        {t("game.bingo")}
      </button>
    </div>
  );
}
