'use client';

/**
 * Live NDJSON token rendering during brief refinement.
 * @module components/brief/refinement-stream
 */

import { useRef, useEffect } from 'react';

interface RefinementStreamProps {
  tokens: string;
  isStreaming: boolean;
  warning?: string | null;
}

export function RefinementStream({ tokens, isStreaming, warning }: RefinementStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [tokens]);

  if (!tokens && !isStreaming) return null;

  return (
    <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
      {warning && (
        <p className="mb-2 text-xs" style={{ color: 'var(--warning)' }}>
          {warning}
        </p>
      )}
      <div
        ref={containerRef}
        className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm"
        style={{
          color: 'var(--text-brief)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          lineHeight: '1.5',
        }}
      >
        {tokens}
        {isStreaming && (
          <span
            className="ml-0.5 inline-block h-4 w-1 animate-pulse"
            style={{ background: 'var(--accent)' }}
          />
        )}
      </div>
    </div>
  );
}
