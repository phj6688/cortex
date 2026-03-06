'use client';

/**
 * Project wizard — paste GitHub URL → auto-parse → save in 30 seconds.
 * @module components/projects/project-wizard
 */

import { useState } from 'react';
import * as notify from '../../lib/notify';
import { trpc } from '../../lib/trpc';

interface ProjectWizardProps {
  onClose: () => void;
  onCreated?: () => void;
}

function parseGitHubUrl(url: string): { repo: string; name: string } | null {
  // Match: https://github.com/org/repo or github.com/org/repo or org/repo
  const patterns = [
    /^https?:\/\/github\.com\/([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)/,
    /^github\.com\/([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)/,
    /^([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match?.[1]) {
      const repo = match[1].replace(/\.git$/, '');
      const name = repo.split('/')[1] ?? repo;
      return { repo, name };
    }
  }
  return null;
}

export function ProjectWizard({ onClose, onCreated }: ProjectWizardProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [path, setPath] = useState('');
  const [branch, setBranch] = useState('main');
  const [parsed, setParsed] = useState(false);

  const createProject = trpc.project.create.useMutation();

  const handlePaste = (value: string) => {
    setUrl(value);
    const result = parseGitHubUrl(value);
    if (result) {
      setRepo(result.repo);
      setName(result.name);
      setPath(`~/${result.name}`);
      setParsed(true);
    } else {
      setParsed(false);
    }
  };

  const handleSubmit = async () => {
    if (!name || !repo || !path) return;

    try {
      await createProject.mutateAsync({
        name,
        repo,
        path,
        default_branch: branch,
      });
      notify.success(`Project "${name}" created`);
      onCreated?.();
      onClose();
    } catch (err) {
      notify.error((err as Error).message);
    }
  };

  const canSubmit = name && repo && path && !createProject.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative w-full max-w-[420px] rounded-xl border p-6"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Add Project
        </h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Paste a GitHub URL to auto-populate fields.
        </p>

        <div className="mt-4 space-y-3">
          {/* URL paste */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              GitHub URL or org/repo
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => handlePaste(e.target.value)}
              placeholder="https://github.com/org/repo"
              autoFocus
              className="min-h-[44px] w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
            />
          </div>

          {parsed && (
            <>
              <Field label="Name" value={name} onChange={setName} />
              <Field label="Repository (org/repo)" value={repo} onChange={setRepo} />
              <Field label="Local path" value={path} onChange={setPath} />
              <Field label="Default branch" value={branch} onChange={setBranch} />
            </>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-h-[44px] flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            {createProject.isPending ? 'Creating...' : 'Create Project'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
      />
    </div>
  );
}
