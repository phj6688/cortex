/**
 * State labels and colors — mandatory everywhere.
 * @module domain/vocabulary
 */

import type { TaskState } from './task-machine.js';

/** Human-readable labels for each task state */
export const STATE_LABELS: Record<TaskState, string> = {
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
} as const;

/** Color tokens for each task state */
export const STATE_COLORS: Record<TaskState, string> = {
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
} as const;

/**
 * Get the human-readable label for a task state.
 * @param state - The task state
 * @param failureReason - Optional failure reason for failed state
 * @returns Human-readable label
 */
export function getStateLabel(state: TaskState, failureReason?: string | null): string {
  if (state === 'failed' && failureReason) {
    return `Mission Failed — ${failureReason}`;
  }
  return STATE_LABELS[state];
}
