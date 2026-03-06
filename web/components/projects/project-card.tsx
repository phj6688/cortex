'use client';

/**
 * Project card — display with edit/delete actions.
 * @module components/projects/project-card
 */

import { useState } from 'react';
import { formatCost } from '../../lib/format';
import { ProjectEditForm } from './project-edit-form';
import { ProjectDeleteDialog } from './project-delete-dialog';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    repo: string;
    path: string;
    default_branch: string;
    total_cost_usd: number;
    task_count: number;
    updated_at: number;
  };
  selected?: boolean;
  onClick?: () => void;
  highlight?: boolean;
}

export function ProjectCard({ project, selected, onClick, highlight }: ProjectCardProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (editing) {
    return <ProjectEditForm project={project} onDone={() => setEditing(false)} />;
  }

  return (
    <>
      <div
        onClick={onClick}
        className={`rounded-lg border p-3 transition-all${onClick ? ' cursor-pointer' : ''}${highlight ? ' animate-pulse-glow' : ''}`}
        style={{
          background: 'var(--bg-surface)',
          borderColor: selected ? 'var(--accent)' : 'var(--border)',
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {project.name}
            </h4>
            <p
              className="mt-0.5 text-xs"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
            >
              {project.repo}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              className="rounded p-1 text-xs transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-secondary)' }}
              title="Edit project"
            >
              {'\u270E'}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDeleting(true); }}
              className="rounded p-1 text-xs transition-colors hover:bg-white/10"
              style={{ color: 'var(--danger)' }}
              title="Delete project"
            >
              {'\u2715'}
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Badge>{project.task_count} tasks</Badge>
          {project.total_cost_usd > 0 && (
            <Badge mono>{formatCost(project.total_cost_usd)}</Badge>
          )}
          <Badge>{project.default_branch}</Badge>
        </div>
      </div>

      {deleting && (
        <ProjectDeleteDialog
          project={project}
          onClose={() => setDeleting(false)}
          onDeleted={() => setDeleting(false)}
        />
      )}
    </>
  );
}

function Badge({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className="text-xs tabular-nums"
      style={{
        color: 'var(--text-secondary)',
        fontFamily: mono ? 'var(--font-mono)' : undefined,
      }}
    >
      {children}
    </span>
  );
}
