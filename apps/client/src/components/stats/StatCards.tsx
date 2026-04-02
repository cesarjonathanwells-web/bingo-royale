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
  iconClass: string;
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
        iconClass: "text-neon-blue",
        icon: "#",
      },
      {
        label: t("stats.gamesWon"),
        value: gamesWon,
        iconClass: "text-neon-gold",
        icon: "W",
      },
      {
        label: t("stats.winRate"),
        value: `${winRate}%`,
        iconClass: "text-neon-purple",
        icon: "%",
      },
      {
        label: t("stats.totalDabs"),
        value: totalDabs,
        iconClass: "text-emerald-400",
        icon: "D",
      },
    ],
    [gamesPlayed, gamesWon, winRate, totalDabs, t],
  );

  return (
    <div className="grid grid-cols-2 gap-4 mb-8">
      {cards.map((card, index) => (
        <div
          key={card.label}
          className="glass-card-neon rounded-xl p-4 text-center space-y-1 hover:shadow-lg transition-shadow duration-200 animate-card-deal"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <p
            className={`text-2xl font-bold ${card.iconClass}`}
            style={{ textShadow: "0 0 10px currentColor" }}
          >
            {card.icon}
          </p>
          <p
            className={`font-gaming text-3xl ${card.iconClass}`}
          >
            {card.value}
          </p>
          <p className="text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] font-bold">
            {card.label}
          </p>
        </div>
      ))}
    </div>
  );
}
