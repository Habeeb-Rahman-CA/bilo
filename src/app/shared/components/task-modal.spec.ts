import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskModalComponent } from './task-modal';

describe('TaskModalComponent Title Validation', () => {
  let component: TaskModalComponent;
  let mockTaskService: any;
  let mockProjectService: any;
  let mockWorkflowService: any;
  let mockTaskShareService: any;

  beforeEach(() => {
    mockTaskService = {
      createTask: vi.fn().mockResolvedValue({ id: 'task-1', title: 'Valid Title' }),
      updateTask: vi.fn().mockResolvedValue({ id: 'task-1', title: 'Valid Title' })
    };
    mockProjectService = {
      projects: vi.fn().mockReturnValue([{ id: 'proj-1', name: 'Project 1' }]),
      activeProject: vi.fn().mockReturnValue({ id: 'proj-1', name: 'Project 1' }),
      getWorkspaceMemberOptions: vi.fn().mockResolvedValue([])
    };
    mockWorkflowService = {
      getWorkflowsForProject: vi.fn().mockReturnValue([{ id: 'wf-1', name: 'todo' }])
    };
    mockTaskShareService = {
      showToast: vi.fn()
    };

    component = new TaskModalComponent(
      mockTaskService,
      mockProjectService,
      mockWorkflowService,
      mockTaskShareService
    );
  });

  it('should return error for empty or whitespace-only title', () => {
    component.title = '   ';
    expect(component.titleError).toBe('Summary / Title is required');
  });

  it('should return error for single character title', () => {
    component.title = 'A';
    expect(component.titleError).toBe('Title must be at least 2 characters long');
  });

  it('should return error for title exceeding 255 characters', () => {
    component.title = 'A'.repeat(256);
    expect(component.titleError).toBe('Title cannot exceed 255 characters');
  });

  it('should return null titleError for valid title between 2 and 255 characters', () => {
    component.title = 'Implement JWT Auth Interceptor';
    expect(component.titleError).toBeNull();
  });

  it('should prevent saveTask when title is invalid', async () => {
    component.title = ' ';
    const closeSpy = vi.spyOn(component.close, 'emit');

    await component.saveTask();

    expect(mockTaskService.createTask).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    expect(component.submitted).toBe(true);
  });

  it('should block processFiles when uploadingAttachments is already active', async () => {
    component.uploadingAttachments.set(true);
    const file = new File(['dummy'], 'test.png', { type: 'image/png' });

    await component.processFiles([file]);

    expect(mockTaskShareService.showToast).toHaveBeenCalledWith('Attachment upload in progress. Please wait.');
  });
});
