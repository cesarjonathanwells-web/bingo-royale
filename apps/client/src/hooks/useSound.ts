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

type SoundName =
  | "numberCalled"
  | "cellDabbed"
  | "bingoWin"
  | "bingoInvalid"
  | "reaction";

// --------------- Web Audio API sound synthesis ---------------

const dabNoiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function createDabSound(ctx: AudioContext) {
  // A soft rubber-dauber body, followed by a tiny breath of ink on paper.
  // Both voices finish within 95 ms and remain quieter than the caller chime.
  const start = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(230, start);
  osc.frequency.exponentialRampToValueAtTime(85, start + 0.075);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.linearRampToValueAtTime(0.24, start + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  osc.start(start);
  osc.stop(start + 0.095);

  let buffer = dabNoiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 731;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      samples[i] = seed / 2147483648;
    }
    dabNoiseBuffers.set(ctx, buffer);
  }
  const ink = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const inkGain = ctx.createGain();
  ink.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, start);
  filter.Q.setValueAtTime(0.6, start);
  inkGain.gain.setValueAtTime(0.001, start);
  inkGain.gain.linearRampToValueAtTime(0.045, start + 0.002);
  inkGain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);
  ink.connect(filter);
  filter.connect(inkGain);
  inkGain.connect(ctx.destination);
  ink.onended = () => { ink.disconnect(); filter.disconnect(); inkGain.disconnect(); };
  ink.start(start);
  ink.stop(start + 0.05);
}

function createNumberCalledSound(ctx: AudioContext) {
  // Short "ding" - 800Hz sine, 0.15s
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

function createBingoWinSound(ctx: AudioContext) {
  // Ascending arpeggio - C E G C sequence, each 0.1s, total ~0.5s
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const startTime = ctx.currentTime + i * 0.12;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.15);
  });
}

function createBingoInvalidSound(ctx: AudioContext) {
  // Low "buzz" - 150Hz sawtooth, 0.3s, quick fade
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

function createReactionSound(ctx: AudioContext) {
  // Tiny "blip" - 600Hz, 0.05s
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}

const SOUND_CREATORS: Record<SoundName, (ctx: AudioContext) => void> = {
  cellDabbed: createDabSound,
  numberCalled: createNumberCalledSound,
  bingoWin: createBingoWinSound,
  bingoInvalid: createBingoInvalidSound,
  reaction: createReactionSound,
};

/**
 * Hook to play game sounds using Web Audio API synthesis.
 * No audio files required - all sounds are generated programmatically.
 * AudioContext is lazily created on first user interaction (browser policy).
 * Respects the global mute setting.
 */
export function useSound() {
  const muted = useSoundStore((s) => s.muted);
  const toggleMute = useSoundStore((s) => s.toggleMute);
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    // Resume if suspended (browser autoplay policy)
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  // Server-confirmed stamps arrive after the pointer event. Unlock the shared
  // context during a real gesture first, including when auto-daub is enabled.
  useEffect(() => {
    if (muted) return;
    const unlock = () => {
      try { getContext(); } catch { /* Web Audio is optional. */ }
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, { capture: true, once: true });
    window.addEventListener("keydown", unlock, { capture: true, once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [muted, getContext]);

  const play = useCallback(
    (name: SoundName) => {
      if (muted) return;
      try {
        const ctx = getContext();
        const creator = SOUND_CREATORS[name];
        if (creator) {
          creator(ctx);
        }
      } catch {
        // AudioContext creation may fail in some environments; silently ignore
      }
    },
    [muted, getContext],
  );

  return { play, muted, toggleMute };
}

