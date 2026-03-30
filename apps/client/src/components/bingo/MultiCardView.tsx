import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { BingoCard75, BingoCard90 } from "@bingo/shared";
import { LETTERS, BALL_COLORS, FREE_SPACE_INDEX } from "@bingo/shared";
import type { BingoCard } from "@bingo/shared";
import { cn } from "@/lib/utils";

interface MultiCardViewProps {
  cards: BingoCard[];
  dabs: Set<number>[];
  variant: "75" | "90";
  onDab: (cardIndex: number, cellIndex: number) => void;
  disabled?: boolean;
}

export function MultiCardView({
  cards,
  dabs,
  variant,
  onDab,
  disabled = false,
}: MultiCardViewProps) {
  const { t } = useTranslation("game");
  const is75 = variant === "75";
  const count = cards.length;

  if (count <= 1) return null;

  return (
    <div
      className={cn(
        "w-full mx-auto",
        count === 2 ? "grid grid-cols-2 gap-1.5" : "grid grid-cols-2 gap-1.5",
        count === 3 && "max-w-[calc(100%-0.5rem)]",
      )}
    >
      {cards.map((card, ci) => (
        <div key={ci} className={cn(count === 3 && ci === 2 && "col-span-2 max-w-[50%] mx-auto")}>
          {is75 ? (
            <MiniCard75
              card={card as BingoCard75}
              dabs={dabs[ci] ?? new Set()}
              cardIndex={ci}
              onDab={onDab}
              disabled={disabled}
              label={t("cards.card", { n: ci + 1 })}
            />
          ) : (
            <MiniCard90
              card={card as BingoCard90}
              dabs={dabs[ci] ?? new Set()}
              cardIndex={ci}
              onDab={onDab}
              disabled={disabled}
              label={t("cards.card", { n: ci + 1 })}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Mini 75-ball card (compact, tappable)
// ============================================================

interface MiniCard75Props {
  card: BingoCard75;
  dabs: Set<number>;
  cardIndex: number;
  onDab: (cardIndex: number, cellIndex: number) => void;
  disabled: boolean;
  label: string;
}

function MiniCard75({ card, dabs, cardIndex, onDab, disabled, label }: MiniCard75Props) {
  const getCellValue = useCallback(
    (row: number, col: number): number | null => card.grid[col]?.[row] ?? null,
    [card],
  );

  return (
    <div className="rounded-xl overflow-hidden bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-md">
      {/* Condensed label + BINGO header */}
      <div className="flex items-center gap-0.5 px-1 pt-1">
        {LETTERS.map((letter) => (
          <div
            key={letter}
            className="flex-1 text-center text-[8px] sm:text-[10px] font-black text-white rounded py-0.5"
            style={{ backgroundColor: BALL_COLORS[letter] ?? "#6366f1" }}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-[2px] p-1">
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const index = row * 5 + col;
            const value = getCellValue(row, col);
            const isFree = index === FREE_SPACE_INDEX;
            const isDabbed = isFree || dabs.has(index);
            const letter = LETTERS[col];
            const color = letter ? BALL_COLORS[letter] : undefined;

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (!disabled && !isFree) onDab(cardIndex, index);
                }}
                disabled={disabled || isFree}
                className={cn(
                  "relative flex items-center justify-center",
                  "aspect-square w-full rounded text-[9px] sm:text-[11px] font-bold",
                  "transition-transform duration-75 select-none",
                  isFree
                    ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-[7px]"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] active:scale-90 cursor-pointer",
                )}
              >
                <span className={cn("z-10 relative", isDabbed && !isFree && "text-white text-[8px] sm:text-[10px]")}>
                  {isFree ? "F" : (value ?? "")}
                </span>
                {(isDabbed || isFree) && (
                  <div
                    className="absolute inset-[1px] rounded-full"
                    style={{
                      backgroundColor: isFree ? "var(--color-accent)" : color ?? "var(--color-dab)",
                      opacity: isFree ? 0.3 : 0.65,
                    }}
                  />
                )}
              </button>
            );
          }),
        )}
      </div>

      {/* Card label */}
      <div className="text-center py-0.5 text-[8px] font-semibold text-[var(--color-text-muted)] uppercase">
        {label}
      </div>
    </div>
  );
}

// ============================================================
// Mini 90-ball card (compact, tappable)
// ============================================================

interface MiniCard90Props {
  card: BingoCard90;
  dabs: Set<number>;
  cardIndex: number;
  onDab: (cardIndex: number, cellIndex: number) => void;
  disabled: boolean;
  label: string;
}

function MiniCard90({ card, dabs, cardIndex, onDab, disabled, label }: MiniCard90Props) {
  const getCellValue = useCallback(
    (row: number, col: number): number => card.grid[col]?.[row] ?? 0,
    [card],
  );

  return (
    <div className="rounded-xl overflow-hidden bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-md">
      {/* Grid: 9 cols x 3 rows */}
      <div className="grid grid-cols-9 gap-[2px] p-1">
        {Array.from({ length: 3 }, (_, row) =>
          Array.from({ length: 9 }, (_, col) => {
            const index = row * 9 + col;
            const value = getCellValue(row, col);
            const isBlank = value === 0;
            const isDabbed = !isBlank && dabs.has(index);

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (!disabled && !isBlank) onDab(cardIndex, index);
                }}
                disabled={disabled || isBlank}
                className={cn(
                  "relative flex items-center justify-center",
                  "aspect-square w-full rounded text-[8px] sm:text-[10px] font-bold",
                  "select-none",
                  isBlank
                    ? "bg-[var(--color-bg-primary)]/40"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] active:scale-90 cursor-pointer",
                )}
              >
                {!isBlank && (
                  <>
                    <span className={cn("z-10 relative", isDabbed && "text-white text-[7px] sm:text-[9px]")}>
                      {value}
                    </span>
                    {isDabbed && (
                      <div
                        className="absolute inset-[1px] rounded-full"
                        style={{ backgroundColor: "var(--color-dab)", opacity: 0.65 }}
                      />
                    )}
                  </>
                )}
              </button>
            );
          }),
        )}
      </div>

      {/* Card label */}
      <div className="text-center py-0.5 text-[8px] font-semibold text-[var(--color-text-muted)] uppercase">
        {label}
      </div>
    </div>
  );
}
