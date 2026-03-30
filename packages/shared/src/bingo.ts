// ============================================================
// Bingo Royale - 75-Ball Bingo Logic
// ============================================================

import type { BingoCard75, WinPattern } from './types.js';
import { COLUMN_RANGES, LETTERS, FREE_SPACE_INDEX } from './constants.js';

// --------------- Utilities ---------------

/**
 * Fisher-Yates shuffle. Returns a new array; does not mutate the input.
 */
export function shuffleArray<T>(arr: readonly T[]): T[] {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

// --------------- Letter / Column helpers ---------------

/**
 * Returns the column letter (B, I, N, G, O) for a number 1-75.
 * Throws if the number is out of range.
 */
export function getLetterForNumber(n: number): string {
  const col = getColumnForNumber(n);
  return LETTERS[col]!;
}

/**
 * Returns the column index (0-4) for a number 1-75.
 * Throws if the number is out of range.
 */
export function getColumnForNumber(n: number): number {
  if (n < 1 || n > 75 || !Number.isInteger(n)) {
    throw new RangeError(`Number must be an integer between 1 and 75, got ${n}`);
  }
  return Math.floor((n - 1) / 15);
}

// --------------- Cell index conversion ---------------

/**
 * Convert a flat row-major index (0-24) to [row, col].
 * Row-major layout:
 *   0  1  2  3  4
 *   5  6  7  8  9
 *  10 11 12 13 14
 *  15 16 17 18 19
 *  20 21 22 23 24
 */
export function cellToRowCol(index: number): [number, number] {
  if (index < 0 || index > 24 || !Number.isInteger(index)) {
    throw new RangeError(`Cell index must be an integer between 0 and 24, got ${index}`);
  }
  const row = Math.floor(index / 5);
  const col = index % 5;
  return [row, col];
}

/**
 * Convert [row, col] to a flat row-major index (0-24).
 */
export function rowColToCell(row: number, col: number): number {
  if (row < 0 || row > 4 || col < 0 || col > 4) {
    throw new RangeError(`Row and col must be between 0 and 4, got [${row}, ${col}]`);
  }
  return row * 5 + col;
}

// --------------- Card value access ---------------

/**
 * Get the value at a cell index (row-major) from a 75-ball card.
 * The card grid is stored column-major: grid[col][row].
 * Returns null for the FREE space.
 */
export function getCardCellValue(card: BingoCard75, index: number): number | null {
  const [row, col] = cellToRowCol(index);
  return card.grid[col]![row]!;
}

// --------------- Card generation ---------------

/**
 * Generate a valid 75-ball bingo card.
 *
 * Each column gets 5 random numbers from its range (B=1-15, I=16-30, etc.),
 * shuffled with Fisher-Yates, then sorted ascending within the column.
 * The center cell (grid[2][2], which is row-major index 12) is set to null (FREE).
 */
export function generateCard75(): BingoCard75 {
  const grid: (number | null)[][] = [];

  for (let col = 0; col < 5; col++) {
    const range = COLUMN_RANGES[col]!;
    // Build array of all numbers in this column's range
    const pool: number[] = [];
    for (let n = range.min; n <= range.max; n++) {
      pool.push(n);
    }
    // Pick 5 random numbers using Fisher-Yates partial shuffle
    const picked = shuffleArray(pool).slice(0, 5);
    // Sort ascending so the column looks natural
    picked.sort((a, b) => a - b);
    grid.push(picked);
  }

  // Set FREE space: column 2, row 2 (center of 5x5)
  grid[2]![2] = null;

  const id = generateCardId();

  return { id, grid };
}

// --------------- Caller pool ---------------

/**
 * Returns a shuffled array of numbers 1 through 75 for the caller.
 */
export function generateCallerPool75(): number[] {
  const pool: number[] = [];
  for (let i = 1; i <= 75; i++) {
    pool.push(i);
  }
  return shuffleArray(pool);
}

// --------------- Win checking ---------------

/**
 * Check if the dabbed cells satisfy a given win pattern.
 *
 * The FREE space (index 12) is always considered dabbed.
 *
 * @param dabbedCells - Set of row-major cell indices that the player has dabbed.
 * @param pattern - The win pattern to check against.
 * @returns true if every cell in the pattern is dabbed (or is the FREE space).
 */
export function checkWin75(dabbedCells: Set<number>, pattern: WinPattern): boolean {
  return pattern.cells.every(
    (cell) => cell === FREE_SPACE_INDEX || dabbedCells.has(cell),
  );
}

// --------------- Internal helpers ---------------

/**
 * Generate a short unique-ish card ID.
 */
function generateCardId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'card_';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
