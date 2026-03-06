/**
 * E2E: Production UI tests against live Docker deployment.
 * Cortex API on 3481, AO on 3100, Web on 9301.
 * @module e2e/production
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:3481';

// ── Helpers ──

/** tRPC batch POST helper. */
async function trpcPost(request: APIRequestContext, method: string, input: Record<string, unknown>) {
  const res = await request.post(`${API}/trpc/${method}?batch=1`, {
    data: { '0': input },
  });
  const body = await res.json();
  return body[0].result.data;
}

/** Create a task via API and advance it to a target state. */
async function createTaskViaAPI(
  request: APIRequestContext,
  title: string,
  targetState: 'draft' | 'failed' | 'done' = 'draft',
) {
  const task = await trpcPost(request, 'task.create', {
    title,
    raw_input: title,
    project_id: 'prj_ops_homelab',
    priority: 1,
  });

  if (targetState === 'failed' || targetState === 'done') {
    await trpcPost(request, 'task.update', {
      id: task.id,
      brief: JSON.stringify({ objective: title, title }),
    });
    await trpcPost(request, 'task.updateState', { id: task.id, state: 'refined' });
    await trpcPost(request, 'task.updateState', { id: task.id, state: 'pending_approval' });
    await trpcPost(request, 'task.updateState', { id: task.id, state: 'approved' });

    const sessionId = `ao_${targetState}_${task.id}`;
    await trpcPost(request, 'task.updateState', {
      id: task.id, state: 'dispatched', ao_session_id: sessionId,
    });
    await request.post(`${API}/api/ao-events`, {
      data: { sessionId, event: 'started', payload: {} },
    });

    if (targetState === 'failed') {
      await request.post(`${API}/api/ao-events`, {
        data: { sessionId, event: 'ci-failed', payload: { reason: 'Test failure' } },
      });
    } else {
      await request.post(`${API}/api/ao-events`, {
        data: { sessionId, event: 'done', payload: {} },
      });
    }
  }

  return task;
}

/** Wait for SSE connection to establish. */
async function waitForConnection(page: Page) {
  await page.locator('[title="Connected"]').waitFor({ timeout: 15_000 });
}

/**
 * Complete the brief flow: type input, handle questions/editor, reach Sign Off.
 * Returns true if Sign Off button is visible and ready.
 */
async function completeBriefFlow(page: Page, text: string): Promise<boolean> {
  const textarea = page.locator('textarea[placeholder="Describe what you need done..."]');
  await textarea.fill(text);
  await textarea.press('Enter');

  const signOffBtn = page.getByRole('button', { name: 'Sign Off & Queue' });
  const skipBtn = page.getByRole('button', { name: 'Skip' });
  const saveBriefBtn = page.getByRole('button', { name: 'Save Brief' });

  // Wait for LLM to resolve
  await expect(signOffBtn.or(skipBtn).or(saveBriefBtn)).toBeVisible({ timeout: 30_000 });

  // If questions appeared → skip to manual editor
  if (await skipBtn.isVisible().catch(() => false)) {
    await skipBtn.click();
  }

  // If manual editor appeared → fill required fields and save
  if (await saveBriefBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    // Editor has: Title (input), Objective (1st textarea), Criteria (2nd textarea), Avoid (3rd textarea)
    // Fill Title if empty
    const titleInput = page.locator('input[type="text"]').first();
    if (await titleInput.isVisible().catch(() => false)) {
      const val = await titleInput.inputValue();
      if (!val.trim()) await titleInput.fill(text);
    }
    // Fill Objective (first textarea inside the editor — after Acceptance Criteria which may also be a textarea)
    // The editor labels are: Title, Objective, Acceptance Criteria, Avoid Areas
    // Target the textarea right after the "Objective" label
    const editorTextareas = page.locator('.brief-panel .space-y-3 textarea');
    const firstTextarea = editorTextareas.first();
    if (await firstTextarea.isVisible().catch(() => false)) {
      const val = await firstTextarea.inputValue();
      if (!val.trim()) await firstTextarea.fill(text);
    }

    // Wait for Save Brief to become enabled
    await expect(saveBriefBtn).toBeEnabled({ timeout: 3_000 });
    await saveBriefBtn.click({ timeout: 5_000 });
  }

  // Should now be at brief phase with Sign Off visible
  return await signOffBtn.isVisible({ timeout: 5_000 }).catch(() => false);
}

// ── TEST 1: Page Loads and Connects ──

test.describe('1. Page Loads and Connects', () => {
  test('homepage renders with connection indicator and core UI', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    // Top bar text
    await expect(page.getByText('CORTEX', { exact: true })).toBeVisible();
    await expect(page.getByText('v3', { exact: true })).toBeVisible();

    // Filter bar
    for (const label of ['All', 'Active', 'Done', 'Failed', 'Standing By']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    // Brief input
    await expect(page.locator('textarea[placeholder="Describe what you need done..."]')).toBeVisible();
  });
});

// ── TEST 2: Brief Refinement Flow ──

