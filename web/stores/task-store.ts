/**
 * Zustand store: tasks Map + optimistic transitions with rollback.
 * @module stores/task-store
 */

import { create } from 'zustand';

export type TaskState =
  | 'draft' | 'refined' | 'pending_approval' | 'approved'
  | 'auditing' | 'decomposing'
  | 'dispatched' | 'running' | 'sleeping' | 'done' | 'failed';

export interface Task {
  id: string;
  title: string;
  brief: string | null;
  raw_input: string;
  project_id: string | null;
  state: TaskState;
  priority: number;
  ao_session_id: string | null;
  ao_branch: string | null;
  ao_pr_url: string | null;
  failure_reason: string | null;
  cost_usd: number;
  token_input: number;
  token_output: number;
  parent_task_id: string | null;
  metadata: string;
  created_at: number;
  approved_at: number | null;
  dispatched_at: number | null;
  completed_at: number | null;
  updated_at: number;
}

interface TaskStore {
  tasks: Map<string, Task>;
  setTasks: (tasks: Task[]) => void;
  upsertTask: (task: Task) => void;
  optimisticTransition: (taskId: string, newState: TaskState) => () => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: new Map(),

  setTasks: (tasks) => {
    const map = new Map<string, Task>();
    for (const t of tasks) {
      map.set(t.id, t);
    }
    set({ tasks: map });
  },

  upsertTask: (task) => {
    set((state) => ({
      tasks: new Map(state.tasks).set(task.id, task),
    }));
  },

  optimisticTransition: (taskId, newState) => {
    const previous = get().tasks.get(taskId);
    if (!previous) return () => {};

    set((state) => ({
      tasks: new Map(state.tasks).set(taskId, {
        ...previous,
        state: newState,
        updated_at: Math.floor(Date.now() / 1000),
      }),
    }));

    return () =>
      set((state) => ({
        tasks: new Map(state.tasks).set(taskId, previous),
      }));
  },
}));
