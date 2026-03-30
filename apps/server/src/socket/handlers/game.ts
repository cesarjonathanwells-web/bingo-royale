// ============================================================
// Bingo Royale - Game Socket Handlers
// ============================================================

import type { Server } from 'socket.io';
import type { BingoVariant, WinStage90 } from '@bingo/shared';
import { generateCallerPool75, generateCallerPool90 } from '@bingo/shared';
import type { AuthenticatedSocket } from '../../services/auth.js';
import * as roomStore from '../../redis/room-store.js';
import { CallerManager } from '../../services/caller.js';
import { generateCardsForRoom } from '../../services/card-generator.js';
import { validateBingo75, validateBingo90 } from '../../services/win-validator.js';

export function registerGameHandlers(
  socket: AuthenticatedSocket,
  io: Server,
): void {
  const user = socket.data.user;

  // --------------- game:start ---------------

  socket.on('game:start', async (_, callback) => {
    try {
      const code = socket.data.roomCode;
      if (!code) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Not in a room' });
        return;
      }

      const room = await roomStore.getRoom(code);
      if (!room) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Room not found' });
        return;
      }

      // Only host can start
      if (room.hostId !== user.id) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Only the host can start the game' });
        return;
      }

      // Must be in lobby
      if (room.state !== 'lobby') {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Game already in progress' });
        return;
      }

      // Need at least 1 non-spectator player
      const activePlayers = room.players.filter((p) => !p.isSpectator);
      if (activePlayers.length < 1) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Need at least 1 player to start' });
        return;
      }

      // Update room state
      await roomStore.updateRoom(code, { state: 'in_progress' });

      // Generate cards for all active players
      const playerIds = activePlayers.map((p) => p.id);
      const cards = await generateCardsForRoom(
        room.variant,
        playerIds,
        code,
      );

      // Initialize caller pool
      const pool =
        room.variant === '75'
          ? generateCallerPool75()
          : generateCallerPool90();
      await roomStore.setCallerState(code, pool, [], false);

      // Send each player their card
      const roomSockets = await io.in(code).fetchSockets();
      for (const roomSocket of roomSockets) {
        const socketUserId = roomSocket.data.user?.id;
        if (socketUserId) {
          const card = cards.get(socketUserId);
          if (card) {
            roomSocket.emit('game:card_dealt', { card });
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

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Game] Error starting game:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to start game';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });

  // --------------- game:dab ---------------

  socket.on('game:dab', async (data) => {
    try {
      const code = socket.data.roomCode;
      if (!code) return;

      const cellIndex = data?.cellIndex as number;
      if (typeof cellIndex !== 'number' || cellIndex < 0) return;

      // Get current dabs and add new one
      const dabs = await roomStore.getDabs(code, user.id);
      if (!dabs.includes(cellIndex)) {
        dabs.push(cellIndex);
        await roomStore.setDabs(code, user.id, dabs);
      }
    } catch (err) {
      console.error('[Game] Error recording dab:', err);
      socket.emit('error', { message: 'Failed to record dab' });
    }
  });

  // --------------- game:claim_bingo ---------------

  socket.on('game:claim_bingo', async (data, callback) => {
    try {
      const code = socket.data.roomCode;
      if (!code) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Not in a room' });
        return;
      }

      const room = await roomStore.getRoom(code);
      if (!room || room.state !== 'in_progress') {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Game not in progress' });
        return;
      }

      const markedCells: number[] = Array.isArray(data?.markedCells)
        ? data.markedCells
        : [];
      const stage: WinStage90 | undefined = data?.stage;

      let result;
      if (room.variant === '75') {
        result = await validateBingo75(code, user.id, markedCells);
      } else {
        if (!stage) {
          if (typeof callback === 'function')
            callback({ success: false, error: 'Stage is required for 90-ball bingo' });
          return;
        }
        result = await validateBingo90(code, user.id, markedCells, stage);
      }

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

        if (typeof callback === 'function')
          callback({ success: true, valid: true, pattern: result.pattern });
      } else {
        // Invalid claim - only notify the claimer
        socket.emit('game:bingo_claimed', {
          valid: false,
          playerId: user.id,
          playerName: user.name,
          message: 'Invalid bingo claim',
        });

        if (typeof callback === 'function')
          callback({ success: true, valid: false });
      }
    } catch (err) {
      console.error('[Game] Error claiming bingo:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to validate bingo claim';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });

  // --------------- game:pause ---------------

  socket.on('game:pause', async (_, callback) => {
    try {
      const code = socket.data.roomCode;
      if (!code) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Not in a room' });
        return;
      }

      const room = await roomStore.getRoom(code);
      if (!room) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Room not found' });
        return;
      }

      if (room.hostId !== user.id) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Only the host can pause the game' });
        return;
      }

      if (room.state !== 'in_progress') {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Game not in progress' });
        return;
      }

      await CallerManager.pauseCalling(code);
      io.to(code).emit('game:paused', { pausedBy: user.name });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Game] Error pausing game:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to pause game';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });

  // --------------- game:resume ---------------

  socket.on('game:resume', async (_, callback) => {
    try {
      const code = socket.data.roomCode;
      if (!code) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Not in a room' });
        return;
      }

      const room = await roomStore.getRoom(code);
      if (!room) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Room not found' });
        return;
      }

      if (room.hostId !== user.id) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Only the host can resume the game' });
        return;
      }

      if (room.state !== 'in_progress') {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Game not in progress' });
        return;
      }

      CallerManager.resumeCalling(code, io);
      io.to(code).emit('game:resumed', { resumedBy: user.name });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Game] Error resuming game:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to resume game';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });

  // --------------- game:new_round ---------------

  socket.on('game:new_round', async (_, callback) => {
    try {
      const code = socket.data.roomCode;
      if (!code) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Not in a room' });
        return;
      }

      const room = await roomStore.getRoom(code);
      if (!room) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Room not found' });
        return;
      }

      if (room.hostId !== user.id) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Only the host can start a new round' });
        return;
      }

      if (room.state !== 'finished') {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Game must be finished to start new round' });
        return;
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

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Game] Error starting new round:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to start new round';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });
}
