import { Component, ElementRef, EventEmitter, HostListener, Output, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';
import { Project } from '../../core/models/project.model';

@Component({
  selector: 'app-workspace-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
        <div class="switcher-popover paper-panel font-mono" (click)="$event.stopPropagation()">
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
              [(ngModel)]="searchQuery"
              (click)="$event.stopPropagation()"
            />
            @if (searchQuery()) {
              <button class="btn-clear" (click)="searchQuery.set('')">
                <i class="fi fi-rr-cross"></i>
              </button>
            }
          </div>

          <!-- Workspaces List -->
          <div class="popover-list">
            @if (filteredProjects().length === 0) {
              <div class="empty-list font-mono">
                <i class="fi fi-rr-folder-open text-subtle"></i>
                <span>No matching workspace found</span>
              </div>
            } @else {
              @for (p of filteredProjects(); track p.id) {
                <button
                  type="button"
                  class="ws-item-btn"
                  [class.active]="p.id === activeProject()?.id"
                  (click)="selectWorkspace(p)"
                >
                  <div class="item-left">
                    <div class="ws-item-avatar" [style.background]="p.image_url ? 'transparent' : (p.color || '#06b6d4')">
                      @if (p.image_url) {
                        <img [src]="p.image_url" class="ws-icon-img" alt="Workspace Icon" />
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
  `]
})
export class WorkspaceSwitcherComponent {
  @Output() createWorkspace = new EventEmitter<void>();
  @Output() openAccessModal = new EventEmitter<void>();

  @ViewChild('containerEl') containerEl!: ElementRef;

  isOpen = signal<boolean>(false);
  searchQuery = signal<string>('');

  activeProject = computed(() => this.projectService.activeProject());

  filteredProjects = computed(() => {
    const list = this.projectService.projects();
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return list;
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q)
    );
  });

  constructor(
    public projectService: ProjectService,
    private authService: AuthService
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isOpen() && this.containerEl && !this.containerEl.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  toggleOpen(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  selectWorkspace(project: Project) {
    this.projectService.activeProject.set(project);
    this.isOpen.set(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bilo_active_project_id', project.id);
    }
  }

  getTaskStats(projectId: string) {
    return this.projectService.getProjectProgress(projectId);
  }

  handleCreateWorkspace() {
    this.isOpen.set(false);
    this.createWorkspace.emit();
  }

  handleAccessModal() {
    this.isOpen.set(false);
    this.openAccessModal.emit();
  }
}
