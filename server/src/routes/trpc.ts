/**
 * tRPC router — all procedures.
 * @module routes/trpc
 */

import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';
import * as taskQueries from '../db/queries/tasks.js';
import type { TaskRow } from '../db/queries/tasks.js';
import * as projectQueries from '../db/queries/projects.js';
import * as eventQueries from '../db/queries/events.js';
import * as metricsQueries from '../db/queries/metrics.js';
import { taskId, projectId, eventId } from '../lib/id.js';
import { addProjectToAOConfig } from '../services/ao-config.js';
import {
  canTransition,
  checkGuard,
  type TaskState,
} from '../domain/task-machine.js';
import {
  publishTaskCreated,
  publishTaskStateChanged,
  publishAuditComplete,
} from '../services/event-bus.js';
import { dispatch as aoDispatch } from '../services/ao-dispatch.js';
import { startPoller } from '../services/ao-status-poller.js';
import { env } from '../env.js';
import * as sessionQueries from '../db/queries/sessions.js';
import * as auditQueries from '../db/queries/audits.js';
import { runAudit } from '../services/audit-service.js';
import { decompose } from '../services/decomposer-service.js';
import { executeSessionSequence } from '../services/session-executor.js';
import { sessionId, auditId } from '../lib/id.js';

export interface TRPCContext {
  req: FastifyRequest;
  reply: FastifyReply;
}

const t = initTRPC.context<TRPCContext>().create();
const router = t.router;
const publicProcedure = t.procedure;

const taskStateSchema = z.enum([
  'draft', 'refined', 'pending_approval', 'approved',
  'auditing', 'decomposing',
  'dispatched', 'running', 'sleeping', 'done', 'failed',
]);

