/**
 * Zod-validated environment variables.
 * Parsed at import time — crashes immediately on missing required vars.
 * @module env
 */

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3481),
  DATABASE_PATH: z.string().default('./data/cortex.db'),
  AO_BASE_URL: z.string().url().optional(),
  AO_CONFIG_PATH: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WEB_URL: z.string().default('http://localhost:9301'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

/** @returns Validated environment configuration */
export const env = parsed.data;
