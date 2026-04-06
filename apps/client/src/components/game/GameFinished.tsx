import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { GameState, WinPattern } from "@bingo/shared";
import { resolvePattern } from "@bingo/shared";
import { Button } from "@/components/ui/Button";
import { Fireworks } from "@/components/fx/Fireworks";
import { ScreenShake } from "@/components/fx/ScreenShake";

interface GameFinishedProps {
  gameState: GameState;
  customPatterns?: WinPattern[];
  isHost: boolean;
  onNewRound: () => void;
  onLeave: () => void;
}

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
  const [shakeTrigger] = useState(1);
  const [showFireworks, setShowFireworks] = useState(!!latestWinner);

  // Auto-stop fireworks after 8 seconds to save resources
  useEffect(() => {
    if (!showFireworks) return;
    const timer = setTimeout(() => setShowFireworks(false), 8000);
    return () => clearTimeout(timer);
  }, [showFireworks]);

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

  return (
    <ScreenShake trigger={latestWinner ? shakeTrigger : 0} intensity={10} duration={0.6}>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6 relative">
        {/* Dark backdrop with blur */}
        <motion.div
          className="absolute inset-0 bg-[#050511]/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />

        {/* Fireworks canvas */}
        <Fireworks active={showFireworks} />

        {/* Pulsing radial glow behind content */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
          style={{
            background: "radial-gradient(circle at 50% 40%, rgba(212,162,76,0.15) 0%, transparent 60%)",
          }}
        />

        <motion.div
          className="relative z-10 text-center space-y-5 glass-card rounded-2xl p-6 mx-4"
          initial={{ scale: 0.3, opacity: 0, rotateX: 20 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20,
            delay: 0.2,
          }}
        >
          {/* Crown/trophy icon */}
          {latestWinner && (
            <motion.div
              className="flex justify-center"
              initial={{ y: -40, opacity: 0, scale: 0 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 15,
                delay: 0.5,
              }}
            >
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="drop-shadow-[0_0_20px_rgba(255,215,0,0.6)]">
                <path
                  d="M32 4L40 20L56 8L48 32H16L8 8L24 20L32 4Z"
                  fill="url(#crownGrad)"
                  stroke="#DAA520"
                  strokeWidth="1.5"
                />
                <rect x="14" y="32" width="36" height="6" rx="2" fill="url(#crownGrad)" stroke="#DAA520" strokeWidth="1" />
                <circle cx="20" cy="35" r="2" fill="#FF6B6B" />
                <circle cx="32" cy="35" r="2" fill="#4ECDC4" />
                <circle cx="44" cy="35" r="2" fill="#A78BFA" />
                <defs>
                  <linearGradient id="crownGrad" x1="8" y1="4" x2="56" y2="38" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFD700" />
                    <stop offset="0.5" stopColor="#FFC107" />
                    <stop offset="1" stopColor="#DAA520" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          )}

          <motion.h2
            className="text-6xl sm:text-8xl font-gaming text-gold"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 12,
              delay: 0.4,
            }}
            style={{
              textShadow: "0 0 30px rgba(255,215,0,0.5), 0 0 60px rgba(255,215,0,0.2)",
            }}
          >
            {latestWinner ? "BINGO!" : t("game.gameOver")}
          </motion.h2>

          {latestWinner ? (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <motion.p
                className="text-4xl sm:text-5xl font-gaming text-gold"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9, type: "spring", stiffness: 200 }}
              >
                {latestWinner.playerName}
              </motion.p>
              <p className="text-lg sm:text-xl font-semibold text-[var(--color-text-secondary)]">
                {t("game.winnerAnnouncement", {
                  name: latestWinner.playerName,
                  pattern: winPatternName,
                })}
              </p>

              {/* Animated winning pattern grid */}
              {winPattern && winPattern.cells.length > 0 && (
                <motion.div
                  className="flex flex-col items-center gap-2 pt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1 }}
                >
                  <div className="grid grid-cols-5 gap-1 w-fit">
                    {Array.from({ length: 25 }, (_, i) => {
                      const isActive = winPattern.cells.includes(i);
                      return (
                        <motion.div
                          key={i}
                          initial={isActive ? { scale: 0, opacity: 0 } : {}}
                          animate={isActive ? { scale: 1, opacity: 1 } : {}}
                          transition={isActive ? {
                            delay: 1.2 + i * 0.03,
                            type: "spring",
                            stiffness: 500,
                            damping: 25,
                          } : {}}
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
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.p
              className="text-lg text-[var(--color-text-secondary)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {t("game.noWinner")}
            </motion.p>
          )}

          <motion.div
            className="space-y-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
          >
            <p className="text-3xl sm:text-4xl font-gaming text-gold">
              {gameState.calledNumbers.length}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] uppercase tracking-wider">
              {t("game.numbersCalled", {
                count: gameState.calledNumbers.length,
              })}
            </p>
          </motion.div>

          <motion.div
            className="flex flex-col gap-3 pt-6"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.4 }}
          >
            {isHost && (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  onClick={onNewRound}
                  className="w-full text-lg !bg-gradient-to-r !from-amber-400 !via-yellow-500 !to-amber-600 !text-white !shadow-lg !border-t !border-yellow-300/30 glow-gold"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                >
                  {t("game.playAgain")}
                </Button>
              </motion.div>
            )}
            <Button variant="secondary" onClick={onLeave} className="glass-btn neon-border-purple">
              {t("game.leaveGame")}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </ScreenShake>
  );
}
