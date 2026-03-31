// ============================================================
// Bingo Royale - Stats Query Helpers
// ============================================================

import { eq, desc } from 'drizzle-orm';
import type { getDb } from '../db/index.js';
import { schema } from '../db/index.js';

type Db = NonNullable<ReturnType<typeof getDb>>;

// --------------- User Stats ---------------

export interface StatsResult {
  gamesPlayed: number;
  gamesWon: number;
  totalDabs: number;
  winRate: number;
}

export async function fetchUserStats(db: Db, userId: string): Promise<StatsResult> {
  const rows = await db
    .select()
    .from(schema.userStats)
    .where(eq(schema.userStats.userId, userId))
    .limit(1);

  const statsRow = rows[0];
  const gamesPlayed = statsRow?.gamesPlayed ?? 0;
  const gamesWon = statsRow?.gamesWon ?? 0;
  const totalDabs = statsRow?.totalDabs ?? 0;
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

  return { gamesPlayed, gamesWon, totalDabs, winRate };
}

// --------------- Recent Games ---------------

export interface RecentGame {
  id: string;
  roomCode: string;
  variant: string;
  playerCount: number;
  isWinner: boolean;
  winPattern: string | null;
  calledCount: number;
  finishedAt: Date | null;
}

export async function fetchRecentGames(
  db: Db,
  userId: string,
  limit: number = 20,
): Promise<RecentGame[]> {
  const rows = await db
    .select({
      id: schema.games.id,
      roomCode: schema.games.roomCode,
      variant: schema.games.variant,
      playerCount: schema.games.playerCount,
      isWinner: schema.gamePlayers.isWinner,
      winPattern: schema.games.winPattern,
      calledNumbers: schema.games.calledNumbers,
      finishedAt: schema.games.finishedAt,
    })
    .from(schema.gamePlayers)
    .innerJoin(schema.games, eq(schema.gamePlayers.gameId, schema.games.id))
    .where(eq(schema.gamePlayers.userId, userId))
    .orderBy(desc(schema.games.finishedAt))
    .limit(limit);

  return rows.map((g) => ({
    id: g.id,
    roomCode: g.roomCode,
    variant: g.variant,
    playerCount: g.playerCount,
    isWinner: g.isWinner,
    winPattern: g.winPattern,
    calledCount: Array.isArray(g.calledNumbers) ? g.calledNumbers.length : 0,
    finishedAt: g.finishedAt,
  }));
}
