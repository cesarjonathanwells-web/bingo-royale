import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchProfile } from "@/lib/api";
import type { ProfileResponse } from "@/lib/api";

interface ProfileProps {
  userId: string;
}

export function Profile({ userId }: ProfileProps) {
  const { t } = useTranslation("game");
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError(true);
      return;
    }
    fetchProfile(userId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] animate-pulse mb-3" />
          <div className="h-6 w-32 rounded bg-[var(--color-bg-secondary)] animate-pulse mb-2" />
          <div className="h-4 w-24 rounded bg-[var(--color-bg-secondary)] animate-pulse" />
        </div>
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
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-[var(--color-text-muted)] text-center">
          {t("stats.noStats")}
        </p>
      </div>
    );
  }

  const { user, stats, recentGames } = data;

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
    <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
      {/* Profile header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-2xl font-bold text-white mb-3">
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {user.displayName}
        </h2>
        <span
          className={`mt-1 text-xs font-medium px-2 py-0.5 rounded ${
            user.isGuest
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-green-500/20 text-green-400"
          }`}
        >
          {user.isGuest ? t("profile.guest") : t("profile.registered")}
        </span>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {t("profile.memberSince", {
            date: new Date(user.createdAt).toLocaleDateString(),
          })}
        </p>
      </div>

      {/* Stats cards */}
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        {t("stats.title")}
      </h3>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 text-center space-y-1"
          >
            <p
              className="text-xs font-bold uppercase tracking-wide opacity-60"
              style={{ color: card.color }}
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
