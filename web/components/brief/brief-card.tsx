'use client';

/**
 * Structured brief display card.
 * @module components/brief/brief-card
 */

import type { BriefContent } from '../../lib/api';

interface BriefCardProps {
  brief: BriefContent;
}

export function BriefCard({ brief }: BriefCardProps) {
  return (
    <div
      className="mt-3 space-y-3 rounded-lg border p-4"
      style={{
        borderColor: 'var(--border)',
        background: '#fff',
      }}
    >
      <div>
        <h3
          className="text-base font-semibold"
          style={{ color: 'var(--text-brief)' }}
        >
          {brief.title}
        </h3>
        {brief.estimated_complexity && (
          <span
            className="mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium"
            style={{
              background: 'var(--accent-glow)',
              color: 'var(--accent-dim)',
            }}
          >
            {brief.estimated_complexity}
          </span>
        )}
      </div>

      <div>
        <Label>Objective</Label>
        <p className="text-sm" style={{ color: 'var(--text-brief)' }}>
          {brief.objective}
        </p>
      </div>

      {brief.acceptance_criteria.length > 0 && (
        <div>
          <Label>Acceptance Criteria</Label>
          <ul className="list-inside list-disc space-y-0.5 text-sm" style={{ color: 'var(--text-brief)' }}>
            {brief.acceptance_criteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {brief.avoid_areas.length > 0 && (
        <div>
          <Label>Avoid</Label>
          <ul className="list-inside list-disc space-y-0.5 text-sm" style={{ color: 'var(--danger)' }}>
            {brief.avoid_areas.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {brief.suggested_project && (
        <div>
          <Label>Suggested Project</Label>
          <p className="text-sm" style={{ color: 'var(--text-brief)' }}>
            {brief.suggested_project}
          </p>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-0.5 text-xs font-medium uppercase tracking-wide"
      style={{ color: 'var(--text-secondary)' }}
    >
      {children}
    </p>
  );
}
