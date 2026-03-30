import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { BingoCard75 } from "@bingo/shared";
import { LETTERS, BALL_COLORS, FREE_SPACE_INDEX } from "@bingo/shared";
import { BingoCell } from "./BingoCell";
import { cn } from "@/lib/utils";

interface BingoCardProps {
  card: BingoCard75;
  dabs: Set<number>;
  onDab: (cellIndex: number) => void;
  disabled?: boolean;
  className?: string;
}

export function BingoCard({
  card,
  dabs,
  onDab,
  disabled = false,
  className,
}: BingoCardProps) {
  const { t } = useTranslation("game");

  const getCellValue = useCallback(
    (row: number, col: number): number | null => {
      return card.grid[col]?.[row] ?? null;
    },
    [card],
  );

  const getCellIndex = (row: number, col: number): number => {
    return row * 5 + col;
  };

  return (
    <div
      className={cn(
        "w-full max-w-[calc(100%-0.5rem)] sm:max-w-[400px] mx-auto",
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

      {/* Column letters */}
      <div className="grid grid-cols-5 gap-1 px-2">
        {LETTERS.map((letter, i) => (
          <div
            key={letter}
            className="flex items-center justify-center py-1.5 rounded-lg font-extrabold text-lg text-white"
            style={{ backgroundColor: BALL_COLORS[letter] ?? "#6366f1" }}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-1 p-2">
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const index = getCellIndex(row, col);
            const value = getCellValue(row, col);
            const isDabbed =
              index === FREE_SPACE_INDEX || dabs.has(index);
            return (
              <BingoCell
                key={index}
                index={index}
                value={value}
                column={col}
                dabbed={isDabbed}
                onDab={onDab}
                disabled={disabled}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
