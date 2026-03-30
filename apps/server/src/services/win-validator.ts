// ============================================================
// Bingo Royale - Win Validation Service (Anti-Cheat)
// ============================================================

import type { BingoCard75, BingoCard90, WinStage90 } from '@bingo/shared';
import {
  checkWin75,
  checkWinStage90,
  FREE_SPACE_INDEX,
  WIN_PATTERNS,
} from '@bingo/shared';
import * as roomStore from '../redis/room-store.js';

export interface ValidationResult {
  valid: boolean;
  pattern?: string;
}

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
  // Get the player's cards array
  const cards = await roomStore.getCard(roomCode, playerId);
  if (!cards || cards.length === 0) {
    return { valid: false };
  }
  const safeIndex = Math.max(0, Math.min(cardIndex, cards.length - 1));
  const card = cards[safeIndex] as BingoCard75;
  if (!card) {
    return { valid: false };
  }

  // Get called numbers
  const callerState = await roomStore.getCallerState(roomCode);
  if (!callerState) {
    return { valid: false };
  }

  const calledSet = new Set(callerState.called);

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
  if (!room) {
    return { valid: false };
  }

  const dabbedSet = new Set(markedCells);

  // Check against each active pattern
  const activePatterns = WIN_PATTERNS.filter((p) =>
    room.patterns.includes(p.id),
  );

  for (const pattern of activePatterns) {
    if (checkWin75(dabbedSet, pattern)) {
      return { valid: true, pattern: pattern.id };
    }
  }

  // If no specific patterns are set, check all patterns
  if (room.patterns.length === 0) {
    for (const pattern of WIN_PATTERNS) {
      if (checkWin75(dabbedSet, pattern)) {
        return { valid: true, pattern: pattern.id };
      }
    }
  }

  return { valid: false };
}

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
  // Get the player's cards array
  const cards = await roomStore.getCard(roomCode, playerId);
  if (!cards || cards.length === 0) {
    return { valid: false };
  }
  const safeIndex = Math.max(0, Math.min(cardIndex, cards.length - 1));
  const card = cards[safeIndex] as BingoCard90;
  if (!card) {
    return { valid: false };
  }

  // Get called numbers
  const callerState = await roomStore.getCallerState(roomCode);
  if (!callerState) {
    return { valid: false };
  }

  const calledSet = new Set(callerState.called);

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
