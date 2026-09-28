import { Component, signal, computed, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../core/services/workspace.service';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { ThemeService } from '../../core/services/theme.service';

interface PaletteItem {
  id: string;
  type: 'workspace' | 'action' | 'task' | 'project';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: string;
  action: () => void;
  key?: string;
  description?: string;
  searchContent?: string;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close()" role="dialog" aria-modal="true" aria-label="Command Palette">
      <div #paletteCard class="command-palette-card paper-panel" (click)="$event.stopPropagation()">
        <!-- Search Header -->
        <div class="palette-header">
          <i class="fi fi-rr-search search-icon" aria-hidden="true"></i>
          <input
            #searchInput
            type="text"
            class="palette-input font-mono"
            placeholder="Type a command, task, project, or workspace..."
            aria-label="Search command, task, project, or workspace"
            [ngModel]="rawSearchQuery()"
            (ngModelChange)="onSearchInput($event)"
            (keydown)="onKeydown($event)"
          />
        </div>

        <!-- Results List Container -->
        <div #paletteBody class="palette-body">
          @if (filteredItems().length === 0) {
            <div class="empty-results font-mono" role="status">
              <p>No matching commands found for "{{ searchQuery() }}"</p>
            </div>
          } @else {
            <div class="results-list" role="listbox" aria-label="Command palette results" (mousemove)="onMouseMove()">
              @for (item of filteredItems(); track item.id; let idx = $index) {
                <div
                  class="palette-item"
                  role="option"
                  [attr.aria-selected]="selectedIndex() === idx"
                  [class.selected]="selectedIndex() === idx"
                  (mouseenter)="onItemMouseEnter(idx)"
                  (click)="execute(item)"
                >
                  <div class="item-left">
                    <i [class]="item.icon"></i>
                    <div class="item-text">
                      <span class="item-title">{{ item.title }}</span>
                      @if (item.subtitle) {
                        <span class="item-subtitle font-mono">{{ item.subtitle }}</span>
                      }
                    </div>
                  </div>

                  @if (item.badge) {
                    <span class="badge-mono">{{ item.badge }}</span>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Palette Footer -->
        <div class="palette-footer font-mono">
          <div class="footer-hint">
            <span>Use Arrow Keys to Navigate & Enter to Select</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .command-palette-card {
      width: 100%;
      max-width: 620px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      box-shadow: var(--shadow-modal);
      overflow: hidden;
      animation: paletteIn 0.12s ease-out;
    }

    .palette-header {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
    }
    .search-icon {
      font-size: 1rem;
      color: var(--text-muted);
    }
    .palette-input {
      flex: 1;
      background: transparent;
      border: none;
      font-size: 0.95rem;
      color: var(--text-main);
      outline: none;
    }

    .palette-body {
      max-height: 380px;
      overflow-y: auto;
      padding: 0.4rem;
      scroll-behavior: smooth;
    }
    .empty-results {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.8rem;
    }
    .results-list {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .palette-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.55rem 0.75rem;
      border-radius: var(--radius-xs);
      cursor: pointer;
      border: 1px solid transparent;
      transition: var(--transition-fast);
    }
    .palette-item.selected {
      background: var(--bg-surface-hover);
      border-color: var(--border-subtle);
    }
    .item-left {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .item-left i {
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    .item-text {
      display: flex;
      flex-direction: column;
    }
    .item-title {
      font-size: 0.825rem;
      font-weight: 500;
      color: var(--text-main);
    }
    .item-subtitle {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    .palette-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1rem;
      background: var(--bg-surface-subtle);
      border-top: 1px solid var(--border-subtle);
      font-size: 0.7rem;
      color: var(--text-muted);
    }
    .footer-hint {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    @keyframes paletteIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class CommandPaletteComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('paletteBody') paletteBody!: ElementRef<HTMLDivElement>;
  @ViewChild('paletteCard') paletteCard!: ElementRef<HTMLDivElement>;

  selectedIndex = signal<number>(0);
  previouslyFocusedElement: HTMLElement | null = null;

  constructor(
    public workspaceService: WorkspaceService,
    public taskService: TaskService,
    public projectService: ProjectService,
    public themeService: ThemeService,
    private elementRef: ElementRef
  ) { }

  ngOnInit() {
    if (typeof document !== 'undefined') {
      this.previouslyFocusedElement = document.activeElement as HTMLElement;
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 50);
  }

  close() {
    this.workspaceService.commandPaletteOpen.set(false);
  }

  items = computed<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];

    // Workspaces
    for (const ws of this.workspaceService.workspaces) {
      list.push({
        id: `ws-${ws.id}`,
        type: 'workspace',
        title: `Workspace: ${ws.name}`,
        subtitle: ws.desc,
        badge: ws.code,
        icon: ws.icon,
        key: ws.code,
        description: ws.desc,
        searchContent: `${ws.name} ${ws.desc} ${ws.code} ${ws.id}`.toLowerCase(),
        action: () => {
          this.workspaceService.setWorkspace(ws.id);
          this.close();
        }
      });
    }

    // Quick Actions
    const actionToggleTitle = this.themeService.isDarkMode() ? 'Action: Switch to Light Theme' : 'Action: Switch to Black & Grey Dark Theme';
    list.push({
      id: 'action-toggle-theme',
      type: 'action',
      title: actionToggleTitle,
      subtitle: 'Toggle workspace theme styling and color system',
      badge: 'THEME',
      icon: this.themeService.isDarkMode() ? 'fi fi-rr-sun' : 'fi fi-rr-moon-stars',
      searchContent: `${actionToggleTitle} Toggle workspace theme styling dark light color system THEME`.toLowerCase(),
      action: () => {
        this.themeService.toggleTheme();
        this.close();
      }
    });

    list.push({
      id: 'action-new-task',
      type: 'action',
      title: 'Action: Create New Task',
      subtitle: 'Add a new issue or task to active project',
      badge: 'TASK',
      icon: 'fi fi-rr-plus',
      searchContent: 'Action: Create New Task Add a new issue or task to active project TASK issue feature bug'.toLowerCase(),
      action: () => {
        this.workspaceService.openCreateTaskModal();
        this.close();
      }
    });

    list.push({
      id: 'action-new-project',
      type: 'action',
      title: 'Action: Create New Project',
      subtitle: 'Add a new project workspace',
      badge: 'PROJ',
      icon: 'fi fi-rr-folder-add',
      searchContent: 'Action: Create New Project Add a new project workspace PROJ'.toLowerCase(),
      action: () => {
        this.workspaceService.setWorkspace('06 SETTINGS');
        this.close();
      }
    });

    list.push({
      id: 'action-report-issue',
      type: 'action',
      title: 'Action: Submit Feedback & Bug Report',
      subtitle: 'Submit feedback, feature requests, or bug reports directly to project bilo',
      badge: 'FEEDBACK',
      icon: 'fi fi-rr-bug text-rose',
      searchContent: 'Action: Submit Feedback & Bug Report Submit feedback, feature requests, or bug reports directly to project bilo FEEDBACK bug'.toLowerCase(),
      action: () => {
        this.workspaceService.openReportIssueModal();
        this.close();
      }
    });

    // Tasks
    for (const t of this.taskService.tasks()) {
      const shortId = t.id.slice(0, 8);
      const labelsStr = (t.labels || []).join(' ');
      const descStr = t.description || '';
      const fullKey = t.id;
      const displaySubtitle = `Task #${shortId} • Status: ${t.status} • Priority: ${t.priority}`;
      const searchBlob = `${t.title} ${fullKey} #${shortId} ${descStr} ${t.type} ${t.status} ${t.priority} ${t.severity || ''} ${labelsStr} ${t.assignee || ''} ${t.reporter || ''}`.toLowerCase();

      list.push({
        id: `task-${t.id}`,
        type: 'task',
        title: t.title,
        subtitle: displaySubtitle,
        badge: t.type.toUpperCase(),
        icon: t.type === 'bug' ? 'fi fi-rr-bug' : 'fi fi-rr-check-circle',
        key: fullKey,
        description: descStr,
        searchContent: searchBlob,
        action: () => {
          this.workspaceService.setWorkspace('03 TASKS');
          this.close();
        }
      });
    }

    // Projects
    for (const p of this.projectService.projects()) {
      const projKey = p.slug || p.id;
      const projDesc = p.description || '';
      const projLabels = (p.labels || []).join(' ');
      const searchBlob = `${p.name} ${projKey} ${p.id} ${projDesc} ${p.status} ${projLabels}`.toLowerCase();

      list.push({
        id: `proj-${p.id}`,
        type: 'project',
        title: `Project: ${p.name}`,
        subtitle: `${projDesc || 'No description'} • Status: ${p.status}`,
        badge: 'PROJECT',
        icon: 'fi fi-rr-box',
        key: projKey,
        description: projDesc,
        searchContent: searchBlob,
        action: () => {
          this.projectService.setActiveProject(p);
          this.workspaceService.setWorkspace('06 SETTINGS');
          this.close();
        }
      });
    }

    return list;
  });

  readonly MAX_RESULTS = 50;
  readonly DEBOUNCE_MS = 200;

  filteredItems = computed<PaletteItem[]>(() => {
    const rawQ = this.searchQuery().trim().toLowerCase();
    const allItems = this.items();
    if (!rawQ) return allItems.slice(0, this.MAX_RESULTS);

    // Split search into lowercased tokens for multi-word fuzzy / token search
    const tokens = rawQ.split(/\s+/).filter(Boolean);
    const scoredMatches: { item: PaletteItem; score: number }[] = [];

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const content = item.searchContent || `${item.title} ${item.subtitle || ''} ${item.badge || ''}`.toLowerCase();
      const titleLower = item.title.toLowerCase();
      const keyLower = (item.key || '').toLowerCase();
      const descLower = (item.description || '').toLowerCase();

      // Check if ALL query tokens are matched somewhere in title, key, description, or searchContent
      let allMatch = true;
      for (const token of tokens) {
        const cleanToken = token.startsWith('#') ? token.slice(1) : token;
        
        const inTitle = titleLower.includes(token);
        const inKey = keyLower.includes(token) || (cleanToken.length > 0 && keyLower.includes(cleanToken));
        const inDesc = descLower.includes(token);
        const inContent = content.includes(token) || (cleanToken.length > 0 && content.includes(cleanToken));

        if (!inTitle && !inKey && !inDesc && !inContent) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        let score = 0;

        // Title matches
        if (titleLower === rawQ) score += 1000;
        else if (titleLower.startsWith(rawQ)) score += 500;
        else if (titleLower.includes(rawQ)) score += 300;

        // Key / ID matches (e.g., #task-123, task-123, 123)
        if (keyLower) {
          const cleanQ = rawQ.startsWith('#') ? rawQ.slice(1) : rawQ;
          if (keyLower === cleanQ || keyLower === rawQ) score += 800;
          else if (keyLower.includes(cleanQ) || keyLower.includes(rawQ)) score += 450;
        }

        // Subtitle / Description matches
        if (descLower && descLower.includes(rawQ)) score += 150;

        // Token hit bonus distribution
        for (const token of tokens) {
          if (titleLower.includes(token)) score += 60;
          if (keyLower.includes(token)) score += 50;
          if (descLower.includes(token)) score += 20;
        }

        scoredMatches.push({ item, score });
      }
    }

    // Sort matching results by highest relevance score first
    scoredMatches.sort((a, b) => b.score - a.score);

    return scoredMatches.map(m => m.item).slice(0, this.MAX_RESULTS);
  });

  rawSearchQuery = signal<string>('');
  searchQuery = signal<string>('');
  private searchDebounceTimer: any = null;

  ngOnDestroy() {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    // Restore focus back to the element that had focus before command palette opened
    if (this.previouslyFocusedElement && typeof this.previouslyFocusedElement.focus === 'function') {
      try {
        this.previouslyFocusedElement.focus();
      } catch { }
    }
  }

  @HostListener('keydown', ['$event'])
  handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }

    if (e.key === 'Tab') {
      this.trapFocus(e);
    }
  }

  private trapFocus(e: KeyboardEvent) {
    const cardContainer = this.paletteCard?.nativeElement || this.elementRef?.nativeElement;
    if (!cardContainer) return;

    const focusables = Array.from(
      cardContainer.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="option"]:not([disabled])'
      )
    ).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === this.searchInput?.nativeElement);

    if (focusables.length === 0) return;

    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];
    const activeEl = document.activeElement;

    if (e.shiftKey) {
      if (activeEl === firstEl || !cardContainer.contains(activeEl)) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (activeEl === lastEl || !cardContainer.contains(activeEl)) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }

  onSearchInput(value: string) {
    this.rawSearchQuery.set(value);
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    // Immediate update when query is cleared for instant UI responsiveness
    if (!value.trim()) {
      this.searchQuery.set('');
      this.selectedIndex.set(0);
      return;
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.searchQuery.set(value);
      this.selectedIndex.set(0);
      this.scrollToSelected();
      this.searchDebounceTimer = null;
    }, this.DEBOUNCE_MS);
  }

  isKeyboardNavigating = false;

  onMouseMove() {
    this.isKeyboardNavigating = false;
  }

  onItemMouseEnter(idx: number) {
    if (!this.isKeyboardNavigating) {
      this.selectedIndex.set(idx);
    }
  }

  onKeydown(e: KeyboardEvent) {
    // If user hits Enter while search input is still debouncing, flush pending search query immediately
    if (e.key === 'Enter' && this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
      this.searchQuery.set(this.rawSearchQuery());
      this.selectedIndex.set(0);
    }

    const total = this.filteredItems().length;
    if (total === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.isKeyboardNavigating = true;
      this.selectedIndex.update(i => (i + 1) % total);
      this.scrollToSelected();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.isKeyboardNavigating = true;
      this.selectedIndex.update(i => (i - 1 + total) % total);
      this.scrollToSelected();
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.isKeyboardNavigating = true;
      this.selectedIndex.set(0);
      this.scrollToSelected();
    } else if (e.key === 'End') {
      e.preventDefault();
      this.isKeyboardNavigating = true;
      this.selectedIndex.set(total - 1);
      this.scrollToSelected();
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      this.isKeyboardNavigating = true;
      this.selectedIndex.update(i => Math.min(i + 5, total - 1));
      this.scrollToSelected();
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      this.isKeyboardNavigating = true;
      this.selectedIndex.update(i => Math.max(i - 5, 0));
      this.scrollToSelected();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = this.filteredItems()[this.selectedIndex()];
      if (current) {
        this.execute(current);
      }
    }
  }

  private scrollToSelected() {
    setTimeout(() => {
      const body = this.paletteBody?.nativeElement;
      if (!body) return;

      const selectedEl = body.querySelector('.palette-item.selected') as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }, 0);
  }

  execute(item: PaletteItem) {
    item.action();
  }
}
