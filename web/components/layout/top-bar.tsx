'use client';

/**
 * Top bar — logo, connection status, keyboard shortcut hints.
 * @module components/layout/top-bar
 */

import { ConnectionStatus } from './connection-status';

export function TopBar() {
  return (
    <div
      className="flex items-center justify-between border-b px-4 py-2"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="text-sm font-bold tracking-tight"
          style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
        >
          CORTEX
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          v3
        </span>
      </div>

      <div className="flex items-center gap-4">
        <ConnectionStatus />
        <div className="flex items-center gap-2">
          <Kbd>N</Kbd>
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>New</span>
          <Kbd>⌘K</Kbd>
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Command</span>
          <Kbd>?</Kbd>
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Help</span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium"
      style={{
        borderColor: 'var(--border)',
        color: 'var(--text-secondary)',
        background: 'var(--bg-elevated)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {children}
    </kbd>
  );
}
