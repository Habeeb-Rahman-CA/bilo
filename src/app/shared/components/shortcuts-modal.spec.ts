import { describe, it, expect, beforeEach } from 'vitest';
import { ShortcutsModalComponent } from './shortcuts-modal';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ThemeService } from '../../core/services/theme.service';

describe('ShortcutsModalComponent', () => {
  let workspaceService: WorkspaceService;
  let component: ShortcutsModalComponent;

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    const themeService = new ThemeService();
    workspaceService = new WorkspaceService(themeService);
    workspaceService.shortcutsModalOpen.set(true);
    component = new ShortcutsModalComponent(workspaceService);
  });

  it('should initialize with shortcuts active tab', () => {
    expect(component.activeTab()).toBe('shortcuts');
  });

  it('should allow changing active tabs', () => {
    component.activeTab.set('features');
    expect(component.activeTab()).toBe('features');

    component.activeTab.set('markdown');
    expect(component.activeTab()).toBe('markdown');

    component.activeTab.set('workflows');
    expect(component.activeTab()).toBe('workflows');
  });

  it('should set shortcutsModalOpen to false on close()', () => {
    expect(workspaceService.shortcutsModalOpen()).toBe(true);
    component.close();
    expect(workspaceService.shortcutsModalOpen()).toBe(false);
  });

  it('should expose dynamic workspace navigation list from workspaceService.workspaces', () => {
    expect(workspaceService.workspaces.length).toBeGreaterThan(0);
    const firstWorkspace = workspaceService.workspaces[0];
    expect(firstWorkspace.id).toBe('01 TODAY');
    expect(firstWorkspace.name).toBe('DASHBOARD');
    expect(firstWorkspace.key).toBe('1');
  });

  it('should expose dynamic global shortcuts list from workspaceService.globalShortcuts', () => {
    expect(workspaceService.globalShortcuts.length).toBeGreaterThan(0);
    const firstGlobal = workspaceService.globalShortcuts[0];
    expect(firstGlobal.title).toBe('Command Palette Search');
    expect(firstGlobal.keys).toEqual(['⌘', 'K']);
  });

  it('should expose dynamic workspaceKeyRange from workspaceService', () => {
    expect(workspaceService.workspaceKeyRange).toBe('1-6');
  });
});
