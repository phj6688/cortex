'use client';

/**
 * Task detail panel — expandable, shows timeline + actions + AO dashboard.
 * Framer Motion use #2: brief panel ↔ task detail transitions.
 * @module components/board/task-detail
 */

import { motion } from 'framer-motion';
import { useTask } from '../../hooks/use-tasks';
import { useUIStore } from '../../stores/ui-store';
import { StateBadge } from './state-badge';
import { CostIndicator } from './cost-indicator';
import { TaskTimeline } from './task-timeline';
import { TaskActions } from './task-actions';
import { AODashboard } from './ao-dashboard';
import { formatElapsed } from '../../lib/format';
import type { Task } from '../../stores/task-store';

export function TaskDetail() {
  const selectedId = useUIStore((s) => s.selectedTaskId);
  const selectTask = useUIStore((s) => s.selectTask);
  const { data } = useTask(selectedId);
  const task = data as Task | undefined;

  if (!selectedId || !task) return null;

  return (
    <motion.div
      key={selectedId}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden rounded-lg border"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--accent)',
        boxShadow: 'var(--shadow-glow)',
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <StateBadge state={task.state} failureReason={task.failure_reason} />
              <TaskActions task={task} />
            </div>
            <h3
              className="mt-2 text-base font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {task.title}
            </h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {task.id} · {formatElapsed(task.updated_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => selectTask(null)}
            className="rounded px-2 py-1 text-xs transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            Esc
          </button>
        </div>

        {/* Brief */}
        {task.brief && (
          <div className="mt-3 rounded border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Brief
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm" style={{ color: 'var(--text-primary)' }}>
              {(() => {
                try { return JSON.parse(task.brief).objective; }
                catch { return task.brief; }
              })()}
            </p>
          </div>
        )}

        {/* Cost */}
        {task.cost_usd > 0 && (
          <div className="mt-2">
            <CostIndicator costUsd={task.cost_usd} />
            <span className="ml-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              ({task.token_input + task.token_output} tokens)
            </span>
          </div>
        )}

        {/* AO Dashboard */}
        {task.ao_session_id && (
          <AODashboard sessionId={task.ao_session_id} />
        )}

        {/* PR Link */}
        {task.ao_pr_url && (
          <a
            href={task.ao_pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs underline"
            style={{ color: 'var(--accent)' }}
          >
            View PR
          </a>
        )}

        {/* Timeline */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Timeline
          </p>
          <TaskTimeline taskId={task.id} />
        </div>
      </div>
    </motion.div>
  );
}
