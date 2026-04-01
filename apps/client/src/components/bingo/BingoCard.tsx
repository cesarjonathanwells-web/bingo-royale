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
        "w-full mx-auto",
        "rounded-xl sm:rounded-2xl overflow-hidden",
        "glass-card",
        "shadow-xl shadow-black/30",
        className,
      )}
    >
      {/* Column letters */}
      <div className="grid grid-cols-5 gap-1 lg:gap-1.5 px-1.5 lg:px-2 pt-1.5 lg:pt-2">
        {LETTERS.map((letter) => (
          <div
            key={letter}
            className="col-header flex items-center justify-center py-1 sm:py-1.5 lg:py-2 rounded font-black text-sm sm:text-base lg:text-lg text-white"
            style={{ backgroundColor: BALL_COLORS[letter] ?? "#f59e0b" }}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-1 lg:gap-1.5 p-1.5 lg:p-2">
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
