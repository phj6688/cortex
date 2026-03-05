'use client';

/**
 * Vertical event timeline per task (audit log from events table).
 * @module components/board/task-timeline
 */

import { useTaskEvents } from '../../hooks/use-tasks';
import { formatDate } from '../../lib/format';

interface TaskTimelineProps {
  taskId: string;
}

const EVENT_LABELS: Record<string, string> = {
  created:       'Created',
  state_changed: 'State changed',
  brief_refined: 'Brief refined',
  signed_off:    'Signed off',
  dispatched:    'Dispatched to AO',
  ao_update:     'AO update',
  pr_opened:     'PR opened',
  ci_passed:     'CI passed',
  ci_failed:     'CI failed',
  done:          'Completed',
  failed:        'Failed',
  cost_update:   'Cost updated',
  comment:       'Comment',
  retried:       'Retried',
  slept:         'Put to sleep',
  woke:          'Woken up',
};

export function TaskTimeline({ taskId }: TaskTimelineProps) {
  const { data: events, isLoading } = useTaskEvents(taskId);

  if (isLoading) {
    return <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading timeline...</p>;
  }

  if (!events || events.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No events</p>;
  }

  return (
    <div className="space-y-0">
      {events.map((event) => (
        <div key={event.id} className="flex gap-3 py-1.5">
          <div className="flex flex-col items-center">
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: 'var(--text-secondary)' }}
            />
            <div
              className="w-px flex-1"
              style={{ background: 'var(--border)' }}
            />
          </div>
          <div className="flex-1 pb-1">
            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {EVENT_LABELS[event.event_type] ?? event.event_type}
              {event.from_state && event.to_state && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {' '}{event.from_state} → {event.to_state}
                </span>
              )}
            </p>
            <p
              className="text-[10px]"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
            >
              {formatDate(event.created_at)} · {event.actor}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
