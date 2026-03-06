'use client';

/**
 * Virtualized task list using @tanstack/react-virtual.
 * @module components/board/task-list
 */

import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence } from 'framer-motion';
import { TaskCard } from './task-card';
import { EmptyState } from '../shared/empty-state';
import { useTaskStore, type Task, type TaskState } from '../../stores/task-store';
import { useUIStore, type FilterValue, type SortValue } from '../../stores/ui-store';

const FILTER_STATES: Record<FilterValue, TaskState[] | null> = {
  all:      null,
  active:   ['draft', 'refined', 'pending_approval', 'approved', 'dispatched', 'running'],
  done:     ['done'],
  failed:   ['failed'],
  sleeping: ['sleeping'],
};

const STATE_ORDER: Record<string, number> = {
  running: 0, dispatched: 1, approved: 2, pending_approval: 3,
  refined: 4, draft: 5, sleeping: 6, done: 7, failed: 8,
};

function sortTasks(tasks: Task[], sort: SortValue): Task[] {
  const sorted = [...tasks];
  switch (sort) {
    case 'priority':
      sorted.sort((a, b) => b.priority - a.priority || b.created_at - a.created_at);
      break;
    case 'recent':
      sorted.sort((a, b) => b.updated_at - a.updated_at);
      break;
    case 'state':
      sorted.sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9));
      break;
  }
  return sorted;
}

interface TaskListProps {
  onFocusChatInput?: () => void;
}

export function TaskList({ onFocusChatInput }: TaskListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const tasks = useTaskStore((s) => s.tasks);
  const filter = useUIStore((s) => s.filter);
  const sort = useUIStore((s) => s.sort);

  const filteredTasks = useMemo(() => {
    const allTasks = Array.from(tasks.values());
    const states = FILTER_STATES[filter];
    const filtered = states
      ? allTasks.filter((t) => (states as string[]).includes(t.state))
      : allTasks;
    return sortTasks(filtered, sort);
  }, [tasks, filter, sort]);

  const virtualizer = useVirtualizer({
    count: filteredTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  if (filteredTasks.length === 0) {
    return <FilterEmptyState filter={filter} onFocusChatInput={onFocusChatInput} />;
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto p-4">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <AnimatePresence mode="popLayout">
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const task = filteredTasks[virtualRow.index];
            if (!task) return null;
            return (
              <div
                key={task.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="pb-3">
                  <TaskCard task={task} />
                </div>
              </div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FilterEmptyState({ filter, onFocusChatInput }: { filter: FilterValue; onFocusChatInput?: () => void }) {
  switch (filter) {
    case 'failed':
      return (
        <EmptyState
          icon={'\u2713'}
          title="No failed tasks"
          description="All systems operational"
        />
      );
    case 'sleeping':
      return (
        <EmptyState
          icon={'\u23F8'}
          title="No tasks standing by"
          description="Sleeping tasks will appear here"
        />
      );
    case 'done':
      return (
        <EmptyState
          icon={'\u2610'}
          title="No completed tasks"
          description="Finished tasks will appear here"
        />
      );
    default:
      return (
        <EmptyState
          icon={'\u25B6'}
          title="Create your first task"
          description="Describe what you need done and AI will refine it into a structured brief."
          action={onFocusChatInput ? { label: 'New Brief', onClick: onFocusChatInput } : undefined}
        />
      );
  }
}
