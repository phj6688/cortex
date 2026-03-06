/**
 * Cortex V3 — Fastify bootstrap.
 * Port 3481. Pino structured logging. tRPC + SSE + NDJSON streaming.
 * @module index
 */

import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { env } from './env.js';
import { migrate } from './db/migrate.js';
import { appRouter, type TRPCContext } from './routes/trpc.js';
import { registerHealthRoute } from './routes/health.js';
import { registerSSERoute } from './routes/sse.js';
import { registerBriefRoutes } from './routes/briefs.js';
import { registerAoWebhookRoute } from './routes/ao-webhook.js';
import { registerTestRoutes } from './routes/test-routes.js';

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },
});

fastify.server.keepAliveTimeout = 120_000;
fastify.server.headersTimeout = 130_000;

/** Run migrations before starting */
migrate(fastify.log);

await fastify.register(cors, { origin: true, credentials: true });

await fastify.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext: ({ req, res }: { req: TRPCContext['req']; res: TRPCContext['reply'] }): TRPCContext => ({
      req,
      reply: res,
    }),
  },
});

await registerHealthRoute(fastify);
await registerSSERoute(fastify);
await registerBriefRoutes(fastify);
await registerAoWebhookRoute(fastify);

if (env.NODE_ENV !== 'production') {
  await fastify.register(registerTestRoutes, { prefix: '/test' });
}

fastify.get('/', (_req, reply) => {
  return reply.redirect(env.WEB_URL);
});

fastify.setErrorHandler((err: FastifyError, _request, reply) => {
  fastify.log.error(err);
  reply.status(err.statusCode ?? 500).send({
    success: false,
    error: err.message,
  });
});

try {
  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  fastify.log.info(`Cortex V3 running on port ${env.PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
