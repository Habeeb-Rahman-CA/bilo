import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskService } from './task.service';
import { Task } from '../models/project.model';

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

function makeSupabase() {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: null, error: null }),
    range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    then: vi.fn().mockImplementation((cb: any) => Promise.resolve(cb({ data: null, error: null })))
  };
  return {
    isConfigured: false,
    supabase: {
      from: vi.fn().mockReturnValue(chain),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } } }) }
    }
  };
}

function makeSync(online = false) {
  return {
    isOnline: () => online,
    onConnectionRestored: vi.fn(),
    enqueue: vi.fn(),
    pendingSyncQueue: () => [],
    isValidUuid: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
  };
}

function makeProgress() {
  return {
    start: vi.fn().mockReturnValue('progress-id'),
    update: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn()
  };
}

function makeProject(projId = 'proj-1') {
  return {
    activeProject: () => ({ id: projId, name: 'Main' }),
    projects: () => [{ id: projId, name: 'Main' }],
    logActivity: vi.fn()
  };
}

function makePush() {
  return {
    notifyTaskCreated: vi.fn(),
    notifyTaskStatusChanged: vi.fn()
  };
}

function makeAuth(userId = 'u-1') {
  return { user: () => ({ id: userId, email: 'user@test.com', user_metadata: {} }) };
}

function makeWorkflowService(projId = 'proj-1') {
  const wfs = [
    { id: 'wf-backlog-proj-1', project_id: projId, name: 'Backlog', color: '#64748b', position: 0 },
    { id: 'wf-todo-proj-1', project_id: projId, name: 'To Do', color: '#3b82f6', position: 1 },
    { id: 'wf-in-progress-proj-1', project_id: projId, name: 'In Progress', color: '#eab308', position: 2 },
    { id: 'wf-in-review-proj-1', project_id: projId, name: 'In Review', color: '#a855f7', position: 3 },
    { id: 'wf-done-proj-1', project_id: projId, name: 'Done', color: '#22c55e', position: 4 }
  ];
  return {
    getWorkflowsForProject: vi.fn((_: string) => wfs),
    workflowsByProject: () => ({ [projId]: wfs })
  };
}

function makeInjector(wfSvc: any) {
  return { get: vi.fn(() => wfSvc) };
}

function buildService(overrides: {
  supabase?: any; sync?: any; project?: any; push?: any;
  auth?: any; injector?: any; progress?: any;
} = {}) {
  return new TaskService(
    overrides.supabase ?? makeSupabase(),
    overrides.sync ?? makeSync(),
    overrides.project ?? makeProject(),
    overrides.push ?? makePush(),
    overrides.auth ?? makeAuth(),
    overrides.progress ?? makeProgress(),
    overrides.injector ?? makeInjector(makeWorkflowService())
  );
}

function makeTask(partial: Partial<Task> = {}): Task {
  return {
    id: 'task-' + Math.random().toString(36).slice(2),
    title: 'Test Task',
    status: 'To Do',
    completed: false,
    project_id: 'proj-1',
    workflow_id: 'wf-todo-proj-1',
    position: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial
  };
}

