/**
 * Health check endpoint.
 * @module routes/health
 */

import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { env } from '../env.js';

const startTime = Date.now();

/**
 * Check AO connectivity by hitting /api/sessions.
 * @returns 'ok' | 'degraded' | 'unreachable'
 */
async function checkAo(): Promise<'ok' | 'degraded' | 'unreachable'> {
  const aoBaseUrl = env.AO_BASE_URL;
  if (!aoBaseUrl) return 'ok';

  try {
    const res = await fetch(`${aoBaseUrl}/api/sessions`, {
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok ? 'ok' : 'degraded';
  } catch {
    return 'unreachable';
  }
}

/**
 * Register GET /health route.
 * @param fastify - Fastify instance
 * @returns void
 */
export async function registerHealthRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async () => {
    let dbStatus = 'ok';
    try {
      const row = getDb().prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
      if (row?.ok !== 1) dbStatus = 'error';
    } catch {
      dbStatus = 'error';
    }

    const aoStatus = await checkAo();
    const aoConfigured = !!env.AO_BASE_URL;
    const overall = dbStatus === 'ok' && (!aoConfigured || aoStatus === 'ok') ? 'ok' : 'degraded';

    return {
      status: overall,
      db: dbStatus,
      ...(aoConfigured && { ao: aoStatus }),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      ts: Date.now(),
    };
  });
}
