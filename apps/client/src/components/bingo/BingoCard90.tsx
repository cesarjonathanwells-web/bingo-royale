import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { BingoCard90 as BingoCard90Type } from "@bingo/shared";
import { cn } from "@/lib/utils";

interface BingoCard90Props {
  card: BingoCard90Type;
  dabs: Set<number>;
  onDab: (cellIndex: number) => void;
  disabled?: boolean;
  className?: string;
}

export function BingoCard90({
  card,
  dabs,
  onDab,
  disabled = false,
  className,
}: BingoCard90Props) {
  const { t } = useTranslation("game");

  const getCellValue = useCallback(
    (row: number, col: number): number => {
      return card.grid[col]?.[row] ?? 0;
    },
    [card],
  );

  // Flat index for 90-ball: row * 9 + col
  const getCellIndex = (row: number, col: number): number => {
    return row * 9 + col;
  };

  return (
    <div
      className={cn(
        "w-full max-w-[500px] mx-auto",
        "rounded-2xl overflow-hidden",
        "bg-[var(--color-bg-card)] border border-[var(--color-border)]",
        "shadow-xl shadow-black/20",
        className,
      )}
    >
      {/* Header */}
      <div className="text-center py-2 px-1 bg-gradient-to-b from-[var(--color-bg-tertiary)] to-[var(--color-bg-card)]">
        <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest">
          {t("game.yourCard")}
        </h3>
      </div>

      {/* Grid: 9 columns x 3 rows */}
      <div className="grid grid-cols-9 gap-1 p-2">
        {Array.from({ length: 3 }, (_, row) =>
          Array.from({ length: 9 }, (_, col) => {
            const index = getCellIndex(row, col);
            const value = getCellValue(row, col);
            const isBlank = value === 0;
            const isDabbed = !isBlank && dabs.has(index);

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (!disabled && !isBlank) onDab(index);
                }}
                disabled={disabled || isBlank}
                className={cn(
                  "relative flex items-center justify-center touch-target",
                  "aspect-square w-full rounded-lg font-bold text-sm sm:text-base",
                  "transition-transform duration-100 select-none",
                  "border border-[var(--color-border)]/50",
                  isBlank
                    ? "bg-[var(--color-bg-primary)]/50 cursor-default"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] active:scale-90 cursor-pointer",
                  disabled && !isBlank && "opacity-60 cursor-not-allowed",
                )}
                aria-label={isBlank ? "blank" : `${value} ${isDabbed ? "dabbed" : ""}`}
              >
                {!isBlank && (
                  <>
                    <span className={cn("z-10 relative", isDabbed && "text-white")}>
                      {value}
                    </span>
                    {isDabbed && (
                      <div
                        className="absolute inset-1 rounded-full animate-dab"
                        style={{
                          backgroundColor: "var(--color-dab)",
                          opacity: 0.7,
                        }}
                      />
                    )}
                  </>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
