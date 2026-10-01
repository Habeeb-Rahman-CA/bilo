import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession, mockInitialTasks } from './helpers/test-setup';

test.describe('Batch Operations E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
    await page.goto('/');

    // Switch to 02 BACKLOG view
    const backlogTab = page.locator('button.sidebar-tab-btn', { hasText: 'BACKLOG' }).first();
    if (await backlogTab.isVisible()) {
      await backlogTab.click();
    } else {
      const mobileBacklogTab = page.locator('button.bottom-tab-btn', { hasText: 'Backlog' }).first();
      await mobileBacklogTab.click();
    }
  });

  test('should display task list and select all tasks via header checkbox', async ({ page }) => {
    // Verify backlog table is rendered
    const tableContainer = page.locator('.backlog-table-container');
    await expect(tableContainer).toBeVisible();

    // Batch bar is initially hidden
    const batchBar = page.locator('.batch-bar');
    await expect(batchBar).not.toBeVisible();

    // Click select all checkbox in table header
    const selectAllCheckbox = page.locator('.table-header-row .cell-check input[type="checkbox"]');
    await selectAllCheckbox.click();

    // Batch selection bar should appear showing selected count
    await expect(batchBar).toBeVisible();
    const batchText = page.locator('.batch-text');
    await expect(batchText).toContainText(/3 tasks selected/i);
  });

  test('should batch update status to Done for selected tasks', async ({ page }) => {
    const selectAllCheckbox = page.locator('.table-header-row .cell-check input[type="checkbox"]');
    await selectAllCheckbox.click();

    const markDoneBtn = page.locator('.batch-actions button', { hasText: 'Mark Done' });
    await expect(markDoneBtn).toBeVisible();
    await markDoneBtn.click();

    // Verify tasks are marked completed / completed styling
    const taskRows = page.locator('.task-table-row');
    const firstRowSummary = taskRows.first().locator('.summary-text');
    await expect(firstRowSummary).toHaveClass(/completed/);
  });

  test('should batch update priority to Urgent for selected tasks', async ({ page }) => {
    const selectAllCheckbox = page.locator('.table-header-row .cell-check input[type="checkbox"]');
    await selectAllCheckbox.click();

    const setUrgentBtn = page.locator('.batch-actions button', { hasText: 'Set Urgent' });
    await expect(setUrgentBtn).toBeVisible();
    await setUrgentBtn.click();

    // Verify priority badges updated to urgent
    const priorityBadges = page.locator('.cell-priority .priority-badge');
    await expect(priorityBadges.first()).toHaveText(/urgent/i);
  });

  test('should clear selection when Clear Selection button is clicked', async ({ page }) => {
    const selectAllCheckbox = page.locator('.table-header-row .cell-check input[type="checkbox"]');
    await selectAllCheckbox.click();

    const batchBar = page.locator('.batch-bar');
    await expect(batchBar).toBeVisible();

    const clearBtn = page.locator('.batch-actions button', { hasText: 'Clear Selection' });
    await clearBtn.click();

    // Batch bar hides
    await expect(batchBar).not.toBeVisible();
  });
});
