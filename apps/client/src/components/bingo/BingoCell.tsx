import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { BALL_COLORS, LETTERS, FREE_SPACE_INDEX } from "@bingo/shared";
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
  const color = letter ? BALL_COLORS[letter] : undefined;

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
        "relative flex items-center justify-center touch-target",
        "aspect-square w-full rounded-lg font-bold text-base sm:text-lg",
        "transition-all duration-150 select-none",
        "border border-[var(--color-border)]/40",
        "cell-depth",
        isFree
          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] cursor-default border-[var(--color-accent)]/30"
          : "bg-[var(--color-cell-bg)] text-[var(--color-text-primary)] hover:bg-[var(--color-cell-hover)] hover:border-[var(--color-border)]/60 active:scale-90 cursor-pointer",
        disabled && !isFree && "opacity-60 cursor-not-allowed",
      )}
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
          dabbed && !isFree && "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
          isFree && "text-xs sm:text-sm font-black tracking-wide",
        )}
      >
        {isFree ? t("game.free") : (value ?? "")}
      </span>

      {/* Dab overlay */}
      {(dabbed || isFree) && (
        <div
          className={cn(
            "absolute inset-[3px] rounded-full",
            !isFree && "animate-dab dab-stamp",
            isFree && "border border-[var(--color-accent)]/20",
          )}
          style={{
            backgroundColor: isFree
              ? "var(--color-accent)"
              : color ?? "var(--color-dab)",
            opacity: isFree ? 0.25 : 0.75,
          }}
        />
      )}
    </button>
  );
}
