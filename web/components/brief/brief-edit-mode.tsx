'use client';

/**
 * Inline brief edit mode — editable fields with add/remove for lists.
 * @module components/brief/brief-edit-mode
 */

import { useState, useRef, useCallback, type ChangeEvent } from 'react';
import type { BriefContent } from '../../lib/api';

const COMPLEXITY_OPTIONS = ['trivial', 'small', 'medium', 'large'] as const;

interface BriefEditModeProps {
  brief: BriefContent;
  onSave: (brief: BriefContent) => void;
  onCancel: () => void;
}

export function BriefEditMode({ brief, onSave, onCancel }: BriefEditModeProps) {
  const [title, setTitle] = useState(brief.title);
  const [objective, setObjective] = useState(brief.objective);
  const [criteria, setCriteria] = useState<string[]>([...brief.acceptance_criteria]);
  const [avoid, setAvoid] = useState<string[]>([...brief.avoid_areas]);
  const [complexity, setComplexity] = useState(brief.estimated_complexity ?? 'small');

  const canSave = title.trim() && objective.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      objective: objective.trim(),
      acceptance_criteria: criteria.filter((c) => c.trim()),
      avoid_areas: avoid.filter((a) => a.trim()),
      estimated_complexity: complexity,
      suggested_project: brief.suggested_project ?? null,
    });
  };

  const updateItem = (list: string[], setList: (l: string[]) => void, i: number, v: string) => {
    const next = [...list];
    next[i] = v;
    setList(next);
  };

  return (
    <div
      className="mt-3 space-y-3 rounded-lg border p-4"
      style={{ borderColor: 'var(--accent)', background: '#fff' }}
    >
      <EditField label="Title" value={title} onChange={setTitle} />
      <EditField label="Objective" value={objective} onChange={setObjective} multiline />

      <ListField
        label="Acceptance Criteria"
        items={criteria}
        onChange={(i, v) => updateItem(criteria, setCriteria, i, v)}
        onRemove={(i) => setCriteria(criteria.filter((_, idx) => idx !== i))}
        onAdd={() => setCriteria([...criteria, ''])}
      />
      <ListField
        label="Avoid"
        items={avoid}
        onChange={(i, v) => updateItem(avoid, setAvoid, i, v)}
        onRemove={(i) => setAvoid(avoid.filter((_, idx) => idx !== i))}
        onAdd={() => setAvoid([...avoid, ''])}
      />

      <div>
        <FieldLabel>Complexity</FieldLabel>
        <div className="flex gap-1">
          {COMPLEXITY_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setComplexity(c)}
              className="rounded px-2 py-1 text-xs font-medium transition-colors"
              style={{
                background: complexity === c ? 'var(--accent-glow)' : 'transparent',
                color: complexity === c ? 'var(--accent-dim)' : 'var(--text-secondary)',
                border: `1px solid ${complexity === c ? 'var(--accent-dim)' : 'var(--border)'}`,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="min-h-[36px] rounded px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[36px] rounded border px-3 py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </label>
  );
}

function EditField({ label, value, onChange, multiline }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const autoResize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (multiline) autoResize();
  };

  const inputStyle = { borderColor: 'var(--border)', color: 'var(--text-brief)' };

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {multiline ? (
        <textarea
          ref={ref}
          value={value}
          onChange={handleChange}
          rows={2}
          className="w-full resize-none rounded border px-2 py-1.5 text-sm outline-none focus:border-[var(--border-focus)]"
          style={inputStyle}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={handleChange}
          className="w-full rounded border px-2 py-1.5 text-sm outline-none focus:border-[var(--border-focus)]"
          style={inputStyle}
        />
      )}
    </div>
  );
}

function ListField({ label, items, onChange, onRemove, onAdd }: {
  label: string;
  items: string[];
  onChange: (i: number, v: string) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="text"
              value={item}
              onChange={(e) => onChange(i, e.target.value)}
              className="min-w-0 flex-1 rounded border px-2 py-1 text-sm outline-none focus:border-[var(--border-focus)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-brief)' }}
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="shrink-0 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-red-50"
              style={{ color: 'var(--danger)' }}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="rounded px-2 py-0.5 text-xs transition-colors hover:bg-black/5"
          style={{ color: 'var(--text-secondary)' }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}
