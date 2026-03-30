import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameState, BingoVariant } from "@bingo/shared";
import { getLetterForNumber, BALL_COLORS, LETTERS } from "@bingo/shared";
import { NumberBall } from "./NumberBall";
import { cn } from "@/lib/utils";

interface CalledNumbersProps {
  gameState: GameState;
  variant: BingoVariant;
}

export function CalledNumbers({ gameState, variant }: CalledNumbersProps) {
  const { t } = useTranslation("game");
  const [showBoard, setShowBoard] = useState(false);
  const is75 = variant === "75";
  const maxNumber = is75 ? 75 : 90;

  const calledSet = useMemo(
    () => new Set(gameState.calledNumbers),
    [gameState.calledNumbers],
  );

  const lastFive = useMemo(
    () => gameState.calledNumbers.slice(-5).reverse(),
    [gameState.calledNumbers],
  );

  return (
    <div className="w-full">
      {/* Current number */}
      <div className="flex flex-col items-center gap-2 mb-3">
        {gameState.currentNumber ? (
          <>
            <NumberBall
              number={gameState.currentNumber}
              is75={is75}
              size="lg"
              animate
              key={gameState.currentNumber}
            />
            {is75 && gameState.currentLetter && (
              <span className="text-sm font-bold text-[var(--color-text-secondary)]">
                {gameState.currentLetter}-{gameState.currentNumber}
              </span>
            )}
          </>
        ) : (
          <div className="w-20 h-20 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
            <span className="text-xs text-[var(--color-text-muted)] text-center px-2">
              {t("game.noNumberYet")}
            </span>
          </div>
        )}
      </div>

      {/* Last 5 called */}
      {lastFive.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-3">
          {lastFive.slice(1).map((n) => (
            <NumberBall key={n} number={n} is75={is75} size="sm" />
          ))}
        </div>
      )}

      {/* Count and toggle */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-xs text-[var(--color-text-muted)]">
          {t("game.numbersCalled", { count: gameState.calledNumbers.length })}
        </span>
        <button
          onClick={() => setShowBoard(!showBoard)}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          {showBoard ? t("actions.close", { ns: "common" }) : t("game.allCalledNumbers")}
        </button>
      </div>

      {/* Full board */}
      {showBoard && (
        <div className="animate-slide-down">
          {is75 ? (
            <Board75 calledSet={calledSet} />
          ) : (
            <Board90 calledSet={calledSet} />
          )}
        </div>
      )}
    </div>
  );
}

function Board75({ calledSet }: { calledSet: Set<number> }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 overflow-x-auto">
      <div className="grid grid-cols-5 gap-1 min-w-0">
        {/* Column headers */}
        {LETTERS.map((letter) => (
          <div
            key={letter}
            className="text-center py-1 rounded font-bold text-sm text-white"
            style={{ backgroundColor: BALL_COLORS[letter] ?? "#6366f1" }}
          >
            {letter}
          </div>
        ))}
        {/* Numbers in columns */}
        {Array.from({ length: 15 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const n = col * 15 + row + 1;
            const called = calledSet.has(n);
            const letter = LETTERS[col];
            const color = letter ? BALL_COLORS[letter] : "#6366f1";
            return (
              <div
                key={n}
                className={cn(
                  "text-center py-1 rounded text-xs font-semibold transition-all duration-300",
                  called
                    ? "text-white shadow-sm"
                    : "text-[var(--color-text-muted)] bg-[var(--color-bg-primary)]/50",
                )}
                style={called ? { backgroundColor: color } : undefined}
              >
                {n}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

function Board90({ calledSet }: { calledSet: Set<number> }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 overflow-x-auto">
      <div className="grid grid-cols-10 gap-0.5 min-w-0">
        {Array.from({ length: 90 }, (_, i) => {
          const n = i + 1;
          const called = calledSet.has(n);
          return (
            <div
              key={n}
              className={cn(
                "text-center py-1 rounded text-xs font-semibold transition-all duration-300",
                called
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-muted)] bg-[var(--color-bg-primary)]/50",
              )}
            >
              {n}
            </div>
          );
        })}
      </div>
    </div>
  );
}
