'use client';

/**
 * Project info display card.
 * @module components/projects/project-card
 */

import { formatCost } from '../../lib/format';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    repo: string;
    path: string;
    default_branch: string;
    total_cost_usd: number;
    task_count: number;
  };
  selected?: boolean;
  onClick?: () => void;
}

export function ProjectCard({ project, selected, onClick }: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg border p-3 transition-colors${onClick ? '' : ' cursor-default'}`}
      style={{
        background: 'var(--bg-surface)',
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
      }}
    >
      <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {project.name}
      </h4>
      <p
        className="mt-0.5 text-xs"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
      >
        {project.repo}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {project.task_count} tasks
        </span>
        {project.total_cost_usd > 0 && (
          <span
            className="text-xs tabular-nums"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
          >
            {formatCost(project.total_cost_usd)}
          </span>
        )}
      </div>
    </div>
  );
}