// ---------------------------------------------------------------------------
// 1. createTask
// ---------------------------------------------------------------------------
describe('TaskService.createTask', () => {
  let svc: TaskService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });
  afterEach(() => { localStorage.clear(); });

  it('should default title to "Untitled Task" when empty string provided', async () => {
    const task = await svc.createTask({ title: '   ' });
    expect(task.title).toBe('Untitled Task');
  });

  it('should trim whitespace from title', async () => {
    const task = await svc.createTask({ title: '  Fix login bug  ' });
    expect(task.title).toBe('Fix login bug');
  });

  it('should normalise status "done" (lowercase) to "Done"', async () => {
    const task = await svc.createTask({ title: 'T', status: 'done' });
    expect(task.status).toBe('Done');
  });

  it('should normalise status "todo" to "To Do"', async () => {
    const task = await svc.createTask({ title: 'T', status: 'todo' });
    expect(task.status).toBe('To Do');
  });

  it('should normalise status "in progress" (lowercase) to "In Progress"', async () => {
    const task = await svc.createTask({ title: 'T', status: 'in progress' });
    expect(task.status).toBe('In Progress');
  });

  it('should default status to "Backlog" when not provided', async () => {
    const task = await svc.createTask({ title: 'T' });
    expect(task.status).toBe('Backlog');
  });

  it('should set completed=true for tasks created with status "Done"', async () => {
    const task = await svc.createTask({ title: 'T', status: 'Done' });
    expect(task.completed).toBe(true);
  });

  it('should set completed=false for tasks with non-done status', async () => {
    const task = await svc.createTask({ title: 'T', status: 'To Do' });
    expect(task.completed).toBe(false);
  });

  it('should assign position that avoids collision with existing tasks in same column', async () => {
    svc.tasks.set([
      makeTask({ status: 'Backlog', project_id: 'proj-1', position: 0 }),
      makeTask({ status: 'Backlog', project_id: 'proj-1', position: 1 })
    ]);
    const task = await svc.createTask({ title: 'T', status: 'Backlog' });
    expect(task.position).toBeGreaterThanOrEqual(2);
  });

  it('should add created task to the tasks signal', async () => {
    const initial = svc.tasks().length;
    await svc.createTask({ title: 'New Task' });
    expect(svc.tasks().length).toBe(initial + 1);
  });

  it('should enqueue CREATE_TASK via syncService', async () => {
    const sync = makeSync();
    const s = buildService({ sync });
    await s.createTask({ title: 'Queued Task' });
    expect(sync.enqueue).toHaveBeenCalledWith('CREATE_TASK', expect.any(Object));
  });

  it('should call logActivity on project service', async () => {
    const project = makeProject();
    const s = buildService({ project });
    await s.createTask({ title: 'Activity Task' });
    expect(project.logActivity).toHaveBeenCalled();
  });

  it('should use active project id when no project_id provided', async () => {
    const task = await svc.createTask({ title: 'T' });
    expect(task.project_id).toBe('proj-1');
  });
});

// ---------------------------------------------------------------------------
// 2. updateTask
// ---------------------------------------------------------------------------
describe('TaskService.updateTask', () => {
  let svc: TaskService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });
  afterEach(() => { localStorage.clear(); });

  it('should return null when task id not found', async () => {
    const result = await svc.updateTask('nonexistent-id', { title: 'New' });
    expect(result).toBeNull();
  });

  it('should update status and set completed=true when status is "Done"', async () => {
    svc.tasks.set([makeTask({ id: 't-1', status: 'To Do', completed: false })]);
    const result = await svc.updateTask('t-1', { status: 'Done' });
    expect(result?.status).toBe('Done');
    expect(result?.completed).toBe(true);
  });

  it('should update status and set completed=false when status is "In Progress"', async () => {
    svc.tasks.set([makeTask({ id: 't-1', status: 'Done', completed: true })]);
    const result = await svc.updateTask('t-1', { status: 'In Progress' });
    expect(result?.status).toBe('In Progress');
    expect(result?.completed).toBe(false);
  });

  it('should strip leading/trailing whitespace from updated title', async () => {
    svc.tasks.set([makeTask({ id: 't-1', title: 'Old Title' })]);
    const result = await svc.updateTask('t-1', { title: '  New Title  ' });
    expect(result?.title).toBe('New Title');
  });

  it('should NOT overwrite title with empty string — keeps existing title', async () => {
    svc.tasks.set([makeTask({ id: 't-1', title: 'Keep This' })]);
    const result = await svc.updateTask('t-1', { title: '' });
    expect(result?.title).toBe('Keep This');
  });

  it('should record status history entry when status changes', async () => {
    svc.tasks.set([makeTask({ id: 't-1', status: 'To Do' })]);
    await svc.updateTask('t-1', { status: 'In Progress' });
    const history = svc.taskStatusHistory()['t-1'] || [];
    const statusEntries = history.filter(h => h.action_type === 'status');
    expect(statusEntries.length).toBeGreaterThan(0);
    expect(statusEntries[0].from_status).toBe('To Do');
    expect(statusEntries[0].to_status).toBe('In Progress');
  });

  it('should record priority history when priority changes', async () => {
    svc.tasks.set([makeTask({ id: 't-1', priority: 'low' })]);
    await svc.updateTask('t-1', { priority: 'high' });
    const history = svc.taskStatusHistory()['t-1'] || [];
    expect(history.some(h => h.action_type === 'priority')).toBe(true);
  });

  it('should record assignee history when assignee changes', async () => {
    svc.tasks.set([makeTask({ id: 't-1', assignee: 'Alice' })]);
    await svc.updateTask('t-1', { assignee: 'Bob' });
    const history = svc.taskStatusHistory()['t-1'] || [];
    expect(history.some(h => h.action_type === 'assignee')).toBe(true);
  });

  it('should record due_date history when due date changes', async () => {
    svc.tasks.set([makeTask({ id: 't-1', due_date: '2026-10-01' })]);
    await svc.updateTask('t-1', { due_date: '2026-10-15' });
    const history = svc.taskStatusHistory()['t-1'] || [];
    expect(history.some(h => h.action_type === 'due_date')).toBe(true);
  });

  it('should NOT record status history when status does not change', async () => {
    svc.tasks.set([makeTask({ id: 't-1', status: 'To Do' })]);
    await svc.updateTask('t-1', { status: 'To Do' });
    const statusEntries = (svc.taskStatusHistory()['t-1'] || []).filter(h => h.action_type === 'status');
    expect(statusEntries.length).toBe(0);
  });

  it('should enqueue UPDATE_TASK via syncService', async () => {
    const sync = makeSync();
    const s = buildService({ sync });
    s.tasks.set([makeTask({ id: 't-1' })]);
    await s.updateTask('t-1', { title: 'Updated' });
    expect(sync.enqueue).toHaveBeenCalledWith('UPDATE_TASK', expect.objectContaining({ id: 't-1' }));
  });

  it('should reject update with stale expectedUpdatedAt (OCC guard)', async () => {
    svc.tasks.set([makeTask({ id: 't-1', title: 'Original', updated_at: '2026-09-01T11:00:00.000Z' })]);
    const result = await svc.updateTask('t-1', { title: 'Conflict' }, '2026-09-01T10:00:00.000Z');
    expect(result).toBeNull();
    expect(svc.tasks()[0].title).toBe('Original');
  });

  it('should apply update with matching expectedUpdatedAt (OCC pass)', async () => {
    const ts = '2026-09-01T10:00:00.000Z';
    svc.tasks.set([makeTask({ id: 't-1', updated_at: ts })]);
    const result = await svc.updateTask('t-1', { title: 'OCC Passed' }, ts);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('OCC Passed');
  });
});

