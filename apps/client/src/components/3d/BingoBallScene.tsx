import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  CSS 3D-look bingo balls — no WebGL, always faces forward           */
/* ------------------------------------------------------------------ */

const BALLS = [
  { number: 7, color: "#3b82f6", letter: "B" },
  { number: 22, color: "#ef4444", letter: "I" },
  { number: 38, color: "#a78bfa", letter: "N" },
  { number: 51, color: "#22c55e", letter: "G" },
  { number: 65, color: "#f59e0b", letter: "O" },
];

function BingoBall({
  color,
  letter,
  number,
  index,
}: {
  color: string;
  letter: string;
  number: number;
  index: number;
}) {
  return (
    <motion.div
      className="relative select-none"
      animate={{ y: [0, -8, 0] }}
      transition={{
        duration: 2.5 + index * 0.3,
        repeat: Infinity,
        ease: "easeInOut",
        delay: index * 0.2,
      }}
    >
      {/* Ball body */}
      <div
        className="w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 32% 28%, ${lighten(color, 50)}, ${color} 50%, ${darken(color, 30)} 100%)`,
          boxShadow: `
            0 6px 20px ${color}55,
            0 2px 8px rgba(0,0,0,0.4),
            inset 0 -4px 8px ${darken(color, 25)}80,
            inset 0 3px 8px ${lighten(color, 30)}50
          `,
        }}
      >
        {/* Specular highlight */}
        <div
          className="absolute rounded-full"
          style={{
            width: "40%",
            height: "22%",
            top: "12%",
            left: "18%",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.15) 50%, transparent 80%)",
          }}
        />

        {/* White inner circle with letter + number */}
        <div
          className="w-9 h-9 sm:w-13 sm:h-13 lg:w-16 lg:h-16 rounded-full flex flex-col items-center justify-center z-10"
          style={{
            background: "radial-gradient(circle at 48% 38%, #ffffff, #f4f4f4 60%, #e8e8e8 85%, #ddd 100%)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.4)",
          }}
        >
          <span
            className="font-bold leading-none"
            style={{ color, fontSize: "clamp(7px, 1.2vw, 11px)" }}
          >
            {letter}
          </span>
          <span
            className="font-extrabold leading-none"
            style={{ color: "#0f1330", fontSize: "clamp(13px, 2.5vw, 22px)" }}
          >
            {number}
          </span>
        </div>
      </div>

      {/* Drop shadow */}
      <div
        className="mx-auto rounded-full mt-1"
        style={{
          width: "60%",
          height: "clamp(3px, 0.5vw, 6px)",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.06) 50%, transparent 75%)",
        }}
      />
    </motion.div>
  );
}

export function BingoBallScene() {
  return (
    <div className="flex justify-center items-center gap-3 sm:gap-5 lg:gap-8 py-2 sm:py-4">
      {BALLS.map((ball, i) => (
        <motion.div
          key={ball.number}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            delay: 0.1 + i * 0.08,
          }}
        >
          <BingoBall
            color={ball.color}
            letter={ball.letter}
            number={ball.number}
            index={i}
          />
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Color helpers                                                      */
/* ------------------------------------------------------------------ */

function lighten(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 255) + Math.round((255 * percent) / 100));
  const g = Math.min(255, ((num >> 8) & 255) + Math.round((255 * percent) / 100));
  const b = Math.min(255, (num & 255) + Math.round((255 * percent) / 100));
  return `rgb(${r}, ${g}, ${b})`;
}

function darken(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((num >> 16) & 255) - Math.round((255 * percent) / 100));
  const g = Math.max(0, ((num >> 8) & 255) - Math.round((255 * percent) / 100));
  const b = Math.max(0, (num & 255) - Math.round((255 * percent) / 100));
  return `rgb(${r}, ${g}, ${b})`;
}
