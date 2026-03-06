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

/** Map AO event type strings to Cortex event names and optional task state */
const aoEventNameMap: Record<string, { cortexEvent: string; taskState?: TaskState }> = {
  // Session lifecycle
  'session.spawned':           { cortexEvent: 'started',            taskState: 'running' },
  'session.working':           { cortexEvent: 'running',            taskState: 'running' },
  'session.exited':            { cortexEvent: 'done',               taskState: 'done' },
  'session.stuck':             { cortexEvent: 'stuck',              taskState: 'failed' },
  'session.killed':            { cortexEvent: 'killed',             taskState: 'failed' },
  'session.errored':           { cortexEvent: 'errored',            taskState: 'failed' },
  'session.needs_input':       { cortexEvent: 'needs_input',        taskState: 'running' },

  // CI
  'ci.failing':                { cortexEvent: 'ci-failed',          taskState: 'running' },
  'ci.passing':                { cortexEvent: 'ci-passed' },

  // PR lifecycle
  'pr.created':                { cortexEvent: 'pr-opened' },
  'review.pending':            { cortexEvent: 'review-pending' },
  'review.changes_requested':  { cortexEvent: 'changes-requested' },
  'review.approved':           { cortexEvent: 'review-approved' },

  // Merge
  'merge.ready':               { cortexEvent: 'merge-ready' },
  'merge.completed':           { cortexEvent: 'done',               taskState: 'done' },

  // Reactions
  'reaction.escalated':        { cortexEvent: 'escalated' },
};

/** Map Cortex event names to DB event_type column values */
function mapEventType(cortexEvent: string): string {
  const eventTypeMap: Record<string, string> = {
    'started':           'ao_update',
    'running':           'ao_update',
    'needs_input':       'ao_update',
    'pr-opened':         'pr_opened',
    'review-pending':    'ao_update',
    'review-approved':   'ao_update',
    'ci-passed':         'ci_passed',
    'ci-failed':         'ci_failed',
    'done':              'done',
    'stuck':             'failed',
    'killed':            'failed',
    'errored':           'failed',
    'escalated':         'ao_update',
    'changes-requested': 'ao_update',
    'merge-ready':       'ao_update',
  };
  return eventTypeMap[cortexEvent] ?? 'ao_update';
}

/**
 * Parse incoming webhook body into normalized { sessionId, event, payload }.
 * @param body - Raw request body
 * @returns Normalized webhook data or null if invalid
 */
function parseWebhook(body: unknown): { sessionId: string; cortexEvent: string; taskState?: TaskState; payload: Record<string, unknown> } | null {
  // Try AO notification format first
  const aoResult = aoNotificationSchema.safeParse(body);
  if (aoResult.success) {
    const { event } = aoResult.data;
    const mapping = aoEventNameMap[event.type];
    if (mapping) {
      return {
        sessionId: event.sessionId,
        cortexEvent: mapping.cortexEvent,
        taskState: mapping.taskState,
        payload: (event.data as Record<string, unknown>) ?? {},
      };
    }
    // Unknown AO event — log as ao_update, no state change
    return {
      sessionId: event.sessionId,
      cortexEvent: event.type,
      payload: (event.data as Record<string, unknown>) ?? {},
    };
  }

  // Fall back to legacy format
  const legacyResult = legacyWebhookSchema.safeParse(body);
  if (legacyResult.success) {
    return {
      sessionId: legacyResult.data.sessionId,
      cortexEvent: legacyResult.data.event,
      taskState: legacyResult.data.event === 'done' ? 'done' : legacyResult.data.event === 'failed' ? 'failed' : undefined,
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

    const { sessionId, cortexEvent, taskState, payload } = parsed;

    const task = getTaskByAoSession(sessionId);
    if (!task) {
      fastify.log.warn({ sessionId }, 'Webhook for unknown session');
      return reply.code(404).send({ error: 'Unknown session' });
    }

    const db = getDb();
    const fromState = task.state as TaskState;
    const newState = taskState ?? (fromState as TaskState);

    db.transaction(() => {
      if (taskState === 'failed') {
        updateTask(task.id, {
          state: 'failed',
          failure_reason: (payload.reason as string) ?? (payload.message as string) ?? `Agent reported: ${cortexEvent}`,
          completed_at: Math.floor(Date.now() / 1000),
        });
      } else if (taskState === 'done') {
        updateTask(task.id, {
          state: 'done',
          completed_at: Math.floor(Date.now() / 1000),
        });
      } else if (cortexEvent === 'pr-opened') {
        updateTask(task.id, {
          state: newState,
          ao_pr_url: (payload.url as string) ?? null,
        });
      } else if (taskState) {
        updateTask(task.id, { state: taskState });
      }
      // Events without taskState are logged but don't change task state

      createEvent({
        id: eventId(),
        task_id: task.id,
        event_type: mapEventType(cortexEvent),
        from_state: fromState,
        to_state: newState,
        payload: JSON.stringify(payload),
        actor: 'ao',
      });
    })();

    // SSE push
    if (taskState) {
      publishTaskStateChanged(task.id, fromState, newState);
    }
    publishAoUpdate(task.id, cortexEvent);

    // Ensure poller is running when we have active tasks
    if (newState === 'running') {
      startPoller(fastify.log);
    }

    fastify.log.info({ taskId: task.id, cortexEvent, from: fromState, to: newState }, 'AO webhook processed');
    return reply.code(200).send({ ok: true });
  });
}
