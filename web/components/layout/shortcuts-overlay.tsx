'use client';

/**
 * Keyboard shortcuts overlay — triggered by ? key.
 * @module components/layout/shortcuts-overlay
 */

import { Kbd } from '../shared/kbd';

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['N'],          desc: 'Focus chat input (new brief)' },
  { keys: ['⌘', 'K'],    desc: 'Command palette' },
  { keys: ['Enter'],      desc: 'Sign off (when brief focused)' },
  { keys: ['Escape'],     desc: 'Cancel / close / deselect' },
  { keys: ['F'],          desc: 'Fullscreen AO Dashboard' },
  { keys: ['1', '-', '9'],desc: 'Select task by position' },
  { keys: ['R'],          desc: 'Retry failed task' },
  { keys: ['S'],          desc: 'Sleep/wake toggle' },
  { keys: ['?'],          desc: 'Show this overlay' },
];

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative w-full max-w-[360px] rounded-xl border p-6"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Keyboard Shortcuts
        </h2>
        <div className="space-y-2.5">
          {SHORTCUTS.map((s) => (
            <div key={s.desc} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {s.desc}
              </span>
              <div className="flex items-center gap-0.5">
                {s.keys.map((k) =>
                  k === '-' ? (
                    <span key={k} className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>-</span>
                  ) : (
                    <Kbd key={k}>{k}</Kbd>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full min-h-[44px] rounded-lg border py-2 text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
