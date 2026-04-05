// ============================================================
// Bingo Royale - Room Socket Handlers
// ============================================================

import { randomUUID } from 'crypto';
import type { Server } from 'socket.io';
import type { Room, Player, BingoVariant, WinPattern } from '@bingo/shared';
import {
  DEFAULT_PLAYER_LIMIT,
  MAX_PLAYERS,
  MAX_CUSTOM_PATTERNS,
  MIN_PATTERN_CELLS,
  MAX_PATTERN_NAME_LENGTH,
  SPEED_PRESETS,
  WIN_PATTERNS,
} from '@bingo/shared';
import type { AuthenticatedSocket } from '../../services/auth.js';
import * as roomStore from '../../redis/room-store.js';
import { CallerManager } from '../../services/caller.js';

/**
 * Generate a 6-character alphanumeric room code.
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

/** Validate that a value is a well-formed custom WinPattern. */
function isValidCustomPattern(p: unknown): p is WinPattern {
  if (!p || typeof p !== 'object') return false;
  const { id, name, nameEs, cells } = p as Record<string, unknown>;
  if (typeof id !== 'string' || !id.startsWith('custom_')) return false;
  if (typeof name !== 'string' || name.length < 1 || name.length > MAX_PATTERN_NAME_LENGTH) return false;
  if (typeof nameEs !== 'string' || nameEs.length < 1 || nameEs.length > MAX_PATTERN_NAME_LENGTH) return false;
  if (!Array.isArray(cells) || cells.length < MIN_PATTERN_CELLS || cells.length > 25) return false;
  const cellSet = new Set<number>();
  for (const c of cells) {
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c > 24) return false;
    cellSet.add(c);
  }
  if (cellSet.size !== cells.length) return false; // duplicates
  return true;
}

