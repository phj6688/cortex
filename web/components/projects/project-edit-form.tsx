'use client';

/**
 * Inline project edit form — replaces project card while editing.
 * @module components/projects/project-edit-form
 */

import { useState } from 'react';
import * as notify from '../../lib/notify';
import { trpc } from '../../lib/trpc';

interface ProjectEditFormProps {
  project: { id: string; name: string; repo: string; path: string; default_branch: string };
  onDone: () => void;
}

const REPO_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export function ProjectEditForm({ project, onDone }: ProjectEditFormProps) {
  const [name, setName] = useState(project.name);
  const [repo, setRepo] = useState(project.repo);
  const [path, setPath] = useState(project.path);
  const [branch, setBranch] = useState(project.default_branch);

  const utils = trpc.useUtils();
  const updateProject = trpc.project.update.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
      utils.project.get.invalidate({ id: project.id });
      notify.success('Project updated');
      onDone();
    },
    onError: (err) => notify.error(err.message),
  });

  const canSave = name.trim() && REPO_RE.test(repo) && path.trim() && !updateProject.isPending;

  const handleSave = () => {
    if (!canSave) return;
    updateProject.mutate({
      id: project.id,
      name: name.trim(),
      repo: repo.trim(),
      path: path.trim(),
      default_branch: branch.trim() || 'main',
    });
  };

  return (
    <div
      className="space-y-2.5 rounded-lg border p-3"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}
    >
      <Field label="Name" value={name} onChange={setName} />
      <Field label="Repo (org/repo)" value={repo} onChange={setRepo} error={repo && !REPO_RE.test(repo) ? 'Must be org/repo' : undefined} />
      <Field label="Path" value={path} onChange={setPath} />
      <Field label="Branch" value={branch} onChange={setBranch} />
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="rounded px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          {updateProject.isPending ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, error }: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border px-2 py-1.5 text-sm outline-none"
        style={{ borderColor: error ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-elevated)' }}
      />
      {error && <p className="mt-0.5 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}
