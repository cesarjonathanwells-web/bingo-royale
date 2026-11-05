import type { Server } from 'socket.io';
import type { BingoVariant } from '@bingo/shared';
import { getLetterForNumber } from '@bingo/shared';
import * as roomStore from '../redis/room-store.js';
import { persistGameResult } from './game-persistence.js';
import { withRoomLock } from './room-lock.js';
import { applyPowerUpCall } from './powerups.js';

interface CallerInstance {
  interval: ReturnType<typeof setInterval> | null;
  speed: number;
  variant: BingoVariant;
}

const activeCallers = new Map<string, CallerInstance>();

/** One authoritative draw, shared by the timer and deterministic game tests. */
export async function callNextNumber(roomCode: string, variant: BingoVariant, io: Server): Promise<number | null> {
  return withRoomLock(roomCode, async () => {
    const room = await roomStore.getRoom(roomCode);
    const state = await roomStore.getCallerState(roomCode);
    if (room?.state !== 'in_progress' || !state || state.paused) return null;
    const number = await roomStore.popNextNumber(roomCode);
    if (number === null) {
      CallerManager.stopCalling(roomCode);
      await roomStore.updateRoom(roomCode, { state: 'finished' });
      io.to(roomCode).emit('game:finished', { reason: 'no_numbers_left', winners: [], calledNumbers: state.called });
      void persistGameResult(roomCode, variant, room.hostId, [], state.called);
      return null;
    }
    const caller = await roomStore.getCallerState(roomCode);
    const calledNumbers = caller?.called ?? [number];
    io.to(roomCode).emit('game:number_called', {
      number, calledNumbers, remaining: caller?.pool.length ?? 0,
      ...(variant === '75' ? { letter: getLetterForNumber(number) } : {}),
    });
    await applyPowerUpCall(roomCode, number, calledNumbers.length, io);
    return number;
  });
}

function startInterval(roomCode: string, caller: CallerInstance, io: Server, immediate: boolean): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await callNextNumber(roomCode, caller.variant, io); }
    catch (error) {
      console.error(`[Caller] Error calling number for room ${roomCode}:`, error);
      CallerManager.stopCalling(roomCode);
    } finally { running = false; }
  };
  activeCallers.set(roomCode, caller);
  caller.interval = setInterval(() => void tick(), caller.speed);
  if (immediate) void tick();
}

export const CallerManager = {
  startCalling(roomCode: string, speed: number, variant: BingoVariant, io: Server): void {
    this.stopCalling(roomCode);
    startInterval(roomCode, { interval: null, speed, variant }, io, true);
  },

  async pauseCalling(roomCode: string): Promise<void> {
    const caller = activeCallers.get(roomCode);
    if (caller?.interval) { clearInterval(caller.interval); caller.interval = null; }
    const state = await roomStore.getCallerState(roomCode);
    if (state) await roomStore.setCallerState(roomCode, state.pool, state.called, true);
  },

  async resumeCalling(roomCode: string, io: Server): Promise<void> {
    const room = await roomStore.getRoom(roomCode);
    const state = await roomStore.getCallerState(roomCode);
    if (!room || room.state !== 'in_progress' || !state) return;
    this.stopCalling(roomCode);
    await roomStore.setCallerState(roomCode, state.pool, state.called, false);
    startInterval(roomCode, { interval: null, speed: room.speed, variant: room.variant }, io, false);
  },

  stopCalling(roomCode: string): void {
    const caller = activeCallers.get(roomCode);
    if (caller?.interval) clearInterval(caller.interval);
    activeCallers.delete(roomCode);
  },

  isActive(roomCode: string): boolean { return activeCallers.has(roomCode); },
};
