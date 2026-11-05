import { useState } from "react";

interface BlenderBallSurfaceProps {
  letter: string;
  onReadyChange?: (ready: boolean) => void;
}

/** Unreal-rendered artwork over the existing CSS ball; labels remain live HTML. */
export function BlenderBallSurface({ letter, onReadyChange }: BlenderBallSurfaceProps) {
  const [failed, setFailed] = useState(false);
  const paletteKey = "BINGO".includes(letter) && letter.length === 1 ? letter : "O";
  if (failed) return null;

  return (
    <img
      src={`/images/unreal-balls/${paletteKey.toLowerCase()}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={256}
      height={256}
      className="absolute inset-0 w-full h-full rounded-full pointer-events-none"
      onLoad={() => onReadyChange?.(true)}
      onError={() => { setFailed(true); onReadyChange?.(false); }}
    />
  );
}
