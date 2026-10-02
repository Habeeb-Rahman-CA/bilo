import { Component, ElementRef, EventEmitter, HostListener, Output, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';
import { Project } from '../../core/models/project.model';
import { registerOpenPopover, unregisterOpenPopover } from './select';
import { LazyImageDirective } from '../directives/lazy-image.directive';

@Component({
  selector: 'app-workspace-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule, LazyImageDirective],
  template: `
    <div class="workspace-switcher font-mono" #containerEl>
      <!-- Trigger Pill Button -->
      <button
        type="button"
        class="switcher-trigger paper-panel"
        [class.active]="isOpen()"
        (click)="toggleOpen($event)"
        title="Switch active workspace"
      >
        <div class="trigger-left">
          <div class="ws-avatar" [style.background]="activeProject()?.image_url ? 'transparent' : (activeProject()?.color || '#06b6d4')">
            @if (activeProject()?.image_url) {
              <img [src]="activeProject()!.image_url" class="ws-icon-img" alt="Workspace Icon" />
            } @else if (activeProject()?.icon) {
              <i [class]="activeProject()!.icon"></i>
            } @else {
              <i class="fi fi-rr-folder"></i>
            }
          </div>
          <div class="ws-info">
            <span class="ws-name">{{ activeProject()?.name || 'No Workspace Selected' }}</span>
            <span class="ws-slug" *ngIf="activeProject()?.slug">{{ (activeProject()?.slug || '').toUpperCase() }}</span>
          </div>
        </div>
        <i class="fi fi-rr-angle-small-down arrow-icon" [class.rotated]="isOpen()"></i>
      </button>

      <!-- Dropdown Popover Menu -->
      @if (isOpen()) {
        <div class="switcher-popover paper-panel font-mono" (click)="$event.stopPropagation()" (keydown)="onKeydown($event)">
          <div class="popover-header">
            <span class="header-title">WORKSPACES</span>
            <span class="badge-mono">{{ filteredProjects().length }} AVAILABLE</span>
          </div>

          <!-- Search Input Box -->
          <div class="popover-search">
            <i class="fi fi-rr-search search-icon"></i>
            <input
              type="text"
              class="search-input font-mono"
              placeholder="Filter workspaces..."
              [ngModel]="rawSearchQuery()"
              (ngModelChange)="onSearchInput($event)"
              (click)="$event.stopPropagation()"
            />
            @if (rawSearchQuery()) {
              <button class="btn-clear" (click)="clearSearch()">
                <i class="fi fi-rr-cross"></i>
              </button>
            }
          </div>

          <!-- Workspaces List -->
          <div class="popover-list" #popoverListEl>
            @if (filteredProjects().length === 0) {
              <div class="empty-state-card compact font-mono" style="padding: 1.25rem 0.75rem;">
                <div class="empty-state-icon-badge warning" style="width: 36px; height: 36px; font-size: 1rem; margin-bottom: 0.5rem;">
                  <i class="fi fi-rr-search"></i>
                </div>
                <h4 class="empty-state-title" style="font-size: 0.85rem;">No Workspaces Found</h4>
                <p class="empty-state-subtitle" style="font-size: 0.75rem; margin-bottom: 0.5rem;">No workspace matches "{{ rawSearchQuery() }}"</p>
                <button type="button" class="btn btn-ghost btn-xs text-cyan" (click)="clearSearch()">Clear Search</button>
              </div>
            } @else {
              @for (p of filteredProjects(); track p.id; let i = $index) {
                <button
                  type="button"
                  class="ws-item-btn"
                  [class.active]="p.id === activeProject()?.id"
                  [class.focused]="i === activeIndex()"
                  (click)="selectWorkspace(p)"
                  (mouseenter)="activeIndex.set(i)"
                >
                  <div class="item-left">
                    <div class="ws-item-avatar" [style.background]="p.image_url ? 'transparent' : (p.color || '#06b6d4')">
                      @if (p.image_url) {
                        <img [appLazyImage]="p.image_url" class="ws-icon-img" alt="Workspace Icon" />
                      } @else if (p.icon) {
                        <i [class]="p.icon"></i>
                      } @else {
                        <i class="fi fi-rr-folder"></i>
                      }
                    </div>
                    <div class="item-details">
                      <span class="item-name">{{ p.name }}</span>
                      <span class="item-meta">
                        <span class="item-slug">{{ p.slug.toUpperCase() }}</span>
                        @if (getTaskStats(p.id); as stats) {
                          <span class="item-count">• {{ stats.completed }}/{{ stats.total }} tasks</span>
                        }
                      </span>
                    </div>
                  </div>

                  @if (p.id === activeProject()?.id) {
                    <i class="fi fi-rr-check text-emerald check-icon"></i>
                  }
                </button>
              }
            }
          </div>

          <!-- Action Footer Row -->
          <div class="popover-footer">
            <button
              type="button"
              class="footer-btn btn-create"
              (click)="handleCreateWorkspace()"
            >
              <i class="fi fi-rr-plus"></i>
              <span>New Workspace</span>
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .workspace-switcher {
      position: relative;
      display: inline-block;
    }

    .switcher-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
      padding: 0.35rem 0.65rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      cursor: pointer;
      transition: var(--transition-fast);
      height: 36px;
      min-width: 190px;
      max-width: 240px;
    }
    .switcher-trigger:hover,
    .switcher-trigger.active {
      background: var(--bg-surface-hover);
      border-color: var(--border-active);
    }

    .trigger-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      overflow: hidden;
      flex: 1;
    }

    .ws-avatar {
      width: 22px;
      height: 22px;
      border-radius: var(--radius-xs);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 0.75rem;
      flex-shrink: 0;
      overflow: hidden;
    }
    .ws-icon-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: var(--radius-xs);
    }

    .ws-info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      overflow: hidden;
      line-height: 1.15;
    }
    .ws-name {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 130px;
    }
    .ws-slug {
      font-size: 0.65rem;
      color: var(--text-subtle);
      font-weight: 500;
    }

    .arrow-icon {
      font-size: 0.75rem;
      color: var(--text-muted);
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }
    .arrow-icon.rotated {
      transform: rotate(180deg);
    }

    /* Popover Menu */
    .switcher-popover {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 280px;
      z-index: 1500;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: fadeInDown 0.15s ease-out;
    }

    @keyframes fadeInDown {
      from {
        opacity: 0;
        transform: translateY(-6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .popover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
    }
    .header-title {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }

    .popover-search {
      display: flex;
      align-items: center;
      padding: 0.35rem 0.65rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-canvas);
      gap: 0.4rem;
    }
    .search-icon {
      font-size: 0.75rem;
      color: var(--text-subtle);
    }
    .search-input {
      border: none;
      background: transparent;
      outline: none;
      width: 100%;
      font-size: 0.775rem;
      color: var(--text-main);
    }
    .btn-clear {
      background: transparent;
      border: none;
      color: var(--text-subtle);
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
    }

    .popover-list {
      max-height: 240px;
      overflow-y: auto;
      padding: 0.35rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .empty-list {
      padding: 1.25rem 0.5rem;
      text-align: center;
      color: var(--text-subtle);
      font-size: 0.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
    }

    .ws-item-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0.45rem 0.6rem;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-xs);
      cursor: pointer;
      text-align: left;
      transition: var(--transition-fast);
    }
    .ws-item-btn:hover {
      background: var(--bg-surface-hover);
      border-color: var(--border-subtle);
    }
    .ws-item-btn.active {
      background: var(--bg-surface-subtle);
      border-color: var(--border-medium);
      font-weight: 700;
    }

    .item-left {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      overflow: hidden;
      flex: 1;
    }
    .ws-item-avatar {
      width: 24px;
      height: 24px;
      border-radius: var(--radius-xs);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 0.75rem;
      flex-shrink: 0;
    }
    .item-details {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      line-height: 1.2;
    }
    .item-name {
      font-size: 0.775rem;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-meta {
      font-size: 0.65rem;
      color: var(--text-subtle);
    }
    .item-slug {
      font-weight: 700;
    }
    .check-icon {
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .popover-footer {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      padding: 0.35rem;
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
    }

    .footer-btn {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      width: 100%;
      padding: 0.35rem 0.65rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-main);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .footer-btn:hover {
      background: var(--bg-surface-hover);
      border-color: var(--border-medium);
      color: var(--accent-cyan);
    }
    .btn-create {
      color: var(--accent-cyan);
    }

    @media (max-width: 768px) {
      .switcher-trigger {
        min-width: 148px;
        padding: 0.25rem 0.45rem;
      }
      .ws-name {
        max-width: 80px;
      }
      .switcher-popover {
        position: absolute;
        top: calc(100% + 6px);
        left: -20px;
        right: auto;
        width: 270px;
        max-width: calc(100vw - 1rem);
        z-index: 2000;
      }
    }
  `]
})
export class WorkspaceSwitcherComponent {
  @Output() createWorkspace = new EventEmitter<void>();
  @Output() openAccessModal = new EventEmitter<void>();

