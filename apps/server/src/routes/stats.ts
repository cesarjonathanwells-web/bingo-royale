// ============================================================
// Bingo Royale - Stats Routes
// ============================================================

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';

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
        userId,
        gamesPlayed: 0,
        gamesWon: 0,
        totalDabs: 0,
      });
      return;
    }

    const rows = await db
      .select()
      .from(schema.userStats)
      .where(eq(schema.userStats.userId, userId))
      .limit(1);

    if (rows.length === 0) {
      res.json({
        userId,
        gamesPlayed: 0,
        gamesWon: 0,
        totalDabs: 0,
      });
      return;
    }

    const stats = rows[0]!;
    res.json({
      userId: stats.userId,
      gamesPlayed: stats.gamesPlayed,
      gamesWon: stats.gamesWon,
      totalDabs: stats.totalDabs,
    });
  } catch (err) {
    console.error('[Stats] Error fetching stats:', err);
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

export default router;
