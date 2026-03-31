import { useTranslation } from "react-i18next";
import type { RecentGame } from "@/lib/api";

interface RecentGamesListProps {
  games: RecentGame[];
}

export function RecentGamesList({ games }: RecentGamesListProps) {
  const { t } = useTranslation("game");

  return (
    <>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        {t("stats.recentGames")}
      </h3>

      {games.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
          {t("stats.noGames")}
        </p>
      ) : (
        <div className="space-y-2">
          {games.map((game) => (
            <div
              key={game.id}
              className="flex items-center justify-between rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                  {game.variant === "75"
                    ? t("stats.variant75")
                    : t("stats.variant90")}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {t("stats.players", { count: game.playerCount })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    game.isWinner
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {game.isWinner ? t("stats.win") : t("stats.loss")}
                </span>
                {game.finishedAt && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {new Date(game.finishedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
