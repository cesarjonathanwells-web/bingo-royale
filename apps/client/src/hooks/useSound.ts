import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SoundState {
  muted: boolean;
  toggleMute: () => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      muted: false,
      toggleMute: () => set((s) => ({ muted: !s.muted })),
    }),
    { name: "bingo-sound" },
  ),
);

type SoundName = "numberCalled" | "cellDabbed" | "bingoWin" | "bingoInvalid";

const SOUND_PATHS: Record<SoundName, string> = {
  numberCalled: "/sounds/number-called.mp3",
  cellDabbed: "/sounds/cell-dabbed.mp3",
  bingoWin: "/sounds/bingo-win.mp3",
  bingoInvalid: "/sounds/bingo-invalid.mp3",
};

/**
 * Hook to play game sounds.
 * Sounds are preloaded and reused via HTMLAudioElement.
 * Respects the global mute setting.
 */
export function useSound() {
  const muted = useSoundStore((s) => s.muted);
  const toggleMute = useSoundStore((s) => s.toggleMute);
  const audioCache = useRef<Map<SoundName, HTMLAudioElement>>(new Map());

  useEffect(() => {
    // Preload audio elements
    for (const [name, path] of Object.entries(SOUND_PATHS)) {
      const audio = new Audio(path);
      audio.preload = "auto";
      audio.volume = 0.5;
      audioCache.current.set(name as SoundName, audio);
    }

    return () => {
      audioCache.current.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      audioCache.current.clear();
    };
  }, []);

  const play = useCallback(
    (name: SoundName) => {
      if (muted) return;
      const audio = audioCache.current.get(name);
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Autoplay may be blocked by browser; silently ignore
        });
      }
    },
    [muted],
  );

  return { play, muted, toggleMute };
}
