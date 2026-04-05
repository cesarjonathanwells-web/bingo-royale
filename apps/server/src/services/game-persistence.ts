// ============================================================
// Bingo Royale - Game Persistence Service
// ============================================================

import { sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import * as roomStore from '../redis/room-store.js';
import type { BingoVariant, WinEvent } from '@bingo/shared';

/**
 * Persist a completed game to PostgreSQL.
 * This is fire-and-forget: callers should use `void persistGameResult(...)`.
 */
export async function persistGameResult(
  roomCode: string,
  variant: BingoVariant,
  hostId: string,
  winners: WinEvent[],
  calledNumbers: number[],
): Promise<void> {
  const db = getDb();
  if (!db) return; // No DB in dev mode

  try {
    const room = await roomStore.getRoom(roomCode);
    if (!room) return;

    const players = await roomStore.getPlayers(roomCode);

    // 1. Insert game record
    const [game] = await db.insert(schema.games).values({
      roomCode,
      hostId,
      variant,
      state: 'finished',
      speed: room.speed,
      patterns: room.patterns,
      customPatterns: room.customPatterns ?? [],
      calledNumbers,
      winnerId: winners[0]?.playerId ?? null,
      winPattern: winners[0]?.pattern ?? null,
      playerCount: players.filter((p) => !p.isSpectator).length,
      startedAt: new Date(room.createdAt),
      finishedAt: new Date(),
    }).returning();

    if (!game) return;

    // 2. Insert game_players records for each player
    for (const player of players) {
      if (player.isSpectator) continue;

      const cards = await roomStore.getCard(roomCode, player.id);
      const dabs = await roomStore.getDabs(roomCode, player.id);
      const isWinner = winners.some((w) => w.playerId === player.id);

      await db.insert(schema.gamePlayers).values({
        gameId: game.id,
        userId: player.id,
        card: cards ?? {},
        dabState: dabs ?? [],
        isWinner,
      });
    }

    // 3. Update user_stats for all players
    for (const player of players) {
      if (player.isSpectator) continue;
      const isWinner = winners.some((w) => w.playerId === player.id);
      const dabs = await roomStore.getDabs(roomCode, player.id);
      const dabCount = Array.isArray(dabs) ? dabs.length : 0;

      // Upsert stats
      await db.insert(schema.userStats).values({
        userId: player.id,
        gamesPlayed: 1,
        gamesWon: isWinner ? 1 : 0,
        totalDabs: dabCount,
      }).onConflictDoUpdate({
        target: schema.userStats.userId,
        set: {
          gamesPlayed: sql`${schema.userStats.gamesPlayed} + 1`,
          gamesWon: sql`${schema.userStats.gamesWon} + ${isWinner ? 1 : 0}`,
          totalDabs: sql`${schema.userStats.totalDabs} + ${dabCount}`,
          updatedAt: new Date(),
        },
      });
    }

    console.log(`[Persistence] Game ${game.id} saved with ${players.length} players`);
  } catch (err) {
    console.error('[Persistence] Error saving game result:', err);
  }
}
