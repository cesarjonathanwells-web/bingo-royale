// ============================================================
// Bingo Royale - Room Store (Redis-backed with in-memory fallback)
// ============================================================

import type { Room, Player, BingoCard } from '@bingo/shared';
import { getRedis } from './index.js';

const ROOM_TTL = 7200; // 2 hours in seconds
const KEY_PREFIX = 'room:';

// --------------- In-memory fallback for dev mode ---------------

const memoryStore = new Map<string, string>();

function memGet(key: string): string | null {
  return memoryStore.get(key) ?? null;
}

function memSet(key: string, value: string): void {
  memoryStore.set(key, value);
}

function memDel(key: string): void {
  memoryStore.delete(key);
}

function memKeys(pattern: string): string[] {
  const prefix = pattern.replace('*', '');
  return Array.from(memoryStore.keys()).filter((k) => k.startsWith(prefix));
}

// --------------- Caller State ---------------

export interface CallerState {
  pool: number[];
  called: number[];
  paused: boolean;
}

// --------------- Room Store API ---------------

function roomKey(code: string): string {
  return `${KEY_PREFIX}${code}`;
}

function playersKey(code: string): string {
  return `${KEY_PREFIX}${code}:players`;
}

function callerKey(code: string): string {
  return `${KEY_PREFIX}${code}:caller`;
}

function cardKey(code: string, playerId: string): string {
  return `${KEY_PREFIX}${code}:card:${playerId}`;
}

function dabsKey(code: string, playerId: string): string {
  return `${KEY_PREFIX}${code}:dabs:${playerId}`;
}

// --------------- Create Room ---------------

export async function createRoom(room: Room): Promise<void> {
  const redis = getRedis();
  const data = JSON.stringify(room);

  if (redis) {
    await redis.set(roomKey(room.code), data, 'EX', ROOM_TTL);
    // Store players separately
    if (room.players.length > 0) {
      await redis.set(
        playersKey(room.code),
        JSON.stringify(room.players),
        'EX',
        ROOM_TTL,
      );
    }
  } else {
    memSet(roomKey(room.code), data);
    if (room.players.length > 0) {
      memSet(playersKey(room.code), JSON.stringify(room.players));
    }
  }
}

// --------------- Get Room ---------------

export async function getRoom(code: string): Promise<Room | null> {
  const redis = getRedis();

  let data: string | null;
  if (redis) {
    data = await redis.get(roomKey(code));
  } else {
    data = memGet(roomKey(code));
  }

  if (!data) return null;

  const room = JSON.parse(data) as Room;

  // Merge players from separate key
  const players = await getPlayers(code);
  room.players = players;

  return room;
}

// --------------- Update Room ---------------

export async function updateRoom(
  code: string,
  updates: Partial<Omit<Room, 'code' | 'players'>>,
): Promise<void> {
  const room = await getRoom(code);
  if (!room) return;

  const updated = { ...room, ...updates };
  // Don't overwrite players from updates (managed separately)
  const { players: _p, ...roomWithoutPlayers } = updated;
  const data = JSON.stringify(roomWithoutPlayers);

  const redis = getRedis();
  if (redis) {
    await redis.set(roomKey(code), data, 'EX', ROOM_TTL);
  } else {
    memSet(roomKey(code), data);
  }
}

// --------------- Delete Room ---------------

