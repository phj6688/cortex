'use client';

/**
 * Context menu for task actions: retry, sleep, edit brief, CI actions, kill.
 * @module components/board/task-actions
 */

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { trpc } from '../../lib/trpc';
import type { Task, TaskState } from '../../stores/task-store';

interface TaskActionsProps {
  task: Task;
}

interface StateAction {
  type: 'state';
  label: string;
  newState: TaskState;
  condition: boolean;
  color?: string;
}

interface CustomAction {
  type: 'custom';
  label: string;
  condition: boolean;
  color?: string;
  onClick: () => void;
}

type Action = StateAction | CustomAction;

/**
 * Check if a failure reason indicates a CI/test failure.
 * @param reason - The failure reason string
 * @returns Whether the failure is CI-related
 */
function isCIFailure(reason: string | null): boolean {
  if (!reason) return false;
  const lower = reason.toLowerCase();
  return lower.includes('ci') || lower.includes('test');
}

/**
 * Check if a failure reason indicates a stuck session.
 * @param reason - The failure reason string
 * @returns Whether the failure is stuck-related
 */
function isStuckFailure(reason: string | null): boolean {
  if (!reason) return false;
  return reason.toLowerCase().includes('stuck');
}

export function TaskActions({ task }: TaskActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const updateState = trpc.task.updateState.useMutation();
  const sendFix = trpc.task.sendFix.useMutation();
  const killSession = trpc.task.killSession.useMutation();

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

  const ciFailure = task.state === 'failed' && isCIFailure(task.failure_reason);
  const stuckFailure = task.state === 'failed' && isStuckFailure(task.failure_reason);

  const actions: Action[] = [
    {
      type: 'state',
      label: 'Retry',
      newState: 'draft',
      condition: task.state === 'failed',
    },
    {
      type: 'state',
      label: 'Sleep',
      newState: 'sleeping',
      condition: ['draft', 'refined', 'pending_approval', 'running'].includes(task.state),
    },
    {
      type: 'state',
      label: 'Wake',
      newState: 'draft',
      condition: task.state === 'sleeping',
    },
    {
      type: 'state',
      label: 'Back to Draft',
      newState: 'draft',
      condition: ['refined', 'pending_approval', 'approved'].includes(task.state),
    },
    {
      type: 'custom',
      label: 'View Logs',
      condition: ciFailure,
      onClick: () => {
        if (task.ao_pr_url) {
          window.open(task.ao_pr_url, '_blank', 'noopener');
        } else {
          toast.error('No CI logs available');
        }
        setOpen(false);
      },
    },
    {
      type: 'custom',
      label: 'Send Fix to Agent',
      condition: ciFailure && !!task.ao_session_id,
      onClick: () => {
        setOpen(false);
        sendFix.mutate({ id: task.id }, {
          onSuccess: () => toast.success('Fix instruction sent to agent'),
          onError: (err) => toast.error(`Send fix failed: ${err.message}`),
        });
      },
    },
    {
      type: 'custom',
      label: 'Kill Session',
      condition: stuckFailure && !!task.ao_session_id,
      color: '#ef4444',
      onClick: () => {
        setOpen(false);
        killSession.mutate({ id: task.id }, {
          onSuccess: () => toast.success('Session killed'),
          onError: (err) => toast.error(`Kill failed: ${err.message}`),
        });
      },
    },
  ];

  const availableActions = actions.filter((a) => a.condition);

  if (availableActions.length === 0) return null;

  const handleAction = async (action: Action) => {
    if (action.type === 'custom') {
      action.onClick();
    } else {
      setOpen(false);
      await updateState.mutateAsync({ id: task.id, state: action.newState });
    }
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
              onClick={(e) => { e.stopPropagation(); handleAction(action); }}
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
