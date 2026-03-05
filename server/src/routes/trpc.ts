/**
 * tRPC router — all procedures.
 * @module routes/trpc
 */

import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';
import * as taskQueries from '../db/queries/tasks.js';
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
import { publishTaskCreated, publishTaskStateChanged } from '../services/event-bus.js';

export interface TRPCContext {
  req: FastifyRequest;
  reply: FastifyReply;
}

const t = initTRPC.context<TRPCContext>().create();
const router = t.router;
const publicProcedure = t.procedure;

const taskStateSchema = z.enum([
  'draft', 'refined', 'pending_approval', 'approved',
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

  events: publicProcedure
    .input(z.object({ taskId: z.string(), limit: z.number().optional() }))
    .query(({ input }) => {
      return eventQueries.getEventsForTask(input.taskId, input.limit);
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

export const appRouter = router({
  task: taskRouter,
  project: projectRouter,
  metrics: metricsRouter,
});

export type AppRouter = typeof appRouter;
