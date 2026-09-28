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

    component = new CommandPaletteComponent(
      mockWorkspaceService,
      mockTaskService,
      mockProjectService,
      mockThemeService
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
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
      vi.advanceTimersByTime(200);

      const matches = component.filteredItems();
      expect(matches.length).toBe(1);
      expect(matches[0].title).toBe('Fix authentication error on login');
    });

    it('should match tasks by description text', () => {
      component.onSearchInput('OAuth token');
      vi.advanceTimersByTime(200);

      const matches = component.filteredItems();
      expect(matches.length).toBe(1);
      expect(matches[0].title).toBe('Fix authentication error on login');
    });

    it('should match tasks by labels', () => {
      component.onSearchInput('security');
      vi.advanceTimersByTime(200);

      const matches = component.filteredItems();
      expect(matches.length).toBe(1);
      expect(matches[0].title).toBe('Fix authentication error on login');
    });

    it('should match multi-word tokens out of order (e.g. "compression setup")', () => {
      component.onSearchInput('compression setup');
      vi.advanceTimersByTime(200);

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
      vi.advanceTimersByTime(200);

      const matches = component.filteredItems();
      expect(matches.length).toBe(2);
      expect(matches[0].title).toBe('Database'); // Exact title match ranked first
    });
  });

  describe('Search Debounce', () => {
    it('should debounce search input changes by 200ms', () => {
      component.onSearchInput('t');
      expect(component.rawSearchQuery()).toBe('t');
      expect(component.searchQuery()).toBe('');

      vi.advanceTimersByTime(100);
      component.onSearchInput('task');
      expect(component.rawSearchQuery()).toBe('task');
      expect(component.searchQuery()).toBe(''); // Still empty before 200ms

      vi.advanceTimersByTime(200);
      expect(component.searchQuery()).toBe('task');
    });

    it('should update query immediately when search input is cleared', () => {
      component.onSearchInput('query');
      vi.advanceTimersByTime(200);
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
      vi.advanceTimersByTime(200);

      const matches = component.filteredItems();
      expect(matches.length).toBe(50);
      expect(matches[0].title).toContain('Performance Test Item');
    });
  });
});
