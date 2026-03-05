'use client';

/**
 * Manual brief editor — fallback when LLM times out.
 * @module components/brief/brief-editor
 */

import { useState, type ChangeEvent } from 'react';
import type { BriefContent } from '../../lib/api';

interface BriefEditorProps {
  initial?: Partial<BriefContent>;
  onSave: (brief: BriefContent) => void;
  onCancel: () => void;
}

export function BriefEditor({ initial, onSave, onCancel }: BriefEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [objective, setObjective] = useState(initial?.objective ?? '');
  const [criteria, setCriteria] = useState(initial?.acceptance_criteria?.join('\n') ?? '');
  const [avoid, setAvoid] = useState(initial?.avoid_areas?.join('\n') ?? '');
  const [complexity, setComplexity] = useState(initial?.estimated_complexity ?? 'small');

  const canSave = title.trim() && objective.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      objective: objective.trim(),
      acceptance_criteria: criteria.split('\n').map(s => s.trim()).filter(Boolean),
      avoid_areas: avoid.split('\n').map(s => s.trim()).filter(Boolean),
      estimated_complexity: complexity,
      suggested_project: initial?.suggested_project ?? null,
    });
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: '#fff' }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--warning)' }}>
        Manual Brief Editor
      </p>

      <Field label="Title" value={title} onChange={setTitle} />
      <Field label="Objective" value={objective} onChange={setObjective} multiline />
      <Field label="Acceptance Criteria (one per line)" value={criteria} onChange={setCriteria} multiline />
      <Field label="Avoid Areas (one per line)" value={avoid} onChange={setAvoid} multiline />

      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Complexity
        </label>
        <select
          value={complexity}
          onChange={(e) => setComplexity(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-brief)' }}
        >
          <option value="trivial">Trivial</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="rounded px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          Save Brief
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border px-3 py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value);
  const inputStyle = {
    borderColor: 'var(--border)',
    color: 'var(--text-brief)',
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={handleChange}
          rows={3}
          className="w-full resize-none rounded border px-2 py-1.5 text-sm outline-none"
          style={inputStyle}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={handleChange}
          className="w-full rounded border px-2 py-1.5 text-sm outline-none"
          style={inputStyle}
        />
      )}
    </div>
  );
}
