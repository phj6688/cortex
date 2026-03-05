/**
 * E2E: Task Decomposer — session lifecycle, retry, skip, edit, regression.
 * Tests the full decomposer flow via API-level Playwright tests.
 * @module e2e/decomposer-flow
 */

import { test, expect } from '@playwright/test';

const API = 'http://localhost:3481';

// ── Helpers ──

async function createTask(request: any, title: string, complexity: string = 'large') {
  const res = await request.post(`${API}/trpc/task.create`, {
    data: {
      '0': {
        title,
        raw_input: title,
        project_id: 'prj_ops_homelab',
        priority: 1,
      },
    },
  });
  const body = await res.json();
  const task = body[0].result.data;

  // Set brief with estimated_complexity
  const brief = JSON.stringify({
    objective: title,
    estimated_complexity: complexity,
    acceptance_criteria: ['Tests pass', 'No regressions'],
  });
  await request.post(`${API}/trpc/task.update`, {
    data: { '0': { id: task.id, brief } },
  });

  return task.id;
}

async function advanceToApproved(request: any, taskId: string) {
  await request.post(`${API}/trpc/task.updateState`, {
    data: { '0': { id: taskId, state: 'refined' } },
  });
  await request.post(`${API}/trpc/task.updateState`, {
    data: { '0': { id: taskId, state: 'pending_approval' } },
  });
  await request.post(`${API}/trpc/task.updateState`, {
    data: { '0': { id: taskId, state: 'approved' } },
  });
}

async function advanceToDecomposed(request: any, taskId: string) {
  // Move task to dispatched state (simulating decomposer completed)
  await request.post(`${API}/trpc/task.updateState`, {
    data: { '0': { id: taskId, state: 'auditing' } },
  });
  await request.post(`${API}/trpc/task.updateState`, {
    data: { '0': { id: taskId, state: 'decomposing' } },
  });
  await request.post(`${API}/trpc/task.updateState`, {
    data: { '0': { id: taskId, state: 'dispatched' } },
  });
}

