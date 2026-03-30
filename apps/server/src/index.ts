// ============================================================
// Bingo Royale - Server Entry Point
// ============================================================

import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { createSocketServer } from './socket/index.js';
import { closeDb } from './db/index.js';
import { closeRedis } from './redis/index.js';
import authRoutes from './routes/auth.js';
import statsRoutes from './routes/stats.js';
import healthRoutes from './routes/health.js';
import profileRoutes from './routes/profile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------- Express App ---------------

const app = express();

// CORS
app.use(
  cors({
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
    credentials: true,
  }),
);

// Body parsing
app.use(express.json());

// --------------- API Routes ---------------

app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/profile', profileRoutes);

// --------------- Static files (production) ---------------

if (config.NODE_ENV === 'production') {
  // Try multiple possible client dist paths
  const clientDistPaths = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../../../apps/client/dist'),
  ];

  for (const distPath of clientDistPaths) {
    try {
      app.use(express.static(distPath));
      // SPA fallback - serve index.html for non-API routes
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
          next();
          return;
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log(`[Server] Serving static files from ${distPath}`);
      break;
    } catch {
      // Try next path
    }
  }
}

// --------------- HTTP + Socket.IO Server ---------------

const httpServer = createServer(app);
const io = createSocketServer(httpServer);

// --------------- Start Listening ---------------

httpServer.listen(config.PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║       Bingo Royale Server             ║
  ║  Running on port ${String(config.PORT).padEnd(20)}║
  ║  Environment: ${config.NODE_ENV.padEnd(23)}║
  ╚═══════════════════════════════════════╝
  `);
});

// --------------- Graceful Shutdown ---------------

async function shutdown(signal: string) {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);

  // Close Socket.IO
  io.close();

  // Close HTTP server
  httpServer.close();

  // Close database connection
  await closeDb();

  // Close Redis connection
  await closeRedis();

  console.log('[Server] Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Handle uncaught errors
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
  process.exit(1);
});

export { app, httpServer, io };
