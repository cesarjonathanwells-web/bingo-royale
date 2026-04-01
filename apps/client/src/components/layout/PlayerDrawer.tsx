import { useTranslation } from "react-i18next";
import type { Player } from "@bingo/shared";
import { generateRoomCode, cn } from "@/lib/utils";

interface PlayerDrawerProps {
  open: boolean;
  onClose: () => void;
  players: Player[];
  roomCode: string;
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

export function PlayerDrawer({ open, onClose, players, roomCode }: PlayerDrawerProps) {
  const { t } = useTranslation("game");

  if (!open) return null;

  const activePlayers = players.filter((p) => !p.isSpectator);
  const spectators = players.filter((p) => p.isSpectator);

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
          "fixed top-0 right-0 bottom-0 w-[300px] max-w-[85vw]",
          "flex flex-col",
          "glass-strong",
          "animate-slide-in-right",
        )}
        style={{ zIndex: 36 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)]">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              {t("lobby.players")}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono font-bold text-[var(--color-gold)]">
                {generateRoomCode(roomCode)}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {activePlayers.length} {t("lobby.players").toLowerCase()}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] transition-colors cursor-pointer"
            aria-label={t("actions.close", { ns: "common" })}
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Player list */}
        <ul className="flex-1 overflow-y-auto">
          {activePlayers.map((player) => (
            <DrawerPlayerRow key={player.id} player={player} />
          ))}

          {/* Spectators section */}
          {spectators.length > 0 && (
            <>
              <li className="px-4 py-2 bg-[var(--color-bg-tertiary)]/30 border-t border-[var(--color-border)]/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {t("lobby.spectator")} ({spectators.length})
                </span>
              </li>
              {spectators.map((player) => (
                <DrawerPlayerRow key={player.id} player={player} />
              ))}
            </>
          )}
        </ul>
      </div>
    </>
  );
}

function DrawerPlayerRow({ player }: { player: Player }) {
  const { t } = useTranslation("game");
  const color = getAvatarColor(player.name);

  return (
    <li className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]/20 overflow-hidden">
      {/* Avatar - unique color per player */}
      <div className="relative shrink-0">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white shadow-md",
            !player.connected && "opacity-40",
          )}
          style={{ backgroundColor: color }}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>
        {/* Connection dot */}
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-bg-secondary)]",
            player.connected ? "bg-emerald-400" : "bg-red-400",
          )}
        />
      </div>

      {/* Name + status stacked vertically */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-base font-semibold leading-tight truncate",
            player.connected
              ? "text-[var(--color-text-primary)]"
              : "text-[var(--color-text-muted)]",
          )}
          title={player.name}
        >
          {player.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {player.isHost && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 1l3.22 6.966 7.78.694-5.811 5.012L19.11 21 12 17.27 4.89 21l1.921-7.328L1 8.66l7.78-.694z" />
              </svg>
              {t("lobby.host")}
            </span>
          )}
          {player.connected ? (
            <span className="text-[10px] text-emerald-400 font-medium">
              {t("lobby.connected")}
            </span>
          ) : (
            <span className="text-[10px] text-red-400 font-medium">
              {t("lobby.disconnected")}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
