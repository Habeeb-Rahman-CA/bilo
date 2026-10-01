import { Page } from '@playwright/test';

export const MOCK_USER_ID = 'e2e-user-123';
export const MOCK_USER_EMAIL = 'e2e-tester@bilo.app';

export const mockSession = {
  access_token: 'mock-e2e-access-token-jwt-payload',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-e2e-refresh-token',
  user: {
    id: MOCK_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: MOCK_USER_EMAIL,
    user_metadata: {
      display_name: 'E2E Tester'
    },
    app_metadata: { provider: 'email' }
  }
};

export const mockProfile = {
  id: MOCK_USER_ID,
  email: MOCK_USER_EMAIL,
  display_name: 'E2E Tester',
  avatar_url: null,
  updated_at: new Date().toISOString()
};

export const mockProjects = [
  {
    id: 'proj-e2e-1',
    user_id: MOCK_USER_ID,
    name: 'E2E Test Workspace',
    slug: 'e2e-test-workspace',
    description: 'Primary workspace for Playwright automated testing',
    status: 'active',
    color: '#06b6d4',
    icon: 'fi fi-rr-folder',
    labels: ['test', 'e2e'],
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z'
  }
];

export const mockWorkflows = [
  { id: 'wf-backlog-proj-e2e-1', project_id: 'proj-e2e-1', name: 'Backlog', color: '#64748b', position: 0, created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'wf-todo-proj-e2e-1', project_id: 'proj-e2e-1', name: 'To Do', color: '#3b82f6', position: 1, created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'wf-in-progress-proj-e2e-1', project_id: 'proj-e2e-1', name: 'In Progress', color: '#eab308', position: 2, created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'wf-in-review-proj-e2e-1', project_id: 'proj-e2e-1', name: 'In Review', color: '#a855f7', position: 3, created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'wf-done-proj-e2e-1', project_id: 'proj-e2e-1', name: 'Done', color: '#22c55e', position: 4, created_at: '2026-10-01T00:00:00.000Z' }
];

export const mockInitialTasks = [
  {
    id: 'task-e2e-1',
    user_id: MOCK_USER_ID,
    project_id: 'proj-e2e-1',
    task_number: 1,
    title: 'E2E Refactor Authentication Flow',
    description: 'Task for testing status updates and detail modal',
    type: 'task',
    status: 'To Do',
    priority: 'medium',
    assignee: 'Unassigned',
    labels: ['auth', 'core'],
    created_at: '2026-10-01T01:00:00.000Z',
    updated_at: '2026-10-01T01:00:00.000Z'
  },
  {
    id: 'task-e2e-2',
    user_id: MOCK_USER_ID,
    project_id: 'proj-e2e-1',
    task_number: 2,
    title: 'E2E Fix Drag and Drop Board Animation',
    description: 'Kanban board card drag and drop verification',
    type: 'bug',
    status: 'In Progress',
    priority: 'high',
    assignee: 'Unassigned',
    labels: ['kanban', 'bug'],
    created_at: '2026-10-01T02:00:00.000Z',
    updated_at: '2026-10-01T02:00:00.000Z'
  },
  {
    id: 'task-e2e-3',
    user_id: MOCK_USER_ID,
    project_id: 'proj-e2e-1',
    task_number: 3,
    title: 'E2E Verify Batch Operations Toolbar',
    description: 'Multi-select tasks and apply bulk status or priority updates',
    type: 'story',
    status: 'Backlog',
    priority: 'low',
    assignee: 'Unassigned',
    labels: ['batch'],
    created_at: '2026-10-01T03:00:00.000Z',
    updated_at: '2026-10-01T03:00:00.000Z'
  }
];

/**
 * Injects mock authenticated user state and seed data into browser localStorage
 * before navigation and intercepts Supabase REST endpoints.
 */
export async function setupAuthenticatedSession(page: Page, tasks = mockInitialTasks) {
  // Intercept Supabase Auth & REST API calls
  await page.route('**/auth/v1/session*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { session: mockSession }, error: null })
    });
  });

  await page.route('**/auth/v1/user*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSession.user)
    });
  });

  await page.route('**/rest/v1/projects*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProjects)
    });
  });

  await page.route('**/rest/v1/workflows*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockWorkflows)
    });
  });

  await page.route('**/rest/v1/tasks*', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tasks)
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    }
  });

  await page.route('**/rest/v1/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  const workflowsMap = { 'proj-e2e-1': mockWorkflows };

  // Inject localStorage items before page scripts evaluate
  await page.addInitScript(
    ({ session, uid, profile, projects, taskList, wfMap }) => {
      window.localStorage.setItem('sb-wjdeatxaljoazczehqlc-auth-token', JSON.stringify(session));
      window.localStorage.setItem(`bilo_user_profile_${uid}`, JSON.stringify(profile));
      window.localStorage.setItem(`bilo_projects_data_${uid}`, JSON.stringify({ projects, activities: [] }));
      window.localStorage.setItem(`bilo_tasks_data_${uid}`, JSON.stringify({ tasks: taskList, taskComments: {}, taskStatusHistory: {} }));
      window.localStorage.setItem(`bilo_workflows_by_project_${uid}`, JSON.stringify(wfMap));
      window.localStorage.setItem('bilo_workflows_by_project', JSON.stringify(wfMap));
      window.localStorage.setItem('bilo_active_project_id', 'proj-e2e-1');
    },
    {
      session: mockSession,
      uid: MOCK_USER_ID,
      profile: mockProfile,
      projects: mockProjects,
      taskList: tasks,
      wfMap: workflowsMap
    }
  );
}
