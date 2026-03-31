import { useCallback } from "react";
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
        "bg-gradient-card border border-[var(--color-border)]",
        "shadow-xl shadow-black/30",
        className,
      )}
    >
      {/* Column letters - directly at top, no header text */}
      <div className="grid grid-cols-5 gap-1.5 px-2.5 pt-2.5">
        {LETTERS.map((letter) => (
          <div
            key={letter}
            className="col-header flex items-center justify-center py-2.5 rounded-lg font-black text-xl text-white"
            style={{ backgroundColor: BALL_COLORS[letter] ?? "#f59e0b" }}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-1.5 p-2.5">
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
