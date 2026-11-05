import type { Server } from 'socket.io';
import type { BingoCard, PowerUpEffects, PowerUpId } from '@bingo/shared';
import { COLUMN_RANGES_90, GameUsePowerupSchema, POWER_UP_MAP, shuffleArray } from '@bingo/shared';
import * as store from '../redis/room-store.js';

export interface PowerUpRequest {
  powerupId: PowerUpId;
  cardIndex?: number;
  targetCellIndex?: number;
  selectedNumber?: number;
}

export class PowerUpError extends Error {
  constructor(public code: string, message: string, public choices?: number[]) {
    super(message);
  }
}

function requireEffect(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new PowerUpError(code, message);
}

export function cellValue(card: BingoCard, index: number): number | null {
  if (!Number.isInteger(index) || index < 0 || index >= (card.grid.length === 5 ? 25 : 27)) return null;
  const value = card.grid[index % card.grid.length]?.[Math.floor(index / card.grid.length)];
  return typeof value === 'number' && value > 0 ? value : null;
}

export function isCellBlocked(effects: PowerUpEffects, cardIndex: number, cellIndex: number, callCount: number): boolean {
  return effects.blockedCells.some((cell) => cell.cardIndex === cardIndex && cell.cellIndex === cellIndex && cell.expiresAtCall >= callCount);
}

function numberedCells(card: BingoCard): number[] {
  return Array.from({ length: card.grid.length === 5 ? 25 : 27 }, (_, index) => index)
    .filter((index) => cellValue(card, index) !== null);
}

function candidates(card: BingoCard, dabs: number[], effects: PowerUpEffects, cardIndex: number, callCount: number): number[] {
  return numberedCells(card).filter((index) => !dabs.includes(index) && !isCellBlocked(effects, cardIndex, index, callCount));
}

export async function getPowerUpSnapshot(code: string, playerId: string) {
  const [cards, dabs, powerups, effects, caller] = await Promise.all([
    store.getCard(code, playerId), store.getDabs(code, playerId),
    store.getPowerUps(code, playerId), store.getPowerUpEffects(code, playerId), store.getCallerState(code),
  ]);
  return { roomCode: code, cards: cards ?? [], dabs, powerups, effects, calledCount: caller?.called.length ?? 0 };
}

async function emitPrivate(code: string, playerId: string, io: Server, event: string, payload: unknown): Promise<void> {
  const sockets = await io.in(code).fetchSockets();
  for (const socket of sockets) if (socket.data.user?.id === playerId) socket.emit(event, payload);
}

export async function sendPowerUpState(code: string, playerId: string, io: Server): Promise<void> {
  await emitPrivate(code, playerId, io, 'game:powerup_state', await getPowerUpSnapshot(code, playerId));
}

// Preserve every called, marked, blocked and wild cell. American cards shuffle
// the remaining values within a column. Sorted 90-ball tickets re-roll only
// those values between their fixed neighbours, preserving blanks and ranges.
export function scrambleCard(card: BingoCard, dabs: number[], effects: PowerUpEffects, cardIndex: number, called: number[]): BingoCard | null {
  const next: BingoCard = { ...card, grid: card.grid.map((column) => [...column]) } as BingoCard;
  const allowed = new Set(candidates(card, dabs, effects, cardIndex, called.length)
    .filter((index) => !called.includes(cellValue(card, index)!) &&
      !effects.wildCells.some((cell) => cell.cardIndex === cardIndex && cell.cellIndex === index)));
  let changed = false;
  for (let col = 0; col < card.grid.length; col++) {
    const rows = card.grid[col].map((_, row) => row).filter((row) => cellValue(card, row * card.grid.length + col) !== null);
    if (card.grid.length === 5) {
      const mutable = rows.filter((row) => allowed.has(row * 5 + col));
      if (mutable.length < 2) continue;
      const values = mutable.map((row) => card.grid[col][row]);
      // A non-zero rotation always changes unique values.
      const offset = 1 + Math.floor(Math.random() * (values.length - 1));
      mutable.forEach((row, i) => { next.grid[col][row] = values[(i + offset) % values.length] as number; });
      changed = true;
      continue;
    }
    const range = COLUMN_RANGES_90[col];
    for (let start = 0; start < rows.length;) {
      if (!allowed.has(rows[start] * 9 + col)) { start++; continue; }
      let end = start;
      while (end < rows.length && allowed.has(rows[end] * 9 + col)) end++;
      const low = start === 0 ? range.min : (card.grid[col][rows[start - 1]] as number) + 1;
      const high = end === rows.length ? range.max : (card.grid[col][rows[end]] as number) - 1;
      const options = Array.from({ length: Math.max(0, high - low + 1) }, (_, index) => low + index).filter((value) => !called.includes(value));
      const size = end - start;
      let values = shuffleArray(options).slice(0, size).sort((a, b) => a - b);
      const same = (candidate: number[]) => candidate.every((value, index) => value === card.grid[col][rows[start + index]]);
      if (same(values) && options.length > size) {
        values = options.slice(0, size);
        if (same(values)) values = options.slice(-size);
      }
      if (values.length === size && !same(values)) {
        values.forEach((value, index) => { next.grid[col][rows[start + index]] = value; });
        changed = true;
      }
      start = end;
    }
  }
  return changed ? next : null;
}