const taskRouter = router({
  list: publicProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        state: taskStateSchema.optional(),
        limit: z.number().min(1).max(200).optional(),
      }).optional()
    )
    .query(({ input }) => {
      return taskQueries.listTasks(input ? {
        projectId: input.projectId,
        state: input.state,
        limit: input.limit,
      } : undefined);
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const task = taskQueries.getTask(input.id);
      if (!task) throw new Error('Task not found');
      return task;
    }),

  create: publicProcedure
    .input(z.object({
      title: z.string().min(1),
      raw_input: z.string().min(1),
      brief: z.string().optional(),
      project_id: z.string().nullable().optional(),
      parent_task_id: z.string().nullable().optional(),
      priority: z.number().min(0).max(2).optional(),
    }))
    .mutation(({ input }) => {
      const id = taskId();
      const task = taskQueries.createTask({
        id,
        title: input.title,
        raw_input: input.raw_input,
        brief: input.brief ?? null,
        project_id: input.project_id ?? null,
        parent_task_id: input.parent_task_id ?? null,
        priority: input.priority ?? 0,
      });

      eventQueries.createEvent({
        id: eventId(),
        task_id: id,
        event_type: 'created',
        to_state: 'draft',
        actor: 'human',
      });

      if (input.project_id) {
        projectQueries.incrementTaskCount(input.project_id);
      }

      publishTaskCreated(id);
      return task;
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      brief: z.string().nullable().optional(),
      project_id: z.string().nullable().optional(),
      priority: z.number().min(0).max(2).optional(),
    }))
    .mutation(({ input }) => {
      const task = taskQueries.getTask(input.id);
      if (!task) throw new Error('Task not found');
      return taskQueries.updateTask(input.id, {
        title: input.title,
        brief: input.brief,
        project_id: input.project_id,
        priority: input.priority,
      })!;
    }),

  updateState: publicProcedure
    .input(z.object({
      id: z.string(),
      state: taskStateSchema,
      failure_reason: z.string().nullable().optional(),
      ao_session_id: z.string().nullable().optional(),
    }))
    .mutation(({ input }) => {
      const task = taskQueries.getTask(input.id);
      if (!task) throw new Error('Task not found');

      const from = task.state;
      const to = input.state;

      if (!canTransition(from, to)) {
        throw new Error(`Invalid transition: ${from} → ${to}`);
      }

      const guardError = checkGuard(to, {
        failureReason: input.failure_reason ?? task.failure_reason,
        aoSessionId: input.ao_session_id ?? task.ao_session_id,
        projectId: task.project_id,
        brief: task.brief,
      });
      if (guardError) throw new Error(guardError);

      const updates: Parameters<typeof taskQueries.updateTask>[1] = { state: to };
      if (input.failure_reason !== undefined) updates.failure_reason = input.failure_reason;
      if (input.ao_session_id !== undefined) updates.ao_session_id = input.ao_session_id;
      if (to === 'approved') updates.approved_at = Math.floor(Date.now() / 1000);
      if (to === 'dispatched') updates.dispatched_at = Math.floor(Date.now() / 1000);
      if (to === 'done' || to === 'failed') updates.completed_at = Math.floor(Date.now() / 1000);

      const updated = taskQueries.updateTask(input.id, updates)!;

      eventQueries.createEvent({
        id: eventId(),
        task_id: input.id,
        event_type: 'state_changed',
        from_state: from,
        to_state: to,
        actor: 'human',
      });

      publishTaskStateChanged(input.id, from, to);
      return updated;
    }),

  dispatch: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const task = taskQueries.getTask(input.id);
      if (!task) throw new Error('Task not found');
      if (task.state !== 'approved') {
        throw new Error(`Cannot dispatch task in state: ${task.state}`);
      }

      try {
        const result = await aoDispatch(task);

        const updated = taskQueries.updateTask(input.id, {
          state: 'dispatched',
          ao_session_id: result.sessionId,
          ao_branch: result.branch,
          dispatched_at: Math.floor(Date.now() / 1000),
        })!;

        eventQueries.createEvent({
          id: eventId(),
          task_id: input.id,
          event_type: 'dispatched',
          from_state: 'approved',
          to_state: 'dispatched',
          payload: JSON.stringify({ sessionId: result.sessionId, branch: result.branch }),
          actor: 'system',
        });

        publishTaskStateChanged(input.id, 'approved', 'dispatched');
        startPoller();
        return updated;
      } catch (err) {
        // Dispatch failed — mark task as failed
        taskQueries.updateTask(input.id, {
          state: 'failed',
          failure_reason: (err as Error).message,
          completed_at: Math.floor(Date.now() / 1000),
        });

        eventQueries.createEvent({
          id: eventId(),
          task_id: input.id,
          event_type: 'failed',
          from_state: 'approved',
          to_state: 'failed',
          payload: JSON.stringify({ error: (err as Error).message }),
          actor: 'system',
        });

        publishTaskStateChanged(input.id, 'approved', 'failed');
        throw new Error(`Dispatch failed: ${(err as Error).message}`);
      }
    }),

  approve: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const task = taskQueries.getTask(input.id);
      if (!task) throw new Error('Task not found');
      if (task.state !== 'pending_approval') {
        throw new Error(`Cannot approve task in state: ${task.state}`);
      }
      if (!task.brief) throw new Error('Cannot approve task without a brief');

      // Transition to approved
      taskQueries.updateTask(input.id, {
        state: 'approved',
        approved_at: Math.floor(Date.now() / 1000),
      });
      eventQueries.createEvent({
        id: eventId(),
        task_id: input.id,
        event_type: 'signed_off',
        from_state: 'pending_approval',
        to_state: 'approved',
        actor: 'human',
      });
      publishTaskStateChanged(input.id, 'pending_approval', 'approved');

      // Check complexity for decomposer flow
      let briefObj: { estimated_complexity?: string } | null = null;
      try {
        briefObj = JSON.parse(task.brief);
      } catch {
        briefObj = null;
      }

      const isLarge = briefObj?.estimated_complexity === 'large' && env.DECOMPOSER_ENABLED;

      if (isLarge && task.project_id) {
        // Enter decomposer flow (async — SSE pushes updates)
        const freshTask = taskQueries.getTask(input.id)!;
        handleDecomposerFlow(freshTask).catch((err) => {
          // Fallback: mark failed if decomposer crashes
          taskQueries.updateTask(input.id, {
            state: 'failed',
            failure_reason: `Decomposer error: ${(err as Error).message}`,
            completed_at: Math.floor(Date.now() / 1000),
          });
          publishTaskStateChanged(input.id, freshTask.state, 'failed');
        });
        return taskQueries.getTask(input.id)!;
      }

      // Non-large: return approved task (dispatch separately via task.dispatch)
      return taskQueries.getTask(input.id)!;
    }),

  sessions: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(({ input }) => {
      return sessionQueries.getSessionsByTask(input.taskId);
    }),

  sessionDetail: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const session = sessionQueries.getSession(input.id);
      if (!session) throw new Error('Session not found');
      return session;
    }),

  auditVerdicts: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(({ input }) => {
      return auditQueries.getVerdictsByTask(input.taskId);
    }),

  retrySession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => {
      const session = sessionQueries.getSession(input.sessionId);
      if (!session) throw new Error('Session not found');
      if (session.state !== 'failed') {
        throw new Error(`Cannot retry session in state: ${session.state}`);
      }
      sessionQueries.updateSession(input.sessionId, {
        state: 'ready',
        retry_count: session.retry_count + 1,
      });
      return sessionQueries.getSession(input.sessionId)!;
    }),

  skipSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => {
      const session = sessionQueries.getSession(input.sessionId);
      if (!session) throw new Error('Session not found');
      if (session.state !== 'failed' && session.state !== 'pending') {
        throw new Error(`Cannot skip session in state: ${session.state}`);
      }
      sessionQueries.updateSession(input.sessionId, {
        state: 'skipped',
        completed_at: Math.floor(Date.now() / 1000),
      });
      return sessionQueries.getSession(input.sessionId)!;
    }),

  updateSessionPrompt: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      prompt: z.string().min(1),
    }))
    .mutation(({ input }) => {
      const session = sessionQueries.getSession(input.sessionId);
      if (!session) throw new Error('Session not found');
      if (session.state !== 'failed' && session.state !== 'pending' && session.state !== 'ready') {
        throw new Error(`Cannot edit session in state: ${session.state}`);
      }
      sessionQueries.updateSession(input.sessionId, {
        prompt: input.prompt,
        state: 'ready',
      });
      return sessionQueries.getSession(input.sessionId)!;
    }),

  events: publicProcedure
    .input(z.object({ taskId: z.string(), limit: z.number().optional() }))
    .query(({ input }) => {
      return eventQueries.getEventsForTask(input.taskId, input.limit);
    }),

  // Test-only: seed sessions and verdicts for E2E tests
  _seedSession: publicProcedure
    .input(z.object({
      id: z.string(),
      task_id: z.string(),
      session_number: z.number(),
      title: z.string(),
      prompt: z.string().optional(),
      state: z.enum(['pending', 'auditing', 'ready', 'dispatched', 'running', 'verifying', 'passed', 'failed', 'skipped']).optional(),
      deliverables: z.string().optional(),
      verification: z.string().optional(),
      regression: z.string().optional(),
      anti_patterns: z.string().optional(),
    }))
    .mutation(({ input }) => {
      if (env.NODE_ENV === 'production') throw new Error('Not available in production');
      sessionQueries.insertSession(input);
      return sessionQueries.getSession(input.id)!;
    }),

  _seedVerdict: publicProcedure
    .input(z.object({
      id: z.string(),
      task_id: z.string(),
      file_path: z.string(),
      verdict: z.enum(['keep', 'patch', 'rewrite', 'delete', 'create']),
      reason: z.string(),
      patch_details: z.string().nullable().optional(),
    }))
    .mutation(({ input }) => {
      if (env.NODE_ENV === 'production') throw new Error('Not available in production');
      auditQueries.insertVerdict(input);
      return { ok: true };
    }),

  _updateSession: publicProcedure
    .input(z.object({
      id: z.string(),
      state: z.enum(['pending', 'auditing', 'ready', 'dispatched', 'running', 'verifying', 'passed', 'failed', 'skipped']).optional(),
      verification_output: z.string().nullable().optional(),
      failure_reason: z.string().nullable().optional(),
      cost_usd: z.number().optional(),
      retry_count: z.number().optional(),
      started_at: z.number().nullable().optional(),
      completed_at: z.number().nullable().optional(),
    }))
    .mutation(({ input }) => {
      if (env.NODE_ENV === 'production') throw new Error('Not available in production');
      const { id, ...updates } = input;
      sessionQueries.updateSession(id, updates);
      return sessionQueries.getSession(id)!;
    }),
});

