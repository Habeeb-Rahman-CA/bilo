import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { App } from './app';
import { WorkspaceService } from './core/services/workspace.service';
import { SyncService } from './core/services/sync.service';
import { UpdateService } from './core/services/update.service';
import { TaskShareService } from './core/services/task-share.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';
import { ProjectService } from './core/services/project.service';
import { TaskService } from './core/services/task.service';
import { SupabaseService } from './core/services/supabase.service';
import { registerOpenPopover } from './shared/components/select';

vi.mock('@angular/core', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    effect: (fn: Function) => {
      try { fn(); } catch {}
    }
  };
});

describe('App Popover Management', () => {
  let app: App;

  beforeEach(() => {
    localStorage.clear();
    const themeService = new ThemeService();
    const workspaceService = new WorkspaceService(themeService);
    const syncService = new SyncService();
    const updateService = new UpdateService();
    const taskShareService = new TaskShareService();
    const pushService = new PushNotificationService();
    const supabaseService = new SupabaseService();
    const mockAuthService: any = {
      user: signal(null),
      userAvatar: signal(null),
      userEmail: signal('user@example.com'),
      authModalOpen: signal(false),
      authLoading: signal(false),
      signOut: vi.fn(),
      closeAuthModal: vi.fn()
    };
    const projectService = new ProjectService(supabaseService, syncService, mockAuthService);
    const taskService = new TaskService(supabaseService, syncService, projectService, pushService, mockAuthService);

    app = new App(
      workspaceService,
      syncService,
      updateService,
      taskShareService,
      pushService,
      themeService,
      mockAuthService,
      projectService,
      taskService,
      supabaseService
    );
  });

  it('should initialize with popovers closed', () => {
    expect(app.userMenuOpen()).toBe(false);
    expect(app.notificationMenuOpen()).toBe(false);
  });

  it('should enforce single open popover when toggling between User Menu and Notification Menu', () => {
    const mockEvent = new MouseEvent('click');
    vi.spyOn(mockEvent, 'stopPropagation');

    app.openUserMenu();
    expect(app.userMenuOpen()).toBe(true);
    expect(app.notificationMenuOpen()).toBe(false);

    app.openNotificationMenu();
    expect(app.notificationMenuOpen()).toBe(true);
    expect(app.userMenuOpen()).toBe(false);
  });

  it('should automatically close active App popover when another component registers an open popover', () => {
    app.openUserMenu();
    expect(app.userMenuOpen()).toBe(true);

    const dummyPopover = { closePopover: vi.fn() };
    registerOpenPopover(dummyPopover);

    expect(app.userMenuOpen()).toBe(false);
  });
});