async function activeContext(code: string, playerId: string) {
  const room = await store.getRoom(code);
  requireEffect(room?.state === 'in_progress', 'game_not_running', 'Game not in progress');
  const player = room.players.find((entry) => entry.id === playerId);
  requireEffect(player && !player.isSpectator, 'spectator', 'Spectators cannot use power-ups');
  const caller = await store.getCallerState(code);
  const cards = await store.getCard(code, playerId);
  requireEffect(caller && cards?.length, 'no_cards', 'No active cards found');
  const effects = await store.getPowerUpEffects(code, playerId);
  const dabs = await store.getDabs(code, playerId);
  while (dabs.length < cards.length) dabs.push([]);
  return { room, player, caller, cards, effects, dabs };
}

export async function usePowerUp(code: string, playerId: string, request: PowerUpRequest, io: Server): Promise<{ choices?: number[] }> {
  const parsed = GameUsePowerupSchema.safeParse(request);
  requireEffect(parsed.success, 'invalid_request', 'Invalid power-up request');
  request = parsed.data;
  const { powerupId } = request;
  requireEffect(typeof powerupId === 'string' && Object.hasOwn(POWER_UP_MAP, powerupId), 'invalid_powerup', 'Invalid power-up');
  const { room, player, caller, cards, effects, dabs } = await activeContext(code, playerId);
  requireEffect(!caller.paused, 'game_paused', 'Resume the game before using power-ups');
  const powerups = await store.getPowerUps(code, playerId);
  const available = powerups.find((entry) => entry.id === powerupId && !entry.used);
  requireEffect(available, 'unavailable', 'Power-up not available');
  const cardIndex = request.cardIndex ?? 0;
  requireEffect(Number.isInteger(cardIndex) && cardIndex >= 0 && cardIndex < cards.length, 'invalid_card', 'Invalid card');
  const card = cards[cardIndex];
  const callCount = caller.called.length;
  const eligible = candidates(card, dabs[cardIndex], effects, cardIndex, callCount);
  let notify: { id: string; event: string; payload: unknown } | undefined;
  let attackedId: string | undefined;

  switch (powerupId) {
    case 'number_peek':
      requireEffect(caller.pool.length, 'no_numbers', 'No numbers remain to peek');
      notify = { id: playerId, event: 'game:number_peek', payload: { numbers: caller.pool.slice(0, 3) } };
      break;
    case 'wild_square': {
      const index = request.targetCellIndex;
      requireEffect(typeof index === 'number' && Number.isInteger(index) && eligible.includes(index), 'invalid_target', 'Choose an unmarked, unblocked number on this card');
      dabs[cardIndex].push(index);
      effects.wildCells.push({ cardIndex, cellIndex: index, grantedAtCall: callCount });
      break;
    }
    case 'turbo_stamp': {
      const matches = eligible.filter((index) => caller.called.includes(cellValue(card, index)!));
      requireEffect(matches.length, 'no_targets', 'This card has no called numbers left to mark');
      dabs[cardIndex].push(...matches);
      break;
    }
    case 'double_daub':
      requireEffect(caller.pool.length && eligible.length, 'no_targets', 'No number cells are available for Double Daub');
      requireEffect(!effects.doubleDaub, 'already_active', 'Double Daub is already active');
      effects.doubleDaub = { cardIndex, activateAtCall: callCount + 1 };
      break;
    case 'shield':
      requireEffect(caller.pool.length, 'no_numbers', 'No calls remain for Shield');
      effects.shieldUntilCall = callCount + 2;
      break;
    case 'callers_choice': {
      const choices = caller.pool.slice(0, 3);
      requireEffect(choices.length, 'no_numbers', 'No numbers remain to choose');
      if (request.selectedNumber === undefined) return { choices };
      if (!Number.isInteger(request.selectedNumber) || !choices.includes(request.selectedNumber)) {
        throw new PowerUpError('stale_choice', 'Those choices changed. Choose a current number.', choices);
      }
      caller.pool.splice(caller.pool.indexOf(request.selectedNumber), 1);
      caller.pool.unshift(request.selectedNumber);
      await store.setCallerState(code, caller.pool, caller.called, caller.paused);
      break;
    }
    case 'scramble':
    case 'ink_blot': {
      const opponents = shuffleArray(room.players.filter((entry) => entry.id !== playerId && !entry.isSpectator && entry.connected));
      requireEffect(opponents.length, 'no_opponents', 'No opponents are available');
      let applied = false;
      for (const target of opponents) {
        const targetCards = await store.getCard(code, target.id);
        if (!targetCards?.length) continue;
        const targetEffects = await store.getPowerUpEffects(code, target.id);
        if (targetEffects.shieldUntilCall > 0 && targetEffects.shieldUntilCall >= callCount) {
          notify = { id: target.id, event: 'game:powerup_blocked', payload: { powerupId, byPlayer: player.name } };
          applied = true;
          break;
        }
        const targetDabs = await store.getDabs(code, target.id);
        for (const index of shuffleArray(targetCards.map((_, i) => i))) {
          if (powerupId === 'scramble') {
            const scrambled = scrambleCard(targetCards[index], targetDabs[index] ?? [], targetEffects, index, caller.called);
            if (!scrambled) continue;
            targetCards[index] = scrambled;
            await store.setCard(code, target.id, targetCards);
          } else {
            const targets = candidates(targetCards[index], targetDabs[index] ?? [], targetEffects, index, callCount);
            if (!targets.length) continue;
            targetEffects.blockedCells.push({ cardIndex: index, cellIndex: targets[Math.floor(Math.random() * targets.length)], expiresAtCall: callCount + 2 });
            await store.setPowerUpEffects(code, target.id, targetEffects);
          }
          attackedId = target.id;
          notify = { id: target.id, event: powerupId === 'scramble' ? 'game:scrambled' : 'game:ink_blot', payload: { byPlayer: player.name, cardIndex: index } };
          applied = true;
          break;
        }
        if (applied) break;
      }
      requireEffect(applied, 'no_targets', 'Opponents have no eligible number cells');
      break;
    }
  }

  // The operation is validated before its inventory is consumed. The room lock
  // prevents another use, caller tick or claim from observing a half-applied effect.
  available.used = true;
  await store.setDabs(code, playerId, dabs);
  await store.setPowerUpEffects(code, playerId, effects);
  await store.setPowerUps(code, playerId, powerups);
  if (attackedId) await sendPowerUpState(code, attackedId, io);
  await sendPowerUpState(code, playerId, io);
  if (notify) await emitPrivate(code, notify.id, io, notify.event, notify.payload);
  io.to(code).emit('game:powerup_used', { playerId, playerName: player.name, powerupId });
  return {};
}

