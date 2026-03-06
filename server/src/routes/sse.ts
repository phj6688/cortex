/**
 * SSE endpoint — GET /api/events
 * NON-async handler. reply.hijack() before writing.
 * Events are SIGNALS ONLY — client fetches full data via tRPC.
 * Per-connection heartbeat every 30s with proper cleanup.
 * @module routes/sse
 */

import type { FastifyInstance } from 'fastify';
import { subscribe } from '../services/event-bus.js';

export async function registerSSERoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/events', (_req, reply) => {
    reply.hijack();
    const raw = reply.raw;

    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    });
    raw.flushHeaders();

    // Per-connection heartbeat every 15s
    const heartbeat = setInterval(() => {
      raw.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
    }, 15_000);

    const unsubscribe = subscribe((event) => {
      try {
        const data = JSON.stringify(event);
        raw.write(`id:${event.id}\nevent:${event.type}\ndata:${data}\n\n`);
      } catch (err) {
        fastify.log.error({ err }, 'SSE write error');
      }
    });

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    raw.once('close', cleanup);
    raw.once('error', cleanup);
  });
}
