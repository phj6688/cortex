'use client';

/**
 * Project wizard — paste GitHub URL → clone → ready for dispatch.
 * @module components/projects/project-wizard
 */

import { useState } from 'react';
import * as notify from '../../lib/notify';
import { trpc } from '../../lib/trpc';

interface ProjectWizardProps {
  onClose: () => void;
  onCreated?: () => void;
}

function parseGitHubUrl(url: string): { orgRepo: string; name: string } | null {
  const patterns = [
    /^https?:\/\/github\.com\/([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)/,
    /^github\.com\/([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)/,
    /^git@github\.com:([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)/,
    /^([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match?.[1]) {
      const orgRepo = match[1].replace(/\.git$/, '');
      const name = orgRepo.split('/')[1] ?? orgRepo;
      return { orgRepo, name };
    }
  }
  return null;
}

export function ProjectWizard({ onClose, onCreated }: ProjectWizardProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [preview, setPreview] = useState('');

  const createProject = trpc.project.create.useMutation();

  const handleInput = (value: string) => {
    setUrl(value);
    const result = parseGitHubUrl(value);
    if (result) {
      setPreview(result.orgRepo);
      if (!name) setName(result.name);
    } else {
      setPreview('');
    }
  };

  const handleSubmit = async () => {
    if (!url.trim()) return;

    try {
      const result = await createProject.mutateAsync({
        githubUrl: url.trim(),
        ...(name && { name }),
        ...(branch && { defaultBranch: branch }),
      });
      notify.success(`Project "${result.name}" created`);
      if (result.aoRestartRequired) {
        notify.info('Restart AO to enable dispatch: docker compose restart agent-orchestrator');
      }
      onCreated?.();
      onClose();
    } catch (err) {
      notify.error((err as Error).message);
    }
  };

  const canSubmit = url.trim().length > 0 && !createProject.isPending;

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
          Paste a GitHub URL. The repo will be cloned automatically.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              GitHub URL or org/repo
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="https://github.com/org/repo"
              autoFocus
              className="min-h-[44px] w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
            />
            {preview && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Will clone: {preview}
              </p>
            )}
          </div>

          <Field label="Project name (optional)" value={name} onChange={setName} placeholder="auto-detected from repo" />
          <Field label="Branch (optional)" value={branch} onChange={setBranch} placeholder="auto-detected" />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-h-[44px] flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            {createProject.isPending ? 'Cloning repository...' : 'Add Project'}
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

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[44px] w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
      />
    </div>
  );
}