// Called after a number is appended to the authoritative pool, under room lock.
export async function applyPowerUpCall(code: string, number: number, callCount: number, io: Server): Promise<void> {
  const room = await store.getRoom(code);
  if (!room) return;
  for (const player of room.players.filter((entry) => !entry.isSpectator)) {
    const effects = await store.getPowerUpEffects(code, player.id);
    const hadDoubleDaub = Boolean(effects.doubleDaub);
    if (effects.doubleDaub && effects.doubleDaub.activateAtCall <= callCount) {
      const cards = await store.getCard(code, player.id);
      const dabs = await store.getDabs(code, player.id);
      const index = effects.doubleDaub.cardIndex;
      const card = cards?.[index];
      if (card) {
        while (dabs.length < cards!.length) dabs.push([]);
        const eligible = candidates(card, dabs[index], effects, index, callCount);
        const calledCell = eligible.find((cell) => cellValue(card, cell) === number);
        const bonus = shuffleArray(eligible.filter((cell) => cell !== calledCell));
        const marks = (calledCell === undefined ? bonus : [calledCell, ...bonus]).slice(0, 2);
        for (const cellIndex of marks) {
          dabs[index].push(cellIndex);
          effects.wildCells.push({ cardIndex: index, cellIndex, grantedAtCall: callCount });
        }
        await store.setDabs(code, player.id, dabs);
      }
      delete effects.doubleDaub;
      await store.setPowerUpEffects(code, player.id, effects);
    }
    // Retain expired block records for previous-call win eligibility checks.
    // Clients filter their visible blocks by the accompanying calledCount.
    if (hadDoubleDaub || effects.wildCells.length || effects.blockedCells.length || effects.shieldUntilCall || effects.doubleDaub) {
      await sendPowerUpState(code, player.id, io);
    }
  }
}
