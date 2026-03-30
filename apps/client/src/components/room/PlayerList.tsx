import { useTranslation } from "react-i18next";
import type { Player } from "@bingo/shared";
import { cn } from "@/lib/utils";

interface PlayerListProps {
  players: Player[];
  className?: string;
}

export function PlayerList({ players, className }: PlayerListProps) {
  const { t } = useTranslation("game");

  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("lobby.players")}
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          {players.length}
        </span>
      </div>
      <ul className="divide-y divide-[var(--color-border)]/50 max-h-[300px] overflow-y-auto">
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            {/* Avatar circle with first letter */}
            <div
              className={cn(
                "w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white relative",
                player.connected
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-text-muted)]",
              )}
            >
              {player.name.charAt(0).toUpperCase()}
              {/* Connection status indicator */}
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
            <div className="flex items-center gap-1.5 shrink-0">
              {player.isHost && (
                <span
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400"
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
                  {t("lobby.host")}
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
  );
}
