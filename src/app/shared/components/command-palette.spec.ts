import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandPaletteComponent } from './command-palette';
import { Task } from '../../core/models/task.model';
import { signal } from '@angular/core';

describe('CommandPaletteComponent', () => {
  let component: CommandPaletteComponent;
  let mockTaskService: any;
  let mockWorkspaceService: any;
  let mockProjectService: any;
  let mockThemeService: any;
  let mockElementRef: any;

  beforeEach(() => {
    vi.useFakeTimers();

    const tasksSignal = signal<Task[]>([]);

    mockTaskService = {
      tasks: tasksSignal
    };

    mockWorkspaceService = {
      workspaces: [
        { id: '01 DASHBOARD', name: 'Dashboard', desc: 'Main view', code: 'DB', icon: 'fi fi-rr-apps' }
      ],
      commandPaletteOpen: signal(true),
      setWorkspace: vi.fn(),
      openCreateTaskModal: vi.fn(),
      openReportIssueModal: vi.fn()
    };

    mockProjectService = {
      projects: signal([]),
      setActiveProject: vi.fn()
    };

    mockThemeService = {
      isDarkMode: signal(true),
      toggleTheme: vi.fn()
    };

    mockElementRef = {
      nativeElement: document.createElement('div')
    };

    component = new CommandPaletteComponent(
      mockWorkspaceService,
      mockTaskService,
      mockProjectService,
      mockThemeService,
      mockElementRef
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  describe('Keyboard Navigation & Auto-Scrolling', () => {
    beforeEach(() => {
      const mockTasks: Task[] = [];
      for (let i = 1; i <= 20; i++) {
        mockTasks.push({
          id: `task-${i}`,
          title: `Scroll Item ${i}`,
          type: 'task',
          status: 'todo',
          priority: 'medium',
          projectId: 'p1',
          createdAt: new Date().toISOString()
        } as Task);
      }
      mockTaskService.tasks.set(mockTasks);
    });

    it('should navigate down and up with Arrow keys', () => {
      expect(component.selectedIndex()).toBe(0);

      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
      component.onKeydown(downEvent);
      expect(component.selectedIndex()).toBe(1);

      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
      component.onKeydown(upEvent);
      expect(component.selectedIndex()).toBe(0);
    });

    it('should navigate to top and bottom with Home and End keys', () => {
      const total = component.filteredItems().length;

      const endEvent = new KeyboardEvent('keydown', { key: 'End', cancelable: true });
      component.onKeydown(endEvent);
      expect(component.selectedIndex()).toBe(total - 1);

      const homeEvent = new KeyboardEvent('keydown', { key: 'Home', cancelable: true });
      component.onKeydown(homeEvent);
      expect(component.selectedIndex()).toBe(0);
    });

    it('should navigate in pages with PageUp and PageDown keys', () => {
      const pageDownEvent = new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true });
      component.onKeydown(pageDownEvent);
      expect(component.selectedIndex()).toBe(5);

      const pageUpEvent = new KeyboardEvent('keydown', { key: 'PageUp', cancelable: true });
      component.onKeydown(pageUpEvent);
      expect(component.selectedIndex()).toBe(0);
    });

    it('should prevent mouse hover from stealing selection during keyboard navigation', () => {
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
      component.onKeydown(downEvent);
      expect(component.selectedIndex()).toBe(1);
      expect(component.isKeyboardNavigating).toBe(true);

      // Passive mouse hover over item 10 should be ignored while keyboard navigating
      component.onItemMouseEnter(10);
      expect(component.selectedIndex()).toBe(1);

      // Actual mouse movement re-enables hover selection
      component.onMouseMove();
      expect(component.isKeyboardNavigating).toBe(false);

      component.onItemMouseEnter(10);
      expect(component.selectedIndex()).toBe(10);
    });

    it('should invoke scrollIntoView when scrolling selected item', () => {
      const mockBody = document.createElement('div');
      const mockItem = document.createElement('div');
      mockItem.className = 'palette-item selected';
      const scrollIntoViewSpy = vi.fn();
      mockItem.scrollIntoView = scrollIntoViewSpy;
      mockBody.appendChild(mockItem);

      component.paletteBody = { nativeElement: mockBody } as any;

      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
      component.onKeydown(downEvent);

      vi.advanceTimersByTime(10);
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
    });
  });

  describe('Focus Trap & WCAG Accessibility', () => {
    it('should close command palette on Escape keypress', () => {
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      const preventSpy = vi.spyOn(escapeEvent, 'preventDefault');

      component.handleGlobalKeydown(escapeEvent);

      expect(preventSpy).toHaveBeenCalled();
      expect(mockWorkspaceService.commandPaletteOpen()).toBe(false);
    });

    it('should trap focus when Tab key is pressed', () => {
      const container = document.createElement('div');
      const input = document.createElement('input');
      container.appendChild(input);

      component.paletteCard = { nativeElement: container } as any;
      component.searchInput = { nativeElement: input } as any;

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
      const preventSpy = vi.spyOn(tabEvent, 'preventDefault');

      component.handleGlobalKeydown(tabEvent);

      expect(preventSpy).toHaveBeenCalled();
    });

    it('should restore focus to previously focused element when component is destroyed', () => {
      const dummyButton = document.createElement('button');
      document.body.appendChild(dummyButton);
      dummyButton.focus();

      component.ngOnInit();
      expect(component.previouslyFocusedElement).toBe(dummyButton);

      const focusSpy = vi.spyOn(dummyButton, 'focus');
      component.ngOnDestroy();

      expect(focusSpy).toHaveBeenCalled();
      document.body.removeChild(dummyButton);
    });
  });

  describe('Search Scope & Fuzzy / Multi-field Matching', () => {
    beforeEach(() => {
      mockTaskService.tasks.set([
        {
          id: 'task-101',
          title: 'Fix authentication error on login',
          description: 'OAuth token expires prematurely when user changes password',
          type: 'bug',
          status: 'in_progress',
          priority: 'high',
          labels: ['security', 'auth'],
          assignee: 'Alice',
          projectId: 'p1',
          createdAt: new Date().toISOString()
        } as Task,
        {
          id: 'task-102',
          title: 'Setup user profile avatar compression',
          description: 'Downscale images to 256x256 before uploading to storage bucket',
          type: 'feature',
          status: 'todo',
          priority: 'medium',
          labels: ['frontend', 'media'],
          assignee: 'Bob',
          projectId: 'p1',
          createdAt: new Date().toISOString()
        } as Task
      ]);
    });

    it('should match tasks by ID / key prefix (e.g. #task-101 or 101)', () => {
      component.onSearchInput('#task-101');
      vi.advanceTimersByTime(300);

      const matches = component.filteredItems();
      expect(matches.length).toBe(1);
      expect(matches[0].title).toBe('Fix authentication error on login');
    });

    it('should match tasks by description text', () => {
      component.onSearchInput('OAuth token');
      vi.advanceTimersByTime(300);

      const matches = component.filteredItems();
      expect(matches.length).toBe(1);
      expect(matches[0].title).toBe('Fix authentication error on login');
    });

    it('should match tasks by labels', () => {
      component.onSearchInput('security');
      vi.advanceTimersByTime(300);

      const matches = component.filteredItems();
      expect(matches.length).toBe(1);
      expect(matches[0].title).toBe('Fix authentication error on login');
    });

    it('should match multi-word tokens out of order (e.g. "compression setup")', () => {
      component.onSearchInput('compression setup');
      vi.advanceTimersByTime(300);

      const matches = component.filteredItems();
      expect(matches.length).toBe(1);
      expect(matches[0].title).toBe('Setup user profile avatar compression');
    });

    it('should rank exact title matches higher than description matches', () => {
      mockTaskService.tasks.set([
        {
          id: 'task-201',
          title: 'Database setup guide',
          description: 'General overview',
          type: 'story',
          status: 'todo',
          priority: 'low',
          projectId: 'p1',
          createdAt: new Date().toISOString()
        } as Task,
        {
          id: 'task-202',
          title: 'Database',
          description: 'Complete database migration',
          type: 'task',
          status: 'todo',
          priority: 'high',
          projectId: 'p1',
          createdAt: new Date().toISOString()
        } as Task
      ]);

      component.onSearchInput('Database');
      vi.advanceTimersByTime(300);

      const matches = component.filteredItems();
      expect(matches.length).toBe(2);
      expect(matches[0].title).toBe('Database'); // Exact title match ranked first
    });
  });

  describe('Search Debounce', () => {
    it('should debounce search input changes by 300ms', () => {
      component.onSearchInput('t');
      expect(component.rawSearchQuery()).toBe('t');
      expect(component.searchQuery()).toBe('');

      vi.advanceTimersByTime(100);
      component.onSearchInput('task');
      expect(component.rawSearchQuery()).toBe('task');
      expect(component.searchQuery()).toBe(''); // Still empty before 300ms

      vi.advanceTimersByTime(300);
      expect(component.searchQuery()).toBe('task');
    });

    it('should update query immediately when search input is cleared', () => {
      component.onSearchInput('query');
      vi.advanceTimersByTime(300);
      expect(component.searchQuery()).toBe('query');

      component.onSearchInput('');
      expect(component.rawSearchQuery()).toBe('');
      expect(component.searchQuery()).toBe('');
    });

    it('should flush pending debounced query if Enter key is pressed', () => {
      component.onSearchInput('Dashboard');
      expect(component.searchQuery()).toBe(''); // pending

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      component.onKeydown(enterEvent);

      expect(component.searchQuery()).toBe('Dashboard');
      expect(mockWorkspaceService.setWorkspace).toHaveBeenCalledWith('01 DASHBOARD');
    });

    it('should clean up pending timer on destroy', () => {
      component.onSearchInput('pending');
      component.ngOnDestroy();
      vi.advanceTimersByTime(300);
      expect(component.searchQuery()).toBe('');
    });
  });

  describe('Performance with 1000+ Tasks', () => {
    it('should cap returned results to MAX_RESULTS (50) when 1000+ tasks exist', () => {
      const mockTasks: Task[] = [];
      for (let i = 1; i <= 1200; i++) {
        mockTasks.push({
          id: `task-${i}`,
          title: `Bulk Task Item ${i}`,
          type: 'feature',
          status: 'todo',
          priority: 'medium',
          projectId: 'p1',
          createdAt: new Date().toISOString()
        } as Task);
      }
      mockTaskService.tasks.set(mockTasks);

      expect(component.items().length).toBeGreaterThan(1200);
      // filteredItems should be capped at 50
      expect(component.filteredItems().length).toBe(50);
    });

    it('should break search iteration early once 50 matches are found', () => {
      const mockTasks: Task[] = [];
      for (let i = 1; i <= 1500; i++) {
        mockTasks.push({
          id: `task-${i}`,
          title: `Performance Test Item ${i}`,
          type: 'bug',
          status: 'todo',
          priority: 'high',
          projectId: 'p1',
          createdAt: new Date().toISOString()
        } as Task);
      }
      mockTaskService.tasks.set(mockTasks);

      component.onSearchInput('Performance');
      vi.advanceTimersByTime(300);

      const matches = component.filteredItems();
      expect(matches.length).toBe(50);
      expect(matches[0].title).toContain('Performance Test Item');
    });
  });
});
