import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession, mockInitialTasks } from './helpers/test-setup';

test.describe('Kanban Board Drag-and-Drop E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
    await page.goto('/');

    // Switch to 03 TASKS (Kanban Board) view
    const boardTab = page.locator('button.sidebar-tab-btn', { hasText: 'TASKS' }).first();
    if (await boardTab.isVisible()) {
      await boardTab.click();
    } else {
      const mobileBoardTab = page.locator('button.bottom-tab-btn', { hasText: 'Board' }).first();
      await mobileBoardTab.click();
    }
  });

  test('should display Kanban Board columns and initial tasks', async ({ page }) => {
    // Verify Kanban board header
    const headerTitle = page.locator('.view-header-title');
    await expect(headerTitle).toContainText(/Kanban Board/i);

    // Verify task columns exist
    const todoCol = page.locator('#col-col-todo');
    const inProgressCol = page.locator('#col-col-in-progress');
    await expect(todoCol).toBeVisible();
    await expect(inProgressCol).toBeVisible();

    // Verify initial task cards are rendered in their respective columns
    const taskCard1 = page.locator('.task-card', { hasText: 'E2E Refactor Authentication Flow' });
    await expect(taskCard1).toBeVisible();
  });

  test('should move task between status columns via status select', async ({ page }) => {
    const taskCard = page.locator('.task-card', { hasText: 'E2E Refactor Authentication Flow' });
    await expect(taskCard).toBeVisible();

    // Change status using card's quick status selector
    const statusSelect = taskCard.locator('.mobile-status-select');
    await statusSelect.selectOption('In Progress');

    // Verify task has moved to In Progress column container
    const inProgressCol = page.locator('#col-col-in-progress');
    const movedCard = inProgressCol.locator('.task-card', { hasText: 'E2E Refactor Authentication Flow' });
    await expect(movedCard).toBeVisible();
  });

  test('should move task card using drag handle dragTo method', async ({ page }) => {
    const taskCard = page.locator('.task-card', { hasText: 'E2E Refactor Authentication Flow' });
    const dragHandle = taskCard.locator('.drag-grip-wrap');
    const targetColumn = page.locator('#col-col-done .column-cards');

    // Drag task card from To Do to Done column
    await dragHandle.dragTo(targetColumn);

    // Check if status updated to Done column
    const doneCol = page.locator('#col-col-done');
    const movedCard = doneCol.locator('.task-card', { hasText: 'E2E Refactor Authentication Flow' });
    await expect(movedCard).toBeVisible();
  });
});
