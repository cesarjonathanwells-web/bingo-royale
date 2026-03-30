// ============================================================
// Bingo Royale - Profile Routes
// ============================================================

import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';

const router = Router();

// --------------- GET /api/profile/:userId ---------------

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const db = getDb();
    if (!db) {
      // Return default profile in dev mode without DB
      res.json({
        user: {
          id: userId,
          displayName: 'Guest',
          isGuest: true,
          locale: 'en',
          createdAt: new Date().toISOString(),
        },
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalDabs: 0,
          winRate: 0,
        },
        recentGames: [],
      });
      return;
    }

    // Fetch user
    const userRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userRows[0]!;

    // Fetch user stats
    const statsRows = await db
      .select()
      .from(schema.userStats)
      .where(eq(schema.userStats.userId, userId))
      .limit(1);

    const statsRow = statsRows[0];
    const gamesPlayed = statsRow?.gamesPlayed ?? 0;
    const gamesWon = statsRow?.gamesWon ?? 0;
    const totalDabs = statsRow?.totalDabs ?? 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

    // Fetch recent games (last 20)
    const recentGames = await db
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
      .limit(20);

    res.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        isGuest: user.isGuest,
        locale: user.locale,
        createdAt: user.createdAt,
      },
      stats: {
        gamesPlayed,
        gamesWon,
        totalDabs,
        winRate,
      },
      recentGames: recentGames.map((g) => ({
        id: g.id,
        roomCode: g.roomCode,
        variant: g.variant,
        playerCount: g.playerCount,
        isWinner: g.isWinner,
        winPattern: g.winPattern,
        calledCount: Array.isArray(g.calledNumbers) ? g.calledNumbers.length : 0,
        finishedAt: g.finishedAt,
      })),
    });
  } catch (err) {
    console.error('[Profile] Error fetching profile:', err);
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

export default router;
