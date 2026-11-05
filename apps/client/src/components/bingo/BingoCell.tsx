import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { BlenderIcon } from "@/components/3d/BlenderIcon";
import { useCallback, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { LETTERS, BALL_COLORS, FREE_SPACE_INDEX } from "@bingo/shared";
import { cn } from "@/lib/utils";
import { DaubMark } from "./DaubMark";

interface BingoCellProps {
  index: number;
  value: number | null;
  column: number;
  dabbed: boolean;
  onDab: (index: number) => void;
  disabled?: boolean;
  blocked?: boolean;
  wild?: boolean;
  targetable?: boolean;
  current?: boolean;
  called?: boolean;
  winning?: boolean;
  nearWin?: boolean;
}

export function BingoCell({
  index, value, column, dabbed, onDab,
  disabled = false, blocked = false, wild = false, targetable = false,
  current = false, called = false, winning = false, nearWin = false,
}: BingoCellProps) {
  const { t } = useTranslation("game");
  const reducedMotion = usePrefersReducedMotion();
  const isFree = index === FREE_SPACE_INDEX;
  const letter = LETTERS[column];
  const columnColor = letter ? BALL_COLORS[letter] : "#f59e0b";
  const handleClick = useCallback(() => {
    if (disabled || blocked || isFree) return;
    onDab(index);
  }, [disabled, blocked, isFree, index, onDab]);
  const status = blocked ? t("powerups.blockedCell")
    : wild ? t("powerups.wildCell") : dabbed ? t("powerups.markedCell")
    : current ? t("game.currentNumber") : called ? t("game.calledNumbers") : "";

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={disabled || blocked || isFree}
      className={cn(
        "bingo-cell relative flex items-center justify-center",
        "aspect-square w-full rounded-lg font-bold text-xs @min-[250px]:text-base @min-[350px]:text-lg",
        "select-none glass-cell cell-depth",
        isFree ? "bingo-cell--free cursor-default" : "text-[var(--color-text-primary)] cursor-pointer",
        dabbed && "bingo-cell--marked",
        called && !dabbed && !isFree && "bingo-cell--called",
        current && !isFree && "bingo-cell--current",
        nearWin && !dabbed && !isFree && "bingo-cell--near-win",
        winning && "bingo-cell--winning",
        disabled && !isFree && "opacity-60 cursor-not-allowed",
        blocked && "!border-purple-400/80 !bg-purple-950/70 cursor-not-allowed",
        targetable && "ring-2 ring-amber-300/80 !border-amber-200",
        wild && "ring-1 ring-amber-300/70",
      )}
      style={{ "--cell-ink": columnColor } as CSSProperties}
      whileTap={!reducedMotion && !disabled && !blocked && !isFree ? { scale: 0.94 } : undefined}
      transition={{ type: "spring", stiffness: 650, damping: 28 }}
      aria-pressed={dabbed || isFree}
      aria-current={current ? "true" : undefined}
      aria-label={isFree ? t("game.free") : `${letter ?? ""}${value ?? ""} ${status}`.trim()}
    >
      {!isFree && <DaubMark marked={dabbed} color={columnColor} seed={`${letter}-${value}-${index}`} />}
      {isFree ? (
        <span className="z-10 relative flex items-center justify-center">
          <BlenderIcon name="wild_square" className="w-5 h-5 @min-[250px]:w-6 @min-[250px]:h-6 @min-[350px]:w-7 @min-[350px]:h-7">
            <svg viewBox="0 0 24 24" fill="#e8b75e" className="w-full h-full" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
          </BlenderIcon>
        </span>
      ) : (
        <span className={cn("bingo-cell__number z-10 relative font-black tabular-nums", dabbed && "text-white")}>
          {value ?? ""}
        </span>
      )}
      {called && !dabbed && !isFree && !blocked && <span className="bingo-cell__call-cue" aria-hidden="true" />}
      {blocked && <span className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-purple-950/70 text-xl" aria-hidden="true">🔒</span>}
      {wild && <span className="absolute top-0 right-0 z-30 text-[10px] leading-none text-amber-200" aria-hidden="true">★</span>}
    </motion.button>
  );
}
