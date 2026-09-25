import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarComponent } from './calendar';

describe('CalendarComponent - Touch Drag & Scheduling', () => {
  let component: any;
  let draggedTaskIdVal: string | null = null;
  let dragOverDateVal: string | null = null;

  beforeEach(() => {
    component = Object.create(CalendarComponent.prototype);

    draggedTaskIdVal = 'task-1';
    dragOverDateVal = '2026-09-30';

    const mockDraggedTaskId: any = () => draggedTaskIdVal;
    mockDraggedTaskId.set = vi.fn((val: any) => { draggedTaskIdVal = val; });

    const mockDragOverDate: any = () => dragOverDateVal;
    mockDragOverDate.set = vi.fn((val: any) => { dragOverDateVal = val; });

    component.draggedTaskId = mockDraggedTaskId;
    component.dragOverDate = mockDragOverDate;
    component.taskService = { updateTask: vi.fn().mockResolvedValue({}) };
  });

  it('should create touch drag ghost element on touchstart', () => {
    const mockTouch = { clientX: 150, clientY: 250 };
    const mockEvent = { touches: [mockTouch] } as unknown as TouchEvent;
    const mockTask = { id: 'task-100', title: 'Mobile Touch Test Task' } as any;

    component.onTouchStartTask(mockEvent, mockTask);

    expect(component.touchGhostEl).not.toBeNull();
    expect(component.touchGhostEl.innerText).toContain('Mobile Touch Test Task');

    component.cleanupTouchGhost();
    expect(document.querySelector('.touch-drag-ghost')).toBeNull();
  });

  it('should update task due date on touchend over target day cell', async () => {
    const mockEvent = {} as TouchEvent;

    await component.onTouchEndTask(mockEvent);

    expect(component.taskService.updateTask).toHaveBeenCalledWith('task-1', { due_date: '2026-09-30' });
  });

  it('should cleanup touch ghost element on touchcancel', () => {
    const mockTouch = { clientX: 100, clientY: 200 };
    component.onTouchStartTask({ touches: [mockTouch] } as any, { id: 't1', title: 'Task' } as any);

    expect(component.touchGhostEl).not.toBeNull();

    component.onTouchCancelTask();

    expect(component.touchGhostEl).toBeNull();
    expect(component.draggedTaskId.set).toHaveBeenCalledWith(null);
  });

  it('should truncate day cell events to max 3 items and calculate overflow count accurately for 10+ events', () => {
    component.maxVisibleCellEvents = 3;
    component.showCreated = () => true;
    component.showClosed = () => true;
    component.showDue = () => true;

    const mockCell: any = {
      createdTasks: Array.from({ length: 5 }, (_, i) => ({ id: `c-${i}`, title: `Created ${i}` })),
      closedTasks: Array.from({ length: 5 }, (_, i) => ({ id: `x-${i}`, title: `Closed ${i}` })),
      dueTasks: Array.from({ length: 5 }, (_, i) => ({ id: `d-${i}`, title: `Due ${i}` }))
    };

    // Total 15 events
    const allEvents = component.getAllCellEvents(mockCell);
    expect(allEvents.length).toBe(15);

    const visible = component.getVisibleEvents(mockCell);
    expect(visible.length).toBe(3);

    const overflow = component.getOverflowCount(mockCell);
    expect(overflow).toBe(12);
  });
});
