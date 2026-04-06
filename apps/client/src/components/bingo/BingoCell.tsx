import { useCallback, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { LETTERS, BALL_COLORS, FREE_SPACE_INDEX } from "@bingo/shared";
import { cn } from "@/lib/utils";

interface BingoCellProps {
  index: number;
  value: number | null;
  column: number;
  dabbed: boolean;
  onDab: (index: number) => void;
  disabled?: boolean;
}

// Ink splat SVG paths for randomized dab shapes
const SPLAT_PATHS = [
  "M50,5 C65,2 80,10 90,25 C98,38 95,55 85,70 C78,80 60,92 45,95 C30,97 15,90 8,75 C2,62 0,42 10,28 C18,15 35,8 50,5Z",
  "M48,3 C68,0 85,15 92,30 C100,48 92,65 80,78 C68,88 48,96 32,92 C18,88 5,72 2,55 C0,38 8,18 25,8 C35,3 42,3 48,3Z",
  "M52,4 C70,1 88,12 95,28 C100,42 96,60 84,74 C72,86 52,95 36,93 C20,90 8,76 3,58 C-1,40 5,20 20,10 C32,3 44,4 52,4Z",
];

export function BingoCell({
  index,
  value,
  column,
  dabbed,
  onDab,
  disabled = false,
}: BingoCellProps) {
  const { t } = useTranslation("game");
  const isFree = index === FREE_SPACE_INDEX;
  const letter = LETTERS[column];
  const columnColor = letter ? BALL_COLORS[letter] : "#f59e0b";
  const [justDabbed, setJustDabbed] = useState(false);
  const prevDabbedRef = useRef(dabbed);
  const splatIndex = useRef(Math.floor(Math.random() * SPLAT_PATHS.length));

  useEffect(() => {
    if (dabbed && !prevDabbedRef.current) {
      setJustDabbed(true);
      splatIndex.current = Math.floor(Math.random() * SPLAT_PATHS.length);
      const timer = setTimeout(() => setJustDabbed(false), 600);
      return () => clearTimeout(timer);
    }
    prevDabbedRef.current = dabbed;
  }, [dabbed]);

  const handleClick = useCallback(() => {
    if (disabled || isFree) return;
    onDab(index);
  }, [disabled, isFree, index, onDab]);

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={disabled || isFree}
      className={cn(
        "relative flex items-center justify-center",
        "aspect-square w-full rounded-lg font-bold text-xs sm:text-base lg:text-lg",
        "select-none",
        "glass-cell cell-depth",
        isFree
          ? "border border-[var(--color-gold)]/30 cursor-default"
          : "text-[var(--color-text-primary)] hover:bg-[var(--color-cell-hover)] hover:border-[var(--color-border-light)] cursor-pointer",
        disabled && !isFree && "opacity-60 cursor-not-allowed",
      )}
      style={isFree ? { background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(245,158,11,0.1))', boxShadow: '0 0 12px rgba(255,215,0,0.15)' } : undefined}
      whileTap={!disabled && !isFree ? { scale: 0.88 } : undefined}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      aria-label={
        isFree
          ? t("game.free")
          : `${letter ?? ""}${value ?? ""} ${dabbed ? "dabbed" : ""}`
      }
    >
      {/* Number or FREE star icon */}
      {isFree ? (
        <span className="z-10 relative flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="url(#goldStar)"
            className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 drop-shadow-[0_0_6px_rgba(255,215,0,0.5)]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="goldStar" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffd700" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z" />
          </svg>
        </span>
      ) : (
        <span
          className={cn(
            "z-10 relative font-black",
            dabbed && "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]",
          )}
        >
          {value ?? ""}
        </span>
      )}

      {/* Dab overlay - ink splat shape */}
      <AnimatePresence>
        {dabbed && !isFree && (
          <motion.div
            className="absolute inset-0 z-[5] flex items-center justify-center"
            initial={justDabbed ? { scale: 0, rotate: -20, opacity: 0 } : false}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={justDabbed ? {
              type: "spring",
              stiffness: 600,
              damping: 20,
              mass: 0.8,
            } : { duration: 0 }}
          >
            <svg viewBox="0 0 100 100" className="absolute inset-[1px] w-full h-full">
              <path
                d={SPLAT_PATHS[splatIndex.current]}
                fill={columnColor}
                opacity={0.8}
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dab splash particles */}
      <AnimatePresence>
        {justDabbed && !isFree && (
          <>
            {Array.from({ length: 6 }, (_, i) => {
              const angle = (Math.PI * 2 * i) / 6;
              return (
                <motion.div
                  key={`splash-${i}`}
                  className="absolute z-20 rounded-full"
                  style={{
                    width: 4 + Math.random() * 3,
                    height: 4 + Math.random() * 3,
                    backgroundColor: columnColor,
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(angle) * (20 + Math.random() * 15),
                    y: Math.sin(angle) * (20 + Math.random() * 15),
                    opacity: 0,
                    scale: 0.3,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* Glow pulse on fresh dab */}
      {justDabbed && !isFree && (
        <motion.div
          className="absolute inset-[-4px] rounded-xl z-[4]"
          initial={{ opacity: 0.6, scale: 0.8 }}
          animate={{ opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            boxShadow: `0 0 20px ${columnColor}, 0 0 40px ${columnColor}66`,
          }}
        />
      )}

      {/* FREE space gold overlay */}
      {isFree && (
        <div
          className="absolute inset-[3px] rounded-full border border-[var(--color-gold)]/20"
          style={{
            background: 'radial-gradient(circle, rgba(255,215,0,0.2) 0%, rgba(245,158,11,0.1) 100%)',
            opacity: 0.5,
          }}
        />
      )}
    </motion.button>
  );
}
