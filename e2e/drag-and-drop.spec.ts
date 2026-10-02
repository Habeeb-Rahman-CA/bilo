import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession, mockInitialTasks } from './helpers/test-setup';

test.describe('Kanban Board Drag-and-Drop E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Reset seed tasks before each test so tests are isolated and independent
    await setupAuthenticatedSession(page, mockInitialTasks, '03 TASKS');
    await page.goto('/#tasks');
  });

  test('should display Kanban Board columns and initial tasks', async ({ page }) => {
    // Verify Kanban board header is active
    const headerTitle = page.locator('.view-header-title');
    await expect(headerTitle).toContainText(/Kanban Board/i);

    // Verify task columns exist
    const todoCol = page.locator('#col-wf-todo-proj-e2e-1');
    const inProgressCol = page.locator('#col-wf-in-progress-proj-e2e-1');
    await expect(todoCol).toBeVisible();
    await expect(inProgressCol).toBeVisible();

    // Verify initial task cards are rendered in their respective columns
    const taskCard1 = todoCol.locator('.task-card', { hasText: 'E2E Refactor Authentication Flow' });
    await expect(taskCard1).toBeVisible();
  });

  test('should move task between status columns via quick status select', async ({ page }) => {
    const todoCol = page.locator('#col-wf-todo-proj-e2e-1');
    const taskCard = todoCol.locator('.task-card', { hasText: 'E2E Refactor Authentication Flow' });
    await expect(taskCard).toBeVisible();

    // Change status using card's quick status selector
    const statusSelect = taskCard.locator('.mobile-status-select');
    await statusSelect.selectOption('In Progress');

    // Verify task has moved to In Progress column container
    const inProgressCol = page.locator('#col-wf-in-progress-proj-e2e-1');
    const movedCard = inProgressCol.locator('.task-card', { hasText: 'E2E Refactor Authentication Flow' });
    await expect(movedCard).toBeVisible();
  });

  test('should move task card to Done column via status selector', async ({ page }) => {
    const inProgressCol = page.locator('#col-wf-in-progress-proj-e2e-1');
    const taskCard = inProgressCol.locator('.task-card', { hasText: 'E2E Fix Drag and Drop Board Animation' });
    await expect(taskCard).toBeVisible();

    // Move from In Progress to Done status
    const statusSelect = taskCard.locator('.mobile-status-select');
    await statusSelect.selectOption('Done');

    // Verify task card appears under Done column container
    const doneCol = page.locator('#col-wf-done-proj-e2e-1');
    const movedCard = doneCol.locator('.task-card', { hasText: 'E2E Fix Drag and Drop Board Animation' });
    await expect(movedCard).toBeVisible();
  });
});
