// ============================================================
// Bingo Royale - Game Socket Handlers
// ============================================================

import type { Server } from 'socket.io';
import type { Room, RoomState, WinStage90, PlayerPowerUp } from '@bingo/shared';
import { generateCallerPool75, generateCallerPool90, dealPowerUps } from '@bingo/shared';
import type { AuthenticatedSocket } from '../../services/auth.js';
import * as roomStore from '../../redis/room-store.js';
import { CallerManager } from '../../services/caller.js';
import { generateCardsForRoom } from '../../services/card-generator.js';
import { validateBingo75, validateBingo90, isPatternExpired75, isStageExpired90, type ValidationResult } from '../../services/win-validator.js';
import { persistGameResult } from '../../services/game-persistence.js';
import { withRoomLock } from '../../services/room-lock.js';
import { usePowerUp, sendPowerUpState, PowerUpError, cellValue, isCellBlocked } from '../../services/powerups.js';

// --------------- Shared handler helpers ---------------

/** Callback type used by socket event handlers. */
type HandlerCallback = (result: Record<string, unknown>) => void;

/** Send an error via callback (if present). Returns true so callers can `return fail(...)`. */
function fail(callback: unknown, error: string): true {
  if (typeof callback === 'function') {
    (callback as HandlerCallback)({ success: false, error });
  }
  return true;
}

/** Send a success via callback (if present). */
function succeed(callback: unknown, extra?: Record<string, unknown>): void {
  if (typeof callback === 'function') {
    (callback as HandlerCallback)({ success: true, ...extra });
  }
}

/**
 * Common guard: resolve room code from socket and fetch the room.
 * Returns null (and sends error callback) if the room is missing or doesn't
 * match the required state.
 */
async function requireRoom(
  socket: AuthenticatedSocket,
  callback: unknown,
  requiredState?: RoomState,
): Promise<{ code: string; room: Room } | null> {
  const code = socket.data.roomCode;
  if (!code) {
    fail(callback, 'Not in a room');
    return null;
  }

  const room = await roomStore.getRoom(code);
  if (!room) {
    fail(callback, 'Room not found');
    return null;
  }

  if (requiredState && room.state !== requiredState) {
    const messages: Record<RoomState, string> = {
      lobby: 'Game already in progress',
      in_progress: 'Game not in progress',
      finished: 'Game must be finished to start new round',
    };
    fail(callback, messages[requiredState] ?? `Room must be in ${requiredState} state`);
    return null;
  }

  return { code, room };
}

/** Wrap a handler body with standard error handling. */
function handleError(
  socket: AuthenticatedSocket,
  label: string,
  callback: unknown,
  err: unknown,
): void {
  console.error(`[Game] Error ${label}:`, err);
  const errorMsg = err instanceof Error ? err.message : `Failed to ${label}`;
  fail(callback, errorMsg);
  socket.emit('error', { message: errorMsg });
}