async function seedSession(request: any, data: {
  id: string;
  task_id: string;
  session_number: number;
  title: string;
  state?: string;
  prompt?: string;
  verification?: string;
  regression?: string;
}) {
  const res = await request.post(`${API}/trpc/task._seedSession`, {
    data: { '0': data },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json())[0].result.data;
}

async function updateSession(request: any, id: string, updates: Record<string, any>) {
  const res = await request.post(`${API}/trpc/task._updateSession`, {
    data: { '0': { id, ...updates } },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json())[0].result.data;
}

async function seedVerdict(request: any, data: {
  id: string;
  task_id: string;
  file_path: string;
  verdict: string;
  reason: string;
  patch_details?: string | null;
}) {
  const res = await request.post(`${API}/trpc/task._seedVerdict`, {
    data: { '0': data },
  });
  expect(res.ok()).toBeTruthy();
}

async function getSessions(request: any, taskId: string) {
  const res = await request.post(`${API}/trpc/task.sessions`, {
    data: { '0': { taskId } },
  });
  return (await res.json())[0].result.data;
}

async function getTask(request: any, taskId: string) {
  const res = await request.post(`${API}/trpc/task.get`, {
    data: { '0': { id: taskId } },
  });
  return (await res.json())[0].result.data;
}

async function getVerdicts(request: any, taskId: string) {
  const res = await request.post(`${API}/trpc/task.auditVerdicts`, {
    data: { '0': { taskId } },
  });
  return (await res.json())[0].result.data;
}

// ── Test Scenarios ──

test.describe('1. Happy Path — Large Task Decomposer Flow', () => {
  let taskId: string;

  test('create large task and advance to approved', async ({ request }) => {
    taskId = await createTask(request, 'Rebuild auth module with OAuth2 support', 'large');
    await advanceToApproved(request, taskId);

    const task = await getTask(request, taskId);
    expect(task.state).toBe('approved');
    expect(task.approved_at).toBeTruthy();
  });

  test('transition through auditing → decomposing → dispatched', async ({ request }) => {
    await advanceToDecomposed(request, taskId);

    const task = await getTask(request, taskId);
    expect(task.state).toBe('dispatched');
  });

  test('seed audit verdicts', async ({ request }) => {
    await seedVerdict(request, {
      id: `aud_test_v1`,
      task_id: taskId,
      file_path: 'src/auth/login.ts',
      verdict: 'patch',
      reason: 'Missing OAuth2 provider integration',
      patch_details: 'Add OAuth2 strategy pattern',
    });
    await seedVerdict(request, {
      id: `aud_test_v2`,
      task_id: taskId,
      file_path: 'src/auth/session.ts',
      verdict: 'rewrite',
      reason: 'Session management incompatible with OAuth2 tokens',
    });
    await seedVerdict(request, {
      id: `aud_test_v3`,
      task_id: taskId,
      file_path: 'src/auth/types.ts',
      verdict: 'keep',
      reason: 'Types are compatible',
    });

    const verdicts = await getVerdicts(request, taskId);
    expect(verdicts).toHaveLength(3);
    expect(verdicts.map((v: any) => v.verdict).sort()).toEqual(['keep', 'patch', 'rewrite']);
  });

  test('seed 3 sessions and verify ordering', async ({ request }) => {
    await seedSession(request, {
      id: 'ses_hp_s1',
      task_id: taskId,
      session_number: 1,
      title: 'OAuth2 provider integration',
      prompt: 'Implement OAuth2 provider interface',
      verification: JSON.stringify(['pnpm test -- --grep oauth']),
    });
    await seedSession(request, {
      id: 'ses_hp_s2',
      task_id: taskId,
      session_number: 2,
      title: 'Session management rewrite',
      prompt: 'Rewrite session management for OAuth2 tokens',
      verification: JSON.stringify(['pnpm test -- --grep session']),
      regression: JSON.stringify(['pnpm test -- --grep oauth']),
    });
    await seedSession(request, {
      id: 'ses_hp_s3',
      task_id: taskId,
      session_number: 3,
      title: 'Integration tests',
      prompt: 'Write integration tests for OAuth2 flow',
      verification: JSON.stringify(['pnpm test:e2e']),
      regression: JSON.stringify(['pnpm test -- --grep oauth', 'pnpm test -- --grep session']),
    });

    const sessions = await getSessions(request, taskId);
    expect(sessions).toHaveLength(3);
    expect(sessions[0].session_number).toBe(1);
    expect(sessions[1].session_number).toBe(2);
    expect(sessions[2].session_number).toBe(3);
    expect(sessions[0].state).toBe('pending');
  });

  test('session 1 passes verification', async ({ request }) => {
    await updateSession(request, 'ses_hp_s1', {
      state: 'passed',
      verification_output: 'All 5 OAuth tests passed',
      completed_at: Math.floor(Date.now() / 1000),
      cost_usd: 0.15,
    });

    const sessions = await getSessions(request, taskId);
    expect(sessions[0].state).toBe('passed');
    expect(sessions[0].cost_usd).toBe(0.15);
  });

  test('session 2 passes verification', async ({ request }) => {
    await updateSession(request, 'ses_hp_s2', {
      state: 'passed',
      verification_output: 'Session management tests: 8/8 passed',
      completed_at: Math.floor(Date.now() / 1000),
      cost_usd: 0.22,
    });

    const sessions = await getSessions(request, taskId);
    expect(sessions[1].state).toBe('passed');
  });

  test('session 3 passes → task done', async ({ request }) => {
    await updateSession(request, 'ses_hp_s3', {
      state: 'passed',
      verification_output: 'E2E tests: all passed',
      completed_at: Math.floor(Date.now() / 1000),
      cost_usd: 0.10,
    });

    // Mark task done since all sessions passed
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'running' } },
    });
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'done' } },
    });

    const task = await getTask(request, taskId);
    expect(task.state).toBe('done');
    expect(task.completed_at).toBeTruthy();

    // All sessions passed
    const sessions = await getSessions(request, taskId);
    const allPassed = sessions.every((s: any) => s.state === 'passed');
    expect(allPassed).toBe(true);
  });

  test('verify event timeline has all transitions', async ({ request }) => {
    const res = await request.post(`${API}/trpc/task.events`, {
      data: { '0': { taskId } },
    });
    const events = (await res.json())[0].result.data;
    expect(events.length).toBeGreaterThanOrEqual(6);

    const types = events.map((e: any) => e.event_type);
    expect(types).toContain('created');
    expect(types).toContain('state_changed');
  });
});

