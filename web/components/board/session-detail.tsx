'use client';

/**
 * Session detail — expandable panel showing prompt, verification output, failure.
 * @module components/board/session-detail
 */

import { useState } from 'react';

interface SessionDetailProps {
  session: {
    id: string;
    prompt: string;
    state: string;
    verification_output: string | null;
    failure_reason: string | null;
    retry_count: number;
  };
}

export function SessionDetail({ session }: SessionDetailProps) {
  const [promptOpen, setPromptOpen] = useState(false);

  return (
    <div className="space-y-2">
      {/* Retry indicator */}
      {session.retry_count > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Retry {session.retry_count}/2
        </p>
      )}

      {/* Prompt (collapsible) */}
      {session.prompt && (
        <div>
          <button
            type="button"
            onClick={() => setPromptOpen(!promptOpen)}
            className="text-xs font-medium underline"
            style={{ color: 'var(--accent)' }}
          >
            {promptOpen ? 'Hide prompt' : 'Show prompt'}
          </button>
          {promptOpen && (
            <pre
              className="mt-1 max-h-[300px] overflow-auto rounded border p-2 text-xs leading-relaxed"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {session.prompt}
            </pre>
          )}
        </div>
      )}

      {/* Verification output */}
      {session.verification_output && (
        <div>
          <p
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Verification output:
          </p>
          <pre
            className="mt-1 max-h-[200px] overflow-auto rounded border p-2 text-xs leading-relaxed"
            style={{
              borderColor:
                session.state === 'failed'
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'var(--border)',
              background:
                session.state === 'failed'
                  ? 'rgba(239, 68, 68, 0.05)'
                  : 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {session.verification_output}
          </pre>
        </div>
      )}

      {/* Failure reason (detailed) */}
      {session.state === 'failed' && session.failure_reason && (
        <div
          className="rounded border p-2"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.3)',
            background: 'rgba(239, 68, 68, 0.05)',
          }}
        >
          <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
            Failure reason:
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-primary)' }}>
            {session.failure_reason}
          </p>
        </div>
      )}
    </div>
  );
}
