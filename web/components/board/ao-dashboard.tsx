'use client';

/**
 * AO Dashboard iframe with Framer Motion fullscreen toggle (press F).
 * Framer Motion use #4: fullscreen expand/collapse.
 * @module components/board/ao-dashboard
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../stores/ui-store';

interface AODashboardProps {
  sessionId: string | null;
}

export function AODashboard({ sessionId }: AODashboardProps) {
  const fullscreen = useUIStore((s) => s.aoFullscreen);
  const toggle = useUIStore((s) => s.toggleAoFullscreen);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle]);

  if (!sessionId) return null;

  return (
    <AnimatePresence>
      <motion.div
        layout
        className={fullscreen
          ? 'fixed inset-0 z-50'
          : 'mt-3 overflow-hidden rounded-lg border'
        }
        style={{
          borderColor: fullscreen ? undefined : 'var(--border)',
          background: 'var(--bg-surface)',
        }}
        initial={false}
        animate={fullscreen
          ? { borderRadius: 0 }
          : { borderRadius: 10 }
        }
        transition={{ duration: 0.3 }}
      >
        {fullscreen && (
          <div
            className="flex items-center justify-between border-b px-4 py-2"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              AO Dashboard
            </span>
            <button
              type="button"
              onClick={toggle}
              className="rounded px-2 py-0.5 text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              Press F to exit
            </button>
          </div>
        )}
        <iframe
          src={`/ao-session/${sessionId}`}
          title="AO Dashboard"
          className="w-full border-0"
          style={{ height: fullscreen ? 'calc(100vh - 36px)' : '300px' }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
