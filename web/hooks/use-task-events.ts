'use client';

/**
 * SSE subscription hook — typed events, 100ms initial reconnect, 2x backoff, max 5000ms.
 * Invalidates specific TanStack Query keys per event type (NOT all queries).
 * @module hooks/use-task-events
 */

import { useEffect, useRef } from 'react';
import { useConnectionStore } from '../stores/connection-store';
import { trpc } from '../lib/trpc';

interface TaskCreatedEvent {
  type: 'task_created';
  data: { taskId: string };
}

interface TaskStateChangedEvent {
  type: 'task_state_changed';
  data: { taskId: string; from: string; to: string };
}

interface CostUpdateEvent {
  type: 'cost_update';
  data: { taskId: string; cost_usd: number };
}

interface CommentAddedEvent {
  type: 'comment_added';
  data: { taskId: string; commentId: string };
}

interface SessionStateChangedEvent {
  type: 'session_state_changed';
  data: { taskId: string; sessionId: string; state: string };
}

interface AuditCompleteEvent {
  type: 'audit_complete';
  data: { taskId: string; summary: Record<string, number> };
}

interface VerificationResultEvent {
  type: 'verification_result';
  data: { taskId: string; sessionId: string; passed: boolean };
}

type SSEPayload =
  | TaskCreatedEvent
  | TaskStateChangedEvent
  | CostUpdateEvent
  | CommentAddedEvent
  | SessionStateChangedEvent
  | AuditCompleteEvent
  | VerificationResultEvent;

function parseEvent(data: string): SSEPayload | null {
  try {
    return JSON.parse(data) as SSEPayload;
  } catch {
    return null;
  }
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

export function useTaskEvents() {
  const reconnectDelay = useRef(100);
  const utils = trpc.useUtils();
  const setStatus = useConnectionStore((s) => s.setStatus);

  useEffect(() => {
    let es: EventSource;
    let destroyed = false;
    let watchdog: ReturnType<typeof setTimeout>;

    function connect() {
      if (destroyed) return;

      function resetWatchdog() {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          es.close();
          setStatus('reconnecting');
          if (!destroyed) {
            setTimeout(connect, reconnectDelay.current);
            reconnectDelay.current = Math.min(reconnectDelay.current * 2, 5000);
          }
        }, 20_000);
      }

      es = new EventSource(`${apiBase}/api/events`);

      es.onopen = () => {
        reconnectDelay.current = 100;
        setStatus('connected');
        resetWatchdog();
      };

      es.onerror = () => {
        es.close();
        clearTimeout(watchdog);
        setStatus('reconnecting');
        if (!destroyed) {
          setTimeout(connect, reconnectDelay.current);
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 5000);
        }
      };

      es.addEventListener('heartbeat', () => {
        resetWatchdog();
      });

      es.addEventListener('task_state_changed', (e) => {
        resetWatchdog();
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.list.invalidate();
        utils.task.get.invalidate({ id: taskId });
      });

      es.addEventListener('task_created', () => {
        resetWatchdog();
        utils.task.list.invalidate();
      });

      es.addEventListener('cost_update', (e) => {
        resetWatchdog();
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.get.invalidate({ id: taskId });
        utils.metrics.summary.invalidate();
      });

      es.addEventListener('comment_added', (e) => {
        resetWatchdog();
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.get.invalidate({ id: taskId });
      });

      es.addEventListener('session_state_changed', (e) => {
        resetWatchdog();
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.get.invalidate({ id: taskId });
        utils.task.sessions.invalidate({ taskId });
      });

      es.addEventListener('audit_complete', (e) => {
        resetWatchdog();
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.get.invalidate({ id: taskId });
        utils.task.auditVerdicts.invalidate({ taskId });
      });

      es.addEventListener('verification_result', (e) => {
        resetWatchdog();
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.sessions.invalidate({ taskId });
      });
    }

    connect();
    return () => {
      destroyed = true;
      clearTimeout(watchdog);
      es?.close();
      setStatus('disconnected');
    };
  }, [utils, setStatus]);
}
