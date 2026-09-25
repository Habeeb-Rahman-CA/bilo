import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from './task.service';
import { Task, Workflow } from '../models/project.model';

describe('TaskService - Task Restoration & Target Status Column Recovery', () => {
  let taskService: TaskService;
  let mockSupabase: any;
  let mockSync: any;
  let mockProject: any;
  let mockPush: any;
  let mockAuth: any;
  let mockWorkflowService: any;
  let mockInjector: any;

  beforeEach(() => {
    localStorage.clear();

    mockSupabase = {
      isConfigured: false,
      supabase: {}
    };

    mockSync = {
      isOnline: () => false,
      onConnectionRestored: vi.fn(),
      enqueue: vi.fn(),
      pendingSyncQueue: () => [],
      isValidUuid: () => true
    };

    mockProject = {
      activeProject: () => ({ id: 'proj-1', name: 'Main Project' }),
      projects: () => [{ id: 'proj-1', name: 'Main Project' }],
      logActivity: vi.fn()
    };

    mockPush = {
      notifyTaskCreated: vi.fn(),
      notifyTaskStatusChanged: vi.fn()
    };

    mockAuth = {
      user: () => ({ id: 'user-1', email: 'test@example.com' })
    };

    mockWorkflowService = {
      getWorkflowsForProject: vi.fn((pid: string) => [
        { id: 'wf-backlog', project_id: pid, name: 'Backlog', color: '#64748b', position: 0 },
        { id: 'wf-todo', project_id: pid, name: 'To Do', color: '#3b82f6', position: 1 },
        { id: 'wf-in-progress', project_id: pid, name: 'In Progress', color: '#eab308', position: 2 },
        { id: 'wf-done', project_id: pid, name: 'Done', color: '#22c55e', position: 3 }
      ])
    };

    mockInjector = {
      get: vi.fn((token: any) => {
        return mockWorkflowService;
      })
    };

    taskService = new TaskService(
      mockSupabase,
      mockSync,
      mockProject,
      mockPush,
      mockAuth,
      mockInjector
    );
  });

  it('should restore task to its pre-completion status from status history if available', async () => {
    const task: Task = {
      id: 't-100',
      title: 'Fix Authentication Flow',
      completed: true,
      status: 'Done',
      workflow_id: 'wf-done',
      project_id: 'proj-1',
      position: 0,
      created_at: '2026-09-01T10:00:00Z',
      updated_at: ''
    };
    taskService.tasks.set([task]);

    // Record status history showing task transitioned from "In Progress" to "Done"
    taskService.taskStatusHistory.set({
      't-100': [
        {
          id: 'h-1',
          task_id: 't-100',
          from_status: 'To Do',
          to_status: 'In Progress',
          action_type: 'status',
          created_at: '2026-09-01T11:00:00Z'
        },
        {
          id: 'h-2',
          task_id: 't-100',
          from_status: 'In Progress',
          to_status: 'Done',
          action_type: 'status',
          created_at: '2026-09-01T12:00:00Z'
        }
      ]
    });

    const restored = await taskService.restoreTask('t-100');

    expect(restored).not.toBeNull();
    expect(restored?.completed).toBe(false);
    expect(restored?.status).toBe('In Progress');
    expect(restored?.workflow_id).toBe('wf-in-progress');
    expect(mockProject.logActivity).toHaveBeenCalledWith('proj-1', 'Task Restored', expect.stringContaining('In Progress'));
  });

  it('should fall back to "To Do" or first non-completed workflow column if no status history exists', async () => {
    const task: Task = {
      id: 't-101',
      title: 'Unarchived Task Without History',
      completed: true,
      status: 'Done',
      workflow_id: 'wf-done',
      project_id: 'proj-1',
      position: 0,
      created_at: '2026-09-01T10:00:00Z',
      updated_at: ''
    };
    taskService.tasks.set([task]);

    const restored = await taskService.restoreTask('t-101');

    expect(restored).not.toBeNull();
    expect(restored?.completed).toBe(false);
    expect(restored?.status).toBe('To Do');
    expect(restored?.workflow_id).toBe('wf-todo');
  });
});