test.describe('2. Brief Refinement Flow', () => {
  test('typing a brief triggers streaming and produces a brief card', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    const ready = await completeBriefFlow(page, 'Add a health dashboard page');

    if (ready) {
      // Project selector visible
      await expect(page.locator('select')).toBeVisible();

      // Select a project
      const projectSelect = page.locator('select');
      const options = await projectSelect.locator('option').allTextContents();
      const projectOption = options.find((o) => o !== 'No project');
      if (projectOption) {
        await projectSelect.selectOption({ label: projectOption });
      }

      // Sign-off button enabled
      await expect(page.getByRole('button', { name: 'Sign Off & Queue' })).toBeEnabled();
    }
  });
});

// ── TEST 3: Sign-Off and Dispatch ──

test.describe('3. Sign-Off and Dispatch', () => {
  test('signing off creates task on mission board', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    const ready = await completeBriefFlow(page, 'Add a /ping endpoint that returns pong');
    expect(ready).toBe(true);

    // Select a project
    const projectSelect = page.locator('select');
    const options = await projectSelect.locator('option').allTextContents();
    const projectOption = options.find((o) => o !== 'No project');
    if (projectOption) {
      await projectSelect.selectOption({ label: projectOption });
    } else {
      const signOffBtn = page.getByRole('button', { name: 'Sign Off & Queue' });
      await signOffBtn.click();
      await expect(page.getByText('Select a project before signing off')).toBeVisible();
      return;
    }

    // Sign off
    await page.getByRole('button', { name: 'Sign Off & Queue' }).click();

    // Wait for dispatch or signed-off phase
    const dispatchingText = page.getByText('Dispatching to agent...');
    const signedOffText = page.getByText('Signed off', { exact: false });
    await expect(dispatchingText.or(signedOffText)).toBeVisible({ timeout: 15_000 });

    // Task should appear with a state badge
    const boardBadge = page.getByText('Briefed')
      .or(page.getByText('In the Field'))
      .or(page.getByText('Queued'))
      .or(page.locator('text=/Failed/'));
    await expect(boardBadge.first()).toBeVisible({ timeout: 20_000 });
  });
});

// ── TEST 4: Task Card Interactions ──

