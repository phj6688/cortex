/**
 * Health check endpoint.
 * @module routes/health
 */

import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';

const startTime = Date.now();

/**
 * Register GET /health route.
 * @param fastify - Fastify instance
 * @returns void
 */
export async function registerHealthRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', () => {
    let dbStatus = 'ok';
    try {
      const row = getDb().prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
      if (row?.ok !== 1) dbStatus = 'error';
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      db: dbStatus,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      ts: Date.now(),
    };
  });
}
