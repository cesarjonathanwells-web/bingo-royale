// ============================================================
// Bingo Royale - Redis Client
// ============================================================

import Redis from 'ioredis';
import { config } from '../config.js';

let redisClient: Redis | null = null;

// When true, Redis has fatally disconnected and we fall back to in-memory mode.
let redisFailed = false;

export function getRedis(): Redis | null {
  // If Redis previously failed, return null so callers use in-memory fallback.
  if (redisFailed) return null;

  if (redisClient) return redisClient;

  if (!config.REDIS_URL) {
    console.warn(
      '[Redis] REDIS_URL not set. Using in-memory fallback for dev mode.',
    );
    return null;
  }

  redisClient = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      // After 10 retries (~30s), give up and switch to in-memory mode
      if (times > 10) {
        console.error(
          '[Redis] Max reconnection attempts reached. Switching to in-memory fallback.',
        );
        redisFailed = true;
        return null; // stop retrying
      }
      return Math.min(times * 200, 3000);
    },
  });

  redisClient.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connected successfully');
    // If we reconnect successfully after a failure, clear the flag
    redisFailed = false;
  });

  redisClient.on('end', () => {
    // The connection has been closed (after retries exhausted or quit())
    if (!redisFailed) {
      console.warn('[Redis] Connection ended. Switching to in-memory fallback.');
      redisFailed = true;
    }
  });

  return redisClient;
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisFailed = false;
  }
}
