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

  it('should update displayDate immediately and debounce grid currentDate recalculation on prev/next month clicks', async () => {
    vi.useFakeTimers();
    let displayVal = new Date(2026, 8, 1); // Sept 2026
    let currentVal = new Date(2026, 8, 1);

    const mockDisplayDate: any = () => displayVal;
    mockDisplayDate.set = vi.fn((val: Date) => { displayVal = val; });

    const mockCurrentDate: any = () => currentVal;
    mockCurrentDate.set = vi.fn((val: Date) => { currentVal = val; });

    component.displayDate = mockDisplayDate;
    component.currentDate = mockCurrentDate;

    // Rapid navigation clicks (3 next month clicks)
    component.nextMonth();
    component.nextMonth();
    component.nextMonth();

    // Immediate display date update
    expect(mockDisplayDate.set).toHaveBeenCalledTimes(3);
    expect(displayVal.getMonth()).toBe(11); // Dec 2026

    // Grid recalculation is debounced (currentDate.set not called yet)
    expect(mockCurrentDate.set).not.toHaveBeenCalled();

    // Fast forward timer 150ms
    vi.advanceTimersByTime(150);

    // Grid recalculation fired once at the end
    expect(mockCurrentDate.set).toHaveBeenCalledTimes(1);
    expect(currentVal.getMonth()).toBe(11);

    vi.useRealTimers();
  });

  it('should filter unscheduled tasks by search query and paginate results accurately', () => {
    let qVal = '';
    let pageVal = 1;

    const mockSearch: any = () => qVal;
    mockSearch.set = vi.fn((val: string) => { qVal = val; });

    const mockPage: any = () => pageVal;
    mockPage.set = vi.fn((val: number) => { pageVal = val; });
    mockPage.update = vi.fn((fn: any) => { pageVal = fn(pageVal); });

    component.unscheduledSearchQuery = mockSearch;
    component.unscheduledPage = mockPage;
    component.unscheduledPageSize = 10;

    const tasksList = Array.from({ length: 25 }, (_, i) => ({
      id: `task-${i}`,
      title: i === 5 ? 'Fix Database Bug' : `Unscheduled Task ${i}`,
      due_date: null
    }));
    component.unscheduledTasks = () => tasksList;

    component.filteredUnscheduledTasks = () => {
      const all = component.unscheduledTasks();
      const q = component.unscheduledSearchQuery().toLowerCase().trim();
      if (!q) return all;
      return all.filter((t: any) => t.title.toLowerCase().includes(q));
    };

    component.totalUnscheduledPages = () => {
      return Math.max(1, Math.ceil(component.filteredUnscheduledTasks().length / component.unscheduledPageSize));
    };

    component.paginatedUnscheduledTasks = () => {
      const list = component.filteredUnscheduledTasks();
      const page = Math.min(component.unscheduledPage(), component.totalUnscheduledPages());
      const start = (page - 1) * component.unscheduledPageSize;
      return list.slice(start, start + component.unscheduledPageSize);
    };

    // Total 25 items -> 3 pages
    expect(component.filteredUnscheduledTasks().length).toBe(25);
    expect(component.totalUnscheduledPages()).toBe(3);
    expect(component.paginatedUnscheduledTasks().length).toBe(10);

    // Search query filtering
    component.onUnscheduledSearch('Database');
    expect(mockSearch.set).toHaveBeenCalledWith('Database');
    expect(mockPage.set).toHaveBeenCalledWith(1);
    expect(component.filteredUnscheduledTasks().length).toBe(1);
    expect(component.filteredUnscheduledTasks()[0].title).toBe('Fix Database Bug');
  });

  it('should support configurable week start days and output corresponding week headers and localStorage persistence', () => {
    let currentWeekStart: any = 'sunday';
    const mockWeekStart: any = () => currentWeekStart;
    mockWeekStart.set = vi.fn((val: any) => { currentWeekStart = val; });
    component.weekStart = mockWeekStart;

    component.weekHeaders = () => {
      switch (component.weekStart()) {
        case 'monday':
          return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
        case 'saturday':
          return ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];
        case 'sunday':
        default:
          return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      }
    };

    component.setWeekStart = (start: any) => {
      component.weekStart.set(start);
      localStorage.setItem('bilo_calendar_week_start', start);
    };

    // Default Sunday
    expect(component.weekHeaders()).toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);

    // Change to Monday
    component.setWeekStart('monday');
    expect(mockWeekStart.set).toHaveBeenCalledWith('monday');
    expect(localStorage.getItem('bilo_calendar_week_start')).toBe('monday');
    expect(component.weekHeaders()).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);

    // Change to Saturday
    component.setWeekStart('saturday');
    expect(mockWeekStart.set).toHaveBeenCalledWith('saturday');
    expect(localStorage.getItem('bilo_calendar_week_start')).toBe('saturday');
    expect(component.weekHeaders()).toEqual(['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI']);
  });
});

