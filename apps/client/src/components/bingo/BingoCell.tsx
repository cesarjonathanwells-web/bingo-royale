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
        "aspect-square w-full rounded-lg font-bold text-xs sm:text-base lg:text-lg",
        "transition-all duration-150 select-none",
        "glass-cell cell-depth",
        isFree
          ? "border border-[var(--color-gold)]/30 cursor-default"
          : "text-[var(--color-text-primary)] hover:bg-[var(--color-cell-hover)] hover:border-[var(--color-border-light)] active:scale-[0.92] cursor-pointer",
        disabled && !isFree && "opacity-60 cursor-not-allowed",
      )}
      style={isFree ? { background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(245,158,11,0.1))', boxShadow: '0 0 12px rgba(255,215,0,0.15)' } : undefined}
      aria-label={
        isFree
          ? t("game.free")
          : `${letter ?? ""}${value ?? ""} ${dabbed ? "dabbed" : ""}`
      }
    >
      {/* Number or FREE star icon */}
      {isFree ? (
        <span className="z-10 relative flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="url(#goldStar)"
            className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 drop-shadow-[0_0_6px_rgba(255,215,0,0.5)]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="goldStar" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffd700" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
          </svg>
        </span>
      ) : (
        <span
          className={cn(
            "z-10 relative font-black",
            dabbed && "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]",
          )}
        >
          {value ?? ""}
        </span>
      )}

      {/* Dab overlay - column color */}
      {dabbed && !isFree && (
        <>
          <div
            className="absolute inset-[2px] rounded-full animate-dab"
            style={{
              backgroundColor: columnColor,
              opacity: 0.75,
              boxShadow: `0 0 8px ${columnColor}66`,
            }}
          />
        </>
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
