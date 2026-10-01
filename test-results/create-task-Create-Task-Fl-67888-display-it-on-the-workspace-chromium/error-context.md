# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: create-task.spec.ts >> Create Task Flow E2E >> should create a new task successfully and display it on the workspace
- Location: e2e/create-task.spec.ts:40:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('button').filter({ hasText: 'New Task' }).first()

```

# Page snapshot

```yaml
- generic [ref=f1e4]:
  - banner [ref=f1e5]:
    - generic "bilo Developer Project Manager" [ref=f1e8]:
      - img "bilo Logo" [ref=f1e9]
    - button "Light Mode" [ref=f1e10] [cursor=pointer]
  - main [ref=f1e12]:
    - generic [ref=f1e13]:
      - generic [ref=f1e15]:
        - generic [ref=f1e16]: RLS ISOLATED WORKSPACE
        - heading "Developer Project & Kanban Hub" [level=1] [ref=f1e17]
        - paragraph [ref=f1e18]: Minimalist personal workspace with backlog, custom workflows, offline PWA sync, and row-level security.
        - generic [ref=f1e19]:
          - generic [ref=f1e20]: User-based data isolation & project ownership
          - generic [ref=f1e22]: Today focus metrics & interactive Kanban board
          - generic [ref=f1e24]: Supabase Authentication & Row Level Security
      - generic [ref=f1e26]:
        - generic [ref=f1e27]:
          - button "Sign In" [ref=f1e28] [cursor=pointer]
          - button "Create Account" [ref=f1e29] [cursor=pointer]
        - generic [ref=f1e30]:
          - heading "Welcome Back" [level=2] [ref=f1e31]
          - paragraph [ref=f1e32]: Sign in to access your projects and Today dashboard
        - generic [ref=f1e33]:
          - generic [ref=f1e34]:
            - generic [ref=f1e35]: EMAIL ADDRESS
            - textbox "developer@example.com" [ref=f1e37]
          - generic [ref=f1e38]:
            - generic [ref=f1e39]: PASSWORD
            - generic [ref=f1e40]:
              - textbox "••••••••••••" [ref=f1e41]
              - button "Toggle password visibility" [ref=f1e42] [cursor=pointer]
          - button "Sign In & Enter Workspace" [disabled] [ref=f1e43] [cursor=pointer]
        - generic [ref=f1e44]: Don't have an account? Create one now
  - contentinfo [ref=f1e46]: bilo Developer Workspace • Built with Supabase RLS & Angular
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
  12 |     await expect(newTaskBtn).toBeVisible();
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
> 42 |     await newTaskBtn.click();
     |                      ^ Error: locator.click: Test timeout of 60000ms exceeded.
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