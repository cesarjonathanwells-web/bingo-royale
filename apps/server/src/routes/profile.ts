// ============================================================
// Bingo Royale - Profile Routes
// ============================================================

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { fetchUserStats, fetchRecentGames } from '../services/stats-queries.js';

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
    const stats = await fetchUserStats(db, userId);
    const recentGames = await fetchRecentGames(db, userId);

    res.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        isGuest: user.isGuest,
        locale: user.locale,
        createdAt: user.createdAt,
      },
      stats,
      recentGames,
    });
  } catch (err) {
    console.error('[Profile] Error fetching profile:', err);
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

export default router;
