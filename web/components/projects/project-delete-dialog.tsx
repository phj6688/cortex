'use client';

/**
 * Confirmation dialog for project deletion.
 * @module components/projects/project-delete-dialog
 */

import * as notify from '../../lib/notify';
import { trpc } from '../../lib/trpc';

interface ProjectDeleteDialogProps {
  project: { id: string; name: string };
  onClose: () => void;
  onDeleted: () => void;
}

export function ProjectDeleteDialog({ project, onClose, onDeleted }: ProjectDeleteDialogProps) {
  const utils = trpc.useUtils();
  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
      notify.success(`Project "${project.name}" deleted`);
      onDeleted();
    },
    onError: (err) => notify.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative w-full max-w-[380px] rounded-xl border p-5"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Delete {project.name}?
        </h3>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          This cannot be undone. All project configuration will be removed.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => deleteProject.mutate({ id: project.id })}
            disabled={deleteProject.isPending}
            className="min-h-[36px] rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--danger)' }}
          >
            {deleteProject.isPending ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] rounded border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
