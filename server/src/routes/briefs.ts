/**
 * Brief refinement route — NDJSON streaming.
 * POST /api/briefs/refine
 * 10s warning, 20s fallback to manual editor.
 * @module routes/briefs
 */

import type { FastifyInstance } from 'fastify';
import { refineRequestSchema } from '../domain/brief-schema.js';
import { createRefinementStream, parseLLMResponse } from '../services/brief-refiner.js';
import { writeNdjsonHeaders, writeNdjsonLine, writeNdjsonError } from '../lib/ndjson.js';
import { env } from '../env.js';

/**
 * Register POST /api/briefs/refine route.
 * @param fastify - Fastify instance
 * @returns void
 */
export async function registerBriefRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/briefs/refine', async (req, reply) => {
    const parsed = refineRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map(i => i.message).join('; '),
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return reply.status(503).send({
        success: false,
        error: 'ANTHROPIC_API_KEY is not configured',
      });
    }

    const { input, context, answers } = parsed.data;

    reply.hijack();
    const raw = reply.raw;
    writeNdjsonHeaders(raw);

    let ended = false;
    const safeEnd = () => {
      if (!ended) { ended = true; raw.end(); }
    };

    // 10s: warning
    const timeoutWarning = setTimeout(() => {
      if (!ended) writeNdjsonLine(raw, 'warning', 'Taking longer than expected...');
    }, 10_000);

    // 20s: fallback to manual editor, close stream
    const timeoutFallback = setTimeout(() => {
      if (!ended) {
        writeNdjsonLine(raw, 'fallback', 'Could not reach AI — write brief manually');
        safeEnd();
      }
    }, 20_000);

    try {
      const stream = createRefinementStream(input, context, answers);
      let fullResponse = '';

      stream.on('text', (delta) => {
        if (delta && !ended) {
          fullResponse += delta;
          writeNdjsonLine(raw, 'token', delta);
        }
      });

      await stream.finalText();
      clearTimeout(timeoutWarning);
      clearTimeout(timeoutFallback);

      if (!ended) {
        const result = parseLLMResponse(fullResponse, input);
        writeNdjsonLine(raw, 'complete', result);
      }
    } catch (err) {
      clearTimeout(timeoutWarning);
      clearTimeout(timeoutFallback);
      if (!ended) {
        writeNdjsonError(raw, err instanceof Error ? err.message : String(err));
      }
      return;
    }

    safeEnd();
  });
}
