/**
 * Test-only routes — never registered in production.
 * Provides seed/update endpoints for E2E tests.
 * @module routes/test-routes
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as sessionQueries from '../db/queries/sessions.js';
import * as auditQueries from '../db/queries/audits.js';

const sessionStateEnum = z.enum([
  'pending', 'auditing', 'ready', 'dispatched',
  'running', 'verifying', 'passed', 'failed', 'skipped',
]);

const seedSessionSchema = z.object({
  id: z.string(),
  task_id: z.string(),
  session_number: z.number(),
  title: z.string(),
  prompt: z.string().optional(),
  state: sessionStateEnum.optional(),
  deliverables: z.string().optional(),
  verification: z.string().optional(),
  regression: z.string().optional(),
  anti_patterns: z.string().optional(),
});

const seedVerdictSchema = z.object({
  id: z.string(),
  task_id: z.string(),
  file_path: z.string(),
  verdict: z.enum(['keep', 'patch', 'rewrite', 'delete', 'create']),
  reason: z.string(),
  patch_details: z.string().nullable().optional(),
});

const updateSessionSchema = z.object({
  id: z.string(),
  state: sessionStateEnum.optional(),
  verification_output: z.string().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  cost_usd: z.number().optional(),
  retry_count: z.number().optional(),
  started_at: z.number().nullable().optional(),
  completed_at: z.number().nullable().optional(),
});

/**
 * Register test-only routes for E2E seeding.
 * @param fastify - Fastify instance
 */
export async function registerTestRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/seed-session', async (req, reply) => {
    const input = seedSessionSchema.parse(req.body);
    sessionQueries.insertSession(input);
    const session = sessionQueries.getSession(input.id);
    return reply.send({ success: true, data: session });
  });

  fastify.post('/seed-verdict', async (req, reply) => {
    const input = seedVerdictSchema.parse(req.body);
    auditQueries.insertVerdict(input);
    return reply.send({ success: true, data: { ok: true } });
  });

  fastify.post('/update-session', async (req, reply) => {
    const input = updateSessionSchema.parse(req.body);
    const { id, ...updates } = input;
    sessionQueries.updateSession(id, updates);
    const session = sessionQueries.getSession(id);
    return reply.send({ success: true, data: session });
  });
}
