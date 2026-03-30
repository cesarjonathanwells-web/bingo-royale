// ============================================================
// Bingo Royale - 90-Ball Bingo Logic
// ============================================================

import type { BingoCard90, WinStage90 } from './types.js';
import { COLUMN_RANGES_90 } from './constants.js';
import { shuffleArray } from './bingo.js';

// --------------- Column helpers ---------------

/**
 * Returns the column index (0-8) for a number 1-90.
 *
 * Column 0: 1-9, Column 1: 10-19, ..., Column 7: 70-79, Column 8: 80-90.
 */
export function getColumnForNumber90(n: number): number {
  if (n < 1 || n > 90 || !Number.isInteger(n)) {
    throw new RangeError(`Number must be an integer between 1 and 90, got ${n}`);
  }
  if (n <= 9) return 0;
  if (n >= 80) return 8;
  return Math.floor(n / 10);
}

// --------------- Card generation ---------------

/**
 * Generate a valid 90-ball bingo card.
 *
 * Rules:
 * - 9 columns, 3 rows
 * - Each row has exactly 5 numbers and 4 blanks (0)
 * - Column 0: 1-9, Column 1: 10-19, ..., Column 7: 70-79, Column 8: 80-90
 * - Numbers within a column are sorted ascending top to bottom
 * - Total of 15 numbers on the card
 *
 * Algorithm:
 * 1. Pick 1-3 random numbers from each column's range.
 * 2. Distribute so that every column has at least 1 number and totals exactly 15.
 * 3. Assign numbers to rows so each row has exactly 5 filled cells.
 * 4. Sort numbers within each column ascending.
 */
export function generateCard90(): BingoCard90 {
  // Step 1: Decide how many numbers each column gets (1, 2, or 3).
  // We need exactly 15 numbers across 9 columns, each column getting 1-3.
  const counts = distributeNumbers(9, 15, 1, 3);

  // Step 2: Pick random numbers for each column.
  const columnNumbers: number[][] = [];
  for (let col = 0; col < 9; col++) {
    const range = COLUMN_RANGES_90[col]!;
    const pool: number[] = [];
    for (let n = range.min; n <= range.max; n++) {
      pool.push(n);
    }
    const picked = shuffleArray(pool).slice(0, counts[col]!);
    picked.sort((a, b) => a - b);
    columnNumbers.push(picked);
  }

  // Step 3: Assign numbers to rows. Each row must have exactly 5 numbers.
  // Build a placement grid: grid[col][row] = number or 0
  const grid: number[][] = Array.from({ length: 9 }, () => [0, 0, 0]);

  // For each column, we need to decide which rows get its numbers.
  // We'll build a constraint-satisfaction solution:
  // rowCounts[row] tracks how many numbers are assigned to that row so far.
  const rowCounts = [0, 0, 0];

  // Create a list of columns sorted by count descending (assign most-constrained first)
  const colOrder = Array.from({ length: 9 }, (_, i) => i);
  colOrder.sort((a, b) => counts[b]! - counts[a]!);

  // Use backtracking to assign rows
  const assigned: number[][] = Array.from({ length: 9 }, () => []);

  function backtrack(idx: number): boolean {
    if (idx === 9) {
      // Check all rows have exactly 5
      return rowCounts[0] === 5 && rowCounts[1] === 5 && rowCounts[2] === 5;
    }

    const col = colOrder[idx]!;
    const count = counts[col]!;
    const rowCombinations = getRowCombinations(count, rowCounts);

    // Shuffle combinations for randomness
    const shuffled = shuffleArray(rowCombinations);

    for (const combo of shuffled) {
      // Try this combination
      for (const row of combo) {
        rowCounts[row]++;
      }
      assigned[col] = combo;

      if (backtrack(idx + 1)) {
        return true;
      }

      // Undo
      for (const row of combo) {
        rowCounts[row]--;
      }
      assigned[col] = [];
    }
    return false;
  }

  backtrack(0);

  // Place numbers into the grid
  for (let col = 0; col < 9; col++) {
    const rows = assigned[col]!.slice().sort((a, b) => a - b);
    const nums = columnNumbers[col]!;
    for (let i = 0; i < rows.length; i++) {
      grid[col]![rows[i]!] = nums[i]!;
    }
  }

  const id = generateCard90Id();

  return { id, grid };
}

