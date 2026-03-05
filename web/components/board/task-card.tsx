'use client';

/**
 * Task card — Framer Motion layoutId, all 9 states, cost badge, elapsed time.
 * Framer Motion use #1: task card enter/exit/reorder.
 * @module components/board/task-card
 */

import { motion } from 'framer-motion';
import { StateBadge } from './state-badge';
import { CostIndicator } from './cost-indicator';
import { formatElapsed } from '../../lib/format';
import { useUIStore } from '../../stores/ui-store';
import type { Task } from '../../stores/task-store';

const PRIORITY_LABELS = ['', 'HIGH', 'URGENT'] as const;

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const selectTask = useUIStore((s) => s.selectTask);
  const selectedId = useUIStore((s) => s.selectedTaskId);
  const isSelected = selectedId === task.id;

  return (
    <motion.div
      layoutId={task.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={() => selectTask(isSelected ? null : task.id)}
      className="cursor-pointer rounded-lg border p-3 transition-colors"
      style={{
        background: 'var(--bg-surface)',
        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
        boxShadow: isSelected ? 'var(--shadow-glow)' : 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <StateBadge state={task.state} failureReason={task.failure_reason} />
        {task.priority > 0 && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={{
              background: task.priority === 2 ? 'var(--danger)' : 'var(--warning)',
              color: '#000',
            }}
          >
            {PRIORITY_LABELS[task.priority]}
          </span>
        )}
      </div>

      <h3
        className="mt-2 text-sm font-medium leading-snug"
        style={{ color: 'var(--text-primary)' }}
      >
        {task.title}
      </h3>

      <div className="mt-2 flex items-center justify-between">
        <span
          className="text-xs"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
        >
          {formatElapsed(task.updated_at)}
        </span>
        <CostIndicator costUsd={task.cost_usd} />
      </div>
    </motion.div>
  );
}
