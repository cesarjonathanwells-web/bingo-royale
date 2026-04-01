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
        "w-full mx-auto",
        "rounded-xl sm:rounded-2xl overflow-hidden",
        "glass-card",
        "shadow-xl shadow-black/25",
        className,
      )}
    >
      {/* Grid: 9 columns x 3 rows */}
      <div className="grid grid-cols-9 gap-0.5 sm:gap-1 p-1.5">
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
                  "aspect-square w-full rounded-md font-bold text-[10px] sm:text-sm",
                  "transition-all duration-150 select-none",
                  "cell-depth",
                  isBlank
                    ? "bg-[var(--color-bg-primary)]/30 cursor-default border-transparent"
                    : "glass-cell text-[var(--color-text-primary)] hover:bg-[var(--color-cell-hover)] hover:border-[var(--color-border-light)] active:scale-[0.92] cursor-pointer",
                  disabled && !isBlank && "opacity-60 cursor-not-allowed",
                )}
                aria-label={isBlank ? "blank" : `${value} ${isDabbed ? "dabbed" : ""}`}
              >
                {!isBlank && (
                  <>
                    <span className={cn("z-10 relative font-extrabold", isDabbed && "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]")}>
                      {value}
                    </span>
                    {isDabbed && (
                      <div
                        className="absolute inset-[3px] rounded-full animate-dab dab-stamp"
                        style={{
                          backgroundColor: "var(--color-dab)",
                          opacity: 0.75,
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
