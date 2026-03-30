import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchStats } from "@/lib/api";
import type { StatsResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function Stats() {
  const { t } = useTranslation("game");
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    fetchStats(user.id)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [isAuthenticated, user]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        <div className="h-8 w-40 mx-auto mb-6 rounded bg-[var(--color-bg-secondary)] animate-pulse" />
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 space-y-2"
            >
              <div className="h-8 w-16 mx-auto rounded bg-[var(--color-border)] animate-pulse" />
              <div className="h-3 w-20 mx-auto rounded bg-[var(--color-border)] animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-6 w-32 mb-4 rounded bg-[var(--color-bg-secondary)] animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-12 mb-2 rounded bg-[var(--color-bg-secondary)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (!data || data.stats.gamesPlayed === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-4xl mb-4" aria-hidden="true">
          B I N G O
        </div>
        <p className="text-sm text-[var(--color-text-muted)] text-center">
          {t("stats.noStats")}
        </p>
      </div>
    );
  }

  const { stats, recentGames } = data;

  const statCards = [
    {
      label: t("stats.gamesPlayed"),
      value: stats.gamesPlayed,
      color: "var(--color-ball-b)",
      icon: "#",
    },
    {
      label: t("stats.gamesWon"),
      value: stats.gamesWon,
      color: "var(--color-ball-g)",
      icon: "W",
    },
    {
      label: t("stats.winRate"),
      value: `${stats.winRate}%`,
      color: "var(--color-ball-o)",
      icon: "%",
    },
    {
      label: t("stats.totalDabs"),
      value: stats.totalDabs,
      color: "var(--color-ball-i)",
      icon: "D",
    },
  ];

  return (
    <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full animate-page-enter">
      <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6 text-center">
        {t("stats.title")}
      </h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 text-center space-y-1 hover:shadow-lg transition-shadow duration-200"
          >
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: card.color, opacity: 0.7 }}
            >
              {card.icon}
            </p>
            <p
              className="text-3xl font-extrabold"
              style={{ color: card.color }}
            >
              {card.value}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] font-medium">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Recent games */}
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        {t("stats.recentGames")}
      </h3>

      {recentGames.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
          {t("stats.noGames")}
        </p>
      ) : (
        <div className="space-y-2">
          {recentGames.map((game) => (
            <div
              key={game.id}
              className="flex items-center justify-between rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                  {game.variant === "75" ? t("stats.variant75") : t("stats.variant90")}
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
    </div>
  );
}
