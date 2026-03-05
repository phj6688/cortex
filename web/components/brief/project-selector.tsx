'use client';

/**
 * Inline project picker using tRPC.
 * @module components/brief/project-selector
 */

import { trpc } from '../../lib/trpc';

interface ProjectSelectorProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
}

export function ProjectSelector({ value, onChange, disabled = false }: ProjectSelectorProps) {
  const { data: projects, isLoading } = trpc.project.list.useQuery();

  return (
    <div className="mt-2">
      <label
        className="mb-1 block text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--text-secondary)' }}
      >
        Project
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled || isLoading}
        className="w-full rounded border px-2 py-1.5 text-sm outline-none disabled:opacity-50"
        style={{ borderColor: 'var(--border)', color: 'var(--text-brief)' }}
      >
        <option value="">No project</option>
        {projects?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