export async function deleteRoom(code: string): Promise<void> {
  const redis = getRedis();

  if (redis) {
    // Delete room and all associated keys
    const keys = await redis.keys(`${KEY_PREFIX}${code}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } else {
    const keysToDelete = memKeys(`${KEY_PREFIX}${code}`);
    for (const key of keysToDelete) {
      memDel(key);
    }
  }
}

// --------------- Player Management ---------------

export async function addPlayer(code: string, player: Player): Promise<void> {
  const players = await getPlayers(code);
  // Don't add duplicates
  const existing = players.findIndex((p) => p.id === player.id);
  if (existing >= 0) {
    players[existing] = player;
  } else {
    players.push(player);
  }

  const redis = getRedis();
  const data = JSON.stringify(players);

  if (redis) {
    await redis.set(playersKey(code), data, 'EX', ROOM_TTL);
  } else {
    memSet(playersKey(code), data);
  }
}

export async function removePlayer(
  code: string,
  playerId: string,
): Promise<void> {
  const players = await getPlayers(code);
  const filtered = players.filter((p) => p.id !== playerId);

  const redis = getRedis();
  const data = JSON.stringify(filtered);

  if (redis) {
    await redis.set(playersKey(code), data, 'EX', ROOM_TTL);
  } else {
    memSet(playersKey(code), data);
  }

  // Also clean up card and dabs for this player
  if (redis) {
    await redis.del(cardKey(code, playerId));
    await redis.del(dabsKey(code, playerId));
  } else {
    memDel(cardKey(code, playerId));
    memDel(dabsKey(code, playerId));
  }
}

export async function getPlayers(code: string): Promise<Player[]> {
  const redis = getRedis();

  let data: string | null;
  if (redis) {
    data = await redis.get(playersKey(code));
  } else {
    data = memGet(playersKey(code));
  }

  if (!data) return [];
  return JSON.parse(data) as Player[];
}

// --------------- Caller State ---------------

export async function setCallerState(
  code: string,
  pool: number[],
  called: number[],
  paused: boolean,
): Promise<void> {
  const state: CallerState = { pool, called, paused };
  const data = JSON.stringify(state);
  const redis = getRedis();

  if (redis) {
    await redis.set(callerKey(code), data, 'EX', ROOM_TTL);
  } else {
    memSet(callerKey(code), data);
  }
}

export async function getCallerState(
  code: string,
): Promise<CallerState | null> {
  const redis = getRedis();

  let data: string | null;
  if (redis) {
    data = await redis.get(callerKey(code));
  } else {
    data = memGet(callerKey(code));
  }

  if (!data) return null;
  return JSON.parse(data) as CallerState;
}

export async function popNextNumber(code: string): Promise<number | null> {
  const state = await getCallerState(code);
  if (!state || state.pool.length === 0) return null;

  const number = state.pool.shift()!;
  state.called.push(number);

  await setCallerState(code, state.pool, state.called, state.paused);
  return number;
}

// --------------- Card Storage ---------------

export async function setCard(
  code: string,
  playerId: string,
  card: BingoCard,
): Promise<void> {
  const data = JSON.stringify(card);
  const redis = getRedis();

  if (redis) {
    await redis.set(cardKey(code, playerId), data, 'EX', ROOM_TTL);
  } else {
    memSet(cardKey(code, playerId), data);
  }
}

export async function getCard(
  code: string,
  playerId: string,
): Promise<BingoCard | null> {
  const redis = getRedis();

  let data: string | null;
  if (redis) {
    data = await redis.get(cardKey(code, playerId));
  } else {
    data = memGet(cardKey(code, playerId));
  }

  if (!data) return null;
  return JSON.parse(data) as BingoCard;
}

// --------------- Dab Storage ---------------

export async function setDabs(
  code: string,
  playerId: string,
  dabs: number[],
): Promise<void> {
  const data = JSON.stringify(dabs);
  const redis = getRedis();

  if (redis) {
    await redis.set(dabsKey(code, playerId), data, 'EX', ROOM_TTL);
  } else {
    memSet(dabsKey(code, playerId), data);
  }
}

export async function getDabs(
  code: string,
  playerId: string,
): Promise<number[]> {
  const redis = getRedis();

  let data: string | null;
  if (redis) {
    data = await redis.get(dabsKey(code, playerId));
  } else {
    data = memGet(dabsKey(code, playerId));
  }

  if (!data) return [];
  return JSON.parse(data) as number[];
}

// --------------- TTL Management ---------------

export async function extendTTL(code: string): Promise<void> {
  const redis = getRedis();

  if (redis) {
    const keys = await redis.keys(`${KEY_PREFIX}${code}*`);
    for (const key of keys) {
      await redis.expire(key, ROOM_TTL);
    }
  }
  // In-memory store doesn't need TTL management
}
