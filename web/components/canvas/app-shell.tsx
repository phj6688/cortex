'use client';

/**
 * App shell — wires command bar, keyboard shortcuts, overlays, error boundaries.
 * @module components/canvas/app-shell
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Toaster } from 'sonner';
import * as notify from '../../lib/notify';
import { BriefPanel } from './brief-panel';
import { MissionBoard } from './mission-board';
import { CommandBar } from './command-bar';
import { TopBar } from '../layout/top-bar';
import { ShortcutsOverlay } from '../layout/shortcuts-overlay';
import { ErrorBoundary } from '../shared/error-boundary';
import { ProjectWizard } from '../projects/project-wizard';
import { ProjectListPanel } from '../projects/project-list-panel';
import { useKeyboard } from '../../hooks/use-keyboard';
import { useConnectionStore } from '../../stores/connection-store';
import { useUIStore } from '../../stores/ui-store';
import { usePageTitle } from '../../hooks/use-page-title';
import { useMediaQuery } from '../../hooks/use-media-query';

export function AppShell() {
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [projectWizardOpen, setProjectWizardOpen] = useState(false);
  const [projectListOpen, setProjectListOpen] = useState(false);
  const [highlightProjectId, setHighlightProjectId] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  usePageTitle();

  const isMobile = useMediaQuery('(max-width: 767px)');
  const mobileTab = useUIStore((s) => s.mobileTab);
  const setMobileTab = useUIStore((s) => s.setMobileTab);

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
      notify.warn('Connection lost — action may not have saved');
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
          classNames: {
            success: 'toast-success',
            error: 'toast-error',
          },
        }}
      />

      <div className="flex h-screen w-screen flex-col overflow-hidden">
        <TopBar />
        {isMobile ? (
          <>
            <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={() => setMobileTab('brief')}
                className="flex-1 py-2 text-xs font-medium transition-colors"
                style={{
                  color: mobileTab === 'brief' ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: mobileTab === 'brief' ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                Brief
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('board')}
                className="flex-1 py-2 text-xs font-medium transition-colors"
                style={{
                  color: mobileTab === 'board' ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: mobileTab === 'board' ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                Board
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {mobileTab === 'brief' ? (
                <ErrorBoundary fallbackTitle="Brief panel error">
                  <div className="brief-panel h-full overflow-y-auto">
                    <BriefPanel chatInputRef={chatInputRef} />
                  </div>
                </ErrorBoundary>
              ) : (
                <ErrorBoundary fallbackTitle="Mission board error">
                  <div className="h-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                    <MissionBoard onFocusChatInput={() => { setMobileTab('brief'); focusChatInput(); }} />
                  </div>
                </ErrorBoundary>
              )}
            </div>
          </>
        ) : (
          <div className="app-grid grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '40% 60%' }}>
            <ErrorBoundary fallbackTitle="Brief panel error">
              <div className="brief-panel min-w-[360px] overflow-y-auto">
                <BriefPanel chatInputRef={chatInputRef} />
              </div>
            </ErrorBoundary>
            <ErrorBoundary fallbackTitle="Mission board error">
              <div className="mission-panel overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                <MissionBoard onFocusChatInput={focusChatInput} />
              </div>
            </ErrorBoundary>
          </div>
        )}
      </div>

      <CommandBar
        open={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        onFocusChatInput={focusChatInput}
        onToggleShortcuts={toggleShortcuts}
        onOpenProjectWizard={() => setProjectWizardOpen(true)}
        onManageProjects={() => setProjectListOpen(true)}
      />

      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {projectWizardOpen && (
        <ProjectWizard
          onClose={() => setProjectWizardOpen(false)}
          onCreated={() => {
            setProjectWizardOpen(false);
            setProjectListOpen(true);
          }}
        />
      )}

      {projectListOpen && (
        <ProjectListPanel
          onClose={() => { setProjectListOpen(false); setHighlightProjectId(null); }}
          onAddProject={() => { setProjectListOpen(false); setProjectWizardOpen(true); }}
          highlightId={highlightProjectId}
        />
      )}
    </>
  );
}
