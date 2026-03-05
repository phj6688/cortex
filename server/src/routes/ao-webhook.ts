/**
 * AO Webhook receiver — POST /api/ao-events.
 * Maps AO events to task state transitions.
 * @module routes/ao-webhook
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { getTaskByAoSession, updateTask } from '../db/queries/tasks.js';
import { createEvent } from '../db/queries/events.js';
import { publishTaskStateChanged, publishAoUpdate } from '../services/event-bus.js';
import { eventId } from '../lib/id.js';
import { getDb } from '../db/connection.js';
import type { TaskState } from '../domain/task-machine.js';
import { startPoller } from '../services/ao-status-poller.js';

const aoWebhookSchema = z.object({
  sessionId: z.string(),
  event: z.string(),
  payload: z.record(z.unknown()).optional(),
});

const stateMap: Record<string, TaskState> = {
  'started':           'running',
  'pr-opened':         'running',
  'ci-passed':         'running',
  'ci-failed':         'failed',
  'done':              'done',
  'stuck':             'failed',
  'changes-requested': 'running',
};

/** Map AO event names to Cortex event_type values */
function mapEventType(aoEvent: string): string {
  const eventTypeMap: Record<string, string> = {
    'started':           'ao_update',
    'pr-opened':         'pr_opened',
    'ci-passed':         'ci_passed',
    'ci-failed':         'ci_failed',
    'done':              'done',
    'stuck':             'failed',
    'changes-requested': 'ao_update',
  };
  return eventTypeMap[aoEvent] ?? 'ao_update';
}

/**
 * Register AO webhook route.
 * @param fastify - Fastify instance
 */
export async function registerAoWebhookRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/ao-events', async (req, reply) => {
    const parsed = aoWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid webhook payload',
        details: parsed.error.issues,
      });
    }

    const { sessionId, event, payload } = parsed.data;

    const task = getTaskByAoSession(sessionId);
    if (!task) {
      fastify.log.warn({ sessionId }, 'Webhook for unknown session');
      return reply.code(404).send({ error: 'Unknown session' });
    }

    const newState = stateMap[event];
    if (!newState) {
      fastify.log.warn({ event }, 'Unknown AO event type');
      return reply.code(400).send({ error: 'Unknown event' });
    }

    const db = getDb();
    const fromState = task.state;

    db.transaction(() => {
      if (event === 'ci-failed' || event === 'stuck') {
        updateTask(task.id, {
          state: 'failed',
          failure_reason: (payload?.reason as string) ?? `Agent reported: ${event}`,
          completed_at: Math.floor(Date.now() / 1000),
        });
      } else if (event === 'done') {
        updateTask(task.id, {
          state: 'done',
          completed_at: Math.floor(Date.now() / 1000),
        });
      } else if (event === 'pr-opened') {
        updateTask(task.id, {
          state: newState,
          ao_pr_url: (payload?.url as string) ?? null,
        });
      } else {
        updateTask(task.id, { state: newState });
      }

      createEvent({
        id: eventId(),
        task_id: task.id,
        event_type: mapEventType(event),
        from_state: fromState,
        to_state: newState,
        payload: JSON.stringify(payload ?? {}),
        actor: 'ao',
      });
    })();

    // SSE push
    publishTaskStateChanged(task.id, fromState as TaskState, newState);
    publishAoUpdate(task.id, event);

    // Ensure poller is running when we have active tasks
    if (newState === 'running') {
      startPoller(fastify.log);
    }

    fastify.log.info({ taskId: task.id, event, from: fromState, to: newState }, 'AO webhook processed');
    return reply.code(200).send({ ok: true });
  });
}
