'use client';

/**
 * Context menu for task actions: retry, sleep, edit brief, archive.
 * @module components/board/task-actions
 */

import { useState, useRef, useEffect } from 'react';
import { trpc } from '../../lib/trpc';
import type { Task, TaskState } from '../../stores/task-store';

interface TaskActionsProps {
  task: Task;
}

interface Action {
  label: string;
  newState: TaskState;
  condition: boolean;
  color?: string;
}

export function TaskActions({ task }: TaskActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const updateState = trpc.task.updateState.useMutation();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const actions: Action[] = [
    {
      label: 'Retry',
      newState: 'draft',
      condition: task.state === 'failed',
    },
    {
      label: 'Sleep',
      newState: 'sleeping',
      condition: ['draft', 'refined', 'pending_approval', 'running'].includes(task.state),
    },
    {
      label: 'Wake',
      newState: 'draft',
      condition: task.state === 'sleeping',
    },
    {
      label: 'Back to Draft',
      newState: 'draft',
      condition: ['refined', 'pending_approval', 'approved'].includes(task.state),
    },
  ];

  const availableActions = actions.filter((a) => a.condition);

  if (availableActions.length === 0) return null;

  const handleAction = async (newState: TaskState) => {
    setOpen(false);
    await updateState.mutateAsync({ id: task.id, state: newState });
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-white/10"
        style={{ color: 'var(--text-secondary)' }}
      >
        ...
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border py-1"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {availableActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleAction(action.newState); }}
              className="w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/5"
              style={{ color: action.color ?? 'var(--text-primary)' }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
