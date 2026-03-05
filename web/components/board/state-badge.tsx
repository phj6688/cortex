'use client';

/**
 * Animated state badge — color + scale pulse on change.
 * Framer Motion use #3: state badge pulse on status change.
 * @module components/board/state-badge
 */

import { motion } from 'framer-motion';

const STATE_LABELS: Record<string, string> = {
  draft:            'Writing...',
  refined:          'Ready to Review',
  pending_approval: 'Awaiting Sign-Off',
  approved:         'Queued',
  auditing:         'Auditing Codebase',
  decomposing:      'Decomposing Sessions',
  dispatched:       'Briefed',
  running:          'In the Field',
  sleeping:         'Standing By',
  done:             'Mission Complete',
  failed:           'Mission Failed',
};

const STATE_COLORS: Record<string, string> = {
  draft:            '#6b7280',
  refined:          '#f59e0b',
  pending_approval: '#f97316',
  approved:         '#3b82f6',
  auditing:         '#a855f7',
  decomposing:      '#6366f1',
  dispatched:       '#8b5cf6',
  running:          '#00ff41',
  sleeping:         '#64748b',
  done:             '#10b981',
  failed:           '#ef4444',
};

interface StateBadgeProps {
  state: string;
  failureReason?: string | null;
}

export function StateBadge({ state, failureReason }: StateBadgeProps) {
  const color = STATE_COLORS[state] ?? '#6b7280';
  const label = state === 'failed' && failureReason
    ? `Failed — ${failureReason}`
    : STATE_LABELS[state] ?? state;

  return (
    <motion.span
      key={state}
      initial={{ scale: 1.3, opacity: 0.7 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium${state === 'running' ? ' animate-pulse-glow' : ''}`}
      style={{
        background: `${color}20`,
        color,
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </motion.span>
  );
}
