'use client';

/**
 * Keyboard shortcuts overlay — styled modal with two-column layout.
 * @module components/layout/shortcuts-overlay
 */

import { useEffect } from 'react';
import { Kbd } from '../shared/kbd';

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['N'],                    desc: 'New brief' },
  { keys: ['\u2318', 'K'],         desc: 'Command palette' },
  { keys: ['Enter'],               desc: 'Sign off brief' },
  { keys: ['Escape'],              desc: 'Close / deselect' },
  { keys: ['F'],                   desc: 'AO Dashboard fullscreen' },
  { keys: ['1', '\u2013', '9'],    desc: 'Select task by position' },
  { keys: ['R'],                   desc: 'Retry failed task' },
  { keys: ['S'],                   desc: 'Sleep / wake toggle' },
  { keys: ['?'],                   desc: 'This overlay' },
];

/**
 * Styled keyboard shortcuts modal — two-column layout, Esc to dismiss.
 * @param props - open state and close handler
 */
export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative w-full max-w-[400px] overflow-hidden rounded-xl border"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-xs transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-secondary)' }}
          >
            {'\u2715'}
          </button>
        </div>

        {/* Shortcut rows */}
        <div className="px-5 py-3">
          {SHORTCUTS.map((s) => (
            <div
              key={s.desc}
              className="flex items-center justify-between py-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {s.desc}
              </span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, i) =>
                  k === '\u2013' ? (
                    <span key={`sep-${i}`} className="px-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      {k}
                    </span>
                  ) : (
                    <Kbd key={`key-${i}`}>{k}</Kbd>
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-center text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            Press <Kbd>Esc</Kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
