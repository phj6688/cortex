'use client';

/**
 * Dynamic page title — updates based on task count and selected task.
 * @module hooks/use-page-title
 */

import { useEffect } from 'react';
import { useTaskStore } from '../stores/task-store';
import { useUIStore } from '../stores/ui-store';

/**
 * Sets document.title based on task count or selected task name.
 */
export function usePageTitle(): void {
  const tasks = useTaskStore((s) => s.tasks);
  const selectedTaskId = useUIStore((s) => s.selectedTaskId);

  useEffect(() => {
    if (selectedTaskId) {
      const task = tasks.get(selectedTaskId);
      if (task) {
        document.title = `Cortex V3 \u2014 ${task.title}`;
        return;
      }
    }
    const count = tasks.size;
    document.title = count > 0 ? `Cortex V3 \u2014 ${count} tasks` : 'Cortex V3';
  }, [tasks, selectedTaskId]);
}
