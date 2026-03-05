'use client';

/**
 * Global keyboard shortcuts — ALL from spec.
 * N, ⌘K, Enter, Esc, F, R, S, ?, 1-9
 * @module hooks/use-keyboard
 */

import { useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/ui-store';

interface KeyboardActions {
  focusChatInput: () => void;
  openCommandBar: () => void;
  toggleShortcuts: () => void;
}

export function useKeyboard(actions: KeyboardActions) {
  const selectTask = useUIStore((s) => s.selectTask);
  const toggleAoFullscreen = useUIStore((s) => s.toggleAoFullscreen);
  const setFilter = useUIStore((s) => s.setFilter);
  const selectedTaskId = useUIStore((s) => s.selectedTaskId);

  const handler = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

    // ⌘K / Ctrl+K — command palette (works even in inputs)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      actions.openCommandBar();
      return;
    }

    // Skip if in input field for remaining shortcuts
    if (inInput) return;

    switch (e.key) {
      case 'n':
      case 'N':
        e.preventDefault();
        actions.focusChatInput();
        break;
      case 'Escape':
        e.preventDefault();
        selectTask(null);
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleAoFullscreen();
        break;
      case 'r':
      case 'R':
        // Retry handled by task-actions — dispatch custom event
        if (selectedTaskId) {
          document.dispatchEvent(new CustomEvent('cortex:retry', { detail: { taskId: selectedTaskId } }));
        }
        break;
      case 's':
      case 'S':
        // Sleep/wake handled by task-actions
        if (selectedTaskId) {
          document.dispatchEvent(new CustomEvent('cortex:sleep-toggle', { detail: { taskId: selectedTaskId } }));
        }
        break;
      case '?':
        e.preventDefault();
        actions.toggleShortcuts();
        break;
      default:
        // 1-9: select task by position
        if (e.key >= '1' && e.key <= '9') {
          const idx = Number.parseInt(e.key, 10) - 1;
          document.dispatchEvent(new CustomEvent('cortex:select-by-index', { detail: { index: idx } }));
        }
        break;
    }
  }, [actions, selectTask, toggleAoFullscreen, setFilter, selectedTaskId]);

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
}
