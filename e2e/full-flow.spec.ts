/**
 * E2E: Full path — brief → sign off → AO webhook → Mission Complete.
 * Tests the entire task lifecycle end-to-end.
 * @module e2e/full-flow
 */

import { test, expect } from '@playwright/test';

const API = 'http://localhost:3481';

test.describe('Full Task Lifecycle', () => {
  let taskId: string;

  test('create task via API', async ({ request }) => {
    const res = await request.post(`${API}/trpc/task.create`, {
      data: {
        '0': {
          title: 'E2E Test Task',
          raw_input: 'Fix the login button on the dashboard',
          project_id: 'prj_ops_homelab',
          priority: 1,
        },
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    taskId = body[0].result.data.id;
    expect(taskId).toMatch(/^tsk_/);
  });

  test('refine brief (set brief text)', async ({ request }) => {
    // Simulate refinement by updating brief directly
    const res = await request.post(`${API}/trpc/task.update`, {
      data: {
        '0': {
          id: taskId,
          brief: '## Objective\nFix the login button.\n\n## Acceptance Criteria\n- Button works on click\n- Loading state shows spinner',
        },
      },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('transition draft → refined', async ({ request }) => {
    const res = await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'refined' } },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body[0].result.data.state).toBe('refined');
  });

  test('transition refined → pending_approval', async ({ request }) => {
    const res = await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'pending_approval' } },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body[0].result.data.state).toBe('pending_approval');
  });

  test('sign off: pending_approval → approved', async ({ request }) => {
    const res = await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'approved' } },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body[0].result.data.state).toBe('approved');
  });

  test('simulate dispatch: approved → dispatched', async ({ request }) => {
    // Directly set state since AO isn't available in test
    const res = await request.post(`${API}/trpc/task.updateState`, {
      data: {
        '0': {
          id: taskId,
          state: 'dispatched',
          ao_session_id: `ao_test_${Date.now()}`,
        },
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body[0].result.data.state).toBe('dispatched');
  });

  test('AO webhook: started → running', async ({ request }) => {
    const task = await (await request.post(`${API}/trpc/task.get`, {
      data: { '0': { id: taskId } },
    })).json();
    const aoSessionId = task[0].result.data.ao_session_id;

    const res = await request.post(`${API}/api/ao-events`, {
      data: {
        sessionId: aoSessionId,
        event: 'started',
        payload: {},
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify task is now running
    const updated = await (await request.post(`${API}/trpc/task.get`, {
      data: { '0': { id: taskId } },
    })).json();
    expect(updated[0].result.data.state).toBe('running');
  });

  test('AO webhook: pr-opened (with URL)', async ({ request }) => {
    const task = await (await request.post(`${API}/trpc/task.get`, {
      data: { '0': { id: taskId } },
    })).json();
    const aoSessionId = task[0].result.data.ao_session_id;

    const res = await request.post(`${API}/api/ao-events`, {
      data: {
        sessionId: aoSessionId,
        event: 'pr-opened',
        payload: { url: 'https://github.com/org/repo/pull/42' },
      },
    });
    expect(res.ok()).toBeTruthy();

    const updated = await (await request.post(`${API}/trpc/task.get`, {
      data: { '0': { id: taskId } },
    })).json();
    expect(updated[0].result.data.ao_pr_url).toBe('https://github.com/org/repo/pull/42');
  });

  test('AO webhook: done → Mission Complete', async ({ request }) => {
    const task = await (await request.post(`${API}/trpc/task.get`, {
      data: { '0': { id: taskId } },
    })).json();
    const aoSessionId = task[0].result.data.ao_session_id;

    const res = await request.post(`${API}/api/ao-events`, {
      data: {
        sessionId: aoSessionId,
        event: 'done',
        payload: {},
      },
    });
    expect(res.ok()).toBeTruthy();

    // Verify terminal state
    const updated = await (await request.post(`${API}/trpc/task.get`, {
      data: { '0': { id: taskId } },
    })).json();
    expect(updated[0].result.data.state).toBe('done');
    expect(updated[0].result.data.completed_at).toBeTruthy();
  });

  test('verify full event timeline', async ({ request }) => {
    const res = await request.post(`${API}/trpc/task.events`, {
      data: { '0': { taskId } },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const events = body[0].result.data;

    // Should have: created, state_changed (×3), dispatched, ao_update (started), pr_opened, done
    expect(events.length).toBeGreaterThanOrEqual(7);

    const types = events.map((e: { event_type: string }) => e.event_type);
    expect(types).toContain('created');
    expect(types).toContain('state_changed');
    expect(types).toContain('done');
  });
});

test.describe('AO Webhook Error Handling', () => {
  test('rejects unknown session', async ({ request }) => {
    const res = await request.post(`${API}/api/ao-events`, {
      data: {
        sessionId: 'nonexistent_session',
        event: 'started',
        payload: {},
      },
    });
    expect(res.status()).toBe(404);
  });

  test('rejects unknown event type', async ({ request }) => {
    // First create a task with ao_session_id
    const createRes = await request.post(`${API}/trpc/task.create`, {
      data: {
        '0': {
          title: 'Webhook Error Test',
          raw_input: 'test',
          project_id: 'prj_ops_homelab',
        },
      },
    });
    const task = (await createRes.json())[0].result.data;

    // Set up the task to dispatched state
    await request.post(`${API}/trpc/task.update`, {
      data: { '0': { id: task.id, brief: 'test brief' } },
    });
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: task.id, state: 'refined' } },
    });
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: task.id, state: 'pending_approval' } },
    });
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: task.id, state: 'approved' } },
    });
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: task.id, state: 'dispatched', ao_session_id: 'test_webhook_err' } },
    });

    const res = await request.post(`${API}/api/ao-events`, {
      data: {
        sessionId: 'test_webhook_err',
        event: 'invalid_event_type',
        payload: {},
      },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects invalid payload', async ({ request }) => {
    const res = await request.post(`${API}/api/ao-events`, {
      data: { bad: 'data' },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Failure Scenarios', () => {
  test('ci-failed webhook marks task as failed', async ({ request }) => {
    const createRes = await request.post(`${API}/trpc/task.create`, {
      data: {
        '0': {
          title: 'CI Fail Test',
          raw_input: 'test ci failure',
          project_id: 'prj_ops_homelab',
        },
      },
    });
    const task = (await createRes.json())[0].result.data;

    // Move through states
    await request.post(`${API}/trpc/task.update`, { data: { '0': { id: task.id, brief: 'test brief' } } });
    await request.post(`${API}/trpc/task.updateState`, { data: { '0': { id: task.id, state: 'refined' } } });
    await request.post(`${API}/trpc/task.updateState`, { data: { '0': { id: task.id, state: 'pending_approval' } } });
    await request.post(`${API}/trpc/task.updateState`, { data: { '0': { id: task.id, state: 'approved' } } });
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: task.id, state: 'dispatched', ao_session_id: 'ci_fail_test' } },
    });

    // Send started
    await request.post(`${API}/api/ao-events`, {
      data: { sessionId: 'ci_fail_test', event: 'started', payload: {} },
    });

    // Send ci-failed
    const res = await request.post(`${API}/api/ao-events`, {
      data: {
        sessionId: 'ci_fail_test',
        event: 'ci-failed',
        payload: { reason: 'Tests failed: 3 failures' },
      },
    });
    expect(res.ok()).toBeTruthy();

    const updated = await (await request.post(`${API}/trpc/task.get`, {
      data: { '0': { id: task.id } },
    })).json();
    expect(updated[0].result.data.state).toBe('failed');
    expect(updated[0].result.data.failure_reason).toBe('Tests failed: 3 failures');
  });
});
