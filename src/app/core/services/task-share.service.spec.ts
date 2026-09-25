import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskShareService } from './task-share.service';
import { TaskService } from './task.service';
import { ProjectService } from './project.service';
import { WorkspaceService } from './workspace.service';
import { Task, Project } from '../models/project.model';
import { signal } from '@angular/core';

vi.mock('@angular/core', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    effect: (fn: Function) => {
      // Execute once inline for testing
      try { fn(); } catch {}
    }
  };
});

describe('TaskShareService', () => {
  let mockTaskService: any;
  let mockProjectService: any;
  let mockWorkspaceService: any;
  let service: TaskShareService;

  const mockTasks: Task[] = [
    {
      id: 'task-uuid-101',
      title: 'Setup Database',
      project_id: 'proj-1',
      type: 'task',
      priority: 'high',
      position: 0,
      completed: false,
      created_at: '',
      updated_at: ''
    }
  ];

  const mockProjects: Project[] = [
    {
      id: 'proj-1',
      name: 'Bilo App',
      slug: 'bilo',
      status: 'active',
      created_at: '',
      updated_at: ''
    }
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    mockTaskService = { tasks: signal(mockTasks) };
    mockProjectService = { projects: signal(mockProjects) };
    mockWorkspaceService = {};

    service = new TaskShareService(
      mockTaskService as TaskService,
      mockProjectService as ProjectService,
      mockWorkspaceService as WorkspaceService
    );
  });

  it('should initialize with null toast and null activeSharedTask', () => {
    expect(service.toastMessage()).toBeNull();
    expect(service.activeSharedTask()).toBeNull();
  });

  it('should set toast message and clear it automatically after 3000ms', () => {
    service.showToast('Test Toast');
    expect(service.toastMessage()).toBe('Test Toast');

    vi.advanceTimersByTime(3000);
    expect(service.toastMessage()).toBeNull();
  });

  it('should match task by UUID using openTaskByParam', () => {
    const matched = service.openTaskByParam('task-uuid-101');
    expect(matched).toBe(true);
    expect(service.activeSharedTask()?.id).toBe('task-uuid-101');
    expect(service.toastMessage()).toContain('Opened shared task');
  });

  it('should return false and display a toast notification for unmatched task params', () => {
    const matched = service.openTaskByParam('non-existent-task-id');
    expect(matched).toBe(false);
    expect(service.activeSharedTask()).toBeNull();
    expect(service.toastMessage()).toContain('Shared task "NON-EXISTENT-TASK-ID" not found or may have been deleted');
  });

  it('should close shared task modal', () => {
    service.openTaskByParam('task-uuid-101');
    expect(service.activeSharedTask()).not.toBeNull();

    service.closeSharedTaskModal();
    expect(service.activeSharedTask()).toBeNull();
  });
});
