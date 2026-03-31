// ============================================================
// Bingo Royale - Stats Routes
// ============================================================

import { Router } from 'express';
import { getDb } from '../db/index.js';
import { fetchUserStats, fetchRecentGames } from '../services/stats-queries.js';

const router = Router();

// --------------- GET /api/stats/:userId ---------------

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const db = getDb();
    if (!db) {
      // Return default stats in dev mode without DB
      res.json({
        stats: {
          userId,
          gamesPlayed: 0,
          gamesWon: 0,
          totalDabs: 0,
          winRate: 0,
        },
        recentGames: [],
      });
      return;
    }

    const stats = await fetchUserStats(db, userId);
    const recentGames = await fetchRecentGames(db, userId);

    res.json({
      stats: { userId, ...stats },
      recentGames,
    });
  } catch (err) {
    console.error('[Stats] Error fetching stats:', err);
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

export default router;
