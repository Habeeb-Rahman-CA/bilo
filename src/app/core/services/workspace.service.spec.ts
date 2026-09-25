import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceService } from './workspace.service';
import { ThemeService } from './theme.service';

describe('WorkspaceService', () => {
  let themeService: ThemeService;
  let service: WorkspaceService;

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    themeService = new ThemeService();
    service = new WorkspaceService(themeService);
  });

  afterEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('should initialize with default 01 TODAY workspace when no hash or localStorage exists', () => {
    expect(service.activeWorkspace()).toBe('01 TODAY');
  });

  it('should initialize workspace from localStorage', () => {
    localStorage.setItem('bilo_active_workspace', '03 TASKS');
    const newService = new WorkspaceService(themeService);
    expect(newService.activeWorkspace()).toBe('03 TASKS');
  });

  it('should change active workspace and update localStorage and hash when setWorkspace is called', () => {
    service.setWorkspace('02 BACKLOG');
    expect(service.activeWorkspace()).toBe('02 BACKLOG');
    expect(localStorage.getItem('bilo_active_workspace')).toBe('02 BACKLOG');
    expect(window.location.hash).toBe('#backlog');
  });

  it('should toggle command palette state', () => {
    expect(service.commandPaletteOpen()).toBe(false);
    service.toggleCommandPalette();
    expect(service.commandPaletteOpen()).toBe(true);
    service.toggleCommandPalette();
    expect(service.commandPaletteOpen()).toBe(false);
  });

  it('should open and close global create task modal', () => {
    expect(service.globalCreateTaskModalOpen()).toBe(false);
    service.openCreateTaskModal();
    expect(service.globalCreateTaskModalOpen()).toBe(true);
    service.closeCreateTaskModal();
    expect(service.globalCreateTaskModalOpen()).toBe(false);
  });

  it('should open and close report issue modal', () => {
    expect(service.reportIssueModalOpen()).toBe(false);
    service.openReportIssueModal();
    expect(service.reportIssueModalOpen()).toBe(true);
    service.closeReportIssueModal();
    expect(service.reportIssueModalOpen()).toBe(false);
  });

  it('should open and close shortcuts modal', () => {
    expect(service.shortcutsModalOpen()).toBe(false);
    service.toggleShortcutsModal();
    expect(service.shortcutsModalOpen()).toBe(true);
  });

  it('should handle keyboard shortcut Cmd+K for command palette', () => {
    expect(service.commandPaletteOpen()).toBe(false);

    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    window.dispatchEvent(event);

    expect(service.commandPaletteOpen()).toBe(true);
  });

  it('should handle keyboard shortcut Escape to close open modal', () => {
    service.openCreateTaskModal();
    expect(service.globalCreateTaskModalOpen()).toBe(true);

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(service.globalCreateTaskModalOpen()).toBe(false);
  });

  it('should switch workspace via numeric key shortcuts 1-6', () => {
    const event = new KeyboardEvent('keydown', { key: '3' });
    window.dispatchEvent(event);

    expect(service.activeWorkspace()).toBe('03 TASKS');
  });

  it('should toggle theme on T shortcut when not in input element', () => {
    const spy = vi.spyOn(themeService, 'toggleTheme');
    const event = new KeyboardEvent('keydown', { key: 't' });
    window.dispatchEvent(event);

    expect(spy).toHaveBeenCalled();
  });

  it('should ignore N and T shortcuts when target is inside a contenteditable rich text element', () => {
    const spy = vi.spyOn(themeService, 'toggleTheme');
    const contentEditableDiv = document.createElement('div');
    contentEditableDiv.setAttribute('contenteditable', 'true');
    const childSpan = document.createElement('span');
    contentEditableDiv.appendChild(childSpan);
    document.body.appendChild(contentEditableDiv);

    const eventN = new KeyboardEvent('keydown', { key: 'n', bubbles: true });
    Object.defineProperty(eventN, 'target', { value: childSpan });
    window.dispatchEvent(eventN);

    expect(service.globalCreateTaskModalOpen()).toBe(false);

    const eventT = new KeyboardEvent('keydown', { key: 't', bubbles: true });
    Object.defineProperty(eventT, 'target', { value: childSpan });
    window.dispatchEvent(eventT);

    expect(spy).not.toHaveBeenCalled();

    document.body.removeChild(contentEditableDiv);
  });

  it('should sanitize invalid initial URL hash and correct address bar hash to default or saved workspace', () => {
    window.location.hash = '#invalid_route_999';
    const newService = new WorkspaceService(themeService);

    expect(newService.activeWorkspace()).toBe('01 TODAY');
    expect(window.location.hash).toBe('#today');
  });

  it('should sanitize invalid hashchange event and reset active workspace to valid route', () => {
    service.setWorkspace('03 TASKS');
    expect(window.location.hash).toBe('#tasks');

    window.location.hash = '#unknown_hash';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(service.activeWorkspace()).toBe('03 TASKS');
    expect(window.location.hash).toBe('#tasks');
  });
});


