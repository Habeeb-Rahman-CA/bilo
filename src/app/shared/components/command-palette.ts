import { Component, signal, computed, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
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
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="command-palette-card paper-panel" (click)="$event.stopPropagation()">
        <!-- Search Header -->
        <div class="palette-header">
          <i class="fi fi-rr-search search-icon"></i>
          <input
            #searchInput
            type="text"
            class="palette-input font-mono"
            placeholder="Type a command, task, project, or workspace..."
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchInput($event)"
            (keydown)="onKeydown($event)"
          />
        </div>

        <!-- Results List Container -->
        <div #paletteBody class="palette-body">
          @if (filteredItems().length === 0) {
            <div class="empty-results font-mono">
              <p>No matching commands found for "{{ searchQuery() }}"</p>
            </div>
          } @else {
            <div class="results-list">
              @for (item of filteredItems(); track item.id; let idx = $index) {
                <div
                  class="palette-item"
                  [class.selected]="selectedIndex() === idx"
                  (mouseenter)="selectedIndex.set(idx)"
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
export class CommandPaletteComponent implements AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('paletteBody') paletteBody!: ElementRef<HTMLDivElement>;

  searchQuery = signal<string>('');
  selectedIndex = signal<number>(0);

  constructor(
    public workspaceService: WorkspaceService,
    public taskService: TaskService,
    public projectService: ProjectService,
    public themeService: ThemeService
  ) { }

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
        action: () => {
          this.workspaceService.setWorkspace(ws.id);
          this.close();
        }
      });
    }

    // Quick Actions
    list.push({
      id: 'action-toggle-theme',
      type: 'action',
      title: this.themeService.isDarkMode() ? 'Action: Switch to Light Theme' : 'Action: Switch to Black & Grey Dark Theme',
      subtitle: 'Toggle workspace theme styling and color system',
      badge: 'THEME',
      icon: this.themeService.isDarkMode() ? 'fi fi-rr-sun' : 'fi fi-rr-moon-stars',
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
      action: () => {
        this.workspaceService.setWorkspace('02 PROJECTS');
        this.close();
      }
    });

    list.push({
      id: 'action-report-issue',
      type: 'action',
      title: 'Action: Report Application Issue / Bug',
      subtitle: 'Report a problem or bug directly to project bilo',
      badge: 'REPORT',
      icon: 'fi fi-rr-bug text-rose',
      action: () => {
        this.workspaceService.openReportIssueModal();
        this.close();
      }
    });

    // Tasks
    for (const t of this.taskService.tasks()) {
      list.push({
        id: `task-${t.id}`,
        type: 'task',
        title: t.title,
        subtitle: `Task #${t.id.slice(0, 6)} • Status: ${t.status} • Priority: ${t.priority}`,
        badge: t.type.toUpperCase(),
        icon: t.type === 'bug' ? 'fi fi-rr-bug' : 'fi fi-rr-check-circle',
        action: () => {
          this.workspaceService.setWorkspace('04 TASKS');
          this.close();
        }
      });
    }

    // Projects
    for (const p of this.projectService.projects()) {
      list.push({
        id: `proj-${p.id}`,
        type: 'project',
        title: `Project: ${p.name}`,
        subtitle: `${p.description || 'No description'} • Status: ${p.status}`,
        badge: 'PROJECT',
        icon: 'fi fi-rr-box',
        action: () => {
          this.projectService.activeProject.set(p);
          this.workspaceService.setWorkspace('02 PROJECTS');
          this.close();
        }
      });
    }

    return list;
  });

  filteredItems = computed<PaletteItem[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.items();

    return this.items().filter(item =>
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  });

  onSearchInput(value: string) {
    this.searchQuery.set(value);
    this.selectedIndex.set(0);
    this.scrollToSelected();
  }

  onKeydown(e: KeyboardEvent) {
    const total = this.filteredItems().length;
    if (total === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex.update(i => (i + 1) % total);
      this.scrollToSelected();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex.update(i => (i - 1 + total) % total);
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
      if (!this.paletteBody?.nativeElement) return;
      const selectedEl = this.paletteBody.nativeElement.querySelector('.palette-item.selected') as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  execute(item: PaletteItem) {
    item.action();
  }
}
