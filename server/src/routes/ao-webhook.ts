/**
 * AO Webhook receiver — POST /api/ao-events.
 * Maps AO events to task state transitions.
 * Supports both AO's actual notification format and the legacy format.
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

/** AO's actual notification format */
const aoNotificationSchema = z.object({
  type: z.literal('notification'),
  event: z.object({
    type: z.string(),
    sessionId: z.string(),
    message: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  }),
});

/** Legacy webhook format */
const legacyWebhookSchema = z.object({
  sessionId: z.string(),
  event: z.string(),
  payload: z.record(z.unknown()).optional(),
});

/** Map AO event type strings to Cortex event names */
const aoEventNameMap: Record<string, string> = {
  'session.spawned': 'started',
  'session.working': 'running',
  'ci.failing': 'ci-failed',
  'ci.passing': 'ci-passed',
  'session.exited': 'done',
  'session.stuck': 'stuck',
  'session.killed': 'killed',
  'pr.created': 'pr-opened',
  'review.changes_requested': 'changes-requested',
};

const stateMap: Record<string, TaskState> = {
  'started':           'running',
  'running':           'running',
  'pr-opened':         'running',
  'ci-passed':         'running',
  'ci-failed':         'failed',
  'done':              'done',
  'stuck':             'failed',
  'killed':            'failed',
  'changes-requested': 'running',
};

/** Map AO event names to Cortex event_type values */
function mapEventType(aoEvent: string): string {
  const eventTypeMap: Record<string, string> = {
    'started':           'ao_update',
    'running':           'ao_update',
    'pr-opened':         'pr_opened',
    'ci-passed':         'ci_passed',
    'ci-failed':         'ci_failed',
    'done':              'done',
    'stuck':             'failed',
    'killed':            'failed',
    'changes-requested': 'ao_update',
  };
  return eventTypeMap[aoEvent] ?? 'ao_update';
}

/**
 * Parse incoming webhook body into normalized { sessionId, event, payload }.
 * @param body - Raw request body
 * @returns Normalized webhook data or null if invalid
 */
function parseWebhook(body: unknown): { sessionId: string; event: string; payload: Record<string, unknown> } | null {
  // Try AO notification format first
  const aoResult = aoNotificationSchema.safeParse(body);
  if (aoResult.success) {
    const { event } = aoResult.data;
    const mappedEvent = aoEventNameMap[event.type] ?? event.type;
    return {
      sessionId: event.sessionId,
      event: mappedEvent,
      payload: (event.data as Record<string, unknown>) ?? {},
    };
  }

  // Fall back to legacy format
  const legacyResult = legacyWebhookSchema.safeParse(body);
  if (legacyResult.success) {
    return {
      sessionId: legacyResult.data.sessionId,
      event: legacyResult.data.event,
      payload: legacyResult.data.payload ?? {},
    };
  }

  return null;
}

/**
 * Register AO webhook route.
 * @param fastify - Fastify instance
 */
export async function registerAoWebhookRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/ao-events', async (req, reply) => {
    const parsed = parseWebhook(req.body);
    if (!parsed) {
      return reply.code(400).send({
        error: 'Invalid webhook payload',
      });
    }

    const { sessionId, event, payload } = parsed;

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
      if (event === 'ci-failed' || event === 'stuck' || event === 'killed') {
        updateTask(task.id, {
          state: 'failed',
          failure_reason: (payload.reason as string) ?? (payload.message as string) ?? `Agent reported: ${event}`,
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
          ao_pr_url: (payload.url as string) ?? null,
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
        payload: JSON.stringify(payload),
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
