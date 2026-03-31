// ============================================================
// Bingo Royale - Number Caller Service
// ============================================================

import type { Server } from 'socket.io';
import type { BingoVariant } from '@bingo/shared';
import { getLetterForNumber } from '@bingo/shared';
import * as roomStore from '../redis/room-store.js';
import { persistGameResult } from './game-persistence.js';

// --------------- Active caller intervals ---------------

interface CallerInstance {
  interval: ReturnType<typeof setInterval> | null;
  speed: number;
  variant: BingoVariant;
  roomCode: string;
}

const activeCallers = new Map<string, CallerInstance>();

// --------------- Shared tick factory ---------------

/**
 * Create the tick function used by both startCalling and resumeCalling.
 * Each tick pops the next number from the pool, broadcasts it, and handles
 * pool exhaustion by finishing the game.
 */
function createTickFn(
  roomCode: string,
  variant: BingoVariant,
  io: Server,
  stopCalling: (code: string) => void,
): () => Promise<void> {
  return async () => {
    try {
      const number = await roomStore.popNextNumber(roomCode);

      if (number === null) {
        // Pool is exhausted - game over with no winner
        stopCalling(roomCode);
        await roomStore.updateRoom(roomCode, { state: 'finished' });
        io.to(roomCode).emit('game:finished', {
          reason: 'no_numbers_left',
          winners: [],
        });
        const room = await roomStore.getRoom(roomCode);
        const callerState = await roomStore.getCallerState(roomCode);
        void persistGameResult(roomCode, variant, room?.hostId ?? '', [], callerState?.called ?? []);
        return;
      }

      // Get the current caller state to get full called list
      const callerState = await roomStore.getCallerState(roomCode);
      const calledNumbers = callerState?.called ?? [number];

      // Build event payload
      const payload: Record<string, unknown> = {
        number,
        calledNumbers,
        remaining: callerState?.pool.length ?? 0,
      };

      // Add letter info for 75-ball
      if (variant === '75') {
        payload.letter = getLetterForNumber(number);
      }

      io.to(roomCode).emit('game:number_called', payload);
    } catch (err) {
      console.error(
        `[Caller] Error calling number for room ${roomCode}:`,
        err,
      );
      stopCalling(roomCode);
    }
  };
}

// --------------- CallerManager ---------------

export const CallerManager = {
  /**
   * Start calling numbers for a room at the given speed interval.
   */
  startCalling(
    roomCode: string,
    speed: number,
    variant: BingoVariant,
    io: Server,
  ): void {
    // Clear any existing interval
    this.stopCalling(roomCode);

    const caller: CallerInstance = {
      interval: null,
      speed,
      variant,
      roomCode,
    };

    const tick = createTickFn(roomCode, variant, io, (code) => this.stopCalling(code));

    // Call first number immediately, then start interval
    void tick();
    caller.interval = setInterval(() => void tick(), speed);
    activeCallers.set(roomCode, caller);
  },

  /**
   * Pause calling numbers for a room.
   */
  async pauseCalling(roomCode: string): Promise<void> {
    const caller = activeCallers.get(roomCode);
    if (caller?.interval) {
      clearInterval(caller.interval);
      caller.interval = null;
    }

    const state = await roomStore.getCallerState(roomCode);
    if (state) {
      await roomStore.setCallerState(
        roomCode,
        state.pool,
        state.called,
        true,
      );
    }
  },

  /**
   * Resume calling numbers for a room.
   */
  resumeCalling(roomCode: string, io: Server): void {
    const caller = activeCallers.get(roomCode);
    if (!caller) return;

    // Clear existing interval if any
    if (caller.interval) {
      clearInterval(caller.interval);
    }

    const tick = createTickFn(roomCode, caller.variant, io, (code) => this.stopCalling(code));

    // Update paused state
    void (async () => {
      const state = await roomStore.getCallerState(roomCode);
      if (state) {
        await roomStore.setCallerState(
          roomCode,
          state.pool,
          state.called,
          false,
        );
      }
    })();

    caller.interval = setInterval(() => void tick(), caller.speed);
    activeCallers.set(roomCode, caller);
  },

  /**
   * Stop calling numbers and clean up the interval.
   */
  stopCalling(roomCode: string): void {
    const caller = activeCallers.get(roomCode);
    if (caller?.interval) {
      clearInterval(caller.interval);
      caller.interval = null;
    }
    activeCallers.delete(roomCode);
  },

  /**
   * Check if a room has an active caller.
   */
  isActive(roomCode: string): boolean {
    return activeCallers.has(roomCode);
  },
};
