import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GameState } from "@bingo/shared";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface GameFinishedProps {
  gameState: GameState;
  isHost: boolean;
  onNewRound: () => void;
  onLeave: () => void;
}

const CONFETTI_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#a78bfa",
  "#ec4899",
  "#06b6d4",
];

const CONFETTI_SHAPES = ["rounded-full", "rounded-sm", "rounded-none"];

export function GameFinished({
  gameState,
  isHost,
  onNewRound,
  onLeave,
}: GameFinishedProps) {
  const { t } = useTranslation("game");
  const latestWinner = gameState.winners[gameState.winners.length - 1];

  // Stable confetti pieces (avoid re-randomizing on every render)
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        width: `${6 + Math.random() * 10}px`,
        height: `${6 + Math.random() * 10}px`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        duration: `${2.5 + Math.random() * 4}s`,
        delay: `${Math.random() * 3}s`,
        shape: CONFETTI_SHAPES[i % CONFETTI_SHAPES.length],
      })),
    [],
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6 relative">
      {/* Confetti decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confettiPieces.map((piece, i) => (
          <div
            key={i}
            className={cn("absolute", piece.shape)}
            style={{
              left: piece.left,
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.color,
              animation: `confetti-fall ${piece.duration} linear ${piece.delay} infinite`,
              opacity: 0.8,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center space-y-5 animate-page-enter">
        <h2 className="text-5xl sm:text-6xl font-black text-[var(--color-ball-o)] animate-winner-glow">
          {t("game.gameOver")}
        </h2>

        {latestWinner ? (
          <div className="space-y-3">
            <p className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)]">
              {t("game.winnerAnnouncement", {
                name: latestWinner.playerName,
                pattern: latestWinner.pattern,
              })}
            </p>
          </div>
        ) : (
          <p className="text-lg text-[var(--color-text-secondary)]">
            {t("game.noWinner")}
          </p>
        )}

        <p className="text-sm text-[var(--color-text-muted)]">
          {t("game.numbersCalled", {
            count: gameState.calledNumbers.length,
          })}
        </p>

        <div className="flex flex-col gap-3 pt-6">
          {isHost && (
            <Button size="lg" onClick={onNewRound} className="text-lg">
              {t("game.playAgain")}
            </Button>
          )}
          <Button variant="secondary" onClick={onLeave}>
            {t("game.leaveGame")}
          </Button>
        </div>
      </div>
    </div>
  );
}
