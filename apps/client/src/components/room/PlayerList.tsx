import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { Player } from "@bingo/shared";
import { cn } from "@/lib/utils";

interface PlayerListProps {
  players: Player[];
  className?: string;
}

// Generate a consistent color from a player's name
const AVATAR_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7",
  "#ec4899", "#06b6d4", "#f97316", "#8b5cf6", "#14b8a6",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

export function PlayerList({ players, className }: PlayerListProps) {
  const { t } = useTranslation("game");

  const activePlayers = players.filter((p) => !p.isSpectator);
  const spectators = players.filter((p) => p.isSpectator);

  return (
    <div
      className={cn(
        "rounded-xl glass overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
          {t("lobby.players")}
        </h3>
        <span className="text-xs font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-0.5 rounded-full">
          {players.length}
        </span>
      </div>

      {/* Active players */}
      <ul className="max-h-[200px] sm:max-h-[250px] md:max-h-[350px] lg:max-h-[400px] overflow-y-auto">
        {activePlayers.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}

        {/* Spectators section */}
        {spectators.length > 0 && (
          <>
            <li className="px-4 py-2 bg-[var(--color-bg-tertiary)]/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t("lobby.spectator")} ({spectators.length})
              </span>
            </li>
            {spectators.map((player) => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </>
        )}
      </ul>
    </div>
  );
}

const PlayerRow = memo(function PlayerRow({ player }: { player: Player }) {
  const { t } = useTranslation("game");
  const color = getAvatarColor(player.name);

  return (
    <li className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]/30 last:border-b-0">
      {/* Avatar - larger, colored per player */}
      <div
        className="relative shrink-0"
      >
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white",
            !player.connected && "opacity-50",
          )}
          style={{ backgroundColor: color }}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>
        {/* Connection dot */}
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-bg-secondary)]",
            player.connected ? "bg-emerald-400" : "bg-red-400",
          )}
        />
      </div>

      {/* Name and badges stacked */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[15px] font-semibold leading-tight truncate",
            player.connected
              ? "text-[var(--color-text-primary)]"
              : "text-[var(--color-text-muted)]",
          )}
          title={player.name}
        >
          {player.name}
        </p>
        {/* Badges below name instead of beside */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {player.isHost && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
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
          {!player.connected && (
            <span className="text-[10px] font-medium text-red-400">
              {t("lobby.disconnected")}
            </span>
          )}
        </div>
      </div>
    </li>
  );
});
