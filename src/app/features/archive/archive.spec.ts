import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArchiveComponent } from './archive';
import { Task } from '../../core/models/project.model';

describe('ArchiveComponent - Pagination & Large Task History', () => {
  let component: ArchiveComponent;
  let mockTasks: Task[];
  let mockActivities: any[];

  beforeEach(() => {
    mockTasks = Array.from({ length: 1050 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: i === 42 ? 'Fix Payment Gateway Crash' : `Completed Task ${i + 1}`,
      completed: true,
      status: 'done',
      project_id: 'proj-1',
      assignee: i % 2 === 0 ? 'Alice' : 'Bob',
      type: 'bug',
      priority: 'high',
      due_date: '2026-09-30',
      created_at: '2026-09-01T10:00:00Z'
    }));

    mockActivities = Array.from({ length: 45 }, (_, i) => ({
      id: `act-${i + 1}`,
      action: 'Task Updated',
      description: `Task ${i + 1} marked as done`,
      timestamp: '2026-09-25T12:00:00Z',
      project_id: 'proj-1'
    }));

    const mockTaskService: any = {
      tasks: () => mockTasks,
      loading: () => false
    };

    const mockProjectService: any = {
      activeProject: () => ({ id: 'proj-1', name: 'Main Project' }),
      projects: () => [{ id: 'proj-1', name: 'Main Project' }],
      activities: () => mockActivities
    };

    component = new ArchiveComponent(mockTaskService, mockProjectService);
  });

  it('should accurately calculate total completed tasks and total pages for 1000+ tasks', () => {
    expect(component.completedTasks().length).toBe(1050);
    expect(component.taskPageSize()).toBe(15);
    // 1050 / 15 = 70 pages
    expect(component.totalTaskPages()).toBe(70);
    expect(component.paginatedCompletedTasks().length).toBe(15);
    expect(component.taskStartIndex()).toBe(1);
    expect(component.taskEndIndex()).toBe(15);
  });

  it('should paginate completed tasks accurately when navigating between pages', () => {
    // Page 1
    expect(component.paginatedCompletedTasks()[0].id).toBe('task-1');
    expect(component.paginatedCompletedTasks()[14].id).toBe('task-15');

    // Go to next page
    component.nextTaskPage();
    expect(component.taskPage()).toBe(2);
    expect(component.paginatedCompletedTasks()[0].id).toBe('task-16');
    expect(component.taskStartIndex()).toBe(16);
    expect(component.taskEndIndex()).toBe(30);

    // Go back to prev page
    component.prevTaskPage();
    expect(component.taskPage()).toBe(1);
    expect(component.paginatedCompletedTasks()[0].id).toBe('task-1');
  });

  it('should adjust pagination when changing page size', () => {
    component.setTaskPageSize(50);
    expect(component.taskPageSize()).toBe(50);
    // 1050 / 50 = 21 pages
    expect(component.totalTaskPages()).toBe(21);
    expect(component.paginatedCompletedTasks().length).toBe(50);
    expect(component.taskPage()).toBe(1);
    expect(component.taskStartIndex()).toBe(1);
    expect(component.taskEndIndex()).toBe(50);
  });

  it('should filter completed tasks by search query and reset to page 1', () => {
    // Search for specific title
    component.onTaskSearch('Payment Gateway');
    expect(component.taskSearchQuery()).toBe('Payment Gateway');
    expect(component.taskPage()).toBe(1);

    const filtered = component.filteredCompletedTasks();
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe('Fix Payment Gateway Crash');
    expect(component.paginatedCompletedTasks().length).toBe(1);
    expect(component.totalTaskPages()).toBe(1);

    // Clear search
    component.onTaskSearch('');
    expect(component.filteredCompletedTasks().length).toBe(1050);
  });

  it('should paginate workspace activity log entries accurately', () => {
    expect(component.activities().length).toBe(45);
    // 45 / 15 = 3 pages
    expect(component.totalActivityPages()).toBe(3);
    expect(component.paginatedActivities().length).toBe(15);

    component.nextActivityPage();
    expect(component.activityPage()).toBe(2);
    expect(component.activityStartIndex()).toBe(16);
    expect(component.activityEndIndex()).toBe(30);

    component.nextActivityPage();
    expect(component.activityPage()).toBe(3);
    expect(component.activityStartIndex()).toBe(31);
    expect(component.activityEndIndex()).toBe(45);
  });

  it('should trigger taskService.restoreTask when restoreTask is invoked in ArchiveComponent', async () => {
    const mockTask: any = { id: 'task-43', title: 'Fix Payment Gateway Crash' };
    (component.taskService as any).restoreTask = vi.fn().mockResolvedValue({
      id: 'task-43',
      title: 'Fix Payment Gateway Crash',
      completed: false,
      status: 'In Progress'
    });

    await component.restoreTask(mockTask);

    expect(component.taskService.restoreTask).toHaveBeenCalledWith('task-43');
    expect(component.restoreToastMessage()).toContain('Restored "Fix Payment Gateway Crash" to "In Progress" status.');
  });

  it('should perform non-blocking async exportData with progress status updates', async () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    expect(component.isExporting()).toBe(false);

    const exportPromise = component.exportData();
    expect(component.isExporting()).toBe(true);

    await exportPromise;

    expect(component.exportProgress()).toBe(100);
    expect(component.exportStepMessage()).toBe('Export completed successfully!');
  });
});


