import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchStats } from "@/lib/api";
import type { StatsResponse } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { StatCards } from "@/components/stats/StatCards";
import { RecentGamesList } from "@/components/stats/RecentGamesList";

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
      <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full animate-page-enter">
        <div className="h-8 w-40 mx-auto mb-6 rounded bg-purple-900/40 animate-pulse" />
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl glass p-4 space-y-2 border border-purple-500/20"
            >
              <div className="h-8 w-16 mx-auto rounded bg-purple-800/30 animate-pulse" />
              <div className="h-3 w-20 mx-auto rounded bg-purple-800/30 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-6 w-32 mb-4 rounded bg-purple-900/40 animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-12 mb-2 rounded glass border border-purple-500/20 animate-pulse"
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

  return (
    <div className="flex-1 px-4 py-8 pb-20 max-w-lg mx-auto w-full animate-page-enter">
      <h2 className="font-gaming text-2xl text-gold mb-6 text-center">
        {t("stats.title")}
      </h2>

      <StatCards
        gamesPlayed={stats.gamesPlayed}
        gamesWon={stats.gamesWon}
        winRate={stats.winRate}
        totalDabs={stats.totalDabs}
      />

      <RecentGamesList games={recentGames} />
    </div>
  );
}