// ---------------------------------------------------------------------------
// 3. deleteTask
// ---------------------------------------------------------------------------
describe('TaskService.deleteTask', () => {
  let svc: TaskService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });
  afterEach(() => { localStorage.clear(); });

  it('should return false when task not found', async () => {
    const result = await svc.deleteTask('ghost-id');
    expect(result).toBe(false);
  });

  it('should remove task from tasks signal', async () => {
    svc.tasks.set([makeTask({ id: 't-del' }), makeTask({ id: 't-keep' })]);
    await svc.deleteTask('t-del');
    expect(svc.tasks().find(t => t.id === 't-del')).toBeUndefined();
    expect(svc.tasks().find(t => t.id === 't-keep')).toBeDefined();
  });

  it('should remove task comments from memory map', async () => {
    svc.tasks.set([makeTask({ id: 't-del' })]);
    svc.taskComments.set({ 't-del': [{ id: 'c-1', task_id: 't-del', content: 'Hi', created_at: '' }] });
    await svc.deleteTask('t-del');
    expect(svc.taskComments()['t-del']).toBeUndefined();
  });

  it('should remove task status history from memory map', async () => {
    svc.tasks.set([makeTask({ id: 't-del' })]);
    svc.taskStatusHistory.set({ 't-del': [{ id: 'h-1', task_id: 't-del', from_status: '', to_status: 'Done', created_at: '' }] });
    await svc.deleteTask('t-del');
    expect(svc.taskStatusHistory()['t-del']).toBeUndefined();
  });

  it('should enqueue DELETE_TASK via syncService when offline', async () => {
    const sync = makeSync(false);
    const s = buildService({ sync });
    s.tasks.set([makeTask({ id: 't-del' })]);
    await s.deleteTask('t-del');
    expect(sync.enqueue).toHaveBeenCalledWith('DELETE_TASK', { id: 't-del' });
  });
});

