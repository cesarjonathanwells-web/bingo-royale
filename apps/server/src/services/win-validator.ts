// ============================================================
// Bingo Royale - Win Validation Service (Anti-Cheat)
// ============================================================

import type { BingoCard, BingoCard75, BingoCard90, WinStage90 } from '@bingo/shared';
import {
  checkWin75,
  checkWinStage90,
  FREE_SPACE_INDEX,
  WIN_PATTERNS,
  resolvePattern,
} from '@bingo/shared';
import type { WinPattern } from '@bingo/shared';
import * as roomStore from '../redis/room-store.js';

export interface ValidationResult {
  valid: boolean;
  pattern?: string;
}

// --------------- Common helpers ---------------

/**
 * Retrieve a player's card and the room's called numbers for validation.
 * Returns null if the card or caller state is not available.
 */
async function getValidationContext(
  roomCode: string,
  playerId: string,
  cardIndex: number,
): Promise<{ card: BingoCard; calledSet: Set<number> } | null> {
  const cards = await roomStore.getCard(roomCode, playerId);
  if (!cards || cards.length === 0) return null;

  const safeIndex = Math.max(0, Math.min(cardIndex, cards.length - 1));
  const card = cards[safeIndex];
  if (!card) return null;

  const callerState = await roomStore.getCallerState(roomCode);
  if (!callerState) return null;

  return { card, calledSet: new Set(callerState.called) };
}

// --------------- 75-ball validation ---------------

/**
 * Validate a 75-ball bingo claim.
 *
 * Steps:
 * 1. Get the player's card from the store (by cardIndex)
 * 2. Get the called numbers for the room
 * 3. Verify all marked cells correspond to numbers that have been called (or FREE space)
 * 4. Check if the marked cells satisfy any active win pattern
 */
export async function validateBingo75(
  roomCode: string,
  playerId: string,
  markedCells: number[],
  cardIndex: number = 0,
): Promise<ValidationResult> {
  const ctx = await getValidationContext(roomCode, playerId, cardIndex);
  if (!ctx) return { valid: false };

  const card = ctx.card as BingoCard75;
  const { calledSet } = ctx;

  // Verify each marked cell corresponds to a called number or is the FREE space
  for (const cellIndex of markedCells) {
    if (cellIndex === FREE_SPACE_INDEX) continue;

    // Convert cell index (row-major) to grid value (column-major)
    const row = Math.floor(cellIndex / 5);
    const col = cellIndex % 5;
    const cellValue = card.grid[col]?.[row];

    if (cellValue === null || cellValue === undefined) {
      // FREE space or invalid cell
      continue;
    }

    if (!calledSet.has(cellValue)) {
      // Player marked a number that hasn't been called
      return { valid: false };
    }
  }

  // Get active patterns for the room
  const room = await roomStore.getRoom(roomCode);
  if (!room) return { valid: false };

  const dabbedSet = new Set(markedCells);

  // Build active patterns list (built-in + custom)
  const customPatterns = room.customPatterns ?? [];
  const activePatterns = room.patterns
    .map((id) => resolvePattern(id, customPatterns))
    .filter((p): p is WinPattern => p !== undefined);

  for (const pattern of activePatterns) {
    if (checkWin75(dabbedSet, pattern)) {
      return { valid: true, pattern: pattern.id };
    }
  }

  // If no specific patterns are set, check all built-in patterns
  if (room.patterns.length === 0) {
    for (const pattern of WIN_PATTERNS) {
      if (checkWin75(dabbedSet, pattern)) {
        return { valid: true, pattern: pattern.id };
      }
    }
  }

  return { valid: false };
}

// --------------- 90-ball validation ---------------

/**
 * Validate a 90-ball bingo claim.
 *
 * Steps:
 * 1. Get the player's card from the store (by cardIndex)
 * 2. Get the called numbers for the room
 * 3. Verify all marked cells correspond to called numbers
 * 4. Check if the marked cells satisfy the claimed win stage
 */