test.describe('2. Failure + Retry — Session fails then retries with context', () => {
  let taskId: string;

  test('setup: create task with sessions', async ({ request }) => {
    taskId = await createTask(request, 'Add caching layer to API', 'large');
    await advanceToApproved(request, taskId);
    await advanceToDecomposed(request, taskId);

    await seedSession(request, {
      id: 'ses_retry_s1',
      task_id: taskId,
      session_number: 1,
      title: 'Cache interface',
      state: 'passed',
      prompt: 'Implement cache interface',
    });
    await seedSession(request, {
      id: 'ses_retry_s2',
      task_id: taskId,
      session_number: 2,
      title: 'Redis adapter',
      state: 'failed',
      prompt: 'Implement Redis cache adapter',
    });
  });

  test('session 2 is failed with reason', async ({ request }) => {
    await updateSession(request, 'ses_retry_s2', {
      failure_reason: 'Redis connection timeout in tests',
      verification_output: 'FAIL: redis.test.ts - Connection refused',
    });

    const sessions = await getSessions(request, taskId);
    const s2 = sessions.find((s: any) => s.id === 'ses_retry_s2');
    expect(s2.state).toBe('failed');
    expect(s2.failure_reason).toBe('Redis connection timeout in tests');
  });

  test('retry session 2 via API', async ({ request }) => {
    const res = await request.post(`${API}/trpc/task.retrySession`, {
      data: { '0': { sessionId: 'ses_retry_s2' } },
    });
    expect(res.ok()).toBeTruthy();

    const body = (await res.json())[0].result.data;
    expect(body.state).toBe('ready');
    expect(body.retry_count).toBe(1);
  });

  test('retried session succeeds on second attempt', async ({ request }) => {
    await updateSession(request, 'ses_retry_s2', {
      state: 'passed',
      verification_output: 'All Redis adapter tests passed (with mock)',
      failure_reason: null,
      completed_at: Math.floor(Date.now() / 1000),
      cost_usd: 0.18,
    });

    const sessions = await getSessions(request, taskId);
    const s2 = sessions.find((s: any) => s.id === 'ses_retry_s2');
    expect(s2.state).toBe('passed');
    expect(s2.retry_count).toBe(1);
  });
});

test.describe('3. Regression Failure — Session 3 breaks Session 1', () => {
  let taskId: string;

  test('setup: 3 sessions, first two passed', async ({ request }) => {
    taskId = await createTask(request, 'Refactor database layer', 'large');
    await advanceToApproved(request, taskId);
    await advanceToDecomposed(request, taskId);

    await seedSession(request, {
      id: 'ses_reg_s1',
      task_id: taskId,
      session_number: 1,
      title: 'Connection pool',
      state: 'passed',
      prompt: 'Implement connection pooling',
      verification: JSON.stringify(['pnpm test -- --grep pool']),
    });
    await seedSession(request, {
      id: 'ses_reg_s2',
      task_id: taskId,
      session_number: 2,
      title: 'Query builder',
      state: 'passed',
      prompt: 'Implement query builder',
      verification: JSON.stringify(['pnpm test -- --grep query']),
      regression: JSON.stringify(['pnpm test -- --grep pool']),
    });
    await seedSession(request, {
      id: 'ses_reg_s3',
      task_id: taskId,
      session_number: 3,
      title: 'Migration system',
      state: 'pending',
      prompt: 'Implement migration system',
      verification: JSON.stringify(['pnpm test -- --grep migrate']),
      regression: JSON.stringify(['pnpm test -- --grep pool', 'pnpm test -- --grep query']),
    });
  });

  test('session 3 fails due to regression in session 1 checks', async ({ request }) => {
    await updateSession(request, 'ses_reg_s3', {
      state: 'failed',
      failure_reason: 'Regression: pool tests broke — connection pool closed prematurely during migration',
      verification_output: 'FAIL: pool.test.ts\n  Connection pool closed unexpectedly\n  Expected pool.size to be 5, got 0',
    });

    const sessions = await getSessions(request, taskId);
    const s3 = sessions.find((s: any) => s.id === 'ses_reg_s3');
    expect(s3.state).toBe('failed');
    expect(s3.failure_reason).toContain('Regression');
    expect(s3.failure_reason).toContain('pool');
  });

  test('session 3 shows which prior checks broke', async ({ request }) => {
    const sessions = await getSessions(request, taskId);
    const s3 = sessions.find((s: any) => s.id === 'ses_reg_s3');

    // Regression field should contain session 1's verification
    const regression = JSON.parse(s3.regression);
    expect(regression).toContain('pnpm test -- --grep pool');
    expect(regression).toContain('pnpm test -- --grep query');
    expect(s3.verification_output).toContain('pool.test.ts');
  });

  test('retry after regression fix', async ({ request }) => {
    // Retry session 3
    const retryRes = await request.post(`${API}/trpc/task.retrySession`, {
      data: { '0': { sessionId: 'ses_reg_s3' } },
    });
    expect(retryRes.ok()).toBeTruthy();

    const retried = (await retryRes.json())[0].result.data;
    expect(retried.state).toBe('ready');
    expect(retried.retry_count).toBe(1);

    // Now it passes
    await updateSession(request, 'ses_reg_s3', {
      state: 'passed',
      verification_output: 'All tests passed including regression checks',
      failure_reason: null,
      completed_at: Math.floor(Date.now() / 1000),
    });

    const sessions = await getSessions(request, taskId);
    const s3 = sessions.find((s: any) => s.id === 'ses_reg_s3');
    expect(s3.state).toBe('passed');
  });
});

