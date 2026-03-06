'use client';

/**
 * Per-session actions: retry, edit, skip — with optimistic UI.
 * @module components/board/session-actions
 */

import { useState } from 'react';
import * as notify from '../../lib/notify';
import { trpc } from '../../lib/trpc';

interface SessionActionsProps {
  session: {
    id: string;
    task_id: string;
    state: string;
    retry_count: number;
    prompt: string;
  };
}

export function SessionActions({ session }: SessionActionsProps) {
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState(session.prompt);
  const utils = trpc.useUtils();

  const retryMutation = trpc.task.retrySession.useMutation({
    onSuccess: () => {
      notify.success('Session queued for retry');
      utils.task.sessions.invalidate({ taskId: session.task_id });
    },
    onError: (err) => notify.error(err.message),
  });

  const skipMutation = trpc.task.skipSession.useMutation({
    onSuccess: () => {
      notify.success('Session skipped');
      utils.task.sessions.invalidate({ taskId: session.task_id });
    },
    onError: (err) => notify.error(err.message),
  });

  const editMutation = trpc.task.updateSessionPrompt.useMutation({
    onSuccess: () => {
      notify.success('Session prompt updated');
      setEditing(false);
      utils.task.sessions.invalidate({ taskId: session.task_id });
    },
    onError: (err) => notify.error(err.message),
  });

  const canRetry = session.state === 'failed' && session.retry_count < 2;
  const canSkip = session.state === 'failed' || session.state === 'pending';
  const canEdit = session.state === 'failed' || session.state === 'pending';
  const isLoading =
    retryMutation.isPending || skipMutation.isPending || editMutation.isPending;

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          rows={8}
          className="w-full rounded border p-2 text-xs outline-none"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            resize: 'vertical',
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isLoading || !editPrompt.trim()}
            onClick={() =>
              editMutation.mutate({
                sessionId: session.id,
                prompt: editPrompt,
              })
            }
            className="min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            {editMutation.isPending ? 'Saving...' : 'Save & Ready'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setEditPrompt(session.prompt);
            }}
            className="min-h-[36px] rounded-lg border px-3 py-1.5 text-xs"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {canRetry && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => retryMutation.mutate({ sessionId: session.id })}
          className="min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          {retryMutation.isPending ? 'Retrying...' : 'Retry with context'}
        </button>
      )}
      {canEdit && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => setEditing(true)}
          className="min-h-[36px] rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          Edit session
        </button>
      )}
      {canSkip && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => skipMutation.mutate({ sessionId: session.id })}
          className="min-h-[36px] rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          {skipMutation.isPending ? 'Skipping...' : 'Skip'}
        </button>
      )}
    </div>
  );
}
