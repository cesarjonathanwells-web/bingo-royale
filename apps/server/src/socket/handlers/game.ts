// ============================================================
// Bingo Royale - Game Socket Handlers
// ============================================================

import type { Server } from 'socket.io';
import type { Room, RoomState, WinStage90, PowerUpId, PlayerPowerUp } from '@bingo/shared';
import { generateCallerPool75, generateCallerPool90, dealPowerUps, POWER_UP_MAP } from '@bingo/shared';
import type { AuthenticatedSocket } from '../../services/auth.js';
import * as roomStore from '../../redis/room-store.js';
import { CallerManager } from '../../services/caller.js';
import { generateCardsForRoom } from '../../services/card-generator.js';
import { validateBingo75, validateBingo90 } from '../../services/win-validator.js';
import { persistGameResult } from '../../services/game-persistence.js';

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

  // --------------- room:set_card_count ---------------

  socket.on('room:set_card_count', async (data, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'lobby');
      if (!ctx) return;
      const { code } = ctx;

      const count = typeof data?.count === 'number' ? data.count : 1;
      await roomStore.setCardCount(code, user.id, count);

      succeed(callback);
    } catch (err) {
      handleError(socket, 'setting card count', callback, err);
    }
  });

  // --------------- game:start ---------------

  socket.on('game:start', async (_, callback) => {
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

  socket.on('game:dab', async (data) => {
    try {
      const code = socket.data.roomCode;
      if (!code) return;

      // Check if player has cards (spectators won't)
      const cards = await roomStore.getCard(code, user.id);
      if (!cards || cards.length === 0) return;

      const cellIndex = data?.cellIndex as number;
      const cardIndex = typeof data?.cardIndex === 'number' ? data.cardIndex : 0;
      if (typeof cellIndex !== 'number' || !Number.isInteger(cellIndex) || cellIndex < 0) return;
      if (cardIndex < 0 || cardIndex >= cards.length) return;

      // Validate cellIndex upper bound based on card grid size
      // 75-ball: 5x5 = 25 cells (0-24), 90-ball: 9x3 = 27 cells (0-26)
      const card = cards[cardIndex];
      const maxCell = card.grid.length === 5 ? 24 : 26;
      if (cellIndex > maxCell) return;

      // Get current dabs (array of arrays) and add new one to the right card
      const allDabs = await roomStore.getDabs(code, user.id);
      // Ensure the array has enough entries for all cards
      while (allDabs.length < cards.length) {
        allDabs.push([]);
      }
      if (!allDabs[cardIndex].includes(cellIndex)) {
        allDabs[cardIndex].push(cellIndex);
        await roomStore.setDabs(code, user.id, allDabs);
      }
    } catch (err) {
      console.error('[Game] Error recording dab:', err);
      socket.emit('error', { message: 'Failed to record dab' });
    }
  });

  // --------------- game:claim_bingo ---------------

  socket.on('game:claim_bingo', async (data, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'in_progress');
      if (!ctx) return;
      const { code, room } = ctx;

      const stage: WinStage90 | undefined = data?.stage;

      // Get all cards and server-stored dabs for this player
      const cards = await roomStore.getCard(code, user.id);
      if (!cards || cards.length === 0) {
        return void fail(callback, 'No cards found');
      }

      const allDabs = await roomStore.getDabs(code, user.id);

      // Try ALL cards with server-stored dabs (not client-sent dabs)
      // This prevents desync between client and server dab state
      let result: { valid: boolean; pattern?: string } = { valid: false };

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
          result = cardResult;
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
        }
      }

      console.log(`[Game] Bingo claim by ${user.name}: valid=${result.valid}, pattern=${result.pattern ?? 'none'}, cards=${cards.length}`);

      if (result.valid) {
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

  socket.on('game:pause', async (_, callback) => {
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

  socket.on('game:resume', async (_, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'in_progress');
      if (!ctx) return;
      const { code, room } = ctx;

      if (room.hostId !== user.id) {
        return void fail(callback, 'Only the host can resume the game');
      }

      CallerManager.resumeCalling(code, io);
      io.to(code).emit('game:resumed', { resumedBy: user.name });

      succeed(callback);
    } catch (err) {
      handleError(socket, 'resuming game', callback, err);
    }
  });

  // --------------- game:use_powerup ---------------

  socket.on('game:use_powerup', async (data, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'in_progress');
      if (!ctx) return;
      const { code, room } = ctx;

      const powerupId = data?.powerupId as PowerUpId;
      const targetCellIndex = data?.targetCellIndex as number | undefined;

      // Validate powerupId is a non-empty string and a known power-up
      if (!powerupId || typeof powerupId !== 'string' || !POWER_UP_MAP[powerupId]) {
        return void fail(callback, 'Invalid power-up');
      }

      // 1. Verify player has this power-up and hasn't used it
      const powerups = await roomStore.getPowerUps(code, user.id);
      const powerup = powerups.find((p) => p.id === powerupId && !p.used);
      if (!powerup) {
        return void fail(callback, 'Power-up not available');
      }

      // 2. Mark it as used in Redis
      powerup.used = true;
      await roomStore.setPowerUps(code, user.id, powerups);

      // 3. Apply the effect based on power-up type
      switch (powerupId) {
        case 'number_peek': {
          // Read next 3 from caller pool, emit to this player only
          const callerState = await roomStore.getCallerState(code);
          const peekedNumbers = callerState?.pool.slice(0, 3) ?? [];
          socket.emit('game:number_peek', { numbers: peekedNumbers });
          break;
        }

        case 'wild_square': {
          // Mark the target cell as dabbed in server store (first card)
          if (typeof targetCellIndex === 'number' && targetCellIndex >= 0) {
            const allDabs = await roomStore.getDabs(code, user.id);
            const cardDabs = allDabs[0] ?? [];
            if (!cardDabs.includes(targetCellIndex)) {
              cardDabs.push(targetCellIndex);
            }
            allDabs[0] = cardDabs;
            await roomStore.setDabs(code, user.id, allDabs);
            socket.emit('game:wild_square_applied', { cellIndex: targetCellIndex });
          }
          break;
        }

        case 'turbo_stamp': {
          // Get all called numbers, auto-dab all matching cells on player's first card
          const cards = await roomStore.getCard(code, user.id);
          const callerData = await roomStore.getCallerState(code);
          if (cards && cards.length > 0 && callerData) {
            const firstCard = cards[0];
            const calledSet = new Set(callerData.called);
            const allDabs = await roomStore.getDabs(code, user.id);
            const cardDabs = allDabs[0] ?? [];
            const dabSet = new Set(cardDabs);

            // Iterate through the card grid and dab any called numbers
            const grid = firstCard.grid;
            for (let col = 0; col < grid.length; col++) {
              for (let row = 0; row < grid[col].length; row++) {
                const cellValue = grid[col][row];
                if (cellValue !== null && cellValue !== 0 && calledSet.has(cellValue as number)) {
                  // Convert col/row to row-major index
                  const cellIdx = grid.length === 5
                    ? row * 5 + col
                    : row * 9 + col;
                  dabSet.add(cellIdx);
                }
              }
            }

            const newDabs = Array.from(dabSet);
            allDabs[0] = newDabs;
            await roomStore.setDabs(code, user.id, allDabs);
            socket.emit('game:turbo_stamp_applied', { dabs: newDabs });
          }
          break;
        }

        case 'double_daub': {
          // Set a flag so the player gets notified; actual logic is client-side hint
          socket.emit('game:double_daub_active', {});
          break;
        }

        case 'shield': {
          // Placeholder - emit confirmation
          socket.emit('game:shield_active', { duration: 2 });
          break;
        }

        case 'scramble': {
          // Pick a random other player and notify them
          const otherPlayers = room.players.filter(
            (p) => p.id !== user.id && !p.isSpectator,
          );
          if (otherPlayers.length > 0) {
            const target =
              otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
            const roomSockets = await io.in(code).fetchSockets();
            for (const rs of roomSockets) {
              if (rs.data.user?.id === target.id) {
                rs.emit('game:scrambled', { byPlayer: user.name });
              }
            }
          }
          break;
        }

        case 'callers_choice': {
          // Not fully implemented - emit a toast-worthy event
          socket.emit('game:callers_choice_pending', { message: 'Coming soon!' });
          break;
        }

        case 'ink_blot': {
          // Pick random opponent, emit ink_blot to them with a random cell
          const opponents = room.players.filter(
            (p) => p.id !== user.id && !p.isSpectator,
          );
          if (opponents.length > 0) {
            const target =
              opponents[Math.floor(Math.random() * opponents.length)];
            const targetCards = await roomStore.getCard(code, target.id);
            if (targetCards && targetCards.length > 0) {
              const firstCard = targetCards[0];
              const totalCells =
                firstCard.grid.length === 5 ? 25 : 27; // 5x5 or 9x3
              const blockedCell = Math.floor(Math.random() * totalCells);
              const roomSockets = await io.in(code).fetchSockets();
              for (const rs of roomSockets) {
                if (rs.data.user?.id === target.id) {
                  rs.emit('game:ink_blot', {
                    cellIndex: blockedCell,
                    duration: 2,
                    byPlayer: user.name,
                  });
                }
              }
            }
          }
          break;
        }
      }

      // 4. Emit 'game:powerup_used' to room
      io.to(code).emit('game:powerup_used', {
        playerId: user.id,
        playerName: user.name,
        powerupId,
      });

      // 5. Callback with success
      succeed(callback);
    } catch (err) {
      handleError(socket, 'using power-up', callback, err);
    }
  });

  // --------------- game:new_round ---------------

  socket.on('game:new_round', async (_, callback) => {
    try {
      const ctx = await requireRoom(socket, callback, 'finished');
      if (!ctx) return;
      const { code, room } = ctx;

      if (room.hostId !== user.id) {
        return void fail(callback, 'Only the host can start a new round');
      }

      // Reset room state to lobby
      await roomStore.updateRoom(code, { state: 'lobby' });

      // Clear dabs for all players
      const players = await roomStore.getPlayers(code);
      for (const player of players) {
        await roomStore.setDabs(code, player.id, []);
      }

      const updatedRoom = await roomStore.getRoom(code);
      io.to(code).emit('room:state', updatedRoom);

      succeed(callback);
    } catch (err) {
      handleError(socket, 'starting new round', callback, err);
    }
  });
}
