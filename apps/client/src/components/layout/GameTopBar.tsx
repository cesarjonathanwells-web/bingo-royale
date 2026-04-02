import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { GameState, BingoVariant } from "@bingo/shared";
import { getLetterForNumber, BALL_COLORS } from "@bingo/shared";
import { generateRoomCode, cn } from "@/lib/utils";

interface GameTopBarProps {
  gameState: GameState;
  variant: BingoVariant;
  roomCode: string;
  onMenuPress: () => void;
  onBallPress: () => void;
  onLeave: () => void;
}

export function GameTopBar({
  gameState,
  variant,
  roomCode,
  onMenuPress,
  onBallPress,
  onLeave,
}: GameTopBarProps) {
  const { t } = useTranslation("game");
  const is75 = variant === "75";
  const total = is75 ? 75 : 90;
  const currentNumber = gameState.currentNumber;
  const currentLetter = gameState.currentLetter;

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode.toUpperCase());
  }, [roomCode]);

  // Determine ball color
  const ballColor =
    is75 && currentNumber && currentNumber <= 75
      ? BALL_COLORS[getLetterForNumber(currentNumber)] ?? "#f59e0b"
      : "#f59e0b";

  return (
    <div className="sticky top-0 z-30 glass" style={{ borderBottom: '1px solid rgba(168, 85, 247, 0.15)' }}>
      <div className="flex items-center justify-between px-2 py-1.5 h-12">
        {/* Left: Current ball + letter-number */}
        <button
          onClick={onBallPress}
          className="flex items-center gap-2 px-1 py-0.5 rounded-lg hover:bg-[var(--color-bg-tertiary)]/50 transition-colors cursor-pointer select-none"
          aria-label={t("game.tapHistory")}
        >
          {currentNumber ? (
            <>
              {/* Small ball */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-extrabold shrink-0 animate-ball-pulse"
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${ballColor}cc, ${ballColor})`,
                  boxShadow: `0 2px 8px ${ballColor}66, 0 0 20px ${ballColor}33`,
                }}
              >
                {currentNumber}
              </div>
              {/* Letter-Number text */}
              <span className="text-sm font-bold text-[var(--color-text-primary)]">
                {is75 && currentLetter ? `${currentLetter}-` : ""}
                {currentNumber}
              </span>
            </>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--color-bg-tertiary)]/60 border border-[var(--color-border)] flex items-center justify-center">
              <span className="text-[8px] text-[var(--color-text-muted)]">--</span>
            </div>
          )}
        </button>

        {/* Center: Called count */}
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {t("game.calledOf", {
            called: gameState.calledNumbers.length,
            total,
          })}
        </span>

        {/* Right: Room code chip + menu button */}
        <div className="flex items-center gap-1">
          {/* Room code chip */}
          <button
            onClick={handleCopyCode}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold",
              "bg-[var(--color-bg-tertiary)] text-[var(--color-neon-purple)]",
              "hover:bg-[var(--color-bg-tertiary)]/80 transition-colors cursor-pointer select-none",
              "neon-border-purple",
            )}
            title={t("game.share")}
          >
            {generateRoomCode(roomCode)}
          </button>

          {/* Leave game button */}
          <button
            onClick={onLeave}
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-lg",
              "text-red-400 hover:text-red-300",
              "hover:bg-red-500/10 transition-colors cursor-pointer",
            )}
            aria-label={t("game.leave")}
            title={t("game.leave")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>

          {/* Menu (hamburger) button */}
          <button
            onClick={onMenuPress}
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-lg",
              "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              "hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer",
            )}
            aria-label={t("game.players")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
