'use client';

/**
 * Connection status indicator — green dot / yellow pulse / red.
 * @module components/layout/connection-status
 */

import { useConnection } from '../../hooks/use-connection';

const STATUS_CONFIG = {
  connected: {
    color: 'var(--success)',
    label: 'Connected',
    pulse: false,
  },
  reconnecting: {
    color: 'var(--warning)',
    label: 'Reconnecting...',
    pulse: true,
  },
  disconnected: {
    color: 'var(--danger)',
    label: 'Disconnected',
    pulse: false,
  },
} as const;

export function ConnectionStatus() {
  const status = useConnection();
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full${config.pulse ? ' animate-pulse' : ''}`}
        style={{ background: config.color }}
      />
      <span
        className="text-xs"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
      >
        {config.label}
      </span>
    </div>
  );
}
