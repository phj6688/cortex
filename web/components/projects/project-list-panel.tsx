'use client';

/**
 * Project list panel — grid of project cards with management actions.
 * @module components/projects/project-list-panel
 */

import { useState } from 'react';
import { ProjectCard } from './project-card';
import { useProjects } from '../../hooks/use-projects';

interface ProjectListPanelProps {
  onClose: () => void;
  onAddProject: () => void;
  highlightId?: string | null;
}

export function ProjectListPanel({ onClose, onAddProject, highlightId }: ProjectListPanelProps) {
  const { data: projects, isLoading } = useProjects();
  const [search, setSearch] = useState('');

  const filtered = projects?.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.repo.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative w-full max-w-[600px] rounded-xl border"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Projects
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddProject}
              className="rounded px-2.5 py-1 text-xs font-medium"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              + Add
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-xs transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-secondary)' }}
            >
              {'\u2715'}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
          />
        </div>

        {/* List */}
        <div className="max-h-[400px] space-y-2 overflow-y-auto p-4">
          {isLoading && (
            <p className="py-8 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
          )}
          {!isLoading && (!filtered || filtered.length === 0) && (
            <p className="py-8 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
              {search ? 'No projects match' : 'No projects yet'}
            </p>
          )}
          {filtered?.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              highlight={p.id === highlightId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