test.describe('4. Small Task — No Decomposition', () => {
  test('small task goes directly to approved (no auditing/decomposing)', async ({ request }) => {
    const taskId = await createTask(request, 'Fix the typo in the README', 'trivial');

    // Move to pending_approval
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'refined' } },
    });
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'pending_approval' } },
    });

    // Approve via the approve mutation (not updateState)
    const approveRes = await request.post(`${API}/trpc/task.approve`, {
      data: { '0': { id: taskId } },
    });
    expect(approveRes.ok()).toBeTruthy();

    const task = (await approveRes.json())[0].result.data;
    expect(task.state).toBe('approved');

    // No sessions should exist (no decomposer triggered)
    const sessions = await getSessions(request, taskId);
    expect(sessions).toHaveLength(0);

    // No audit verdicts
    const verdicts = await getVerdicts(request, taskId);
    expect(verdicts).toHaveLength(0);
  });

  test('small task dispatches directly via AO path', async ({ request }) => {
    const taskId = await createTask(request, 'Add console.log for debugging', 'small');

    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'refined' } },
    });
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'pending_approval' } },
    });
    await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'approved' } },
    });

    // Direct dispatch (approved → dispatched)
    const dispatchRes = await request.post(`${API}/trpc/task.updateState`, {
      data: { '0': { id: taskId, state: 'dispatched', ao_session_id: `ao_small_${Date.now()}` } },
    });
    expect(dispatchRes.ok()).toBeTruthy();

    const task = (await dispatchRes.json())[0].result.data;
    expect(task.state).toBe('dispatched');

    // Webhook done
    const aoId = task.ao_session_id;
    await request.post(`${API}/api/ao-events`, {
      data: { sessionId: aoId, event: 'started', payload: {} },
    });
    await request.post(`${API}/api/ao-events`, {
      data: { sessionId: aoId, event: 'done', payload: {} },
    });

    const final = await getTask(request, taskId);
    expect(final.state).toBe('done');
  });
});

