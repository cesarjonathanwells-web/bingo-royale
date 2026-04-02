import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { fetchProfile } from "@/lib/api";
import type { ProfileResponse } from "@/lib/api";
import { StatCards } from "@/components/stats/StatCards";
import { RecentGamesList } from "@/components/stats/RecentGamesList";

interface ProfileProps {
  userId: string;
}

export function Profile({ userId }: ProfileProps) {
  const { t } = useTranslation("game");
  const navigate = useNavigate();
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
      <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full animate-page-enter">
        <div className="glass-card-neon rounded-xl p-6 flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-purple-900/40 animate-pulse mb-3 ring-2 ring-purple-500/30 ring-offset-2 ring-offset-[var(--color-bg-primary)]" />
          <div className="h-6 w-32 rounded bg-purple-800/30 animate-pulse mb-2" />
          <div className="h-4 w-24 rounded bg-purple-800/30 animate-pulse" />
        </div>
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

  return (
    <div className="flex-1 px-4 py-8 pb-20 max-w-lg mx-auto w-full animate-page-enter">
      {/* Back button */}
      <button
        onClick={() => navigate({ to: "/" })}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
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
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {t("actions.back", { ns: "common", defaultValue: "Back" })}
      </button>

      {/* Profile header */}
      <div className="glass-card-neon rounded-xl p-6 flex flex-col items-center mb-8">
        <div
          className="rounded-full bg-gradient-to-br from-[var(--color-accent-hover)] to-[var(--color-accent)] flex items-center justify-center text-3xl font-bold text-white mb-3 shadow-lg shadow-[var(--color-accent)]/30 ring-2 ring-[var(--color-neon-purple)] ring-offset-2 ring-offset-[var(--color-bg-primary)]"
          style={{ width: "72px", height: "72px" }}
        >
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <h2 className="font-gaming text-2xl text-[var(--color-text-primary)]">
          {user.displayName}
        </h2>
        <span
          className={`mt-1 text-xs font-medium px-2 py-0.5 rounded ${
            user.isGuest
              ? "neon-border-purple bg-purple-500/10 text-neon-purple"
              : "neon-border-gold bg-yellow-500/10 text-neon-gold"
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
      <h3 className="font-gaming text-lg text-gold mb-3">
        {t("stats.title")}
      </h3>

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
