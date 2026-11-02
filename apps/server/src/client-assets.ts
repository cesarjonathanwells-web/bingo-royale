import type { Express } from 'express';
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Serve fresh app entry points and long-lived, content-hashed build assets. */
export function serveClient(app: Express, candidates: string[]): string | undefined {
  const directory = candidates.find(candidate => existsSync(path.join(candidate, 'index.html')));
  if (!directory) return;
  app.use(express.static(directory, {
    setHeaders(res, file) {
      const relative = path.relative(directory, file).split(path.sep).join('/');
      res.setHeader('Cache-Control', relative.startsWith('assets/')
        ? 'public, max-age=31536000, immutable' : 'no-cache');
      if (relative === 'sw.js') res.setHeader('Service-Worker-Allowed', '/');
    },
  }));
  // Express 5 requires a named wildcard. Include / as well as deep links.
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || path.extname(req.path)) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(directory, 'index.html'));
  });
  return directory;
}
