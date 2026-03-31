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
  "#ffd700",
  "#f59e0b",
  "#fbbf24",
  "#22c55e",
  "#3b82f6",
  "#ef4444",
  "#a78bfa",
  "#ec4899",
  "#fcd34d",
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
      Array.from({ length: 60 }, (_, i) => ({
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
      {/* Dark backdrop with blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

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
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center space-y-5">
        <h2
          className="text-5xl sm:text-7xl font-black text-gold animate-win-entrance"
          style={{
            textShadow: '0 0 30px rgba(255, 215, 0, 0.5), 0 0 60px rgba(255, 215, 0, 0.3)',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))',
          }}
        >
          {latestWinner ? "BINGO!" : t("game.gameOver")}
        </h2>

        {latestWinner ? (
          <div className="space-y-3 animate-page-enter">
            <p className="text-3xl sm:text-4xl font-black text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
              {latestWinner.playerName}
            </p>
            <p className="text-lg sm:text-xl font-semibold text-[var(--color-text-secondary)]">
              {t("game.winnerAnnouncement", {
                name: latestWinner.playerName,
                pattern: latestWinner.pattern,
              })}
            </p>
          </div>
        ) : (
          <p className="text-lg text-[var(--color-text-secondary)] animate-page-enter">
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
            <Button
              size="lg"
              onClick={onNewRound}
              className="text-lg !bg-gradient-to-r !from-amber-400 !via-yellow-500 !to-amber-600 !text-white !shadow-lg !border-t !border-yellow-300/30 glow-gold"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
            >
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
