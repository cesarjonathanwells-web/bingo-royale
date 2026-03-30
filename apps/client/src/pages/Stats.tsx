import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UserStats } from "@bingo/shared";
import { getStats } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function Stats() {
  const { t } = useTranslation("game");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    getStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-[var(--color-text-muted)] text-center">
          {t("stats.noStats")}
        </p>
      </div>
    );
  }

  const winRate =
    stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;

  const cards = [
    {
      label: t("stats.gamesPlayed"),
      value: stats.gamesPlayed,
      color: "var(--color-ball-b)",
    },
    {
      label: t("stats.gamesWon"),
      value: stats.gamesWon,
      color: "var(--color-ball-g)",
    },
    {
      label: t("stats.winRate"),
      value: `${winRate}%`,
      color: "var(--color-ball-o)",
    },
    {
      label: t("stats.totalDabs"),
      value: stats.totalDabs,
      color: "var(--color-ball-i)",
    },
  ];

  return (
    <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
      <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6 text-center">
        {t("stats.title")}
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 text-center space-y-1"
          >
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
    </div>
  );
}
