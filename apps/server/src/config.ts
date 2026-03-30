// ============================================================
// Bingo Royale - Server Configuration
// ============================================================

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    process.exit(1);
  }

  const config = result.data;

  if (config.NODE_ENV === 'production') {
    if (!config.DATABASE_URL) {
      console.error('DATABASE_URL is required in production');
      process.exit(1);
    }
    if (!config.REDIS_URL) {
      console.error('REDIS_URL is required in production');
      process.exit(1);
    }
    if (config.JWT_SECRET === 'dev-secret-change-in-production') {
      console.error('JWT_SECRET must be changed from default in production');
      process.exit(1);
    }
  }

  return config;
}

export const config = loadConfig();
