import type { BingoCard, BingoCard75, BingoCard90, WinStage90, PowerUpEffects, WinPattern } from '@bingo/shared';
import { checkWin75, checkWinStage90, FREE_SPACE_INDEX, WIN_PATTERNS, resolvePattern } from '@bingo/shared';
import * as store from '../redis/room-store.js';
import { cellValue } from './powerups.js';

export interface ValidationResult { valid: boolean; pattern?: string; expired?: boolean }

async function context(code: string, playerId: string, cardIndex: number) {
  const cards = await store.getCard(code, playerId);
  if (!cards || !Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= cards.length) return null;
  const caller = await store.getCallerState(code);
  const room = await store.getRoom(code);
  if (!caller || !room) return null;
  return { card: cards[cardIndex], caller, room, effects: await store.getPowerUpEffects(code, playerId) };
}

function eligible(card: BingoCard, index: number, effects: PowerUpEffects, cardIndex: number, called: number[], count: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= (card.grid.length === 5 ? 25 : 27)) return false;
  if (card.grid.length === 5 && index === FREE_SPACE_INDEX) return true;
  const value = cellValue(card, index);
  if (value === null) return false;
  // Historical block records let expiration distinguish a newly unblocked win
  // from one that the player could have claimed before the last draw.
  if (effects.blockedCells.some((cell) => cell.cardIndex === cardIndex && cell.cellIndex === index && cell.expiresAtCall >= count && cell.expiresAtCall - 2 <= count)) return false;
  if (effects.wildCells.some((cell) => cell.cardIndex === cardIndex && cell.cellIndex === index && cell.grantedAtCall <= count)) return true;
  return called.slice(0, count).includes(value);
}

export async function validateBingo75(code: string, playerId: string, markedCells: number[], cardIndex = 0): Promise<ValidationResult> {
  const ctx = await context(code, playerId, cardIndex);
  if (!ctx || ctx.card.grid.length !== 5 || !Array.isArray(markedCells)) return { valid: false };
  const { card, effects, caller, room } = ctx;
  if (!markedCells.every((index) => eligible(card, index, effects, cardIndex, caller.called, caller.called.length))) return { valid: false };
  const patterns = room.patterns.length ? room.patterns.map((id) => resolvePattern(id, room.customPatterns)).filter((pattern): pattern is WinPattern => Boolean(pattern)) : WIN_PATTERNS;
  const marked = new Set(markedCells);
  let expiredPattern: string | undefined;
  for (const pattern of patterns) {
    if (!checkWin75(marked, pattern)) continue;
    const expired = await isPatternExpired75(code, playerId, pattern.id, cardIndex);
    if (!expired) return { valid: true, pattern: pattern.id, expired: false };
    expiredPattern ??= pattern.id;
  }
  return expiredPattern ? { valid: true, pattern: expiredPattern, expired: true } : { valid: false };
}

export async function validateBingo90(code: string, playerId: string, markedCells: number[], stage: WinStage90, cardIndex = 0): Promise<ValidationResult> {
  const ctx = await context(code, playerId, cardIndex);
  if (!ctx || ctx.card.grid.length !== 9 || !['one_line', 'two_lines', 'full_house'].includes(stage) || !Array.isArray(markedCells)) return { valid: false };
  const enabledStages = ctx.room.patterns.filter((pattern) => ['one_line', 'two_lines', 'full_house'].includes(pattern));
  if (enabledStages.length && !enabledStages.includes(stage)) return { valid: false };
  if (!markedCells.every((index) => eligible(ctx.card, index, ctx.effects, cardIndex, ctx.caller.called, ctx.caller.called.length))) return { valid: false };
  if (!checkWinStage90(ctx.card as BingoCard90, new Set(markedCells), stage)) return { valid: false };
  return { valid: true, pattern: stage, expired: await isStageExpired90(code, playerId, stage, cardIndex) };
}

export async function isPatternExpired75(code: string, playerId: string, patternId: string, cardIndex: number): Promise<boolean> {
  const ctx = await context(code, playerId, cardIndex);
  if (!ctx) return false;
  const pattern = resolvePattern(patternId, ctx.room.customPatterns);
  if (!pattern || ctx.caller.called.length === 0) return false;
  const previousCount = ctx.caller.called.length - 1;
  return pattern.cells.every((index) => eligible(ctx.card, index, ctx.effects, cardIndex, ctx.caller.called, previousCount));
}

export async function isStageExpired90(code: string, playerId: string, stage: WinStage90, cardIndex: number): Promise<boolean> {
  const ctx = await context(code, playerId, cardIndex);
  if (!ctx || ctx.caller.called.length === 0 || !['one_line', 'two_lines', 'full_house'].includes(stage)) return false;
  const previousCount = ctx.caller.called.length - 1;
  const previousMarks = new Set(Array.from({ length: 27 }, (_, index) => index)
    .filter((index) => eligible(ctx.card, index, ctx.effects, cardIndex, ctx.caller.called, previousCount)));
  return checkWinStage90(ctx.card as BingoCard90, previousMarks, stage);
}