  @ViewChild('containerEl') containerEl!: ElementRef;

  isOpen = signal<boolean>(false);
  rawSearchQuery = signal<string>('');
  searchQuery = signal<string>('');
  private searchDebounceTimer: any = null;

  onSearchInput(val: string): void {
    this.rawSearchQuery.set(val);
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.searchQuery.set(val);
    }, 300);
  }

  clearSearch(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.rawSearchQuery.set('');
    this.searchQuery.set('');
  }

  activeProject = computed(() => this.projectService.activeProject());

  filteredProjects = computed(() => {
    const list = this.projectService.projects();
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return list;
    return list.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      const slugMatch = (p.slug || '').toLowerCase().includes(q);
      const labelMatch = (p.labels || []).some(l => (l || '').toLowerCase().includes(q));

      return nameMatch || descMatch || slugMatch || labelMatch;
    });
  });

  constructor(
    public projectService: ProjectService,
    private authService: AuthService
  ) {}

  @ViewChild('popoverListEl') popoverListEl?: ElementRef<HTMLDivElement>;
  activeIndex = signal<number>(0);

  onKeydown(e: KeyboardEvent) {
    const list = this.filteredProjects();
    if (list.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex.update(i => (i + 1) % list.length);
      this.scrollToActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex.update(i => (i - 1 + list.length) % list.length);
      this.scrollToActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = list[this.activeIndex()];
      if (current) {
        this.selectWorkspace(current);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.closePopover();
    }
  }

  private scrollToActive() {
    setTimeout(() => {
      if (!this.popoverListEl?.nativeElement) return;
      const focusedEl = this.popoverListEl.nativeElement.querySelector('.ws-item-btn.focused') as HTMLElement;
      if (focusedEl) {
        focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  openPopover() {
    registerOpenPopover(this);
    this.isOpen.set(true);
    this.activeIndex.set(0);
  }

  closePopover() {
    unregisterOpenPopover(this);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isOpen() && this.containerEl && !this.containerEl.nativeElement.contains(event.target)) {
      this.closePopover();
    }
  }

  toggleOpen(event: MouseEvent) {
    event.stopPropagation();
    if (!this.isOpen()) {
      this.openPopover();
    } else {
      this.closePopover();
    }
  }

  selectWorkspace(project: Project) {
    this.projectService.setActiveProject(project);
    this.closePopover();
  }

  getTaskStats(projectId: string) {
    return this.projectService.getProjectProgress(projectId);
  }

  handleCreateWorkspace() {
    this.closePopover();
    this.createWorkspace.emit();
  }

  handleAccessModal() {
    this.closePopover();
    this.openAccessModal.emit();
  }
}
