import { Injectable, signal } from '@angular/core';
import { ThemeService } from './theme.service';

export type WorkspaceSection = '01 TODAY' | '02 BACKLOG' | '03 TASKS' | '04 CALENDAR' | '05 ARCHIVE' | '06 SETTINGS';

export interface WorkspaceItem {
  id: WorkspaceSection;
  key: string;
  name: string;
  code: string;
  icon: string;
  desc: string;
}

export interface GlobalShortcutItem {
  title: string;
  desc: string;
  keys: string[];
}

const WORKSPACE_HASH_MAP: Record<string, WorkspaceSection> = {
  'today': '01 TODAY',
  'dashboard': '01 TODAY',
  'backlog': '02 BACKLOG',
  'tasks': '03 TASKS',
  'board': '03 TASKS',
  'calendar': '04 CALENDAR',
  'archive': '05 ARCHIVE',
  'settings': '06 SETTINGS'
};

const WORKSPACE_SECTION_TO_HASH: Record<WorkspaceSection, string> = {
  '01 TODAY': 'today',
  '02 BACKLOG': 'backlog',
  '03 TASKS': 'tasks',
  '04 CALENDAR': 'calendar',
  '05 ARCHIVE': 'archive',
  '06 SETTINGS': 'settings'
};

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {
  activeWorkspace = signal<WorkspaceSection>(this.getInitialWorkspace());
  maintenanceMode = signal<boolean>(false);
  commandPaletteOpen = signal<boolean>(false);
  shortcutsModalOpen = signal<boolean>(false);
  globalCreateTaskModalOpen = signal<boolean>(false);
  reportIssueModalOpen = signal<boolean>(false);

  readonly workspaces: WorkspaceItem[] = [
    { id: '01 TODAY', key: '1', name: 'DASHBOARD', code: '01', icon: 'fi fi-rr-dashboard', desc: 'Workspace dashboard & metrics' },
    { id: '02 BACKLOG', key: '2', name: 'BACKLOG', code: '02', icon: 'fi fi-rr-list-check', desc: 'Workspace task backlog' },
    { id: '03 TASKS', key: '3', name: 'BOARD', code: '03', icon: 'fi fi-rr-layout-fluid', desc: 'Kanban workflow board' },
    { id: '04 CALENDAR', key: '4', name: 'CALENDAR', code: '04', icon: 'fi fi-rr-calendar', desc: 'Workspace month calendar' },
    { id: '05 ARCHIVE', key: '5', name: 'ARCHIVE', code: '05', icon: 'fi fi-rr-box-alt', desc: 'Completed work history & exports' },
    { id: '06 SETTINGS', key: '6', name: 'SETTINGS', code: '06', icon: 'fi fi-rr-settings', desc: 'Workspace settings & status workflow' }
  ];

  readonly globalShortcuts: GlobalShortcutItem[] = [
    { title: 'Command Palette Search', desc: 'Search tasks, projects, or trigger actions', keys: ['⌘', 'K'] },
    { title: 'Create New Task', desc: 'Open quick task creation modal in any workspace', keys: ['N'] },
    { title: 'System Reference Guide', desc: 'Toggle this help & documentation overlay', keys: ['?'] },
    { title: 'Toggle Dark / Light Theme', desc: 'Switch between Black & Grey Dark Theme and Light Theme', keys: ['T'] },
    { title: 'Close Modal / Dismiss Overlay', desc: 'Exit open dialogs, drawers, or palettes', keys: ['ESC'] }
  ];

  get workspaceKeyRange(): string {
    if (!this.workspaces || this.workspaces.length === 0) return '';
    const firstKey = this.workspaces[0].key;
    const lastKey = this.workspaces[this.workspaces.length - 1].key;
    return firstKey === lastKey ? firstKey : `${firstKey}-${lastKey}`;
  }

  constructor(public themeService: ThemeService) {
    this.initKeyboardListeners();
    this.initHashListener();
  }

  private cleanHash(hashOrHref: string): string {
    if (!hashOrHref) return '';
    let hash = hashOrHref;
    if (hash.includes('#')) {
      hash = hash.split('#').pop() || '';
    }
    if (hash.includes('?')) {
      hash = hash.split('?')[0];
    }
    return hash.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase().trim();
  }

  private getSavedOrDefaultWorkspace(): WorkspaceSection {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bilo_active_workspace') as WorkspaceSection;
      if (saved && WORKSPACE_SECTION_TO_HASH[saved]) {
        return saved;
      }
    }
    return '01 TODAY';
  }

  private getInitialWorkspace(): WorkspaceSection {
    if (typeof window !== 'undefined') {
      const rawHash = this.cleanHash(window.location.hash || window.location.href);
      if (rawHash) {
        if (WORKSPACE_HASH_MAP[rawHash]) {
          return WORKSPACE_HASH_MAP[rawHash];
        } else {
          // Invalid or unknown hash: fallback to saved or default workspace and correct the URL
          const fallback = this.getSavedOrDefaultWorkspace();
          const correctedHash = WORKSPACE_SECTION_TO_HASH[fallback] || 'today';
          window.history.replaceState(null, '', '#' + correctedHash);
          return fallback;
        }
      }

      const saved = localStorage.getItem('bilo_active_workspace') as WorkspaceSection;
      if (saved && WORKSPACE_SECTION_TO_HASH[saved]) {
        return saved;
      }
    }
    return '01 TODAY';
  }

  setWorkspace(workspace: WorkspaceSection, updateHash: boolean = true) {
    this.activeWorkspace.set(workspace);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bilo_active_workspace', workspace);
      if (updateHash) {
        const hash = WORKSPACE_SECTION_TO_HASH[workspace] || 'today';
        window.history.replaceState(null, '', '#' + hash);
      }
    }
  }

  private initHashListener() {
    if (typeof window === 'undefined') return;
    window.addEventListener('hashchange', () => {
      const hash = this.cleanHash(window.location.hash);
      if (hash && WORKSPACE_HASH_MAP[hash]) {
        this.setWorkspace(WORKSPACE_HASH_MAP[hash], false);
      } else {
        const fallback = this.activeWorkspace() || this.getSavedOrDefaultWorkspace();
        this.setWorkspace(fallback, true);
      }
    });
  }

  toggleMaintenanceMode() {
    this.maintenanceMode.update(v => !v);
  }

  toggleCommandPalette() {
    this.commandPaletteOpen.update(v => !v);
  }

  toggleShortcutsModal() {
    this.shortcutsModalOpen.update(v => !v);
  }

  openCreateTaskModal() {
    this.globalCreateTaskModalOpen.set(true);
  }

  closeCreateTaskModal() {
    this.globalCreateTaskModalOpen.set(false);
  }

  openReportIssueModal() {
    this.reportIssueModalOpen.set(true);
  }

  closeReportIssueModal() {
    this.reportIssueModalOpen.set(false);
  }

  private initKeyboardListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Don't intercept shortcuts when typing in inputs/textareas/contenteditable
      const target = e.target as HTMLElement;
      const isInput = !!(
        target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          (typeof target.closest === 'function' && (
            !!target.closest('[contenteditable="true"]') ||
            !!target.closest('[contenteditable=""]') ||
            !!target.closest('.ProseMirror') ||
            !!target.closest('.ql-editor') ||
            !!target.closest('[role="textbox"]')
          ))
        )
      );

      // Global hotkeys (Cmd+K / Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggleCommandPalette();
        return;
      }

      // Escape closes modals
      if (e.key === 'Escape') {
        if (this.reportIssueModalOpen()) {
          this.reportIssueModalOpen.set(false);
          return;
        }
        if (this.globalCreateTaskModalOpen()) {
          this.globalCreateTaskModalOpen.set(false);
          return;
        }
        if (this.commandPaletteOpen()) {
          this.commandPaletteOpen.set(false);
          return;
        }
        if (this.shortcutsModalOpen()) {
          this.shortcutsModalOpen.set(false);
          return;
        }
      }

      if (isInput) return;

      // New Task shortcut (N or n)
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        this.openCreateTaskModal();
        return;
      }

      // Numeric shortcuts for switching workspace based on workspaces array
      const navItem = this.workspaces.find(w => w.key === e.key);
      if (navItem && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        this.setWorkspace(navItem.id);
        return;
      }

      // Toggle theme shortcut (T or t)
      if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        this.themeService.toggleTheme();
        return;
      }

      // Help shortcut (?)
      if (e.key === '?') {
        e.preventDefault();
        this.toggleShortcutsModal();
      }
    });
  }
}
