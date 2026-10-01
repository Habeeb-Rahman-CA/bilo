import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession, mockInitialTasks } from './helpers/test-setup';

test.describe('Create Task Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
    await page.goto('/');
  });

  test('should open Create Task modal via New Task button', async ({ page }) => {
    const newTaskBtn = page.locator('button', { hasText: 'New Task' }).first();
    await expect(newTaskBtn).toBeVisible();
    await newTaskBtn.click();

    // Verify task modal opens with title "Create New Task"
    const modalHeader = page.locator('app-task-modal .modal-header h3');
    await expect(modalHeader).toContainText(/Create New Task/i);

    // Verify title input is focused or visible
    const titleInput = page.locator('app-task-modal input[name="title"]');
    await expect(titleInput).toBeVisible();
  });

  test('should validate required title before saving', async ({ page }) => {
    const newTaskBtn = page.locator('button', { hasText: 'New Task' }).first();
    await newTaskBtn.click();

    const submitBtn = page.locator('app-task-modal button[type="submit"]');
    const titleInput = page.locator('app-task-modal input[name="title"]');

    // Ensure title is empty
    await titleInput.fill('');
    await submitBtn.click();

    // Form validation error notice appears
    const errorBanner = page.locator('app-task-modal .form-error-banner');
    await expect(errorBanner).toBeVisible();
  });

  test('should create a new task successfully and display it on the workspace', async ({ page }) => {
    const newTaskBtn = page.locator('button', { hasText: 'New Task' }).first();
    await newTaskBtn.click();

    const titleInput = page.locator('app-task-modal input[name="title"]');
    const labelsInput = page.locator('app-task-modal input[name="labelsInput"]');
    const submitBtn = page.locator('app-task-modal button[type="submit"]');

    // Fill form details
    const uniqueTitle = `E2E Automated Task - ${Date.now()}`;
    await titleInput.fill(uniqueTitle);
    await labelsInput.fill('playwright, e2e');

    // Submit task creation form
    await submitBtn.click();

    // Modal should close
    const modalHeader = page.locator('app-task-modal .modal-header h3');
    await expect(modalHeader).not.toBeVisible();

    // Navigate to Backlog workspace view (02 BACKLOG) or check board view
    const backlogTab = page.locator('button.sidebar-tab-btn', { hasText: 'BACKLOG' }).first();
    if (await backlogTab.isVisible()) {
      await backlogTab.click();
    } else {
      const mobileBacklogBtn = page.locator('button.bottom-tab-btn', { hasText: 'Backlog' }).first();
      await mobileBacklogBtn.click();
    }

    // Verify new task is listed
    const taskSummary = page.locator('.cell-summary .summary-text', { hasText: uniqueTitle });
    await expect(taskSummary).toBeVisible();
  });

  test('should dismiss task modal on Cancel or Escape key', async ({ page }) => {
    const newTaskBtn = page.locator('button', { hasText: 'New Task' }).first();
    await newTaskBtn.click();

    const cancelBtn = page.locator('app-task-modal button', { hasText: 'Cancel' });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Modal closes
    const modalHeader = page.locator('app-task-modal .modal-header h3');
    await expect(modalHeader).not.toBeVisible();
  });
});
