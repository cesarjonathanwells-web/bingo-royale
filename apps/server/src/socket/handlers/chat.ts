// ============================================================
// Bingo Royale - Chat Socket Handlers
// ============================================================

import { randomUUID } from 'crypto';
import type { Server } from 'socket.io';
import type { ChatMessage } from '@bingo/shared';
import type { AuthenticatedSocket } from '../../services/auth.js';

const MAX_MESSAGE_LENGTH = 200;

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
}
