'use client';

/**
 * Interactive brief display card — copy, checkboxes, editable complexity, inline editing.
 * @module components/brief/brief-card
 */

import { useState } from 'react';
import * as notify from '../../lib/notify';
import type { BriefContent } from '../../lib/api';
import { BriefEditMode } from './brief-edit-mode';

const COMPLEXITY_CYCLE = ['trivial', 'small', 'medium', 'large'] as const;

interface BriefCardProps {
  brief: BriefContent;
  onBriefChange: (brief: BriefContent) => void;
}

function briefToMarkdown(brief: BriefContent): string {
  let md = `# ${brief.title}\n\n**Objective:** ${brief.objective}\n`;
  if (brief.acceptance_criteria.length > 0) {
    md += '\n**Criteria:**\n';
    for (const c of brief.acceptance_criteria) md += `- ${c}\n`;
  }
  if (brief.avoid_areas.length > 0) {
    md += '\n**Avoid:**\n';
    for (const a of brief.avoid_areas) md += `- ${a}\n`;
  }
  if (brief.estimated_complexity) {
    md += `\n**Complexity:** ${brief.estimated_complexity}\n`;
  }
  return md;
}

export function BriefCard({ brief, onBriefChange }: BriefCardProps) {
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(briefToMarkdown(brief));
      setCopied(true);
      notify.success('Brief copied as markdown');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error('Failed to copy');
    }
  };

  const cycleComplexity = () => {
    const current = brief.estimated_complexity ?? 'small';
    const idx = COMPLEXITY_CYCLE.indexOf(current as typeof COMPLEXITY_CYCLE[number]);
    const next = COMPLEXITY_CYCLE[(idx + 1) % COMPLEXITY_CYCLE.length];
    onBriefChange({ ...brief, estimated_complexity: next });
  };

  const toggleCheck = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  if (editing) {
    return (
      <BriefEditMode
        brief={brief}
        onSave={(updated) => { onBriefChange(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div
      className="group mt-3 space-y-3 rounded-lg border p-4 transition-shadow hover:shadow-md"
      style={{ borderColor: 'var(--border)', background: '#fff' }}
    >
      {/* Header row: title + copy + edit */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-brief)' }}>
            {brief.title}
          </h3>
          {brief.estimated_complexity && (
            <button
              type="button"
              onClick={cycleComplexity}
              title="Click to change complexity"
              className="mt-1 inline-block cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent-glow)', color: 'var(--accent-dim)' }}
            >
              {brief.estimated_complexity}
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded p-1 text-xs transition-colors hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
            title="Copy as markdown"
          >
            {copied ? '\u2713' : '\u2398'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            Edit
          </button>
        </div>
      </div>

      <div>
        <SectionLabel>Objective</SectionLabel>
        <p className="text-sm" style={{ color: 'var(--text-brief)' }}>{brief.objective}</p>
      </div>

      {brief.acceptance_criteria.length > 0 && (
        <div>
          <SectionLabel>Acceptance Criteria</SectionLabel>
          <ul className="space-y-1 text-sm" style={{ color: 'var(--text-brief)' }}>
            {brief.acceptance_criteria.map((c, i) => (
              <li key={`${i}-${c}`} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={checked.has(i)}
                  onChange={() => toggleCheck(i)}
                  className="mt-0.5 shrink-0 accent-[var(--accent)]"
                />
                <span className={checked.has(i) ? 'line-through opacity-60' : ''}>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.avoid_areas.length > 0 && (
        <div>
          <SectionLabel>Avoid</SectionLabel>
          <ul className="list-inside list-disc space-y-0.5 text-sm" style={{ color: 'var(--danger)' }}>
            {brief.avoid_areas.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}

      {brief.suggested_project && (
        <div>
          <SectionLabel>Suggested Project</SectionLabel>
          <p className="text-sm" style={{ color: 'var(--text-brief)' }}>{brief.suggested_project}</p>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-0.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  );
}
