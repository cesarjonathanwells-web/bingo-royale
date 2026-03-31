import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface StatCardsProps {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  totalDabs: number;
}

interface StatCardItem {
  label: string;
  value: string | number;
  color: string;
  icon: string;
}

export function StatCards({
  gamesPlayed,
  gamesWon,
  winRate,
  totalDabs,
}: StatCardsProps) {
  const { t } = useTranslation("game");

  const cards = useMemo<StatCardItem[]>(
    () => [
      {
        label: t("stats.gamesPlayed"),
        value: gamesPlayed,
        color: "var(--color-ball-b)",
        icon: "#",
      },
      {
        label: t("stats.gamesWon"),
        value: gamesWon,
        color: "var(--color-ball-g)",
        icon: "W",
      },
      {
        label: t("stats.winRate"),
        value: `${winRate}%`,
        color: "var(--color-ball-o)",
        icon: "%",
      },
      {
        label: t("stats.totalDabs"),
        value: totalDabs,
        color: "var(--color-ball-i)",
        icon: "D",
      },
    ],
    [gamesPlayed, gamesWon, winRate, totalDabs, t],
  );

  return (
    <div className="grid grid-cols-2 gap-4 mb-8">
      {cards.map((card) => (
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
  );
}