/**
 * Get all valid row combinations for placing `count` numbers into 3 rows,
 * given current row fill counts (each row maxes at 5).
 */
function getRowCombinations(count: number, rowCounts: number[]): number[][] {
  const available = [0, 1, 2].filter((r) => rowCounts[r]! < 5);
  const results: number[][] = [];

  function combine(start: number, current: number[]) {
    if (current.length === count) {
      results.push(current.slice());
      return;
    }
    for (let i = start; i < available.length; i++) {
      current.push(available[i]!);
      combine(i + 1, current);
      current.pop();
    }
  }

  combine(0, []);
  return results;
}

/**
 * Distribute `total` items into `buckets` buckets, each getting between `min` and `max`.
 * Returns an array of counts. Uses random distribution.
 */
function distributeNumbers(
  buckets: number,
  total: number,
  min: number,
  max: number,
): number[] {
  // Start each bucket at min
  const counts = new Array<number>(buckets).fill(min);
  let remaining = total - buckets * min;

  // Randomly distribute the remainder
  const indices = shuffleArray(Array.from({ length: buckets }, (_, i) => i));

  for (const idx of indices) {
    if (remaining <= 0) break;
    const canAdd = Math.min(max - counts[idx]!, remaining);
    if (canAdd > 0) {
      const add = Math.floor(Math.random() * canAdd) + 1;
      counts[idx] += add;
      remaining -= add;
    }
  }

  // If there's still remainder, distribute it greedily
  while (remaining > 0) {
    const shuffled = shuffleArray(Array.from({ length: buckets }, (_, i) => i));
    for (const idx of shuffled) {
      if (remaining <= 0) break;
      if (counts[idx]! < max) {
        counts[idx]!++;
        remaining--;
      }
    }
  }

  return counts;
}

// --------------- Caller pool ---------------

/**
 * Returns a shuffled array of numbers 1 through 90 for the caller.
 */
export function generateCallerPool90(): number[] {
  const pool: number[] = [];
  for (let i = 1; i <= 90; i++) {
    pool.push(i);
  }
  return shuffleArray(pool);
}

// --------------- Win checking ---------------

/**
 * Check if a player has won a particular stage in 90-ball bingo.
 *
 * @param card - The player's 90-ball card.
 * @param dabbedCells - Set of flat indices (row-major in a 9x3 grid: index = row * 9 + col)
 *                      that the player has dabbed.
 * @param stage - The win stage to check: 'one_line', 'two_lines', or 'full_house'.
 * @returns true if the player has completed the required stage.
 */
export function checkWinStage90(
  card: BingoCard90,
  dabbedCells: Set<number>,
  stage: WinStage90,
): boolean {
  const completedRows = countCompletedRows(card, dabbedCells);

  switch (stage) {
    case 'one_line':
      return completedRows >= 1;
    case 'two_lines':
      return completedRows >= 2;
    case 'full_house':
      return completedRows >= 3;
  }
}

/**
 * Count how many rows are fully dabbed on a 90-ball card.
 * A row is complete when all its non-zero (non-blank) cells are dabbed.
 *
 * Flat index for 90-ball (row-major in 9-column grid): index = row * 9 + col
 */
function countCompletedRows(card: BingoCard90, dabbedCells: Set<number>): number {
  let completed = 0;

  for (let row = 0; row < 3; row++) {
    let rowComplete = true;
    for (let col = 0; col < 9; col++) {
      const value = card.grid[col]![row]!;
      if (value !== 0) {
        const flatIndex = row * 9 + col;
        if (!dabbedCells.has(flatIndex)) {
          rowComplete = false;
          break;
        }
      }
    }
    if (rowComplete) {
      completed++;
    }
  }

  return completed;
}

// --------------- Internal helpers ---------------

function generateCard90Id(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'card90_';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
