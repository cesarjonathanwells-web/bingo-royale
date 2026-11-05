import { useCallback } from "react";
import type { BingoCard75 } from "@bingo/shared";
import { LETTERS, BALL_COLORS, FREE_SPACE_INDEX } from "@bingo/shared";
import { BingoCell } from "./BingoCell";
import { BoardSurface, type BoardFeedbackProps } from "./BoardSurface";

interface BingoCardProps extends BoardFeedbackProps {
  card: BingoCard75;
  dabs: Set<number>;
  onDab: (cellIndex: number) => void;
  disabled?: boolean;
  className?: string;
  blockedCells?: Set<number>;
  wildCells?: Set<number>;
  targetableCells?: Set<number>;
}

export function BingoCard({
  card,
  dabs,
  onDab,
  disabled = false,
  className,
  blockedCells,
  wildCells,
  targetableCells,
  currentNumber,
  calledNumbers,
  winningCells,
  nearWinCells,
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
    <BoardSurface className={className} completed={Boolean(winningCells?.size)} nearWin={Boolean(nearWinCells?.size)}>
      {/* Column letters */}
      <div className="grid grid-cols-5 gap-1 @min-[350px]:gap-1.5 px-1.5 @min-[350px]:px-2 pt-1.5 @min-[350px]:pt-2">
        {LETTERS.map((letter, column) => {
          const color = BALL_COLORS[letter] ?? "#f59e0b";
          const current = currentNumber != null && Math.floor((currentNumber - 1) / 15) === column;
          return (
            <div
              key={`${letter}-${current ? currentNumber : "idle"}`}
              data-current={current || undefined}
              className="bingo-column-header col-header flex items-center justify-center py-1 @min-[250px]:py-1.5 @min-[350px]:py-2 rounded font-black text-sm @min-[250px]:text-base @min-[350px]:text-lg text-white"
              style={{
                backgroundColor: color,
              }}
            >
              {letter}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-1 @min-[350px]:gap-1.5 p-1.5 @min-[350px]:p-2">
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
                disabled={disabled || (targetableCells !== undefined && !targetableCells.has(index))}
                blocked={blockedCells?.has(index)}
                wild={wildCells?.has(index)}
                targetable={targetableCells?.has(index)}
                current={value != null && value === currentNumber}
                called={value != null && calledNumbers?.has(value)}
                winning={winningCells?.has(index)}
                nearWin={nearWinCells?.has(index)}
              />
            );
          }),
        )}
      </div>
    </BoardSurface>
  );
}

