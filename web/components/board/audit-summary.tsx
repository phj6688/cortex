'use client';

/**
 * Audit summary card — KEEP/PATCH/REWRITE/DELETE/CREATE breakdown.
 * Only shown for decomposed tasks (complexity=large).
 * @module components/board/audit-summary
 */

import { useState } from 'react';
import { useAuditVerdicts } from '../../hooks/use-tasks';

interface AuditSummaryProps {
  taskId: string;
}

const VERDICT_COLORS: Record<string, string> = {
  keep:    '#10b981',
  patch:   '#f59e0b',
  rewrite: '#ef4444',
  delete:  '#6b7280',
  create:  '#3b82f6',
};

const VERDICT_LABELS: Record<string, string> = {
  keep:    'Keep',
  patch:   'Patch',
  rewrite: 'Rewrite',
  delete:  'Delete',
  create:  'Create',
};

export function AuditSummary({ taskId }: AuditSummaryProps) {
  const { data: verdicts, isLoading } = useAuditVerdicts(taskId);
  const [antiPatternsOpen, setAntiPatternsOpen] = useState(false);

  if (isLoading || !verdicts || verdicts.length === 0) return null;

  // Compute summary counts
  const summary: Record<string, number> = {
    keep: 0,
    patch: 0,
    rewrite: 0,
    delete: 0,
    create: 0,
  };
  for (const v of verdicts) {
    const key = v.verdict as string;
    if (key in summary) {
      summary[key]!++;
    }
  }

  // Extract unique anti-patterns from critical verdicts
  const criticalIssues = verdicts
    .filter((v) => v.verdict === 'rewrite' || v.verdict === 'delete')
    .map((v) => `${v.file_path}: ${v.reason}`);

  return (
    <div className="mt-4">
      <p
        className="mb-2 text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--text-secondary)' }}
      >
        Audit Summary
      </p>

      <div
        className="rounded-lg border p-3"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)' }}
      >
        {/* Verdict breakdown */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(summary)
            .filter(([, count]) => count > 0)
            .map(([verdict, count]) => (
              <div key={verdict} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: VERDICT_COLORS[verdict] }}
                />
                <span className="text-xs font-medium" style={{ color: VERDICT_COLORS[verdict] }}>
                  {count}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {VERDICT_LABELS[verdict]}
                </span>
              </div>
            ))}
        </div>

        {/* Critical issues */}
        {criticalIssues.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
              Critical Issues ({criticalIssues.length})
            </p>
            <ul className="mt-1 space-y-0.5">
              {criticalIssues.slice(0, 5).map((issue, i) => (
                <li
                  key={i}
                  className="text-xs"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                >
                  {issue}
                </li>
              ))}
              {criticalIssues.length > 5 && (
                <li className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  +{criticalIssues.length - 5} more
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Anti-patterns (collapsible) */}
        {verdicts.some((v) => v.verdict === 'patch' && v.patch_details) && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setAntiPatternsOpen(!antiPatternsOpen)}
              className="text-xs font-medium underline"
              style={{ color: 'var(--accent)' }}
            >
              {antiPatternsOpen ? 'Hide patch details' : 'Show patch details'}
            </button>
            {antiPatternsOpen && (
              <ul className="mt-1 space-y-0.5">
                {verdicts
                  .filter((v) => v.verdict === 'patch' && v.patch_details)
                  .map((v) => (
                    <li
                      key={v.id}
                      className="text-xs"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        {v.file_path}
                      </span>
                      : {v.patch_details}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