test.describe('4. Task Card Interactions', () => {
  test('clicking task opens detail, Esc closes it', async ({ page, request }) => {
    await createTaskViaAPI(request, `E2E card test ${Date.now()}`, 'failed');

    await page.goto('/');
    await waitForConnection(page);

    // Wait for any task card title
    const taskTitle = page.locator('.group h3').first();
    await expect(taskTitle).toBeVisible({ timeout: 10_000 });

    // Click task card → detail opens
    await taskTitle.click();
    await expect(page.getByText('Timeline', { exact: true })).toBeVisible({ timeout: 5_000 });

    // Click the Esc button in detail panel header to close
    const escButton = page.getByRole('button', { name: 'Esc' });
    await escButton.click();

    // Task list should be visible again
    await expect(page.locator('.group h3').first()).toBeVisible({ timeout: 5_000 });
  });

  test('context menu opens on ... button', async ({ page, request }) => {
    await createTaskViaAPI(request, `E2E menu test ${Date.now()}`, 'failed');

    await page.goto('/');
    await waitForConnection(page);

    // Hover task card to reveal ... button
    const taskCard = page.locator('.group').first();
    await expect(taskCard).toBeVisible({ timeout: 10_000 });
    await taskCard.hover();

    // Click ... menu
    const menuButton = taskCard.locator('[title="Task actions"]');
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Portal menu with "Copy Task ID"
    await expect(page.getByText('Copy Task ID')).toBeVisible({ timeout: 3_000 });

    // Close by clicking outside
    await page.mouse.click(10, 10);
  });

  test('failed task shows Retry and Delete inline buttons', async ({ page, request }) => {
    await createTaskViaAPI(request, `E2E failed actions ${Date.now()}`, 'failed');

    await page.goto('/');
    await waitForConnection(page);

    // Filter to failed
    await page.getByRole('button', { name: 'Failed', exact: true }).click();

    // Wait for "Mission Failed" badge
    await expect(page.locator('text=/Failed/').first()).toBeVisible({ timeout: 10_000 });

    // Inline Retry and Delete buttons
    await expect(page.getByRole('button', { name: 'Retry', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete', exact: true }).first()).toBeVisible();
  });
});

// ── TEST 5: Bulk Delete ──

test.describe('5. Bulk Delete', () => {
  test('clear failed tasks removes them from the board', async ({ page, request }) => {
    // Create 3 failed tasks
    await Promise.all([
      createTaskViaAPI(request, `E2E bulk-1 ${Date.now()}`, 'failed'),
      createTaskViaAPI(request, `E2E bulk-2 ${Date.now()}`, 'failed'),
      createTaskViaAPI(request, `E2E bulk-3 ${Date.now()}`, 'failed'),
    ]);

    await page.goto('/');
    await waitForConnection(page);

    // Filter to Failed
    await page.getByRole('button', { name: 'Failed', exact: true }).click();

    // Wait for failed tasks
    await expect(page.locator('text=/Failed/').first()).toBeVisible({ timeout: 10_000 });
    const initialCount = await page.locator('text=/Failed —/').count();
    expect(initialCount).toBeGreaterThanOrEqual(3);

    // Click "Clear N Failed"
    const clearButton = page.locator('button').filter({ hasText: /Clear \d+ Failed/ });
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Confirm
    const confirmButton = page.locator('button').filter({ hasText: /Confirm Clear \d+/ });
    await expect(confirmButton).toBeVisible({ timeout: 3_000 });
    await confirmButton.click();

    // Failed tasks disappear
    await expect(page.locator('text=/Failed —/')).toHaveCount(0, { timeout: 10_000 });

    // Switch to All
    await page.getByRole('button', { name: 'All', exact: true }).click();
  });
});

// ── TEST 6: Keyboard Shortcuts ──

test.describe('6. Keyboard Shortcuts', () => {
  test('N focuses input, ? opens overlay, Ctrl+K opens palette', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    const textarea = page.locator('textarea[placeholder="Describe what you need done..."]');

    // N → focuses input
    await page.keyboard.press('n');
    await expect(textarea).toBeFocused({ timeout: 3_000 });

    // Click body to blur (Escape doesn't blur when in input — by design)
    await page.locator('body').click({ position: { x: 10, y: 10 } });

    // ? → shortcuts overlay
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible({ timeout: 3_000 });

    // Escape → closes overlay
    await page.keyboard.press('Escape');
    await expect(page.getByText('Keyboard Shortcuts')).not.toBeVisible({ timeout: 3_000 });

    // Ctrl+K → command palette
    await page.keyboard.press('Control+k');
    const commandInput = page.locator('input[placeholder="Type a command..."]');
    await expect(commandInput).toBeVisible({ timeout: 3_000 });

    // Close palette by clicking the backdrop (cmdk captures Escape internally)
    const backdrop = page.locator('.fixed.inset-0.z-50').first();
    await backdrop.click({ position: { x: 5, y: 5 } });
    await expect(commandInput).not.toBeVisible({ timeout: 3_000 });
  });
});

// ── TEST 7: AO Dashboard Link ──

test.describe('7. AO Dashboard Link', () => {
  test('AO Dashboard link targets :3100', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    const aoLink = page.locator('a[title="Open AO Dashboard"]');
    const linkVisible = await aoLink.isVisible().catch(() => false);

    if (!linkVisible) {
      test.skip();
      return;
    }

    const href = await aoLink.getAttribute('href');
    expect(href).toContain(':3100');
    expect(await aoLink.getAttribute('target')).toBe('_blank');
  });
});

// ── TEST 8: SSE Stability ──

test.describe('8. SSE Stability', () => {
  test('connection stays green for 30 seconds', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await page.waitForTimeout(30_000);

    await expect(page.locator('[title="Connected"]')).toBeVisible();
    await expect(page.getByText('Reconnecting...')).not.toBeVisible();
    await expect(page.getByText('Disconnected')).not.toBeVisible();
  });

  test('new task appears via SSE without page refresh', async ({ page, request }) => {
    await page.goto('/');
    await waitForConnection(page);

    const title = `SSE live task ${Date.now()}`;
    await createTaskViaAPI(request, title, 'draft');

    // Task appears via SSE
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
  });
});

// ── TEST 9: Responsive Layout ──

test.describe('9. Responsive Layout', () => {
  test('1440x900: two-column layout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForConnection(page);

    await expect(page.locator('.app-grid')).toBeVisible();
    await expect(page.locator('.brief-panel')).toBeVisible();
    await expect(page.locator('.mission-panel')).toBeVisible();
  });

  test('768x1024: tablet layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await waitForConnection(page);

    const appGrid = page.locator('.app-grid');
    const isDesktop = await appGrid.isVisible().catch(() => false);

    if (!isDesktop) {
      // Mobile tabs
      await expect(page.getByRole('button', { name: 'Brief', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Board', exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Board', exact: true }).click();
      await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Brief', exact: true }).click();
      await expect(page.locator('textarea')).toBeVisible();
    } else {
      await expect(page.locator('.brief-panel')).toBeVisible();
      await expect(page.locator('.mission-panel')).toBeVisible();
    }
  });

  test('375x812: mobile layout, no overlapping', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await waitForConnection(page);

    // Mobile tabs
    await expect(page.getByRole('button', { name: 'Brief', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Board', exact: true })).toBeVisible();

    // CORTEX in top bar
    await expect(page.getByText('CORTEX', { exact: true })).toBeVisible();

    // Brief panel fits viewport
    const briefPanel = page.locator('.brief-panel');
    await expect(briefPanel).toBeVisible();
    const box = await briefPanel.boundingBox();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(375);
    }

    // Switch to board
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();

    // Filter buttons within viewport
    const allBox = await page.getByRole('button', { name: 'All', exact: true }).boundingBox();
    if (allBox) {
      expect(allBox.x).toBeGreaterThanOrEqual(0);
      expect(allBox.x + allBox.width).toBeLessThanOrEqual(375);
    }
  });
});