export function registerGameHandlers(
  socket: AuthenticatedSocket,
  io: Server,
): void {
  const user = socket.data.user;
  const on = (event: string, handler: (...args: any[]) => Promise<void>) => {
    socket.on(event, (...args: any[]) => {
      const code = socket.data.roomCode ?? socket.id;
      return withRoomLock(code, () => {
        if ((socket.data.roomCode ?? socket.id) !== code) {
          fail(args.find((argument) => typeof argument === 'function'), 'Room changed');
          return Promise.resolve();
        }
        return handler(...args);
      });
    });
  };


  // --------------- room:set_card_count ---------------

  on('room:set_card_count', async (data, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'lobby');
      if (!ctx) return;
      const { code } = ctx;

      const count = typeof data?.count === 'number' ? data.count : 1;
      await roomStore.setCardCount(code, user.id, count);

      // Broadcast to room so everyone sees the card count
      io.to(code).emit('room:card_count_updated', {
        playerId: user.id,
        count: Math.max(1, Math.min(4, count)),
      });

      succeed(callback);
    } catch (err) {
      handleError(socket, 'setting card count', callback, err);
    }
  });

  // --------------- game:start ---------------

  on('game:start', async (_, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'lobby');
      if (!ctx) return;
      const { code, room } = ctx;

      // Only host can start
      if (room.hostId !== user.id) {
        return void fail(callback, 'Only the host can start the game');
      }

      // Need at least 1 non-spectator player
      const activePlayers = room.players.filter((p) => !p.isSpectator);
      if (activePlayers.length < 1) {
        return void fail(callback, 'Need at least 1 player to start');
      }

      // Update room state
      await roomStore.updateRoom(code, { state: 'in_progress' });

      // Build card count map from player preferences
      const playerCardCounts = new Map<string, number>();
      for (const player of activePlayers) {
        const count = await roomStore.getCardCount(code, player.id);
        playerCardCounts.set(player.id, count);
      }

      // Generate cards for all active players (multi-card support)
      const cards = await generateCardsForRoom(
        room.variant,
        playerCardCounts,
        code,
      );

      // Initialize caller pool
      const pool =
        room.variant === '75'
          ? generateCallerPool75()
          : generateCallerPool90();
      await roomStore.setCallerState(code, pool, [], false);

      // Send each player their cards (multi-card array)
      const roomSockets = await io.in(code).fetchSockets();
      for (const roomSocket of roomSockets) {
        const socketUserId = roomSocket.data.user?.id;
        if (socketUserId) {
          const playerCards = cards.get(socketUserId);
          if (playerCards) {
            roomSocket.emit('game:card_dealt', { cards: playerCards });
          }
        }
      }

      // Deal 2 random power-ups to each active player
      for (const player of activePlayers) {
        const dealt = dealPowerUps(2);
        const playerPowerUps: PlayerPowerUp[] = dealt.map((id) => ({
          id,
          used: false,
        }));
        await roomStore.setPowerUps(code, player.id, playerPowerUps);
        await roomStore.setPowerUpEffects(code, player.id, roomStore.emptyPowerUpEffects());
        await roomStore.setDabs(code, player.id, (cards.get(player.id) ?? []).map((card) => card.grid.length === 5 ? [12] : []));

        // Send power-ups to the specific player socket
        for (const roomSocket of roomSockets) {
          if (roomSocket.data.user?.id === player.id) {
            roomSocket.emit('game:powerups_dealt', {
              powerups: playerPowerUps,
            });
          }
        }
      }

      // Emit game started to all
      io.to(code).emit('game:started', {
        variant: room.variant,
        speed: room.speed,
        patterns: room.patterns,
        playerCount: activePlayers.length,
        startedAt: Date.now(),
      });

      for (const player of activePlayers) await sendPowerUpState(code, player.id, io);

      // Start the number caller
      CallerManager.startCalling(code, room.speed, room.variant, io);

      // Extend room TTL
      await roomStore.extendTTL(code);

      succeed(callback);
    } catch (err) {
      handleError(socket, 'starting game', callback, err);
    }
  });

  // --------------- game:dab ---------------

  on('game:dab', async (data, callback) => {
    try {
      const code = socket.data.roomCode;
      if (!code) return void fail(callback, 'Not in a room');
      const room = await roomStore.getRoom(code);
      if (room?.state !== 'in_progress' || !room.players.some((player) => player.id === user.id && !player.isSpectator)) return void fail(callback, 'No active game');
      const caller = await roomStore.getCallerState(code);
      const cards = await roomStore.getCard(code, user.id);
      if (!caller || !cards?.length) return void fail(callback, 'No active cards');
      if (caller.paused) return void fail(callback, 'Game is paused');
      const cellIndex = data?.cellIndex;
      const cardIndex = data?.cardIndex ?? 0;
      if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= cards.length) return void fail(callback, 'Invalid card');
      const value = cellValue(cards[cardIndex], cellIndex);
      if (value === null || !caller.called.includes(value)) return void fail(callback, 'Number not called');
      const effects = await roomStore.getPowerUpEffects(code, user.id);
      if (isCellBlocked(effects, cardIndex, cellIndex, caller.called.length)) return void fail(callback, 'Cell is blocked');
      const allDabs = await roomStore.getDabs(code, user.id);
      while (allDabs.length < cards.length) allDabs.push([]);
      if (!allDabs[cardIndex].includes(cellIndex)) {
        allDabs[cardIndex].push(cellIndex);
        await roomStore.setDabs(code, user.id, allDabs);
        await sendPowerUpState(code, user.id, io);
      }
      succeed(callback);
    } catch (err) {
      console.error('[Game] Error recording dab:', err);
      socket.emit('error', { message: 'Failed to record dab' });
      fail(callback, 'Failed to record dab');
    }
  });

  // --------------- game:claim_bingo ---------------

  on('game:claim_bingo', async (data, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'in_progress');
      if (!ctx) return;
      const { code, room } = ctx;

      const stage: WinStage90 | undefined = data?.stage;
      if (!room.players.some((player) => player.id === user.id && !player.isSpectator)) {
        return void fail(callback, 'Spectators cannot claim bingo');
      }

      // Get all cards and server-stored dabs for this player
      const cards = await roomStore.getCard(code, user.id);
      if (!cards || cards.length === 0) {
        return void fail(callback, 'No cards found');
      }

      const allDabs = await roomStore.getDabs(code, user.id);

      // Try ALL cards with server-stored dabs (not client-sent dabs)
      // This prevents desync between client and server dab state
      let result: ValidationResult = { valid: false };
      let expiredCandidate: { result: ValidationResult; cardIndex: number } | undefined;
      let winningCardIndex = 0;

      for (let ci = 0; ci < cards.length; ci++) {
        const serverDabs = allDabs[ci] ?? [];
        if (serverDabs.length === 0) continue;

        let cardResult;
        if (room.variant === '75') {
          cardResult = await validateBingo75(code, user.id, serverDabs, ci);
        } else {
          if (!stage) {
            return void fail(callback, 'Stage is required for 90-ball bingo');
          }
          cardResult = await validateBingo90(code, user.id, serverDabs, stage, ci);
        }

        if (cardResult.valid) {
          if (cardResult.expired) { expiredCandidate ??= { result: cardResult, cardIndex: ci }; continue; }
          result = cardResult;
          winningCardIndex = ci;
          break;
        }
      }

      // If server dabs didn't find a win, also try client-sent dabs as fallback
      // (covers edge case where server dabs are slightly behind)
      if (!result.valid) {
        const rawMarkedCells = Array.isArray(data?.markedCells) ? data.markedCells : [];
        if (rawMarkedCells.every((v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0)) {
          const cardIndex: number = typeof data?.cardIndex === 'number' ? data.cardIndex : 0;
          if (room.variant === '75') {
            result = await validateBingo75(code, user.id, rawMarkedCells, cardIndex);
          } else if (stage) {
            result = await validateBingo90(code, user.id, rawMarkedCells, stage, cardIndex);
          }
          if (result.valid) {
            if (result.expired) {
              expiredCandidate ??= { result, cardIndex };
              result = { valid: false };
            } else winningCardIndex = cardIndex;
          }
        }
      }

      if (!result.valid && expiredCandidate) {
        result = expiredCandidate.result;
        winningCardIndex = expiredCandidate.cardIndex;
      }

      // Check if the winning pattern/stage was already completable before the
      // last called number.  If so, the player missed their window — they must
      // wait for a new bingo.
      if (result.valid && result.pattern) {
        let expired = false;
        if (room.variant === '75') {
          expired = await isPatternExpired75(code, user.id, result.pattern, winningCardIndex);
        } else {
          expired = await isStageExpired90(code, user.id, result.pattern as WinStage90, winningCardIndex);
        }

        if (expired) {
          console.log(`[Game] Bingo EXPIRED for ${user.name}: pattern=${result.pattern} was completable before last number`);
          socket.emit('game:bingo_claimed', {
            valid: false,
            playerId: user.id,
            playerName: user.name,
            message: 'Bingo expired - you must call bingo before the next number is drawn',
          });
          return void succeed(callback, { valid: false, expired: true });
        }
      }

      console.log(`[Game] Bingo claim by ${user.name}: valid=${result.valid}, pattern=${result.pattern ?? 'none'}, cards=${cards.length}`);

      if (result.valid) {
        // Re-check room state to prevent concurrent claims both winning
        const currentRoom = await roomStore.getRoom(code);
        if (!currentRoom || currentRoom.state !== 'in_progress') {
          // Another player already won
          socket.emit('game:bingo_claimed', {
            valid: false,
            playerId: user.id,
            playerName: user.name,
            message: 'Another player already claimed bingo',
          });
          return void succeed(callback, { valid: false });
        }

        // Stop the caller
        CallerManager.stopCalling(code);

        // Update room state
        await roomStore.updateRoom(code, { state: 'finished' });

        // Get caller state for final called numbers
        const callerState = await roomStore.getCallerState(code);

        // Broadcast valid bingo to all
        io.to(code).emit('game:bingo_claimed', {
          valid: true,
          playerId: user.id,
          playerName: user.name,
          pattern: result.pattern,
        });

        io.to(code).emit('game:finished', {
          reason: 'bingo',
          winners: [
            {
              playerId: user.id,
              playerName: user.name,
              pattern: result.pattern,
              timestamp: Date.now(),
            },
          ],
          calledNumbers: callerState?.called ?? [],
          totalCalled: callerState?.called.length ?? 0,
        });

        // Persist game result to PostgreSQL
        void persistGameResult(
          code,
          room.variant,
          room.hostId,
          [{ playerId: user.id, playerName: user.name, pattern: result.pattern ?? '', timestamp: Date.now() }],
          callerState?.called ?? [],
        );

        succeed(callback, { valid: true, pattern: result.pattern });
      } else {
        // Invalid claim - only notify the claimer
        socket.emit('game:bingo_claimed', {
          valid: false,
          playerId: user.id,
          playerName: user.name,
          message: 'Invalid bingo claim',
        });

        succeed(callback, { valid: false });
      }
    } catch (err) {
      handleError(socket, 'claiming bingo', callback, err);
    }
  });

  // --------------- game:pause ---------------

  on('game:pause', async (_, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'in_progress');
      if (!ctx) return;
      const { code, room } = ctx;

      if (room.hostId !== user.id) {
        return void fail(callback, 'Only the host can pause the game');
      }

      await CallerManager.pauseCalling(code);
      io.to(code).emit('game:paused', { pausedBy: user.name });

      succeed(callback);
    } catch (err) {
      handleError(socket, 'pausing game', callback, err);
    }
  });

  // --------------- game:resume ---------------

  on('game:resume', async (_, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'in_progress');
      if (!ctx) return;
      const { code, room } = ctx;

      if (room.hostId !== user.id) {
        return void fail(callback, 'Only the host can resume the game');
      }

      await CallerManager.resumeCalling(code, io);
      io.to(code).emit('game:resumed', { resumedBy: user.name });

      succeed(callback);
    } catch (err) {
      handleError(socket, 'resuming game', callback, err);
    }
  });

  // --------------- game:use_powerup ---------------

  on('game:use_powerup', async (data, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'in_progress');
      if (!ctx) return;
      const result = await usePowerUp(ctx.code, user.id, data, io);
      succeed(callback, result);
    } catch (err) {
      if (err instanceof PowerUpError) {
        if (typeof callback === 'function') callback({ success: false, error: err.message, errorCode: err.code, ...(err.choices ? { choices: err.choices } : {}) });
        else socket.emit('error', { message: err.message });
      } else handleError(socket, 'using power-up', callback, err);
    }
  });

  // --------------- game:new_round ---------------

  on('game:new_round', async (_, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'finished');
      if (!ctx) return;
      const { code, room } = ctx;

      if (room.hostId !== user.id) {
        return void fail(callback, 'Only the host can start a new round');
      }

      // Reset room state to lobby
      await roomStore.updateRoom(code, { state: 'lobby' });

      // Stop any lingering caller
      CallerManager.stopCalling(code);

      // Clear caller state so next game gets a fresh pool
      await roomStore.setCallerState(code, [], [], false);

      // Clear dabs and power-ups for all players
      const players = await roomStore.getPlayers(code);
      for (const player of players) {
        await roomStore.setDabs(code, player.id, []);
        await roomStore.setPowerUps(code, player.id, []);
        await roomStore.setPowerUpEffects(code, player.id, roomStore.emptyPowerUpEffects());
      }

      const updatedRoom = await roomStore.getRoom(code);
      io.to(code).emit('room:state', updatedRoom);

      succeed(callback);
    } catch (err) {
      handleError(socket, 'starting new round', callback, err);
    }
  });
}