test.describe('5. Skip Session — Failed session skipped, next continues', () => {
  let taskId: string;

  test('setup: 4 sessions, session 2 fails', async ({ request }) => {
    taskId = await createTask(request, 'Implement notification system', 'large');
    await advanceToApproved(request, taskId);
    await advanceToDecomposed(request, taskId);

    await seedSession(request, {
      id: 'ses_skip_s1',
      task_id: taskId,
      session_number: 1,
      title: 'Notification model',
      state: 'passed',
      prompt: 'Create notification data model',
    });
    await seedSession(request, {
      id: 'ses_skip_s2',
      task_id: taskId,
      session_number: 2,
      title: 'Email provider',
      state: 'failed',
      prompt: 'Implement email notification provider',
    });
    await seedSession(request, {
      id: 'ses_skip_s3',
      task_id: taskId,
      session_number: 3,
      title: 'Push notifications',
      state: 'pending',
      prompt: 'Implement push notification provider',
    });
    await seedSession(request, {
      id: 'ses_skip_s4',
      task_id: taskId,
      session_number: 4,
      title: 'Notification API',
      state: 'pending',
      prompt: 'Build notification REST API',
    });

    await updateSession(request, 'ses_skip_s2', {
      failure_reason: 'SMTP configuration invalid',
    });
  });

  test('skip session 2', async ({ request }) => {
    const res = await request.post(`${API}/trpc/task.skipSession`, {
      data: { '0': { sessionId: 'ses_skip_s2' } },
    });
    expect(res.ok()).toBeTruthy();

    const skipped = (await res.json())[0].result.data;
    expect(skipped.state).toBe('skipped');
    expect(skipped.completed_at).toBeTruthy();
  });

  test('session 3 can proceed after skip', async ({ request }) => {
    // Session 3 dispatches and passes
    await updateSession(request, 'ses_skip_s3', {
      state: 'passed',
      verification_output: 'Push notification tests: 4/4 passed',
      completed_at: Math.floor(Date.now() / 1000),
    });

    const sessions = await getSessions(request, taskId);
    expect(sessions[0].state).toBe('passed');   // s1
    expect(sessions[1].state).toBe('skipped');   // s2
    expect(sessions[2].state).toBe('passed');    // s3
    expect(sessions[3].state).toBe('pending');   // s4
  });

  test('session 4 passes, verify final state', async ({ request }) => {
    await updateSession(request, 'ses_skip_s4', {
      state: 'passed',
      verification_output: 'API tests: all passed',
      completed_at: Math.floor(Date.now() / 1000),
    });

    const sessions = await getSessions(request, taskId);
    const passed = sessions.filter((s: any) => s.state === 'passed').length;
    const skipped = sessions.filter((s: any) => s.state === 'skipped').length;
    expect(passed).toBe(3);
    expect(skipped).toBe(1);
  });

  test('cannot skip a non-failed/non-pending session', async ({ request }) => {
    const res = await request.post(`${API}/trpc/task.skipSession`, {
      data: { '0': { sessionId: 'ses_skip_s1' } },
    });
    // Should fail — session 1 is already passed
    expect(res.ok()).toBeFalsy();
  });
});

test.describe('6. Edit Session Prompt — Modify and re-dispatch', () => {
  let taskId: string;

  test('setup: session fails, needs prompt edit', async ({ request }) => {
    taskId = await createTask(request, 'Build search feature', 'large');
    await advanceToApproved(request, taskId);
    await advanceToDecomposed(request, taskId);

    await seedSession(request, {
      id: 'ses_edit_s1',
      task_id: taskId,
      session_number: 1,
      title: 'Search index',
      state: 'failed',
      prompt: 'Implement search index using Elasticsearch',
    });

    await updateSession(request, 'ses_edit_s1', {
      failure_reason: 'Elasticsearch not available, use SQLite FTS5 instead',
    });
  });

  test('edit session prompt', async ({ request }) => {
    const newPrompt = 'Implement search index using SQLite FTS5 (full-text search)';
    const res = await request.post(`${API}/trpc/task.updateSessionPrompt`, {
      data: { '0': { sessionId: 'ses_edit_s1', prompt: newPrompt } },
    });
    expect(res.ok()).toBeTruthy();

    const updated = (await res.json())[0].result.data;
    expect(updated.prompt).toBe(newPrompt);
    expect(updated.state).toBe('ready');
  });

  test('edited session dispatches and succeeds', async ({ request }) => {
    await updateSession(request, 'ses_edit_s1', {
      state: 'passed',
      verification_output: 'FTS5 search tests: 6/6 passed',
      failure_reason: null,
      completed_at: Math.floor(Date.now() / 1000),
      cost_usd: 0.12,
    });

    const sessions = await getSessions(request, taskId);
    expect(sessions[0].state).toBe('passed');
    expect(sessions[0].prompt).toBe('Implement search index using SQLite FTS5 (full-text search)');
  });

  test('cannot edit a passed session', async ({ request }) => {
    const res = await request.post(`${API}/trpc/task.updateSessionPrompt`, {
      data: { '0': { sessionId: 'ses_edit_s1', prompt: 'new prompt' } },
    });
    expect(res.ok()).toBeFalsy();
  });

  test('can edit a pending session', async ({ request }) => {
    await seedSession(request, {
      id: 'ses_edit_s2',
      task_id: taskId,
      session_number: 2,
      title: 'Search API',
      state: 'pending',
      prompt: 'Build search API endpoints',
    });

    const res = await request.post(`${API}/trpc/task.updateSessionPrompt`, {
      data: { '0': { sessionId: 'ses_edit_s2', prompt: 'Build search API with pagination and filters' } },
    });
    expect(res.ok()).toBeTruthy();

    const updated = (await res.json())[0].result.data;
    expect(updated.prompt).toBe('Build search API with pagination and filters');
    expect(updated.state).toBe('ready');
  });
});
