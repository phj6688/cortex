'use client';

/**
 * Task card — priority border, project name, objective preview, session progress, actions menu.
 * Framer Motion use #1: task card enter/exit/reorder.
 * @module components/board/task-card
 */

import { motion } from 'framer-motion';
import { StateBadge } from './state-badge';
import { CostIndicator } from './cost-indicator';
import { TaskActions } from './task-actions';
import { formatElapsed } from '../../lib/format';
import { useUIStore } from '../../stores/ui-store';
import { useProjects } from '../../hooks/use-projects';
import { useTaskSessions } from '../../hooks/use-tasks';
import { trpc } from '../../lib/trpc';
import * as notify from '../../lib/notify';
import type { Task } from '../../stores/task-store';

const PRIORITY_COLORS = ['transparent', 'var(--warning)', 'var(--danger)'] as const;

interface TaskCardProps {
  task: Task;
}

/**
 * Extract the objective line from a brief JSON string.
 * @param brief - Raw brief JSON
 * @returns Objective string or null
 */
function getObjective(brief: string | null): string | null {
  if (!brief) return null;
  try {
    const parsed = JSON.parse(brief);
    return parsed.objective ?? parsed.title ?? null;
  } catch {
    return null;
  }
}

export function TaskCard({ task }: TaskCardProps) {
  const selectTask = useUIStore((s) => s.selectTask);
  const selectedId = useUIStore((s) => s.selectedTaskId);
  const isSelected = selectedId === task.id;
  const { data: projects } = useProjects();

  const projectName = task.project_id
    ? projects?.find((p) => p.id === task.project_id)?.name ?? null
    : null;

  const objective = getObjective(task.brief);

  return (
    <motion.div
      layoutId={task.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={() => selectTask(isSelected ? null : task.id)}
      className="group cursor-pointer overflow-hidden rounded-lg border transition-colors"
      style={{
        background: 'var(--bg-surface)',
        borderTopColor: isSelected ? 'var(--accent)' : 'var(--border)',
        borderRightColor: isSelected ? 'var(--accent)' : 'var(--border)',
        borderBottomColor: isSelected ? 'var(--accent)' : 'var(--border)',
        boxShadow: isSelected ? 'var(--shadow-glow)' : 'var(--shadow-card)',
        borderLeftWidth: '3px',
        borderLeftColor: PRIORITY_COLORS[task.priority] ?? 'transparent',
      }}
    >
      <div className="p-3">
        {/* Row 1: state badge + project + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StateBadge state={task.state} failureReason={task.failure_reason} />
            {projectName && (
              <span
                className="truncate text-[10px]"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
              >
                {projectName}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TaskActions
              task={task}
              onDeleted={() => selectTask(null)}
            />
          </div>
        </div>

        {/* Title */}
        <h3
          className="mt-1.5 text-sm font-medium leading-snug"
          style={{ color: 'var(--text-primary)' }}
        >
          {task.title}
        </h3>

        {/* Objective preview */}
        {objective && (
          <p
            className="mt-1 line-clamp-2 text-xs leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {objective}
          </p>
        )}

        <SessionIndicator task={task} />
        <InlineActions task={task} />

        {/* Footer: elapsed + cost */}
        <div className="mt-2 flex items-center justify-between">
          <span
            className="text-xs"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
          >
            {formatElapsed(task.updated_at)}
          </span>
          <CostIndicator costUsd={task.cost_usd} />
        </div>
      </div>
    </motion.div>
  );
}

function SessionIndicator({ task }: { task: Task }) {
  let isLarge = false;
  try {
    const brief = JSON.parse(task.brief ?? '{}');
    isLarge = brief.estimated_complexity === 'large';
  } catch {
    // Not large
  }

  const decomposedStates = ['auditing', 'decomposing', 'dispatched', 'running', 'done', 'failed'];
  if (!isLarge || !decomposedStates.includes(task.state)) return null;

  return <SessionCountBadge taskId={task.id} />;
}

function InlineActions({ task }: { task: Task }) {
  const utils = trpc.useUtils();
  const updateState = trpc.task.updateState.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });
  const approve = trpc.task.approve.useMutation({
    onSuccess: () => { utils.task.list.invalidate(); notify.success('Task approved'); },
    onError: (err) => notify.error(`Approve failed: ${err.message}`),
  });
  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => { utils.task.list.invalidate(); notify.success('Task deleted'); },
    onError: (err) => notify.error(`Delete failed: ${err.message}`),
  });

  const buttons: { label: string; onClick: () => void; variant: 'accent' | 'danger' | 'muted' }[] = [];

  switch (task.state) {
    case 'failed':
      buttons.push({ label: 'Retry', onClick: () => updateState.mutate({ id: task.id, state: 'draft' }), variant: 'accent' });
      buttons.push({ label: 'Delete', onClick: () => deleteTask.mutate({ id: task.id }), variant: 'danger' });
      break;
    case 'pending_approval':
      buttons.push({ label: 'Approve', onClick: () => approve.mutate({ id: task.id }), variant: 'accent' });
      break;
    case 'done':
      buttons.push({ label: 'Delete', onClick: () => deleteTask.mutate({ id: task.id }), variant: 'danger' });
      break;
    case 'sleeping':
      buttons.push({ label: 'Wake', onClick: () => updateState.mutate({ id: task.id, state: 'draft' }), variant: 'accent' });
      buttons.push({ label: 'Delete', onClick: () => deleteTask.mutate({ id: task.id }), variant: 'danger' });
      break;
    default:
      return null;
  }

  const colorMap = {
    accent: 'var(--accent)',
    danger: 'var(--danger)',
    muted: 'var(--text-secondary)',
  };

  return (
    <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={b.onClick}
          className="rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
          style={{
            color: colorMap[b.variant],
            border: '1px solid',
            borderColor: colorMap[b.variant],
          }}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

function SessionCountBadge({ taskId }: { taskId: string }) {
  const { data: sessions } = useTaskSessions(taskId);
  if (!sessions || sessions.length === 0) return null;

  const passed = sessions.filter((s: { state: string }) => s.state === 'passed').length;
  const total = sessions.length;

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <div
        className="h-1 flex-1 overflow-hidden rounded-full"
        style={{ background: 'var(--border)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${(passed / total) * 100}%`,
            background: passed === total ? '#10b981' : 'var(--accent)',
          }}
        />
      </div>
      <span
        className="text-[10px] tabular-nums"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
      >
        {passed}/{total}
      </span>
    </div>
  );
}