// ---------------------------------------------------------------------------
// 4. deleteTasksForProject
// ---------------------------------------------------------------------------
describe('TaskService.deleteTasksForProject', () => {
  let svc: TaskService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });
  afterEach(() => { localStorage.clear(); });

  it('should remove all tasks belonging to the project', () => {
    svc.tasks.set([
      makeTask({ id: 't-1', project_id: 'proj-A' }),
      makeTask({ id: 't-2', project_id: 'proj-A' }),
      makeTask({ id: 't-3', project_id: 'proj-B' })
    ]);
    svc.deleteTasksForProject('proj-A');
    expect(svc.tasks().every(t => t.project_id !== 'proj-A')).toBe(true);
    expect(svc.tasks().length).toBe(1);
  });

  it('should remove comments and status history for deleted project tasks', () => {
    svc.tasks.set([makeTask({ id: 't-1', project_id: 'proj-A' })]);
    svc.taskComments.set({ 't-1': [{ id: 'c-1', task_id: 't-1', content: 'x', created_at: '' }] });
    svc.taskStatusHistory.set({ 't-1': [{ id: 'h-1', task_id: 't-1', from_status: '', to_status: 'Done', created_at: '' }] });
    svc.deleteTasksForProject('proj-A');
    expect(svc.taskComments()['t-1']).toBeUndefined();
    expect(svc.taskStatusHistory()['t-1']).toBeUndefined();
  });

  it('should be a no-op when projectId is empty', () => {
    svc.tasks.set([makeTask({ id: 't-1', project_id: 'proj-A' })]);
    svc.deleteTasksForProject('');
    expect(svc.tasks().length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. batchDeleteTasks
// ---------------------------------------------------------------------------
describe('TaskService.batchDeleteTasks', () => {
  let svc: TaskService;
  let progress: any;
  beforeEach(() => { localStorage.clear(); progress = makeProgress(); svc = buildService({ progress }); });
  afterEach(() => { localStorage.clear(); });

  it('should be a no-op when ids is empty', async () => {
    svc.tasks.set([makeTask({ id: 't-1' })]);
    await svc.batchDeleteTasks([]);
    expect(svc.tasks().length).toBe(1);
    expect(progress.start).not.toHaveBeenCalled();
  });

  it('should remove all specified tasks from signal state', async () => {
    svc.tasks.set([makeTask({ id: 't-1' }), makeTask({ id: 't-2' }), makeTask({ id: 't-3' })]);
    await svc.batchDeleteTasks(['t-1', 't-2']);
    expect(svc.tasks().find(t => t.id === 't-1')).toBeUndefined();
    expect(svc.tasks().find(t => t.id === 't-2')).toBeUndefined();
    expect(svc.tasks().find(t => t.id === 't-3')).toBeDefined();
  });

  it('should enqueue DELETE_TASK for each deleted task', async () => {
    const sync = makeSync();
    const s = buildService({ sync, progress });
    s.tasks.set([makeTask({ id: 't-1' }), makeTask({ id: 't-2' })]);
    await s.batchDeleteTasks(['t-1', 't-2']);
    expect(sync.enqueue).toHaveBeenCalledWith('DELETE_TASK', { id: 't-1' });
    expect(sync.enqueue).toHaveBeenCalledWith('DELETE_TASK', { id: 't-2' });
  });

  it('should reset batchProgress to null after completion', async () => {
    svc.tasks.set([makeTask({ id: 't-1' })]);
    await svc.batchDeleteTasks(['t-1']);
    expect(svc.batchProgress()).toBeNull();
  });

  it('should call progress.complete after successful batch delete', async () => {
    svc.tasks.set([makeTask({ id: 't-1' })]);
    await svc.batchDeleteTasks(['t-1']);
    expect(progress.complete).toHaveBeenCalled();
  });

  it('should skip ghost ids not in tasks signal', async () => {
    svc.tasks.set([makeTask({ id: 't-real' })]);
    await svc.batchDeleteTasks(['ghost-1', 'ghost-2']);
    expect(progress.start).not.toHaveBeenCalled();
    expect(svc.tasks().length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6. batchUpdateTasks
// ---------------------------------------------------------------------------
describe('TaskService.batchUpdateTasks', () => {
  let svc: TaskService;
  let progress: any;
  let sync: any;
  beforeEach(() => { localStorage.clear(); progress = makeProgress(); sync = makeSync(); svc = buildService({ progress, sync }); });
  afterEach(() => { localStorage.clear(); });

  it('should update status of all matching tasks', async () => {
    svc.tasks.set([makeTask({ id: 't-1', status: 'To Do' }), makeTask({ id: 't-2', status: 'In Progress' })]);
    await svc.batchUpdateTasks(['t-1', 't-2'], { status: 'Done' });
    expect(svc.tasks().every(t => t.status === 'Done')).toBe(true);
  });

  it('should set completed=true when batch updating status to "Done"', async () => {
    svc.tasks.set([makeTask({ id: 't-1', status: 'To Do', completed: false })]);
    await svc.batchUpdateTasks(['t-1'], { status: 'Done' });
    expect(svc.tasks()[0].completed).toBe(true);
  });

  it('should record status history for tasks where status changed', async () => {
    svc.tasks.set([makeTask({ id: 't-1', status: 'To Do' })]);
    await svc.batchUpdateTasks(['t-1'], { status: 'In Progress' });
    const history = svc.taskStatusHistory()['t-1'] || [];
    expect(history.some(h => h.action_type === 'status')).toBe(true);
  });

  it('should record priority history when priority changes in batch', async () => {
    svc.tasks.set([makeTask({ id: 't-1', priority: 'low' })]);
    await svc.batchUpdateTasks(['t-1'], { priority: 'critical' as any });
    const history = svc.taskStatusHistory()['t-1'] || [];
    expect(history.some(h => h.action_type === 'priority')).toBe(true);
  });

  it('should be a no-op when ids array is empty', async () => {
    svc.tasks.set([makeTask({ id: 't-1', status: 'To Do' })]);
    await svc.batchUpdateTasks([], { status: 'Done' });
    expect(svc.tasks()[0].status).toBe('To Do');
    expect(progress.start).not.toHaveBeenCalled();
  });

  it('should reset batchProgress to null after completion', async () => {
    svc.tasks.set([makeTask({ id: 't-1' })]);
    await svc.batchUpdateTasks(['t-1'], { status: 'Done' });
    expect(svc.batchProgress()).toBeNull();
  });

  it('should call progress.complete after successful batch update', async () => {
    svc.tasks.set([makeTask({ id: 't-1' })]);
    await svc.batchUpdateTasks(['t-1'], { status: 'Done' });
    expect(progress.complete).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. addComment
// ---------------------------------------------------------------------------
describe('TaskService.addComment', () => {
  let svc: TaskService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });
  afterEach(() => { localStorage.clear(); });

  it('should return null for an empty comment with no attachments', async () => {
    expect(await svc.addComment('t-1', '   ', 'Alice')).toBeNull();
  });

  it('should return null for an empty comment with empty attachments array', async () => {
    expect(await svc.addComment('t-1', '', 'Alice', [])).toBeNull();
  });

  it('should accept a comment with only attachments and no text', async () => {
    const result = await svc.addComment('t-1', '', 'Alice', ['https://img.example.com/a.jpg']);
    expect(result).not.toBeNull();
    expect(result?.attachments).toHaveLength(1);
  });

  it('should accept a comment with only text', async () => {
    const result = await svc.addComment('t-1', 'Valid comment', 'Alice');
    expect(result).not.toBeNull();
    expect(result?.content).toBe('Valid comment');
  });

  it('should truncate content exceeding 10,000 characters', async () => {
    const result = await svc.addComment('t-1', 'A'.repeat(15000), 'Alice');
    expect(result?.content.length).toBe(10000);
  });

  it('should strip blank strings from attachments array', async () => {
    const result = await svc.addComment('t-1', 'Hello', 'Alice', ['https://img.com/a.jpg', '', '  ']);
    expect(result?.attachments?.length).toBe(1);
  });

  it('should add comment to taskComments signal for the task', async () => {
    await svc.addComment('t-1', 'First comment', 'Alice');
    expect(svc.taskComments()['t-1']?.some(c => c.content === 'First comment')).toBe(true);
  });

  it('should enqueue ADD_COMMENT via syncService', async () => {
    const sync = makeSync();
    const s = buildService({ sync });
    await s.addComment('t-1', 'Sync this', 'Alice');
    expect(sync.enqueue).toHaveBeenCalledWith('ADD_COMMENT', expect.any(Object));
  });
});

// ---------------------------------------------------------------------------
// 8. updateComment
// ---------------------------------------------------------------------------
describe('TaskService.updateComment', () => {
  let svc: TaskService;
  beforeEach(() => {
    localStorage.clear();
    svc = buildService();
    svc.taskComments.set({ 't-1': [{ id: 'c-1', task_id: 't-1', content: 'Original', created_at: '' }] });
  });
  afterEach(() => { localStorage.clear(); });

  it('should return null for empty new content', async () => {
    expect(await svc.updateComment('c-1', 't-1', '   ')).toBeNull();
  });

  it('should return null when comment not found', async () => {
    expect(await svc.updateComment('ghost', 't-1', 'New content')).toBeNull();
  });

  it('should update comment content in signal state', async () => {
    await svc.updateComment('c-1', 't-1', 'Updated content');
    expect(svc.taskComments()['t-1']?.find(c => c.id === 'c-1')?.content).toBe('Updated content');
  });

  it('should truncate updated content to 10,000 characters', async () => {
    const result = await svc.updateComment('c-1', 't-1', 'B'.repeat(12000));
    expect(result?.content.length).toBe(10000);
  });

  it('should enqueue UPDATE_COMMENT via syncService', async () => {
    const sync = makeSync();
    const s = buildService({ sync });
    s.taskComments.set({ 't-1': [{ id: 'c-1', task_id: 't-1', content: 'Old', created_at: '' }] });
    await s.updateComment('c-1', 't-1', 'New text');
    expect(sync.enqueue).toHaveBeenCalledWith('UPDATE_COMMENT', expect.objectContaining({ id: 'c-1' }));
  });

  it('should set updated_at timestamp on the updated comment', async () => {
    const result = await svc.updateComment('c-1', 't-1', 'New text');
    expect(result?.updated_at).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 9. deleteComment
// ---------------------------------------------------------------------------
describe('TaskService.deleteComment', () => {
  let svc: TaskService;
  beforeEach(() => {
    localStorage.clear();
    svc = buildService();
    svc.taskComments.set({ 't-1': [
      { id: 'c-1', task_id: 't-1', content: 'Keep', created_at: '' },
      { id: 'c-2', task_id: 't-1', content: 'Delete me', created_at: '' }
    ]});
  });
  afterEach(() => { localStorage.clear(); });

  it('should remove the specified comment', async () => {
    await svc.deleteComment('c-2', 't-1');
    expect(svc.taskComments()['t-1']?.find(c => c.id === 'c-2')).toBeUndefined();
  });

  it('should keep other comments for the same task', async () => {
    await svc.deleteComment('c-2', 't-1');
    expect(svc.taskComments()['t-1']?.find(c => c.id === 'c-1')).toBeDefined();
  });

  it('should enqueue DELETE_COMMENT via syncService', async () => {
    const sync = makeSync();
    const s = buildService({ sync });
    s.taskComments.set({ 't-1': [{ id: 'c-del', task_id: 't-1', content: 'x', created_at: '' }] });
    await s.deleteComment('c-del', 't-1');
    expect(sync.enqueue).toHaveBeenCalledWith('DELETE_COMMENT', { id: 'c-del' });
  });
});

// ---------------------------------------------------------------------------
// 10. loadCommentsPaginated (offline path)
// ---------------------------------------------------------------------------
describe('TaskService.loadCommentsPaginated (offline fallback)', () => {
  let svc: TaskService;
  beforeEach(() => {
    localStorage.clear();
    svc = buildService({ sync: makeSync(false) });
    svc.taskComments.set({
      't-1': Array.from({ length: 45 }, (_, i) => ({
        id: `c-${i}`, task_id: 't-1', content: `Comment ${i}`,
        created_at: new Date(Date.now() + i * 1000).toISOString()
      }))
    });
  });
  afterEach(() => { localStorage.clear(); });

  it('should return first page of 20 from local cache', async () => {
    const result = await svc.loadCommentsPaginated('t-1', 1, 20);
    expect(result.comments.length).toBe(20);
    expect(result.hasMore).toBe(true);
    expect(result.totalCount).toBe(45);
  });

  it('should return second page of 20 from local cache', async () => {
    const result = await svc.loadCommentsPaginated('t-1', 2, 20);
    expect(result.comments.length).toBe(20);
    expect(result.hasMore).toBe(true);
  });

  it('should return last partial page with hasMore=false', async () => {
    const result = await svc.loadCommentsPaginated('t-1', 3, 20);
    expect(result.comments.length).toBe(5);
    expect(result.hasMore).toBe(false);
  });

  it('should return empty result for task with no comments', async () => {
    const result = await svc.loadCommentsPaginated('t-no-comments', 1, 20);
    expect(result.comments.length).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 11. normalizeTaskStatuses
// ---------------------------------------------------------------------------
describe('TaskService.normalizeTaskStatuses', () => {
  let svc: TaskService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });
  afterEach(() => { localStorage.clear(); });

  // normalizeTaskStatuses first checks workflow_id match, then status string.
  // To test the status-string path, tasks must NOT have a workflow_id that
  // matches any mock workflow (otherwise the workflow name wins).

  it('should normalise "DONE" to "Done"', () => {
    const { normalized } = svc.normalizeTaskStatuses([makeTask({ status: 'DONE', workflow_id: undefined })]);
    expect(normalized[0].status).toBe('Done');
  });

  it('should normalise "closed" to "Done"', () => {
    const { normalized } = svc.normalizeTaskStatuses([makeTask({ status: 'closed', workflow_id: undefined })]);
    expect(normalized[0].status).toBe('Done');
  });

  it('should normalise "wip" to "In Progress"', () => {
    const { normalized } = svc.normalizeTaskStatuses([makeTask({ status: 'wip', workflow_id: undefined })]);
    expect(normalized[0].status).toBe('In Progress');
  });

  it('should normalise "open" to "To Do"', () => {
    const { normalized } = svc.normalizeTaskStatuses([makeTask({ status: 'open', workflow_id: undefined })]);
    expect(normalized[0].status).toBe('To Do');
  });

  it('should normalise "testing" to "In Review"', () => {
    const { normalized } = svc.normalizeTaskStatuses([makeTask({ status: 'testing', workflow_id: undefined })]);
    expect(normalized[0].status).toBe('In Review');
  });

  it('should set completed=true for tasks normalised to "Done"', () => {
    const { normalized } = svc.normalizeTaskStatuses([makeTask({ status: 'done', completed: false, workflow_id: undefined })]);
    expect(normalized[0].completed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. triggerConflictNotification & clearConflictNotification
// ---------------------------------------------------------------------------
describe('TaskService conflict notifications', () => {
  let svc: TaskService;
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); svc = buildService(); });
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

  it('should set concurrentConflictMessage on trigger', () => {
    svc.triggerConflictNotification('Conflict detected!');
    expect(svc.concurrentConflictMessage()).toBe('Conflict detected!');
  });

  it('should auto-clear message after 6 seconds', () => {
    svc.triggerConflictNotification('Conflict!');
    vi.advanceTimersByTime(6000);
    expect(svc.concurrentConflictMessage()).toBe('');
  });

  it('should clear message immediately on clearConflictNotification', () => {
    svc.triggerConflictNotification('Conflict!');
    svc.clearConflictNotification();
    expect(svc.concurrentConflictMessage()).toBe('');
  });

  it('should replace previous message when triggered twice rapidly', () => {
    svc.triggerConflictNotification('First');
    svc.triggerConflictNotification('Second');
    expect(svc.concurrentConflictMessage()).toBe('Second');
  });
});

// ---------------------------------------------------------------------------
// 13. resetState
// ---------------------------------------------------------------------------
describe('TaskService.resetState', () => {
  let svc: TaskService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });
  afterEach(() => { localStorage.clear(); });

  it('should clear tasks, comments, and history signals', () => {
    svc.tasks.set([makeTask()]);
    svc.taskComments.set({ 't-1': [{ id: 'c-1', task_id: 't-1', content: 'x', created_at: '' }] });
    svc.taskStatusHistory.set({ 't-1': [{ id: 'h-1', task_id: 't-1', from_status: '', to_status: 'Done', created_at: '' }] });
    svc.resetState();
    expect(svc.tasks()).toHaveLength(0);
    expect(svc.taskComments()).toEqual({});
    expect(svc.taskStatusHistory()).toEqual({});
  });
});
