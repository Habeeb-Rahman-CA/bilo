# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: create-task.spec.ts >> Create Task Flow E2E >> should open Create Task modal via New Task button
- Location: e2e/create-task.spec.ts:10:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button').filter({ hasText: 'New Task' }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('button').filter({ hasText: 'New Task' }).first() with timeout 10000ms
  - waiting for locator('button').filter({ hasText: 'New Task' }).first()

```

```yaml
- banner:
  - img "bilo Logo"
  - button "Light Mode"
- main:
  - text: RLS ISOLATED WORKSPACE
  - heading "Developer Project & Kanban Hub" [level=1]
  - paragraph: Minimalist personal workspace with backlog, custom workflows, offline PWA sync, and row-level security.
  - text: User-based data isolation & project ownership Today focus metrics & interactive Kanban board Supabase Authentication & Row Level Security
  - button "Sign In"
  - button "Create Account"
  - heading "Welcome Back" [level=2]
  - paragraph: Sign in to access your projects and Today dashboard
  - text: EMAIL ADDRESS
  - textbox "developer@example.com"
  - text: PASSWORD
  - textbox "••••••••••••"
  - button "Toggle password visibility"
  - button "Sign In & Enter Workspace" [disabled]
  - text: Don't have an account? Create one now
- contentinfo: bilo Developer Workspace • Built with Supabase RLS & Angular
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { setupAuthenticatedSession, mockInitialTasks } from './helpers/test-setup';
  3  | 
  4  | test.describe('Create Task Flow E2E', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await setupAuthenticatedSession(page);
  7  |     await page.goto('/');
  8  |   });
  9  | 
  10 |   test('should open Create Task modal via New Task button', async ({ page }) => {
  11 |     const newTaskBtn = page.locator('button', { hasText: 'New Task' }).first();
> 12 |     await expect(newTaskBtn).toBeVisible();
     |                              ^ Error: expect(locator).toBeVisible() failed
  13 |     await newTaskBtn.click();
  14 | 
  15 |     // Verify task modal opens with title "Create New Task"
  16 |     const modalHeader = page.locator('app-task-modal .modal-header h3');
  17 |     await expect(modalHeader).toContainText(/Create New Task/i);
  18 | 
  19 |     // Verify title input is focused or visible
  20 |     const titleInput = page.locator('app-task-modal input[name="title"]');
  21 |     await expect(titleInput).toBeVisible();
  22 |   });
  23 | 
  24 |   test('should validate required title before saving', async ({ page }) => {
  25 |     const newTaskBtn = page.locator('button', { hasText: 'New Task' }).first();
  26 |     await newTaskBtn.click();
  27 | 
  28 |     const submitBtn = page.locator('app-task-modal button[type="submit"]');
  29 |     const titleInput = page.locator('app-task-modal input[name="title"]');
  30 | 
  31 |     // Ensure title is empty
  32 |     await titleInput.fill('');
  33 |     await submitBtn.click();
  34 | 
  35 |     // Form validation error notice appears
  36 |     const errorBanner = page.locator('app-task-modal .form-error-banner');
  37 |     await expect(errorBanner).toBeVisible();
  38 |   });
  39 | 
  40 |   test('should create a new task successfully and display it on the workspace', async ({ page }) => {
  41 |     const newTaskBtn = page.locator('button', { hasText: 'New Task' }).first();
  42 |     await newTaskBtn.click();
  43 | 
  44 |     const titleInput = page.locator('app-task-modal input[name="title"]');
  45 |     const labelsInput = page.locator('app-task-modal input[name="labelsInput"]');
  46 |     const submitBtn = page.locator('app-task-modal button[type="submit"]');
  47 | 
  48 |     // Fill form details
  49 |     const uniqueTitle = `E2E Automated Task - ${Date.now()}`;
  50 |     await titleInput.fill(uniqueTitle);
  51 |     await labelsInput.fill('playwright, e2e');
  52 | 
  53 |     // Submit task creation form
  54 |     await submitBtn.click();
  55 | 
  56 |     // Modal should close
  57 |     const modalHeader = page.locator('app-task-modal .modal-header h3');
  58 |     await expect(modalHeader).not.toBeVisible();
  59 | 
  60 |     // Navigate to Backlog workspace view (02 BACKLOG) or check board view
  61 |     const backlogTab = page.locator('button.sidebar-tab-btn', { hasText: 'BACKLOG' }).first();
  62 |     if (await backlogTab.isVisible()) {
  63 |       await backlogTab.click();
  64 |     } else {
  65 |       const mobileBacklogBtn = page.locator('button.bottom-tab-btn', { hasText: 'Backlog' }).first();
  66 |       await mobileBacklogBtn.click();
  67 |     }
  68 | 
  69 |     // Verify new task is listed
  70 |     const taskSummary = page.locator('.cell-summary .summary-text', { hasText: uniqueTitle });
  71 |     await expect(taskSummary).toBeVisible();
  72 |   });
  73 | 
  74 |   test('should dismiss task modal on Cancel or Escape key', async ({ page }) => {
  75 |     const newTaskBtn = page.locator('button', { hasText: 'New Task' }).first();
  76 |     await newTaskBtn.click();
  77 | 
  78 |     const cancelBtn = page.locator('app-task-modal button', { hasText: 'Cancel' });
  79 |     await expect(cancelBtn).toBeVisible();
  80 |     await cancelBtn.click();
  81 | 
  82 |     // Modal closes
  83 |     const modalHeader = page.locator('app-task-modal .modal-header h3');
  84 |     await expect(modalHeader).not.toBeVisible();
  85 |   });
  86 | });
  87 | 
```