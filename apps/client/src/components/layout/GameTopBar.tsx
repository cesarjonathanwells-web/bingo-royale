import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { GameState, BingoVariant } from "@bingo/shared";
import { generateRoomCode, cn } from "@/lib/utils";

interface GameTopBarProps {
  gameState: GameState;
  variant: BingoVariant;
  roomCode: string;
  onMenuPress: () => void;
  onLeave: () => void;
}

export function GameTopBar({
  gameState,
  variant,
  roomCode,
  onMenuPress,
  onLeave,
}: GameTopBarProps) {
  const { t } = useTranslation("game");
  const is75 = variant === "75";
  const total = is75 ? 75 : 90;

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode.toUpperCase());
  }, [roomCode]);

  return (
    <div className="sticky top-0 z-30 glass" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between px-2 py-1.5 h-12">
        {/* Left: Called count */}
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
              "px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold",
              "bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]",
              "hover:bg-[var(--color-bg-tertiary)]/80 transition-colors cursor-pointer select-none",
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
