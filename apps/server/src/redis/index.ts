// ============================================================
// Bingo Royale - Redis Client
// ============================================================

import Redis from 'ioredis';
import { config } from '../config.js';

let redisClient: Redis | null = null;

export function getRedis(): Redis | null {
  if (redisClient) return redisClient;

  if (!config.REDIS_URL) {
    console.warn(
      '[Redis] REDIS_URL not set. Using in-memory fallback for dev mode.',
    );
    return null;
  }

  redisClient = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
  });

  redisClient.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });

  return redisClient;
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
