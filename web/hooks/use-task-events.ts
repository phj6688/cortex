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

    function connect() {
      if (destroyed) return;
      es = new EventSource(`${apiBase}/api/events`);

      es.onopen = () => {
        reconnectDelay.current = 100;
        setStatus('connected');
      };

      es.onerror = () => {
        es.close();
        setStatus('reconnecting');
        if (!destroyed) {
          setTimeout(connect, reconnectDelay.current);
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 5000);
        }
      };

      es.addEventListener('task_state_changed', (e) => {
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.list.invalidate();
        utils.task.get.invalidate({ id: taskId });
      });

      es.addEventListener('task_created', () => {
        utils.task.list.invalidate();
      });

      es.addEventListener('cost_update', (e) => {
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.get.invalidate({ id: taskId });
        utils.metrics.summary.invalidate();
      });

      es.addEventListener('comment_added', (e) => {
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.get.invalidate({ id: taskId });
      });

      es.addEventListener('session_state_changed', (e) => {
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.get.invalidate({ id: taskId });
        utils.task.sessions.invalidate({ taskId });
      });

      es.addEventListener('audit_complete', (e) => {
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.get.invalidate({ id: taskId });
        utils.task.auditVerdicts.invalidate({ taskId });
      });

      es.addEventListener('verification_result', (e) => {
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        utils.task.sessions.invalidate({ taskId });
      });
    }

    connect();
    return () => {
      destroyed = true;
      es?.close();
      setStatus('disconnected');
    };
  }, [utils, setStatus]);
}
