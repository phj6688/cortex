'use client';

/**
 * Session progress panel — vertical session list with states for decomposed tasks.
 * @module components/board/session-progress
 */

import { useState } from 'react';
import { useTaskSessions } from '../../hooks/use-tasks';
import { formatCost } from '../../lib/format';
import { SessionDetail } from './session-detail';
import { SessionActions } from './session-actions';

type SessionState =
  | 'pending' | 'auditing' | 'ready' | 'dispatched'
  | 'running' | 'verifying' | 'passed' | 'failed' | 'skipped';

interface Session {
  id: string;
  task_id: string;
  session_number: number;
  title: string;
  state: SessionState;
  cost_usd: number;
  failure_reason: string | null;
  retry_count: number;
  started_at: number | null;
  completed_at: number | null;
  prompt: string;
  verification_output: string | null;
}

const STATE_ICONS: Record<SessionState, string> = {
  passed:    '\u2705',
  running:   '\uD83D\uDD35',
  verifying: '\uD83D\uDD35',
  dispatched: '\uD83D\uDD35',
  failed:    '\uD83D\uDD34',
  pending:   '\u23F3',
  auditing:  '\uD83D\uDD0D',
  ready:     '\u23F3',
  skipped:   '\u23ED\uFE0F',
};

const STATE_LABELS: Record<SessionState, string> = {
  passed:     'passed',
  running:    'running',
  verifying:  'verifying',
  dispatched: 'dispatched',
  failed:     'failed',
  pending:    'pending',
  auditing:   'auditing',
  ready:      'ready',
  skipped:    'skipped',
};

/**
 * Format duration between two timestamps.
 * @param startAt - Start unix timestamp
 * @param endAt - End unix timestamp (or null for ongoing)
 * @returns Formatted duration string
 */
function formatDuration(startAt: number | null, endAt: number | null): string {
  if (!startAt) return '';
  const end = endAt ?? Math.floor(Date.now() / 1000);
  const diff = end - startAt;
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}m`;
}

interface SessionProgressProps {
  taskId: string;
}

export function SessionProgress({ taskId }: SessionProgressProps) {
  const { data: sessions, isLoading } = useTaskSessions(taskId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Loading sessions...
      </p>
    );
  }

  if (!sessions || sessions.length === 0) return null;

  const typedSessions = sessions as Session[];
  const passedCount = typedSessions.filter((s) => s.state === 'passed').length;
  const totalCost = typedSessions.reduce((sum, s) => sum + s.cost_usd, 0);
  const firstStarted = typedSessions.find((s) => s.started_at)?.started_at ?? null;
  const lastCompleted = typedSessions
    .filter((s) => s.completed_at)
    .sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0))[0]?.completed_at ?? null;

  return (
    <div className="mt-4">
      <p
        className="mb-2 text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--text-secondary)' }}
      >
        Session Progress
      </p>

      <div
        className="rounded-lg border"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)' }}
      >
        {typedSessions.map((session) => (
          <div key={session.id}>
            <button
              type="button"
              onClick={() =>
                setExpandedId(expandedId === session.id ? null : session.id)
              }
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-xs">{STATE_ICONS[session.state]}</span>
              <span
                className="font-mono text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                S{session.session_number}
              </span>
              <span
                className="flex-1 truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {session.title}
              </span>
              <span
                className="text-xs"
                style={{
                  color:
                    session.state === 'failed'
                      ? '#ef4444'
                      : session.state === 'passed'
                        ? '#10b981'
                        : session.state === 'running' || session.state === 'verifying'
                          ? '#00ff41'
                          : 'var(--text-secondary)',
                }}
              >
                {STATE_LABELS[session.state]}
              </span>
              {session.started_at && (
                <span
                  className="text-xs tabular-nums"
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {formatDuration(session.started_at, session.completed_at)}
                </span>
              )}
              {session.cost_usd > 0 && (
                <span
                  className="text-xs tabular-nums"
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {formatCost(session.cost_usd)}
                </span>
              )}
            </button>

            {/* Failure reason inline */}
            {session.state === 'failed' && session.failure_reason && (
              <div
                className="px-3 py-1.5 text-xs"
                style={{
                  color: '#ef4444',
                  background: 'rgba(239, 68, 68, 0.05)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {session.failure_reason}
              </div>
            )}

            {/* Actions for failed/pending sessions */}
            {(session.state === 'failed' || session.state === 'pending') && (
              <div
                className="px-3 py-1.5"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <SessionActions session={session} />
              </div>
            )}

            {/* Expandable detail */}
            {expandedId === session.id && (
              <div
                className="px-3 py-2"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <SessionDetail session={session} />
              </div>
            )}
          </div>
        ))}

        {/* Footer */}
        <div
          className="flex items-center gap-4 px-3 py-2 text-xs"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
        >
          {totalCost > 0 && <span>Total: {formatCost(totalCost)}</span>}
          {firstStarted && (
            <span>
              Elapsed: {formatDuration(firstStarted, lastCompleted)}
            </span>
          )}
          <span>
            {passedCount}/{typedSessions.length} sessions passed
          </span>
        </div>
      </div>
    </div>
  );
}
