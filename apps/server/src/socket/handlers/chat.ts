// ============================================================
// Bingo Royale - Chat Socket Handlers
// ============================================================

import { randomUUID } from 'crypto';
import type { Server } from 'socket.io';
import type { ChatMessage } from '@bingo/shared';
import { GAME_EMOJIS } from '@bingo/shared';
import type { AuthenticatedSocket } from '../../services/auth.js';

const MAX_MESSAGE_LENGTH = 200;

// Rate limiting for emoji reactions: max 3 per 5 seconds per player
const reactionTimestamps = new Map<string, number[]>();
const REACTION_LIMIT = 3;
const REACTION_WINDOW_MS = 5000;

export function registerChatHandlers(
  socket: AuthenticatedSocket,
  io: Server,
): void {
  const user = socket.data.user;

  // --------------- chat:message ---------------

  socket.on('chat:message', (data, callback) => {
    try {
      const code = socket.data.roomCode;
      if (!code) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Not in a room' });
        return;
      }

      const text = typeof data?.text === 'string' ? data.text.trim() : '';

      if (text.length === 0) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Message cannot be empty' });
        return;
      }

      if (text.length > MAX_MESSAGE_LENGTH) {
        if (typeof callback === 'function')
          callback({
            success: false,
            error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
          });
        return;
      }

      const message: ChatMessage = {
        id: randomUUID(),
        playerId: user.id,
        playerName: user.name,
        text,
        timestamp: Date.now(),
      };

      // Broadcast to entire room (including sender)
      io.to(code).emit('chat:message', message);

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Chat] Error sending message:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to send message';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });

  // --------------- chat:reaction ---------------

  socket.on('chat:reaction', (data, callback) => {
    try {
      const code = socket.data.roomCode;
      if (!code) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Not in a room' });
        return;
      }

      const emoji = typeof data?.emoji === 'string' ? data.emoji : '';

      // Validate emoji is in the allowed list
      if (!(GAME_EMOJIS as readonly string[]).includes(emoji)) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Invalid emoji' });
        return;
      }

      // Rate limit: max 3 reactions per 5 seconds
      const now = Date.now();
      const timestamps = reactionTimestamps.get(user.id) ?? [];
      const recent = timestamps.filter((ts) => now - ts < REACTION_WINDOW_MS);

      if (recent.length >= REACTION_LIMIT) {
        if (typeof callback === 'function')
          callback({ success: false, error: 'Rate limited' });
        return;
      }

      recent.push(now);
      reactionTimestamps.set(user.id, recent);

      // Broadcast to entire room (including sender)
      io.to(code).emit('chat:reaction', {
        playerId: user.id,
        playerName: user.name,
        emoji,
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Chat] Error sending reaction:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to send reaction';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMsg });
      }
      socket.emit('error', { message: errorMsg });
    }
  });
}
