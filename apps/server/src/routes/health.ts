// ============================================================
// Bingo Royale - Health Check Route
// ============================================================

import { Router } from 'express';

const router = Router();

const startTime = Date.now();

// --------------- GET /api/health ---------------

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

export default router;
