import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Screen shake wrapper — wraps children and shakes on trigger        */
/* ------------------------------------------------------------------ */

interface ScreenShakeProps {
  trigger: number;
  intensity?: number;
  duration?: number;
  children: React.ReactNode;
}

export function ScreenShake({
  trigger,
  intensity = 8,
  duration = 0.5,
  children,
}: ScreenShakeProps) {
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), duration * 1000);
    return () => clearTimeout(timer);
  }, [trigger, duration]);

  return (
    <motion.div
      animate={
        shaking
          ? {
              x: [0, -intensity, intensity, -intensity * 0.6, intensity * 0.6, -intensity * 0.3, 0],
              y: [0, intensity * 0.5, -intensity * 0.5, intensity * 0.3, -intensity * 0.3, 0],
            }
          : { x: 0, y: 0 }
      }
      transition={{ duration, ease: "easeOut" }}
      style={{ width: "100%", height: "100%" }}
    >
      {children}
    </motion.div>
  );
}
