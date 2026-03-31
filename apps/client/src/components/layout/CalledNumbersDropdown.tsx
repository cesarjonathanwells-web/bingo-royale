import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameState, BingoVariant } from "@bingo/shared";
import { BALL_COLORS, LETTERS } from "@bingo/shared";
import { NumberBall } from "@/components/bingo/NumberBall";
import { cn } from "@/lib/utils";

interface CalledNumbersDropdownProps {
  open: boolean;
  onClose: () => void;
  gameState: GameState;
  variant: BingoVariant;
}

export function CalledNumbersDropdown({
  open,
  onClose,
  gameState,
  variant,
}: CalledNumbersDropdownProps) {
  const { t } = useTranslation("game");
  const [showAll, setShowAll] = useState(false);
  const is75 = variant === "75";

  const calledSet = useMemo(
    () => new Set(gameState.calledNumbers),
    [gameState.calledNumbers],
  );

  const lastTen = useMemo(
    () => gameState.calledNumbers.slice(-10).reverse(),
    [gameState.calledNumbers],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dropdown panel */}
      <div
        className={cn(
          "absolute left-0 right-0 z-35 mx-2",
          "bg-[var(--color-bg-secondary)] border border-[var(--color-border)]",
          "rounded-xl shadow-2xl",
          "animate-slide-down",
          "max-h-[60vh] overflow-y-auto",
        )}
        style={{ top: "48px", zIndex: 35 }}
      >
        <div className="p-3">
          {/* Recent balls (last 10) */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              {t("game.lastCalled")}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {t("game.calledOf", {
                called: gameState.calledNumbers.length,
                total: is75 ? 75 : 90,
              })}
            </span>
          </div>

          {lastTen.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 justify-center mb-3">
              {lastTen.map((n, idx) => (
                <div key={n} style={{ opacity: Math.max(0.4, 1 - idx * 0.06) }}>
                  <NumberBall number={n} is75={is75} size="sm" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
              {t("game.noNumberYet")}
            </p>
          )}

          {/* Show all toggle */}
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-center text-xs text-[var(--color-accent)] hover:underline py-1 cursor-pointer"
          >
            {showAll
              ? t("actions.close", { ns: "common" })
              : t("game.showAll")}
          </button>

          {/* Full board */}
          {showAll && (
            <div className="mt-2 animate-slide-down">
              {is75 ? (
                <Board75 calledSet={calledSet} />
              ) : (
                <Board90 calledSet={calledSet} />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Board75({ calledSet }: { calledSet: Set<number> }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)]/50 p-2">
      <div className="grid grid-cols-5 gap-0.5">
        {/* Column headers */}
        {LETTERS.map((letter) => (
          <div
            key={letter}
            className="text-center py-0.5 rounded font-bold text-[10px] text-white col-header"
            style={{ backgroundColor: BALL_COLORS[letter] ?? "#f59e0b" }}
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
            const color = letter ? BALL_COLORS[letter] : "#f59e0b";
            return (
              <div
                key={n}
                className={cn(
                  "text-center py-0.5 rounded text-[10px] font-semibold transition-all duration-300",
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
    <div className="rounded-xl bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)]/50 p-2">
      <div className="grid grid-cols-10 gap-0.5">
        {Array.from({ length: 90 }, (_, i) => {
          const n = i + 1;
          const called = calledSet.has(n);
          return (
            <div
              key={n}
              className={cn(
                "text-center py-0.5 rounded text-[10px] font-semibold transition-all duration-300",
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
