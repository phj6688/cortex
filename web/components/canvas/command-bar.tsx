'use client';

/**
 * Command palette — cmdk. All commands from spec.
 * @module components/canvas/command-bar
 */

import { Command } from 'cmdk';
import { useUIStore } from '../../stores/ui-store';
import { Kbd } from '../shared/kbd';

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
  onFocusChatInput: () => void;
  onToggleShortcuts: () => void;
  onOpenProjectWizard?: () => void;
  onManageProjects?: () => void;
}

export function CommandBar({ open, onClose, onFocusChatInput, onToggleShortcuts, onOpenProjectWizard, onManageProjects }: CommandBarProps) {
  const toggleAoFullscreen = useUIStore((s) => s.toggleAoFullscreen);
  const setFilter = useUIStore((s) => s.setFilter);
  const selectedTaskId = useUIStore((s) => s.selectedTaskId);

  const run = (action: () => void) => {
    onClose();
    // Defer to allow dialog close animation
    requestAnimationFrame(action);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />

      {/* Dialog */}
      <div
        className="relative w-full max-w-[480px] overflow-hidden rounded-xl border"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command palette" className="[&_[cmdk-input]]:border-b [&_[cmdk-input]]:border-[var(--border)]">
          <Command.Input
            autoFocus
            placeholder="Type a command..."
            className="w-full bg-transparent px-4 py-3 text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
              No commands found
            </Command.Empty>

            <CommandItem
              onSelect={() => run(onFocusChatInput)}
              shortcut="N"
            >
              New Brief
            </CommandItem>

            <CommandItem
              onSelect={() => run(() => {
                if (selectedTaskId) {
                  document.dispatchEvent(new CustomEvent('cortex:retry', { detail: { taskId: selectedTaskId } }));
                }
              })}
              shortcut="R"
            >
              Retry Failed Task
            </CommandItem>

            <CommandItem
              onSelect={() => run(() => {
                if (selectedTaskId) {
                  document.dispatchEvent(new CustomEvent('cortex:sleep-toggle', { detail: { taskId: selectedTaskId } }));
                }
              })}
              shortcut="S"
            >
              Sleep/Wake Task
            </CommandItem>

            <CommandItem
              onSelect={() => run(toggleAoFullscreen)}
              shortcut="F"
            >
              Toggle AO Dashboard
            </CommandItem>

            {onManageProjects && (
              <CommandItem onSelect={() => run(onManageProjects)} shortcut="P">
                Manage Projects
              </CommandItem>
            )}

            {onOpenProjectWizard && (
              <CommandItem onSelect={() => run(onOpenProjectWizard)}>
                Add Project
              </CommandItem>
            )}

            <CommandItem onSelect={() => run(() => setFilter('active'))}>
              Show Active Tasks
            </CommandItem>

            <CommandItem onSelect={() => run(() => setFilter('failed'))}>
              Show Failed Tasks
            </CommandItem>

            <CommandItem onSelect={() => run(() => setFilter('all'))}>
              Show All Tasks
            </CommandItem>

            <CommandItem
              onSelect={() => run(onToggleShortcuts)}
              shortcut="?"
            >
              Keyboard Shortcuts
            </CommandItem>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function CommandItem({
  children,
  shortcut,
  onSelect,
}: {
  children: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex min-h-[44px] cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors data-[selected=true]:bg-white/5"
      style={{ color: 'var(--text-primary)' }}
    >
      <span>{children}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </Command.Item>
  );
}
