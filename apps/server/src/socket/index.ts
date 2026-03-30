// ============================================================
// Bingo Royale - Socket.IO Server Setup
// ============================================================

import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { AFK_TIMEOUT } from '@bingo/shared';
import { config } from '../config.js';
import { getRedis } from '../redis/index.js';
import { socketAuthMiddleware, type AuthenticatedSocket } from '../services/auth.js';
import { registerRoomHandlers } from './handlers/room.js';
import { registerGameHandlers } from './handlers/game.js';
import { registerChatHandlers } from './handlers/chat.js';
import * as roomStore from '../redis/room-store.js';

const afkTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Set up Redis adapter if Redis is available
  const redis = getRedis();
  if (redis) {
    const pubClient = new Redis(config.REDIS_URL!);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
      console.error('[Socket.IO Redis Adapter] Pub client error:', err.message);
    });
    subClient.on('error', (err) => {
      console.error('[Socket.IO Redis Adapter] Sub client error:', err.message);
    });

    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket.IO] Using Redis adapter');
  } else {
    console.log('[Socket.IO] Using in-memory adapter (dev mode)');
  }

  // Auth middleware
  io.use(socketAuthMiddleware);

  // Connection handler
  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const user = socket.data.user;

    console.log(`[Socket.IO] User connected: ${user.name} (${user.id})`);

    // Clear any AFK timer for this user
    const existingTimer = afkTimers.get(user.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      afkTimers.delete(user.id);
    }

    // Register all event handlers
    registerRoomHandlers(socket, io);
    registerGameHandlers(socket, io);
    registerChatHandlers(socket, io);

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`[Socket.IO] User disconnected: ${user.name} (${user.id})`);

      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      try {
        // Mark player as disconnected
        const players = await roomStore.getPlayers(roomCode);
        const player = players.find((p) => p.id === user.id);

        if (player) {
          player.connected = false;
          await roomStore.addPlayer(roomCode, player);

          // Notify room about disconnection
          io.to(roomCode).emit('room:player_updated', {
            playerId: user.id,
            connected: false,
          });

          // Set AFK timer - remove player if they don't reconnect
          const timer = setTimeout(async () => {
            try {
              const currentPlayers = await roomStore.getPlayers(roomCode);
              const stillDisconnected = currentPlayers.find(
                (p) => p.id === user.id && !p.connected,
              );

              if (stillDisconnected) {
                await roomStore.removePlayer(roomCode, user.id);
                io.to(roomCode).emit('room:player_left', {
                  playerId: user.id,
                  playerName: user.name,
                  reason: 'afk',
                });

                // Check if room is empty
                const remaining = await roomStore.getPlayers(roomCode);
                if (remaining.length === 0) {
                  await roomStore.deleteRoom(roomCode);
                }
              }
            } catch (err) {
              console.error('[Socket.IO] AFK cleanup error:', err);
            } finally {
              afkTimers.delete(user.id);
            }
          }, AFK_TIMEOUT);

          afkTimers.set(user.id, timer);
        }
      } catch (err) {
        console.error('[Socket.IO] Disconnect handler error:', err);
      }
    });
  });

  return io;
}
