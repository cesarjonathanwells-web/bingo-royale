import type { BingoCard, WinPattern, WinStage90 } from "@bingo/shared";
import { FREE_SPACE_INDEX, WIN_PATTERNS, resolvePattern } from "@bingo/shared";

export interface CardProgress {
  /** Infinity means no valid configured pattern could be resolved. */
  remaining: number;
  completed: boolean;
  patternId: string | null;
  winningCells: Set<number>;
  /** The whole best path is highlighted only when exactly one mark remains. */
  nearWinCells: Set<number>;
  missingCells: Set<number>;
  markedCount: number;
  totalCells: number;
}

interface Candidate {
  id: string;
  cells: number[];
}

const STAGES: readonly WinStage90[] = ["full_house", "two_lines", "one_line"];

/**
 * Visual progress from authoritative marks, using the same pattern definitions
 * as the server. When prior-call eligibility is supplied, patterns that were
 * already achievable before the current call are excluded from feedback.
 * Claim validation still belongs to the server.
 */
export function getCardProgress(
  card: BingoCard,
  dabs: ReadonlySet<number>,
  patterns: string | readonly string[] = [],
  customPatterns: readonly WinPattern[] = [],
  eligibleBeforeCurrent?: ReadonlySet<number>,
): CardProgress {
  const ids = typeof patterns === "string" ? [patterns] : patterns;
  const grid = Array.isArray(card?.grid) ? card.grid : [];
  const is75 = grid.length === 5;
  const columns = is75 ? 5 : 9;
  const rows = is75 ? 5 : 3;
  const validShape = (is75 || grid.length === 9)
    && grid.every(column => Array.isArray(column) && column.length === rows);
  const playable = new Set<number>();
  if (validShape) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        const value = grid[col]?.[row];
        if ((is75 && index === FREE_SPACE_INDEX)
          || (typeof value === "number" && Number.isInteger(value) && value > 0 && value <= (is75 ? 75 : 90))) {
          playable.add(index);
        }
      }
    }
  }
  const marked = new Set([...dabs].filter(index => Number.isInteger(index) && playable.has(index)));
  if (is75 && playable.has(FREE_SPACE_INDEX)) marked.add(FREE_SPACE_INDEX);
  const result: CardProgress = {
    remaining: Infinity,
    completed: false,
    patternId: null,
    winningCells: new Set(),
    nearWinCells: new Set(),
    missingCells: new Set(),
    markedCount: marked.size,
    totalCells: playable.size,
  };
  // Malformed or blank tickets must never become vacuous completed patterns.
  if (!validShape || (is75 && playable.size !== 25)) return result;

  const candidates: Candidate[] = [];
  if (is75) {
    const configured = ids.length
      ? ids.map(id => resolvePattern(id, [...customPatterns])).filter((pattern): pattern is WinPattern => Boolean(pattern))
      : WIN_PATTERNS;
    for (const pattern of configured) {
      if (!Array.isArray(pattern.cells)) continue;
      const cells = [...new Set(pattern.cells)];
      if (cells.length && cells.every(index => Number.isInteger(index) && playable.has(index))) {
        candidates.push({ id: pattern.id, cells });
      }
    }
  } else {
    const rowCells = Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 9 }, (_, col) => row * 9 + col).filter(index => playable.has(index)),
    );
    if (rowCells.some(cells => cells.length !== 5)) return result;
    // Old 90-ball rooms can contain 75-ball pattern IDs; the server accepts all
    // three stages when no 90-ball stage is configured, so mirror that fallback.
    const configured = STAGES.filter(stage => ids.includes(stage));
    const stages = configured.length ? configured : STAGES;
    for (const stage of stages) {
      if (stage === "full_house") {
        candidates.push({ id: stage, cells: rowCells.flat() });
      } else if (stage === "two_lines") {
        for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
          candidates.push({ id: stage, cells: [...rowCells[a], ...rowCells[b]] });
        }
      } else {
        for (const cells of rowCells) candidates.push({ id: stage, cells });
      }
    }
  }

  // Expiration belongs to the pattern/stage, not just the selected path. In
  // 90-ball, one previously eligible row expires one_line across every row;
  // similarly, any eligible pair expires the whole two_lines stage.
  const expiredPatternIds = new Set(eligibleBeforeCurrent
    ? candidates.filter(candidate => candidate.cells.every(index =>
      (is75 && index === FREE_SPACE_INDEX) || eligibleBeforeCurrent.has(index),
    )).map(candidate => candidate.id)
    : []);
  let best: Candidate | undefined;
  let missing: number[] = [];
  for (const candidate of candidates) {
    if (expiredPatternIds.has(candidate.id)) continue;
    const pending = candidate.cells.filter(index => !marked.has(index));
    // Preserve configured pattern order and row order on ties. For 90-ball,
    // stage order above prefers the highest enabled completed stage.
    if (pending.length < result.remaining) {
      best = candidate;
      missing = pending;
      result.remaining = pending.length;
    }
  }
  if (!best) return result;
  result.patternId = best.id;
  result.completed = result.remaining === 0;
  result.missingCells = new Set(missing);
  if (result.completed) result.winningCells = new Set(best.cells);
  if (result.remaining === 1) result.nearWinCells = new Set(best.cells);
  return result;
}
