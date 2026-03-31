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
      className="fixed bottom-0 left-0 right-0 z-40 px-2 pt-1 pb-1 bg-[var(--color-bg-primary)]/90 backdrop-blur-lg border-t border-[var(--color-border)]/30 safe-bottom"
      style={{ minHeight: "52px" }}
    >
      <button
        onClick={onClaim}
        disabled={disabled}
        className={cn(
          "w-full py-3 rounded-xl",
          "text-xl font-black tracking-wider text-white uppercase",
          "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500",
          "hover:from-amber-400 hover:via-orange-400 hover:to-red-400",
          "active:scale-[0.97] transition-all duration-150",
          "animate-bingo-glow",
          "select-none cursor-pointer",
          "border-t border-amber-300/30",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        )}
        style={{
          textShadow: "0 2px 4px rgba(0,0,0,0.3)",
        }}
      >
        {t("game.bingo")}
      </button>
    </div>
  );
}
