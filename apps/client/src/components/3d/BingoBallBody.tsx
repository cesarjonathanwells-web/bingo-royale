import { useState, type ReactNode } from "react";
import { BlenderBallSurface } from "./BlenderBallSurface";
import { cn } from "@/lib/utils";

interface BingoBallBodyProps {
  letter: string;
  color: string;
  className?: string;
  active?: boolean;
  children: ReactNode;
}

/** One material/shadow treatment for home, current-call, and history balls. */
export function BingoBallBody({ letter, color, className, active = false, children }: BingoBallBodyProps) {
  const paletteKey = "BINGO".includes(letter) && letter.length === 1 ? letter : "O";
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const artworkReady = readyFor === paletteKey;
  const shadow = "0 4px 10px rgba(0,0,0,.30)";
  const halo = active ? ", 0 0 12px rgba(212,162,76,.10)" : "";

  return (
    <div
      className={cn("relative rounded-full flex items-center justify-center", className)}
      style={{
        background: artworkReady ? "transparent" : `radial-gradient(circle at 32% 28%, ${shade(color, 0.5)}, ${color} 50%, ${shade(color, -0.3)} 100%)`,
        // The PNG already contains studio reflections. Inset shading is only a fallback.
        boxShadow: shadow + halo + (artworkReady ? "" : ", inset 0 -3px 6px rgba(0,0,0,.20), inset 0 2px 6px rgba(255,255,255,.20)"),
      }}
    >
      <BlenderBallSurface key={paletteKey} letter={paletteKey} onReadyChange={ready => setReadyFor(ready ? paletteKey : null)} />
      {children}
    </div>
  );
}

function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const channels = [value >> 16 & 255, value >> 8 & 255, value & 255];
  return `rgb(${channels.map(channel => Math.round(amount > 0 ? channel + (255 - channel) * amount : channel * (1 + amount))).join(",")})`;
}
