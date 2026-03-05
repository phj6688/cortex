'use client';

/**
 * SSE subscription hook — typed events, 100ms initial reconnect, 2x backoff, max 5000ms.
 * Invalidates specific TanStack Query keys per event type (NOT all queries).
 * @module hooks/use-task-events
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '../stores/connection-store';

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

type SSEPayload =
  | TaskCreatedEvent
  | TaskStateChangedEvent
  | CostUpdateEvent
  | CommentAddedEvent;

function parseEvent(data: string): SSEPayload | null {
  try {
    return JSON.parse(data) as SSEPayload;
  } catch {
    return null;
  }
}

export function useTaskEvents() {
  const reconnectDelay = useRef(100);
  const queryClient = useQueryClient();
  const setStatus = useConnectionStore((s) => s.setStatus);

  useEffect(() => {
    let es: EventSource;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      es = new EventSource('/api/events');

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
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      });

      es.addEventListener('task_created', () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      });

      es.addEventListener('cost_update', (e) => {
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        queryClient.invalidateQueries({ queryKey: ['task', taskId] });
        queryClient.invalidateQueries({ queryKey: ['metrics'] });
      });

      es.addEventListener('comment_added', (e) => {
        const parsed = parseEvent(e.data);
        if (!parsed) return;
        const { taskId } = parsed.data as { taskId: string };
        queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      });
    }

    connect();
    return () => {
      destroyed = true;
      es?.close();
      setStatus('disconnected');
    };
  }, [queryClient, setStatus]);
}
