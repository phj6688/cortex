'use client';

/**
 * App shell — wires command bar, keyboard shortcuts, overlays, error boundaries.
 * @module components/canvas/app-shell
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { BriefPanel } from './brief-panel';
import { MissionBoard } from './mission-board';
import { CommandBar } from './command-bar';
import { TopBar } from '../layout/top-bar';
import { ShortcutsOverlay } from '../layout/shortcuts-overlay';
import { ErrorBoundary } from '../shared/error-boundary';
import { ProjectWizard } from '../projects/project-wizard';
import { useKeyboard } from '../../hooks/use-keyboard';
import { useConnectionStore } from '../../stores/connection-store';

export function AppShell() {
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [projectWizardOpen, setProjectWizardOpen] = useState(false);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // SSE disconnect toast (failure case #3)
  const prevStatus = useRef('disconnected');
  const status = useConnectionStore((s) => s.status);
  useEffect(() => {
    if (status === 'reconnecting' && prevStatus.current === 'connected') {
      toast.warning('Connection lost — action may not have saved');
    }
    prevStatus.current = status;
  }, [status]);

  const focusChatInput = useCallback(() => {
    chatInputRef.current?.focus();
  }, []);

  const toggleShortcuts = useCallback(() => {
    setShortcutsOpen((p) => !p);
  }, []);

  useKeyboard({
    focusChatInput,
    openCommandBar: () => setCommandBarOpen(true),
    toggleShortcuts,
  });

  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            fontFamily: 'var(--font-sans)',
          },
        }}
      />

      <div className="flex h-screen w-screen flex-col overflow-hidden">
        <TopBar />
        <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '40% 60%' }}>
          {/* LEFT: Brief Panel — 40% */}
          <ErrorBoundary fallbackTitle="Brief panel error">
            <div className="min-w-[360px] overflow-y-auto brief-panel">
              <BriefPanel chatInputRef={chatInputRef} />
            </div>
          </ErrorBoundary>

          {/* RIGHT: Mission Board — 60% */}
          <ErrorBoundary fallbackTitle="Mission board error">
            <div className="overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
              <MissionBoard />
            </div>
          </ErrorBoundary>
        </div>
      </div>

      <CommandBar
        open={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        onFocusChatInput={focusChatInput}
        onToggleShortcuts={toggleShortcuts}
        onOpenProjectWizard={() => setProjectWizardOpen(true)}
      />

      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {projectWizardOpen && (
        <ProjectWizard onClose={() => setProjectWizardOpen(false)} />
      )}
    </>
  );
}