export function registerRoomHandlers(
  socket: AuthenticatedSocket,
  io: Server,
): void {
  const user = socket.data.user;

  // --------------- room:create ---------------

  socket.on('room:create', async (data, callback) => {
    try {
      // Validate variant is '75' or '90'
      if (data?.variant !== undefined && data.variant !== '75' && data.variant !== '90') {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Invalid variant: must be "75" or "90"' });
        return;
      }
      const variant: BingoVariant = data?.variant === '90' ? '90' : '75';
      const speed =
        typeof data?.speed === 'number'
          ? data.speed
          : SPEED_PRESETS[1]!.ms; // Default to 'normal'
      // Default patterns: rows + diagonals + blackout if none specified
      const defaultPatterns = ['top_row', 'middle_row', 'bottom_row', 'diagonal_down', 'diagonal_up', 'four_corners', 'blackout'];
      const patterns: string[] = Array.isArray(data?.patterns) && data.patterns.length > 0
        ? data.patterns
        : defaultPatterns;
      const playerLimit =
        typeof data?.playerLimit === 'number'
          ? Math.min(Math.max(data.playerLimit, 2), MAX_PLAYERS)
          : DEFAULT_PLAYER_LIMIT;

      const code = generateRoomCode();

      const hostPlayer: Player = {
        id: user.id,
        name: user.name,
        isHost: true,
        connected: true,
        isSpectator: false,
      };

      const room: Room = {
        code,
        hostId: user.id,
        variant,
        state: 'lobby',
        speed,
        patterns,
        customPatterns: [],
        playerLimit,
        players: [hostPlayer],
        createdAt: Date.now(),
      };

      await roomStore.createRoom(room);

      // Join the socket to the room channel
      await socket.join(code);
      socket.data.roomCode = code;

      // Respond with room state
      const response = {
        success: true,
        room,
      };

      if (typeof callback === 'function') {
        callback(response);
      }

      socket.emit('room:state', room);
    } catch (err) {
      console.error('[Room] Error creating room:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to create room';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });

  // --------------- room:join ---------------

  socket.on('room:join', async (data, callback) => {
    try {
      const code = data?.code as string;
      if (!code) {
        const msg = 'Room code is required';
        if (typeof callback === 'function') callback({ success: false, error: msg });
        return;
      }

      // Validate code is a string, exactly 6 characters, alphanumeric
      if (typeof code !== 'string' || code.length !== 6 || !/^[A-Za-z0-9]{6}$/.test(code)) {
        const msg = 'Invalid room code: must be 6 alphanumeric characters';
        if (typeof callback === 'function') callback({ success: false, error: msg });
        return;
      }

      const room = await roomStore.getRoom(code);
      if (!room) {
        const msg = 'Room not found';
        if (typeof callback === 'function') callback({ success: false, error: msg });
        return;
      }

      // Check if player is already in the room (reconnecting)
      const existingPlayer = room.players.find((p) => p.id === user.id);

      if (existingPlayer) {
        // Reconnecting - update connection status
        existingPlayer.connected = true;
        await roomStore.addPlayer(code, existingPlayer);
        await socket.join(code);
        socket.data.roomCode = code;

        const updatedRoom = await roomStore.getRoom(code);

        if (typeof callback === 'function') {
          callback({ success: true, room: updatedRoom });
        }
        socket.emit('room:state', updatedRoom);
        io.to(code).emit('room:player_updated', {
          playerId: user.id,
          connected: true,
        });
        return;
      }

      // Check room state - new players can only join in lobby
      const isSpectator = room.state !== 'lobby';

      // Check player limit (spectators don't count)
      if (!isSpectator) {
        const activePlayers = room.players.filter((p) => !p.isSpectator);
        if (activePlayers.length >= room.playerLimit) {
          const msg = 'Room is full';
          if (typeof callback === 'function') callback({ success: false, error: msg });
          return;
        }
      }

      const newPlayer: Player = {
        id: user.id,
        name: user.name,
        isHost: false,
        connected: true,
        isSpectator,
      };

      await roomStore.addPlayer(code, newPlayer);
      await socket.join(code);
      socket.data.roomCode = code;

      const updatedRoom = await roomStore.getRoom(code);

      // Notify others
      socket.to(code).emit('room:player_joined', {
        player: newPlayer,
      });

      // Send state to joiner
      if (typeof callback === 'function') {
        callback({ success: true, room: updatedRoom });
      }
      socket.emit('room:state', updatedRoom);
    } catch (err) {
      console.error('[Room] Error joining room:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to join room';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });

  // --------------- room:leave ---------------

  socket.on('room:leave', async (_, callback) => {
    try {
      const code = socket.data.roomCode;
      if (!code) {
        if (typeof callback === 'function') callback({ success: true });
        return;
      }

      const room = await roomStore.getRoom(code);
      if (!room) {
        socket.data.roomCode = undefined;
        if (typeof callback === 'function') callback({ success: true });
        return;
      }

      await roomStore.removePlayer(code, user.id);
      await socket.leave(code);
      socket.data.roomCode = undefined;

      // Notify room
      io.to(code).emit('room:player_left', {
        playerId: user.id,
        playerName: user.name,
        reason: 'left',
      });

      // Check remaining players
      const remaining = await roomStore.getPlayers(code);

      if (remaining.length === 0) {
        // Room is empty - delete it
        CallerManager.stopCalling(code);
        await roomStore.deleteRoom(code);
      } else if (room.hostId === user.id) {
        // Host left - transfer host to next player
        const newHost = remaining.find((p) => !p.isSpectator) ?? remaining[0]!;
        newHost.isHost = true;
        await roomStore.addPlayer(code, newHost);
        await roomStore.updateRoom(code, { hostId: newHost.id });

        io.to(code).emit('room:host_changed', {
          newHostId: newHost.id,
          newHostName: newHost.name,
        });
      }

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Room] Error leaving room:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to leave room';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });

  // --------------- room:update_settings ---------------

  socket.on('room:update_settings', async (data, callback) => {
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
          callback({ success: false, error: 'Only the host can update settings' });
        return;
      }

      if (room.state !== 'lobby') {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Cannot update settings while game is in progress' });
        return;
      }

      const validSpeeds = SPEED_PRESETS.map((p) => p.ms);
      const validPatternIds = new Set([
        ...WIN_PATTERNS.map((p) => p.id),
        'one_line',
        'two_lines',
        'full_house',
      ]);

      // Existing custom patterns on the room are valid IDs
      for (const cp of room.customPatterns ?? []) {
        validPatternIds.add(cp.id);
      }

      const updates: Partial<Room> = {};
      if (typeof data?.speed === 'number' && validSpeeds.includes(data.speed)) {
        updates.speed = data.speed;
      }

      // Handle custom patterns update (must be processed before patterns)
      if (Array.isArray(data?.customPatterns)) {
        const validated: WinPattern[] = [];
        for (const cp of data.customPatterns) {
          if (isValidCustomPattern(cp) && validated.length < MAX_CUSTOM_PATTERNS) {
            validated.push({ id: cp.id, name: cp.name, nameEs: cp.nameEs, cells: cp.cells });
          }
        }
        updates.customPatterns = validated;
        // Add new custom IDs so they pass the patterns filter below
        for (const cp of validated) {
          validPatternIds.add(cp.id);
        }
      }

      if (Array.isArray(data?.patterns)) {
        const filtered = data.patterns.filter(
          (id: string) => typeof id === 'string' && validPatternIds.has(id),
        );
        if (filtered.length > 0) updates.patterns = filtered;
      }
      if (typeof data?.playerLimit === 'number') {
        updates.playerLimit = Math.min(
          Math.max(data.playerLimit, 2),
          MAX_PLAYERS,
        );
      }
      if (data?.variant === '75' || data?.variant === '90') {
        updates.variant = data.variant;
      }

      await roomStore.updateRoom(code, updates);

      const updatedRoom = await roomStore.getRoom(code);
      io.to(code).emit('room:state', updatedRoom);

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Room] Error updating settings:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to update settings';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });
}
