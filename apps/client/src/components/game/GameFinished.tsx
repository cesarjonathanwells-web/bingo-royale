import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GameState } from "@bingo/shared";
import { Button } from "@/components/ui/Button";

interface GameFinishedProps {
  gameState: GameState;
  isHost: boolean;
  onNewRound: () => void;
  onLeave: () => void;
}

const COIN_COLORS = [
  "#FFD700",
  "#FFC107",
  "#FFB300",
  "#FF8F00",
  "#DAA520",
];

const FIREWORK_COLORS = [
  "radial-gradient(circle, #FFD700 0%, transparent 70%)",
  "radial-gradient(circle, #a78bfa 0%, transparent 70%)",
  "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
  "radial-gradient(circle, #22c55e 0%, transparent 70%)",
  "radial-gradient(circle, #FFC107 0%, transparent 70%)",
  "radial-gradient(circle, #c084fc 0%, transparent 70%)",
];

export function GameFinished({
  gameState,
  isHost,
  onNewRound,
  onLeave,
}: GameFinishedProps) {
  const { t } = useTranslation("game");
  const latestWinner = gameState.winners[gameState.winners.length - 1];

  // Stable coin pieces (avoid re-randomizing on every render)
  const coinPieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        width: `${10 + Math.random() * 8}px`,
        height: `${8 + Math.random() * 6}px`,
        color: COIN_COLORS[i % COIN_COLORS.length],
        duration: `${2.5 + Math.random() * 4}s`,
        delay: `${Math.random() * 3}s`,
      })),
    [],
  );

  // Stable firework positions
  const fireworks = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        top: `${10 + Math.random() * 60}%`,
        left: `${5 + Math.random() * 90}%`,
        size: `${60 + Math.random() * 40}px`,
        background: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
        delay: `${i * 0.3 + Math.random() * 0.5}s`,
      })),
    [],
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6 relative">
      {/* Dark backdrop with blur */}
      <div className="absolute inset-0 bg-[#050511]/80 backdrop-blur-md" />

      {/* Coin rain decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {coinPieces.map((piece, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: piece.left,
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.color,
              animation: `coin-fall ${piece.duration} linear ${piece.delay} infinite`,
              opacity: 0.9,
              boxShadow: `0 0 6px 1px ${piece.color}66`,
            }}
          />
        ))}
      </div>

      {/* Firework bursts */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {fireworks.map((fw, i) => (
          <div
            key={`fw-${i}`}
            className="absolute rounded-full"
            style={{
              top: fw.top,
              left: fw.left,
              width: fw.size,
              height: fw.size,
              background: fw.background,
              animation: `firework-burst 1.5s ease-out ${fw.delay} infinite`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center space-y-5 glass-card-neon rounded-2xl p-6 mx-4">
        <h2
          className="text-6xl sm:text-8xl font-gaming text-shimmer animate-win-entrance"
        >
          {latestWinner ? "BINGO!" : t("game.gameOver")}
        </h2>

        {latestWinner ? (
          <div className="space-y-3 animate-page-enter">
            <p className="text-4xl sm:text-5xl font-gaming text-neon-gold">
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

        <div className="space-y-1">
          <p className="text-3xl sm:text-4xl font-gaming text-gold">
            {gameState.calledNumbers.length}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] uppercase tracking-wider">
            {t("game.numbersCalled", {
              count: gameState.calledNumbers.length,
            })}
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-6">
          {isHost && (
            <Button
              size="lg"
              onClick={onNewRound}
              className="text-lg !bg-gradient-to-r !from-amber-400 !via-yellow-500 !to-amber-600 !text-white !shadow-lg !border-t !border-yellow-300/30 glow-gold animate-gold-pulse"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
            >
              {t("game.playAgain")}
            </Button>
          )}
          <Button variant="secondary" onClick={onLeave} className="glass-btn neon-border-purple">
            {t("game.leaveGame")}
          </Button>
        </div>
      </div>
    </div>
  );
}
