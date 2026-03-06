'use client';

/**
 * Right 60% — task cards + filters + stats + detail panel.
 * @module components/canvas/mission-board
 */

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TaskList } from '../board/task-list';
import { TaskDetail } from '../board/task-detail';
import { TaskListSkeleton, TaskDetailSkeleton } from '../layout/skeleton';
import { useTasks } from '../../hooks/use-tasks';
import { useTaskStore } from '../../stores/task-store';
import { useUIStore, type FilterValue, type SortValue } from '../../stores/ui-store';
import { formatCost } from '../../lib/format';
import { trpc } from '../../lib/trpc';
import * as notify from '../../lib/notify';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'active',   label: 'Active' },
  { value: 'done',     label: 'Done' },
  { value: 'failed',   label: 'Failed' },
  { value: 'sleeping', label: 'Standing By' },
];

const SORTS: { value: SortValue; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'recent',   label: 'Recent' },
  { value: 'state',    label: 'State' },
];

interface MissionBoardProps {
  onFocusChatInput?: () => void;
}

export function MissionBoard({ onFocusChatInput }: MissionBoardProps) {
  const { isLoading } = useTasks();

  const tasks = useTaskStore((s) => s.tasks);
  const filter = useUIStore((s) => s.filter);
  const setFilter = useUIStore((s) => s.setFilter);
  const sort = useUIStore((s) => s.sort);
  const setSort = useUIStore((s) => s.setSort);
  const selectedTaskId = useUIStore((s) => s.selectedTaskId);

  const allTasks = Array.from(tasks.values());
  const totalCount = allTasks.length;
  const runningCount = allTasks.filter((t) => t.state === 'running').length;
  const failedCount = allTasks.filter((t) => t.state === 'failed').length;
  const doneCount = allTasks.filter((t) => t.state === 'done').length;
  const totalCost = allTasks.reduce((sum, t) => sum + t.cost_usd, 0);

  const utils = trpc.useUtils();
  const [confirmBulk, setConfirmBulk] = useState<'done' | 'failed' | null>(null);
  const bulkDelete = trpc.task.bulkDelete.useMutation({
    onSuccess: (data) => {
      utils.task.list.invalidate();
      utils.project.list.invalidate();
      notify.success(`Deleted ${data.deleted} tasks`);
      setConfirmBulk(null);
    },
    onError: (err) => { notify.error(`Bulk delete failed: ${err.message}`); setConfirmBulk(null); },
  });

  return (
    <div className="flex h-full flex-col">
      {/* Filter + Sort bar */}
      <div
        className="flex flex-wrap items-center gap-3 border-b px-4 py-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className="rounded px-2 py-1 text-xs font-medium transition-colors"
              style={{
                background: filter === f.value ? 'var(--accent-glow)' : 'transparent',
                color: filter === f.value ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span style={{ color: 'var(--border)' }}>|</span>

        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sort:</span>
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSort(s.value)}
              className="rounded px-2 py-1 text-xs font-medium transition-colors"
              style={{
                background: sort === s.value ? 'var(--accent-glow)' : 'transparent',
                color: sort === s.value ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {(failedCount > 0 || doneCount > 0) && (
          <>
            <span style={{ color: 'var(--border)' }}>|</span>
            <div className="flex items-center gap-1">
              {failedCount > 0 && (
                <button
                  type="button"
                  onClick={() => confirmBulk === 'failed' ? bulkDelete.mutate({ state: 'failed' }) : setConfirmBulk('failed')}
                  className="rounded px-2 py-1 text-xs font-medium transition-colors"
                  style={{ color: 'var(--danger)' }}
                >
                  {confirmBulk === 'failed' ? `Confirm Clear ${failedCount}` : `Clear ${failedCount} Failed`}
                </button>
              )}
              {doneCount > 0 && (
                <button
                  type="button"
                  onClick={() => confirmBulk === 'done' ? bulkDelete.mutate({ state: 'done' }) : setConfirmBulk('done')}
                  className="rounded px-2 py-1 text-xs font-medium transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {confirmBulk === 'done' ? `Confirm Clear ${doneCount}` : `Clear ${doneCount} Done`}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Task list + detail */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          selectedTaskId ? <TaskDetailSkeleton /> : <TaskListSkeleton />
        ) : (
          <AnimatePresence mode="popLayout">
            {selectedTaskId ? (
              <div key="detail" className="h-full overflow-y-auto p-4">
                <TaskDetail />
              </div>
            ) : (
              <TaskList key="list" onFocusChatInput={onFocusChatInput} />
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-4 border-t px-4 py-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <Stat label="Total" value={String(totalCount)} />
        <Stat label="Running" value={String(runningCount)} accent={runningCount > 0} />
        <Stat label="Cost" value={formatCost(totalCost)} />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}:</span>
      <span
        className="text-xs font-medium tabular-nums"
        style={{
          color: accent ? 'var(--accent)' : 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {value}
      </span>
    </div>
  );
}
