import { useTranslation } from "react-i18next";
import type { PlayerPowerUp, PowerUpId } from "@bingo/shared";
import { POWER_UP_MAP } from "@bingo/shared";
import { cn } from "@/lib/utils";

interface ActionBarProps {
  powerups: PlayerPowerUp[];
  onUsePowerUp: (id: PowerUpId) => void;
  onToggleChat: () => void;
  onToggleEmoji: () => void;
  onTogglePlayers: () => void;
  unreadChat: number;
  chatOpen: boolean;
}

export function ActionBar({
  powerups,
  onUsePowerUp,
  onToggleChat,
  onToggleEmoji,
  onTogglePlayers,
  unreadChat,
  chatOpen,
}: ActionBarProps) {
  const { t } = useTranslation("game");

  return (
    <div
      className="flex items-center justify-between px-2 bg-[var(--color-bg-secondary)]/60 backdrop-blur border-t border-[var(--color-border)]/40"
      style={{ height: "44px" }}
    >
      {/* Left side: Power-up icons (compact) */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {powerups.map((pu) => {
          const def = POWER_UP_MAP[pu.id];
          if (!def) return null;

          return (
            <button
              key={pu.id}
              type="button"
              disabled={pu.used}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!pu.used) onUsePowerUp(pu.id);
              }}
              title={t(`powerups.${pu.id}`)}
              style={{ touchAction: "manipulation" }}
              className={cn(
                "w-9 h-9 flex items-center justify-center rounded-lg text-lg select-none shrink-0",
                "transition-all duration-150",
                pu.used
                  ? "opacity-30 grayscale cursor-not-allowed"
                  : [
                      "hover:bg-[var(--color-accent)]/20 active:scale-90 cursor-pointer",
                      "border border-[var(--color-accent)]/30 bg-[var(--color-bg-tertiary)]/50",
                    ],
              )}
            >
              {def.icon}
            </button>
          );
        })}
      </div>

      {/* Right side: Emoji, Chat, Players buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Emoji button */}
        <button
          onClick={onToggleEmoji}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-lg text-lg",
            "hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer select-none",
          )}
          aria-label={t("reactions.title")}
          title={t("reactions.title")}
        >
          {"\u{1F600}"}
        </button>

        {/* Chat button */}
        <button
          onClick={onToggleChat}
          className={cn(
            "relative w-9 h-9 flex items-center justify-center rounded-lg",
            "transition-colors cursor-pointer select-none",
            chatOpen
              ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]",
          )}
          aria-label={t("game.chat")}
          title={t("game.chat")}
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {/* Unread badge */}
          {unreadChat > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-[9px] font-bold">
              {unreadChat > 9 ? "9+" : unreadChat}
            </span>
          )}
        </button>

        {/* Players button */}
        <button
          onClick={onTogglePlayers}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-lg",
            "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]",
            "transition-colors cursor-pointer select-none",
          )}
          aria-label={t("game.players")}
          title={t("game.players")}
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
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>
      </div>
    </div>
  );
}
