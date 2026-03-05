'use client';

/**
 * TanStack Query hooks for tasks.
 * @module hooks/use-tasks
 */

import { trpc } from '../lib/trpc';
import { useTaskStore, type Task } from '../stores/task-store';
import { useEffect } from 'react';

/** Fetch task list, sync into Zustand store. */
export function useTasks(opts?: { projectId?: string; state?: string }) {
  const setTasks = useTaskStore((s) => s.setTasks);
  const query = trpc.task.list.useQuery(
    opts ? { projectId: opts.projectId, state: opts.state as never } : undefined,
  );

  useEffect(() => {
    if (query.data) {
      setTasks(query.data as Task[]);
    }
  }, [query.data, setTasks]);

  return query;
}

/** Fetch a single task by ID. */
export function useTask(id: string | null) {
  const upsertTask = useTaskStore((s) => s.upsertTask);
  const query = trpc.task.get.useQuery(
    { id: id! },
    { enabled: !!id },
  );

  useEffect(() => {
    if (query.data) {
      upsertTask(query.data as Task);
    }
  }, [query.data, upsertTask]);

  return query;
}

/** Fetch events for a task. */
export function useTaskEvents(taskId: string | null) {
  return trpc.task.events.useQuery(
    { taskId: taskId! },
    { enabled: !!taskId },
  );
}
