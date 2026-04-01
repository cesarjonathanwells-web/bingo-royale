import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { LETTERS, BALL_COLORS, FREE_SPACE_INDEX } from "@bingo/shared";
import { cn } from "@/lib/utils";

interface BingoCellProps {
  index: number;
  value: number | null;
  column: number;
  dabbed: boolean;
  onDab: (index: number) => void;
  disabled?: boolean;
}

export function BingoCell({
  index,
  value,
  column,
  dabbed,
  onDab,
  disabled = false,
}: BingoCellProps) {
  const { t } = useTranslation("game");
  const isFree = index === FREE_SPACE_INDEX;
  const letter = LETTERS[column];
  const columnColor = letter ? BALL_COLORS[letter] : "#f59e0b";

  const handleClick = useCallback(() => {
    if (disabled || isFree) return;
    onDab(index);
  }, [disabled, isFree, index, onDab]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isFree}
      className={cn(
        "relative flex items-center justify-center",
        "aspect-square w-full rounded font-bold text-xs sm:text-base",
        "transition-all duration-150 select-none",
        "cell-depth",
        isFree
          ? "border border-[var(--color-gold)]/30 cursor-default"
          : "glass-cell text-[var(--color-text-primary)] hover:bg-[var(--color-cell-hover)] hover:border-[var(--color-border-light)] active:scale-[0.92] cursor-pointer",
        disabled && !isFree && "opacity-60 cursor-not-allowed",
      )}
      style={isFree ? { background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(245,158,11,0.1))', boxShadow: '0 0 12px rgba(255,215,0,0.15)' } : undefined}
      aria-label={
        isFree
          ? t("game.free")
          : `${letter ?? ""}${value ?? ""} ${dabbed ? "dabbed" : ""}`
      }
    >
      {/* Number or FREE text */}
      <span
        className={cn(
          "z-10 relative font-extrabold",
          dabbed && !isFree && "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]",
          isFree && "text-xs sm:text-sm font-black tracking-wide text-gold",
        )}
      >
        {isFree ? t("game.free") : (value ?? "")}
      </span>

      {/* Dab overlay - column color */}
      {dabbed && !isFree && (
        <div
          className="absolute inset-[2px] rounded-full animate-dab"
          style={{
            backgroundColor: columnColor,
            opacity: 0.75,
            boxShadow: `0 0 8px ${columnColor}66`,
          }}
        />
      )}
      {/* FREE space gold overlay */}
      {isFree && (
        <div
          className="absolute inset-[3px] rounded-full border border-[var(--color-gold)]/20"
          style={{
            background: 'radial-gradient(circle, rgba(255,215,0,0.2) 0%, rgba(245,158,11,0.1) 100%)',
            opacity: 0.5,
          }}
        />
      )}
    </button>
  );
}
