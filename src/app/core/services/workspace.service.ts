import { Injectable, signal } from '@angular/core';
import { ThemeService } from './theme.service';

export type WorkspaceSection = '01 TODAY' | '02 PROJECTS' | '03 BACKLOG' | '04 TASKS' | '05 CALENDAR' | '06 ARCHIVE';

export interface WorkspaceItem {
  id: WorkspaceSection;
  key: string;
  name: string;
  code: string;
  icon: string;
  desc: string;
}

const WORKSPACE_HASH_MAP: Record<string, WorkspaceSection> = {
  'today': '01 TODAY',
  'projects': '02 PROJECTS',
  'backlog': '03 BACKLOG',
  'tasks': '04 TASKS',
  'board': '04 TASKS',
  'calendar': '05 CALENDAR',
  'archive': '06 ARCHIVE'
};

const WORKSPACE_SECTION_TO_HASH: Record<WorkspaceSection, string> = {
  '01 TODAY': 'today',
  '02 PROJECTS': 'projects',
  '03 BACKLOG': 'backlog',
  '04 TASKS': 'tasks',
  '05 CALENDAR': 'calendar',
  '06 ARCHIVE': 'archive'
};

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {
  activeWorkspace = signal<WorkspaceSection>(this.getInitialWorkspace());
  commandPaletteOpen = signal<boolean>(false);
  shortcutsModalOpen = signal<boolean>(false);
  globalCreateTaskModalOpen = signal<boolean>(false);

  readonly workspaces: WorkspaceItem[] = [
    { id: '01 TODAY', key: '1', name: 'DASHBOARD', code: '01', icon: 'fi fi-rr-dashboard', desc: 'Workspace dashboard & metrics' },
    { id: '03 BACKLOG', key: '2', name: 'BACKLOG', code: '02', icon: 'fi fi-rr-list-check', desc: 'Workspace task backlog' },
    { id: '04 TASKS', key: '3', name: 'BOARD', code: '03', icon: 'fi fi-rr-layout-fluid', desc: 'Kanban workflow board' },
    { id: '05 CALENDAR', key: '4', name: 'CALENDAR', code: '04', icon: 'fi fi-rr-calendar', desc: 'Workspace month calendar' },
    { id: '06 ARCHIVE', key: '5', name: 'ARCHIVE', code: '05', icon: 'fi fi-rr-box-alt', desc: 'Completed work history & exports' }
  ];

  constructor(public themeService: ThemeService) {
    this.initKeyboardListeners();
    this.initHashListener();
  }

  private getInitialWorkspace(): WorkspaceSection {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').toLowerCase().trim();
      if (hash && WORKSPACE_HASH_MAP[hash]) {
        return WORKSPACE_HASH_MAP[hash];
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
      const hash = window.location.hash.replace('#', '').toLowerCase().trim();
      if (hash && WORKSPACE_HASH_MAP[hash]) {
        this.setWorkspace(WORKSPACE_HASH_MAP[hash], false);
      }
    });
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

  private initKeyboardListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Don't intercept shortcuts when typing in inputs/textareas/contenteditable
      const target = e.target as HTMLElement;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      // Global hotkeys (Cmd+K / Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggleCommandPalette();
        return;
      }

      // Escape closes modals
      if (e.key === 'Escape') {
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

      // Numeric shortcuts 1-6 for switching workspace
      if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        const item = this.workspaces.find(w => w.key === e.key);
        if (item) {
          e.preventDefault();
          this.setWorkspace(item.id);
        }
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
