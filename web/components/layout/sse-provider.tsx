'use client';

/**
 * SSE subscription provider — mounts useTaskEvents at app root.
 * @module components/layout/sse-provider
 */

import { useTaskEvents } from '../../hooks/use-task-events';

export function SSEProvider({ children }: { children: React.ReactNode }) {
  useTaskEvents();
  return <>{children}</>;
}
