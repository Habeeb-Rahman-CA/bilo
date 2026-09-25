import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TasksComponent } from './tasks';
import { CdkDragStart, CdkDrag } from '@angular/cdk/drag-drop';

describe('TasksComponent - Drag Interruption & Auto-Scroll Safeguards', () => {
  let component: any;

  beforeEach(() => {
    component = Object.create(TasksComponent.prototype);
    component.activeDragItem = null;
    component.autoScrollFrameId = null;
    component.autoScrollSpeed = 0;
  });

  it('should track active drag item when drag starts', () => {
    const mockDrag = { reset: vi.fn() } as unknown as CdkDrag<any>;
    const mockEvent = { source: mockDrag } as CdkDragStart<any>;

    component.onDragStarted(mockEvent);

    expect(component.activeDragItem).toBe(mockDrag);
  });

  it('should reset active drag item and cleanup stray DOM elements on window blur or visibility change', () => {
    const mockDrag = { reset: vi.fn() } as unknown as CdkDrag<any>;
    component.onDragStarted({ source: mockDrag } as CdkDragStart<any>);

    const previewEl = document.createElement('div');
    previewEl.className = 'cdk-drag-preview';
    document.body.appendChild(previewEl);

    const placeholderEl = document.createElement('div');
    placeholderEl.className = 'cdk-drag-placeholder';
    document.body.appendChild(placeholderEl);

    component.onWindowBlurOrHide();

    expect(mockDrag.reset).toHaveBeenCalled();
    expect(component.activeDragItem).toBeNull();
    expect(document.querySelector('.cdk-drag-preview')).toBeNull();
    expect(document.querySelector('.cdk-drag-placeholder')).toBeNull();
  });

  it('should dispatch synthetic mouseup/pointerup events to cancel active browser drag loop', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');

    component.cancelActiveDrag();

    expect(spy).toHaveBeenCalled();
    expect(document.querySelector('.cdk-drag-preview')).toBeNull();
  });

  it('should calculate auto-scroll speed when dragging card near right container boundary', () => {
    const mockContainer = {
      getBoundingClientRect: () => ({ left: 0, right: 1000, top: 0, bottom: 800 }),
      scrollLeft: 100,
      clientWidth: 800,
      scrollWidth: 2000
    } as any;

    component.kanbanBoardContainer = { nativeElement: mockContainer };
    component.canScrollLeft = { set: vi.fn() };
    component.canScrollRight = { set: vi.fn() };
    component.offScreenLeftCount = { set: vi.fn() };
    component.offScreenRightCount = { set: vi.fn() };

    // Pointer near right edge (X = 940, distance to right = 60 < 100 threshold)
    const mockMoveEvent = { pointerPosition: { x: 940, y: 300 } } as any;

    component.onDragMoved(mockMoveEvent);

    expect(component.autoScrollSpeed).toBeGreaterThan(0);

    component.stopAutoScrollLoop();
    expect(component.autoScrollSpeed).toBe(0);
  });

  it('should calculate negative auto-scroll speed when dragging card near left container boundary', () => {
    const mockContainer = {
      getBoundingClientRect: () => ({ left: 0, right: 1000, top: 0, bottom: 800 }),
      scrollLeft: 500,
      clientWidth: 800,
      scrollWidth: 2000
    } as any;

    component.kanbanBoardContainer = { nativeElement: mockContainer };
    component.canScrollLeft = { set: vi.fn() };
    component.canScrollRight = { set: vi.fn() };
    component.offScreenLeftCount = { set: vi.fn() };
    component.offScreenRightCount = { set: vi.fn() };

    // Pointer near left edge (X = 40, distance to left = 40 < 100 threshold)
    const mockMoveEvent = { pointerPosition: { x: 40, y: 300 } } as any;

    component.onDragMoved(mockMoveEvent);

    expect(component.autoScrollSpeed).toBeLessThan(0);

    component.stopAutoScrollLoop();
    expect(component.autoScrollSpeed).toBe(0);
  });

  it('should update task status via moveTaskStatus for mobile touch users', async () => {
    const mockTask = { id: 'task-1', status: 'To Do', updated_at: '2026-09-25T10:00:00Z', project_id: 'proj-1' };
    const mockColumns = [{ id: 'col-2', name: 'In Progress' }];
    component.activeColumns = () => mockColumns;
    component.workflowService = { canTransition: () => true };
    component.taskService = { updateTask: vi.fn().mockResolvedValue({}) };

    await component.moveTaskStatus(mockTask, 'In Progress');

    expect(component.taskService.updateTask).toHaveBeenCalledWith('task-1', { status: 'In Progress', workflow_id: 'col-2' }, '2026-09-25T10:00:00Z');
  });

  it('should prevent status move if workflow transition is restricted', async () => {
    const mockTask = { id: 'task-1', status: 'To Do', updated_at: '2026-09-25T10:00:00Z', project_id: 'proj-1' };
    const mockColumns = [{ id: 'col-3', name: 'Done' }];
    component.activeColumns = () => mockColumns;
    component.workflowService = { canTransition: () => false };
    component.showRestrictedToast = vi.fn();
    component.taskService = { updateTask: vi.fn() };

    await component.moveTaskStatus(mockTask, 'Done');

    expect(component.showRestrictedToast).toHaveBeenCalled();
    expect(component.taskService.updateTask).not.toHaveBeenCalled();
  });
});
