import { useTranslation } from "react-i18next";
import type { Player } from "@bingo/shared";
import { generateRoomCode, cn } from "@/lib/utils";

interface PlayerDrawerProps {
  open: boolean;
  onClose: () => void;
  players: Player[];
  roomCode: string;
}

export function PlayerDrawer({ open, onClose, players, roomCode }: PlayerDrawerProps) {
  const { t } = useTranslation("game");

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="drawer-overlay animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 w-[280px] z-35",
          "flex flex-col",
          "bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)]",
          "shadow-2xl",
          "animate-slide-in-right",
        )}
        style={{ zIndex: 35 }}
      >
        {/* Header with room code */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("lobby.players")}
            </h3>
            <span className="text-[10px] font-mono font-bold text-[var(--color-text-muted)]">
              {generateRoomCode(roomCode)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] transition-colors cursor-pointer"
            aria-label={t("actions.close", { ns: "common" })}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Player count */}
        <div className="px-4 py-2 border-b border-[var(--color-border)]/50">
          <span className="text-xs text-[var(--color-text-muted)]">
            {players.length} {t("lobby.players").toLowerCase()}
          </span>
        </div>

        {/* Player list */}
        <ul className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]/50">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              {/* Avatar circle */}
              <div
                className={cn(
                  "w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white relative",
                  player.connected
                    ? "bg-[var(--color-accent)]"
                    : "bg-[var(--color-text-muted)]",
                )}
              >
                {player.name.charAt(0).toUpperCase()}
                {/* Connection status dot */}
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-bg-secondary)]",
                    player.connected ? "bg-emerald-400" : "bg-red-400",
                  )}
                  title={player.connected ? t("lobby.connected") : t("lobby.disconnected")}
                />
              </div>

              {/* Name */}
              <span
                className={cn(
                  "text-sm font-medium flex-1 truncate",
                  player.connected
                    ? "text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)]",
                )}
              >
                {player.name}
              </span>

              {/* Badges */}
              <div className="flex items-center gap-1 shrink-0">
                {player.isHost && (
                  <span
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400"
                    title={t("lobby.host")}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 1l3.22 6.966 7.78.694-5.811 5.012L19.11 21 12 17.27 4.89 21l1.921-7.328L1 8.66l7.78-.694z" />
                    </svg>
                  </span>
                )}
                {player.isSpectator && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400">
                    {t("lobby.spectator")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