const projectRouter = router({
  list: publicProcedure.query(() => {
    return projectQueries.listProjects();
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const project = projectQueries.getProject(input.id);
      if (!project) throw new Error('Project not found');
      return project;
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      repo: z.string().min(1).regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Must be org/repo format'),
      path: z.string().min(1),
      default_branch: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const id = projectId();
      const project = projectQueries.createProject({
        id,
        name: input.name,
        repo: input.repo,
        path: input.path,
        default_branch: input.default_branch,
      });

      // Write to AO config YAML
      const key = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      try {
        addProjectToAOConfig(key, {
          name: input.name,
          path: input.path,
          repo: input.repo,
          defaultBranch: input.default_branch ?? 'main',
        });
      } catch {
        // Non-fatal — project created in DB even if YAML write fails
      }

      return project;
    }),
});

const metricsRouter = router({
  summary: publicProcedure.query(() => {
    return metricsQueries.getSummary();
  }),

  project: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      return metricsQueries.getProjectMetrics(input.projectId);
    }),
});

/**
 * Handle the decomposer flow for large tasks.
 * Runs audit → decompose → create sessions → execute sequence.
 * @param task - The approved task
 */
async function handleDecomposerFlow(task: TaskRow): Promise<void> {
  // 1. Audit phase
  taskQueries.updateTask(task.id, { state: 'auditing' });
  publishTaskStateChanged(task.id, 'approved', 'auditing');

  const project = projectQueries.getProject(task.project_id!)!;
  const auditReport = await runAudit(task, project);

  // Store verdicts if audit succeeded
  if (auditReport) {
    for (const v of auditReport.verdicts) {
      auditQueries.insertVerdict({
        id: auditId(),
        task_id: task.id,
        file_path: v.file_path,
        verdict: v.verdict,
        reason: v.reason,
        patch_details: v.patch_details,
      });
    }
    publishAuditComplete(task.id, auditReport.summary as unknown as Record<string, number>);
  }

  // 2. Decomposition phase
  taskQueries.updateTask(task.id, { state: 'decomposing' });
  publishTaskStateChanged(task.id, 'auditing', 'decomposing');

  let sessions;
  try {
    sessions = await decompose(task.brief!, auditReport, project);
  } catch (err) {
    // Decomposition failed — fall back to single direct dispatch
    taskQueries.updateTask(task.id, {
      state: 'failed',
      failure_reason: `Decomposition failed: ${(err as Error).message}`,
      completed_at: Math.floor(Date.now() / 1000),
    });
    publishTaskStateChanged(task.id, 'decomposing', 'failed');
    return;
  }

  // 3. Create session records
  for (const s of sessions) {
    sessionQueries.insertSession({
      id: sessionId(),
      task_id: task.id,
      session_number: s.session_number,
      title: s.title,
      deliverables: JSON.stringify(s.deliverables),
      verification: JSON.stringify(s.verification),
      regression: JSON.stringify(s.regression),
      anti_patterns: JSON.stringify(s.anti_patterns),
      state: 'pending',
    });
  }

  // 4. Execute sequence
  const freshTask = taskQueries.getTask(task.id)!;
  await executeSessionSequence(freshTask, sessions);
}

export const appRouter = router({
  task: taskRouter,
  project: projectRouter,
  metrics: metricsRouter,
});

export type AppRouter = typeof appRouter;
