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
      className="shrink-0 px-2 pt-1 pb-2"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        background: "linear-gradient(to top, rgba(5,5,17,0.9), transparent)",
      }}
    >
      <button
        onClick={onClaim}
        disabled={disabled}
        className={cn(
          "w-full py-3.5 rounded-xl",
          "font-gaming text-2xl tracking-[0.2em] text-white uppercase",
          "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500",
          "hover:from-amber-400 hover:via-yellow-300 hover:to-amber-400",
          "active:scale-[0.97] transition-all duration-150",
          "shadow-lg shadow-amber-500/25",
          "select-none cursor-pointer",
          "border border-yellow-300/40",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        )}
        style={{
          textShadow: "0 0 15px rgba(255, 215, 0, 0.7), 0 0 40px rgba(255, 215, 0, 0.3), 0 2px 4px rgba(0,0,0,0.4)",
        }}
      >
        {t("game.bingo")}
      </button>
    </div>
  );
}
