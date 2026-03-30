// ============================================================
// Bingo Royale - Game Constants
// ============================================================

import type { SpeedPreset } from './types.js';

// --------------- 75-ball column ranges ---------------

/**
 * Column ranges for 75-ball bingo.
 * Index 0 (B): 1-15, Index 1 (I): 16-30, Index 2 (N): 31-45,
 * Index 3 (G): 46-60, Index 4 (O): 61-75.
 */
export const COLUMN_RANGES: readonly { min: number; max: number }[] = [
  { min: 1, max: 15 },   // B
  { min: 16, max: 30 },  // I
  { min: 31, max: 45 },  // N
  { min: 46, max: 60 },  // G
  { min: 61, max: 75 },  // O
] as const;

// --------------- 90-ball column ranges ---------------

/**
 * Column ranges for 90-ball bingo.
 * Column 0: 1-9, Column 1: 10-19, ..., Column 7: 70-79, Column 8: 80-90.
 */
export const COLUMN_RANGES_90: readonly { min: number; max: number }[] = [
  { min: 1, max: 9 },
  { min: 10, max: 19 },
  { min: 20, max: 29 },
  { min: 30, max: 39 },
  { min: 40, max: 49 },
  { min: 50, max: 59 },
  { min: 60, max: 69 },
  { min: 70, max: 79 },
  { min: 80, max: 90 },
] as const;

// --------------- Letters ---------------

/** The 5 bingo column letters in order. */
export const LETTERS: readonly string[] = ['B', 'I', 'N', 'G', 'O'] as const;

// --------------- Speed presets ---------------

export const SPEED_PRESETS: readonly SpeedPreset[] = [
  { id: 'slow', name: 'Slow', nameEs: 'Lento', ms: 8000 },
  { id: 'normal', name: 'Normal', nameEs: 'Normal', ms: 5000 },
  { id: 'fast', name: 'Fast', nameEs: 'Rapido', ms: 3000 },
  { id: 'rapid', name: 'Rapid', nameEs: 'Muy Rapido', ms: 1500 },
] as const;

// --------------- Grid constants ---------------

/** Index of the FREE space in a 5x5 row-major grid (center cell). */
export const FREE_SPACE_INDEX = 12;

// --------------- Room / Player limits ---------------

/** Maximum number of players allowed in any room. */
export const MAX_PLAYERS = 200;

/** Default player limit for a new room. */
export const DEFAULT_PLAYER_LIMIT = 50;

/** Number of characters in a room code. */
export const ROOM_CODE_LENGTH = 6;

/** AFK timeout in milliseconds (5 minutes). */
export const AFK_TIMEOUT = 300_000;

// --------------- Ball colors (75-ball) ---------------

/**
 * Hex color values for each bingo letter column.
 * Used by the UI to style called balls.
 */
export const BALL_COLORS: Record<string, string> = {
  B: '#3b82f6', // vivid blue
  I: '#ef4444', // vivid red
  N: '#a78bfa', // vivid violet
  G: '#22c55e', // vivid green
  O: '#f59e0b', // vivid amber
} as const;

// --------------- Emoji reactions ---------------

/** Allowed emojis for quick reactions during gameplay. */
export const GAME_EMOJIS = [
  '\u{1F389}', '\u{1F631}', '\u{1F44F}', '\u{1F605}', '\u{1F525}', '\u{1F4AA}',
  '\u{1F62D}', '\u{1F91E}', '\u{1F624}', '\u{1F64F}', '\u{1F480}', '\u{1F3AF}',
  '\u{2B50}', '\u{1F440}', '\u{1F60E}', '\u{1F92F}', '\u{2764}\u{FE0F}', '\u{1F494}',
  '\u{1F340}', '\u{1F38A}', '\u{1F602}', '\u{1F973}', '\u{1F451}', '\u{1F91D}',
] as const;
