import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { GameState, WinPattern } from "@bingo/shared";
import { resolvePattern } from "@bingo/shared";
import { Button } from "@/components/ui/Button";

interface GameFinishedProps {
  gameState: GameState;
  customPatterns?: WinPattern[];
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


export function GameFinished({
  gameState,
  customPatterns = [],
  isHost,
  onNewRound,
  onLeave,
}: GameFinishedProps) {
  const { t, i18n } = useTranslation("game");
  const isEs = i18n.language === "es";
  const latestWinner = gameState.winners[gameState.winners.length - 1];

  const winPattern = useMemo(() => {
    if (!latestWinner?.pattern) return undefined;
    return resolvePattern(latestWinner.pattern, customPatterns);
  }, [latestWinner, customPatterns]);

  const winPatternName = useMemo(() => {
    if (!latestWinner?.pattern) return "";
    if (winPattern) {
      return isEs ? winPattern.nameEs : winPattern.name;
    }
    return t(`patterns.${latestWinner.pattern}`, latestWinner.pattern);
  }, [latestWinner, winPattern, t, isEs]);

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

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6 relative">
      {/* Dark backdrop with blur */}
      <div className="absolute inset-0 bg-[#050511]/80 backdrop-blur-md" />

      {/* Confetti rain decoration */}
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
              animation: `confetti-fall ${piece.duration} linear ${piece.delay} infinite`,
              opacity: 0.9,
              boxShadow: `0 0 6px 1px ${piece.color}66`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center space-y-5 glass-card rounded-2xl p-6 mx-4">
        <h2
          className="text-6xl sm:text-8xl font-gaming text-gold animate-win-entrance"
        >
          {latestWinner ? "BINGO!" : t("game.gameOver")}
        </h2>

        {latestWinner ? (
          <div className="space-y-4 animate-page-enter">
            <p className="text-4xl sm:text-5xl font-gaming text-gold">
              {latestWinner.playerName}
            </p>
            <p className="text-lg sm:text-xl font-semibold text-[var(--color-text-secondary)]">
              {t("game.winnerAnnouncement", {
                name: latestWinner.playerName,
                pattern: winPatternName,
              })}
            </p>

            {/* Winning pattern grid */}
            {winPattern && winPattern.cells.length > 0 && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <div className="grid grid-cols-5 gap-1 w-fit">
                  {Array.from({ length: 25 }, (_, i) => {
                    const isActive = winPattern.cells.includes(i);
                    return (
                      <div
                        key={i}
                        className={
                          isActive
                            ? "w-5 h-5 sm:w-6 sm:h-6 rounded-sm bg-[var(--color-accent)] shadow-[0_0_6px_var(--color-accent)]"
                            : "w-5 h-5 sm:w-6 sm:h-6 rounded-sm bg-[var(--color-bg-tertiary)]/40"
                        }
                      />
                    );
                  })}
                </div>
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  {winPatternName}
                </p>
              </div>
            )}
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
              className="text-lg !bg-gradient-to-r !from-amber-400 !via-yellow-500 !to-amber-600 !text-white !shadow-lg !border-t !border-yellow-300/30 glow-gold"
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
