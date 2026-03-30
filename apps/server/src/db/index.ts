// ============================================================
// Bingo Royale - Database Client
// ============================================================

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';

const { Pool } = pg;

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pool: pg.Pool | null = null;

export function getDb() {
  if (db) return db;

  if (!config.DATABASE_URL) {
    console.warn(
      '[DB] DATABASE_URL not set. Database features are disabled in dev mode.',
    );
    return null;
  }

  pool = new Pool({
    connectionString: config.DATABASE_URL,
  });

  db = drizzle(pool, { schema });
  return db;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export { schema };
