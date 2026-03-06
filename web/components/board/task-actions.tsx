'use client';

/**
 * Context menu for task actions: approve, retry, sleep/wake, kill, delete, copy ID.
 * @module components/board/task-actions
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as notify from '../../lib/notify';
import { trpc } from '../../lib/trpc';
import type { Task } from '../../stores/task-store';

interface TaskActionsProps {
  task: Task;
  onDeleted?: () => void;
}

interface MenuItem {
  label: string;
  condition: boolean;
  color?: string;
  danger?: boolean;
  onClick: () => void;
}

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

export function TaskActions({ task, onDeleted }: TaskActionsProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const utils = trpc.useUtils();

  const updateState = trpc.task.updateState.useMutation({
    onSuccess: () => { utils.task.list.invalidate(); },
  });
  const approve = trpc.task.approve.useMutation({
    onSuccess: () => { utils.task.list.invalidate(); notify.success('Task approved'); },
    onError: (err) => notify.error(`Approve failed: ${err.message}`),
  });
  const sendFix = trpc.task.sendFix.useMutation();
  const killSession = trpc.task.killSession.useMutation({
    onSuccess: () => { utils.task.list.invalidate(); notify.success('Session killed'); },
    onError: (err) => notify.error(`Kill failed: ${err.message}`),
  });
  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      notify.success('Task deleted');
      onDeleted?.();
    },
    onError: (err) => notify.error(`Delete failed: ${err.message}`),
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          !buttonRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const ciFailure = task.state === 'failed' && isCIFailure(task.failure_reason);
  const canKill = ['running', 'dispatched'].includes(task.state) && !!task.ao_session_id;
  const canDelete = ['draft', 'failed', 'done', 'sleeping'].includes(task.state);

  const items: MenuItem[] = [
    {
      label: 'Approve',
      condition: task.state === 'pending_approval',
      onClick: () => { setOpen(false); approve.mutate({ id: task.id }); },
    },
    {
      label: 'Retry',
      condition: task.state === 'failed',
      onClick: () => { setOpen(false); updateState.mutate({ id: task.id, state: 'draft' }); },
    },
    {
      label: 'Sleep',
      condition: ['draft', 'refined', 'pending_approval', 'running'].includes(task.state),
      onClick: () => { setOpen(false); updateState.mutate({ id: task.id, state: 'sleeping' }); },
    },
    {
      label: 'Wake',
      condition: task.state === 'sleeping',
      onClick: () => { setOpen(false); updateState.mutate({ id: task.id, state: 'draft' }); },
    },
    {
      label: 'Back to Draft',
      condition: ['refined', 'pending_approval', 'approved'].includes(task.state),
      onClick: () => { setOpen(false); updateState.mutate({ id: task.id, state: 'draft' }); },
    },
    {
      label: 'Send Fix to Agent',
      condition: ciFailure && !!task.ao_session_id,
      onClick: () => {
        setOpen(false);
        sendFix.mutate({ id: task.id }, {
          onSuccess: () => notify.success('Fix instruction sent'),
          onError: (err) => notify.error(`Send fix failed: ${err.message}`),
        });
      },
    },
    {
      label: 'Kill Session',
      condition: canKill,
      color: 'var(--danger)',
      onClick: () => { setOpen(false); killSession.mutate({ id: task.id }); },
    },
    {
      label: 'Copy Task ID',
      condition: true,
      onClick: () => {
        navigator.clipboard.writeText(task.id);
        notify.success('Copied');
        setOpen(false);
      },
    },
    {
      label: confirmDelete ? 'Confirm Delete' : 'Delete',
      condition: canDelete,
      danger: true,
      color: 'var(--danger)',
      onClick: () => {
        if (!confirmDelete) {
          setConfirmDelete(true);
          return;
        }
        setOpen(false);
        setConfirmDelete(false);
        deleteTask.mutate({ id: task.id });
      },
    },
  ];

  const visible = items.filter((i) => i.condition);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 4, left: rect.right });
          }
          setOpen(!open);
          setConfirmDelete(false);
        }}
        className="rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-white/10"
        style={{ color: 'var(--text-secondary)' }}
        title="Task actions"
      >
        {'\u22EF'}
      </button>

      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] rounded-lg border py-1"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            transform: 'translateX(-100%)',
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {visible.map((item, i) => (
            <div key={item.label}>
              {item.danger && i > 0 && (
                <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); item.onClick(); }}
                className="w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/5"
                style={{ color: item.color ?? 'var(--text-primary)' }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
