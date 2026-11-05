import { useCallback, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { BingoCard90 as BingoCard90Type } from "@bingo/shared";
import { cn } from "@/lib/utils";
import { DaubMark } from "./DaubMark";
import { BoardSurface, type BoardFeedbackProps } from "./BoardSurface";

interface BingoCard90Props extends BoardFeedbackProps {
  card: BingoCard90Type;
  dabs: Set<number>;
  onDab: (cellIndex: number) => void;
  disabled?: boolean;
  className?: string;
  blockedCells?: Set<number>;
  wildCells?: Set<number>;
  targetableCells?: Set<number>;
}

export function BingoCard90({
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
    <BoardSurface className={className} completed={Boolean(winningCells?.size)} nearWin={Boolean(nearWinCells?.size)}>
      {/* Grid: 9 columns x 3 rows */}
      <div className="grid grid-cols-9 gap-0.5 @min-[250px]:gap-1 @min-[350px]:gap-1.5 p-1.5 @min-[350px]:p-2">
        {Array.from({ length: 3 }, (_, row) =>
          Array.from({ length: 9 }, (_, col) => {
            const index = getCellIndex(row, col);
            const value = getCellValue(row, col);
            const isBlank = value === 0;
            const isDabbed = !isBlank && dabs.has(index);
            const isBlocked = blockedCells?.has(index) ?? false;
            const isWild = wildCells?.has(index) ?? false;
            const isTargetable = targetableCells?.has(index) ?? false;
            const isCurrent = !isBlank && value === currentNumber;
            const isCalled = !isBlank && Boolean(calledNumbers?.has(value));
            const cellDisabled = disabled || isBlank || isBlocked || (targetableCells !== undefined && !isTargetable);

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (!cellDisabled) onDab(index);
                }}
                disabled={cellDisabled}
                className={cn(
                  "relative flex items-center justify-center min-w-0 min-h-11",
                  "aspect-square w-full rounded-md font-bold text-xs @min-[250px]:text-sm @min-[350px]:text-base",
                  "transition-all duration-150 select-none",
                  "cell-depth",
                  isBlank
                    ? "bg-[var(--color-bg-primary)]/30 cursor-default border-transparent"
                    : "bingo-cell glass-cell text-[var(--color-text-primary)] hover:bg-[var(--color-cell-hover)] hover:border-[var(--color-border-light)] motion-safe:active:scale-[0.95] cursor-pointer",
                  isDabbed && "bingo-cell--marked",
                  isCalled && !isDabbed && "bingo-cell--called",
                  isCurrent && "bingo-cell--current",
                  winningCells?.has(index) && "bingo-cell--winning",
                  nearWinCells?.has(index) && !isDabbed && "bingo-cell--near-win",
                  disabled && !isBlank && "opacity-60 cursor-not-allowed",
                  isBlocked && "!border-purple-400/80 !bg-purple-950/70 cursor-not-allowed",
                  isTargetable && "ring-2 ring-amber-300/80 !border-amber-200",
                  isWild && "ring-1 ring-amber-300/70",
                )}
                style={{ "--cell-ink": "var(--color-dab)" } as CSSProperties}
                aria-pressed={isBlank ? undefined : isDabbed}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={isBlank ? t("powerups.blankCell") : `${value} ${isBlocked ? t("powerups.blockedCell") : isWild ? t("powerups.wildCell") : isDabbed ? t("powerups.markedCell") : isCurrent ? t("game.currentNumber") : isCalled ? t("game.calledNumbers") : ""}`.trim()}
              >
                {isBlocked && <span className="absolute inset-0 z-30 flex items-center justify-center rounded-md bg-purple-950/70 text-xl" aria-hidden="true">🔒</span>}
                {isWild && <span className="absolute top-0 right-0 z-30 text-[10px] leading-none text-amber-200" aria-hidden="true">★</span>}
                {!isBlank && (
                  <>
                    <DaubMark marked={isDabbed} color="var(--color-dab)" seed={`${card.id}:${index}:${value}`} />
                    <span className={cn("bingo-cell__number z-10 relative font-extrabold tabular-nums", isDabbed && "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]")}>
                      {value}
                    </span>
                    {isCalled && !isDabbed && !isBlocked && <span className="bingo-cell__call-cue" aria-hidden="true" />}
                  </>
                )}
              </button>
            );
          }),
        )}
      </div>
    </BoardSurface>
  );
}

