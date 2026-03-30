// ============================================================
// Bingo Royale - Shared Types
// ============================================================

// --------------- Game variants ---------------

export type BingoVariant = '75' | '90';

// --------------- Cards ---------------

/**
 * 75-ball card: 5x5 grid.
 * Grid is stored column-major: grid[col][row].
 * Center cell grid[2][2] is null (FREE space).
 * Column ranges: B(1-15), I(16-30), N(31-45), G(46-60), O(61-75).
 */
export interface BingoCard75 {
  id: string;
  grid: (number | null)[][]; // 5 columns, 5 rows each
}

/**
 * 90-ball card: 9x3 grid.
 * Grid is stored column-major: grid[col][row].
 * Each cell is a number or 0 (blank).
 * Each row has exactly 5 numbers and 4 blanks.
 * 15 numbers total on the card.
 */
export interface BingoCard90 {
  id: string;
  grid: (number | 0)[][]; // 9 columns, 3 rows each
}

export type BingoCard = BingoCard75 | BingoCard90;

// --------------- Win patterns (75-ball) ---------------

/**
 * A win pattern for 75-ball bingo.
 * cells contains indices in a 5x5 grid using row-major order:
 *   0  1  2  3  4
 *   5  6  7  8  9
 *  10 11 12 13 14
 *  15 16 17 18 19
 *  20 21 22 23 24
 */
export interface WinPattern {
  id: string;
  name: string;
  nameEs: string;
  cells: number[];
}

// --------------- Win stages (90-ball) ---------------

export type WinStage90 = 'one_line' | 'two_lines' | 'full_house';

// --------------- Room / Lobby ---------------

export type RoomState = 'lobby' | 'in_progress' | 'finished';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  isSpectator: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  variant: BingoVariant;
  state: RoomState;
  speed: number; // ms between calls
  patterns: string[]; // pattern IDs (75-ball) or win stages (90-ball)
  playerLimit: number;
  players: Player[];
  createdAt: number;
}

// --------------- Game state (in-progress) ---------------

export interface WinEvent {
  playerId: string;
  playerName: string;
  pattern: string; // pattern ID or win stage
  timestamp: number;
}

export interface GameState {
  calledNumbers: number[];
  currentNumber: number | null;
  currentLetter: string | null; // B, I, N, G, O (75-ball only)
  paused: boolean;
  startedAt: number;
  winners: WinEvent[];
}

// --------------- Player card state ---------------

export interface PlayerCardState {
  card: BingoCard;
  dabbed: Set<number>; // set of cell indices that are dabbed
}

// --------------- Multi-card state ---------------

export interface MultiCardState {
  cards: BingoCard[];
  dabs: Set<number>[]; // one Set per card
}

// --------------- Chat ---------------

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

// --------------- Auth / Users ---------------

export interface GuestUser {
  id: string;
  name: string;
  isGuest: true;
  locale: 'en' | 'es';
}

export interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  isGuest: false;
  locale: 'en' | 'es';
}

export type User = GuestUser | RegisteredUser;

// --------------- Stats ---------------

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  totalDabs: number;
}

// --------------- Caller speed presets ---------------

export interface SpeedPreset {
  id: string;
  name: string;
  nameEs: string;
  ms: number;
}

// --------------- Power-ups ---------------

export type PowerUpId =
  | 'double_daub'
  | 'number_peek'
  | 'wild_square'
  | 'shield'
  | 'scramble'
  | 'callers_choice'
  | 'ink_blot'
  | 'turbo_stamp';

export interface PowerUpDef {
  id: PowerUpId;
  name: string;
  nameEs: string;
  description: string;
  descriptionEs: string;
  icon: string; // emoji for now
  duration?: number; // turns it lasts (if applicable)
}

export interface PlayerPowerUp {
  id: PowerUpId;
  used: boolean;
}
