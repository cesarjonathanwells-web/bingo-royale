import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSoundStore } from "./useSound";

const LETTERS = ["B", "I", "N", "G", "O"];

/**
 * Returns the audio file path for a given bingo ball.
 *
 * 75-ball: /audio/calls/{lang}/75/{letter}-{number}.mp3
 * 90-ball: /audio/calls/{lang}/90/{number}.mp3
 */
function getAudioPath(
  number: number,
  variant: "75" | "90",
  lang: "en" | "es",
): string {
  if (variant === "75") {
    const letter = LETTERS[Math.floor((number - 1) / 15)];
    return `/audio/calls/${lang}/75/${letter}-${number}.mp3`;
  }
  return `/audio/calls/${lang}/90/${number}.mp3`;
}

/**
 * Hook to announce bingo ball calls using pre-recorded audio files.
 * Plays the correct file based on current i18n language and game variant.
 * Respects the global mute setting from useSoundStore.
 */
export function useBingoCaller() {
  const muted = useSoundStore((s) => s.muted);
  const { i18n } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const announce = useCallback(
    (number: number, variant: "75" | "90") => {
      if (muted) return;

      const lang: "en" | "es" = i18n.language?.startsWith("es") ? "es" : "en";
      const src = getAudioPath(number, variant, lang);

      // Reuse cached Audio elements for instant replay
      let audio = cacheRef.current.get(src);
      if (!audio) {
        audio = new Audio(src);
        cacheRef.current.set(src, audio);
      }

      // Stop any currently playing announcement
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      audio.currentTime = 0;
      audio.play().catch(() => {
        // Autoplay policy: silently ignore if user hasn't interacted yet
      });
      audioRef.current = audio;
    },
    [muted, i18n.language],
  );

  const preload = useCallback(
    (variant: "75" | "90") => {
      const lang: "en" | "es" = i18n.language?.startsWith("es") ? "es" : "en";
      const max = variant === "75" ? 75 : 90;

      for (let n = 1; n <= max; n++) {
        const src = getAudioPath(n, variant, lang);
        if (!cacheRef.current.has(src)) {
          const audio = new Audio();
          audio.preload = "auto";
          audio.src = src;
          cacheRef.current.set(src, audio);
        }
      }
    },
    [i18n.language],
  );

  return { announce, preload };
}