export async function validateBingo90(
  roomCode: string,
  playerId: string,
  markedCells: number[],
  stage: WinStage90,
  cardIndex: number = 0,
): Promise<ValidationResult> {
  const ctx = await getValidationContext(roomCode, playerId, cardIndex);
  if (!ctx) return { valid: false };

  const card = ctx.card as BingoCard90;
  const { calledSet } = ctx;

  // Verify each marked cell corresponds to a called number
  // 90-ball card: grid[col][row], 9 columns x 3 rows, 0 = blank
  for (const cellIndex of markedCells) {
    const row = Math.floor(cellIndex / 9);
    const col = cellIndex % 9;
    const cellValue = card.grid[col]?.[row];

    if (cellValue === 0 || cellValue === undefined) {
      // Blank cell - player shouldn't have marked this
      return { valid: false };
    }

    if (!calledSet.has(cellValue)) {
      return { valid: false };
    }
  }

  // Check the win stage
  const dabbedSet = new Set(markedCells);
  const isWin = checkWinStage90(card, dabbedSet, stage);

  if (isWin) {
    return { valid: true, pattern: stage };
  }

  return { valid: false };
}

// --------------- Bingo expiration checks ---------------

/**
 * Check if a 75-ball pattern was already completable before the most recently
 * called number.  If it was, the player missed their window to claim bingo
 * with this pattern (they should have called before the next number was drawn).
 */
export async function isPatternExpired75(
  roomCode: string,
  playerId: string,
  patternId: string,
  cardIndex: number,
): Promise<boolean> {
  const cards = await roomStore.getCard(roomCode, playerId);
  if (!cards || cards.length === 0) return false;

  const safeIndex = Math.max(0, Math.min(cardIndex, cards.length - 1));
  const card = cards[safeIndex] as BingoCard75;

  const callerState = await roomStore.getCallerState(roomCode);
  if (!callerState || callerState.called.length <= 1) return false;

  // Numbers called before the most recent one
  const previousCalled = new Set(callerState.called.slice(0, -1));

  const room = await roomStore.getRoom(roomCode);
  const pattern = resolvePattern(patternId, room?.customPatterns);
  if (!pattern) return false;

  // If every cell value in the pattern was already called before the last
  // number, the pattern was completable earlier → expired.
  for (const cellIndex of pattern.cells) {
    if (cellIndex === FREE_SPACE_INDEX) continue;

    const row = Math.floor(cellIndex / 5);
    const col = cellIndex % 5;
    const cellValue = card.grid[col]?.[row];

    if (cellValue === null || cellValue === undefined) continue;
    if (!previousCalled.has(cellValue)) return false;
  }

  return true;
}

/**
 * Check if a 90-ball stage was already completable before the most recently
 * called number.
 */
export async function isStageExpired90(
  roomCode: string,
  playerId: string,
  stage: WinStage90,
  cardIndex: number,
): Promise<boolean> {
  const cards = await roomStore.getCard(roomCode, playerId);
  if (!cards || cards.length === 0) return false;

  const safeIndex = Math.max(0, Math.min(cardIndex, cards.length - 1));
  const card = cards[safeIndex] as BingoCard90;

  const callerState = await roomStore.getCallerState(roomCode);
  if (!callerState || callerState.called.length <= 1) return false;

  const previousCalled = new Set(callerState.called.slice(0, -1));

  // Count rows where every non-blank cell value was called before the last number
  let completableRows = 0;
  for (let row = 0; row < 3; row++) {
    let rowComplete = true;
    for (let col = 0; col < 9; col++) {
      const value = card.grid[col]![row]!;
      if (value !== 0 && !previousCalled.has(value)) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) completableRows++;
  }

  switch (stage) {
    case 'one_line':
      return completableRows >= 1;
    case 'two_lines':
      return completableRows >= 2;
    case 'full_house':
      return completableRows >= 3;
  }
}
