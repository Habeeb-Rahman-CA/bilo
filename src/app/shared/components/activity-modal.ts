import { Component, EventEmitter, Output, Input, OnInit, OnDestroy, HostListener, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../core/services/project.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ProjectActivity } from '../../core/models/project.model';
import { registerModal, unregisterModal, isTopModal } from '../../core/utils/modal-stack.util';

@Component({
  selector: 'app-activity-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen) {
      <div class="modal-overlay" [style.z-index]="modalZIndex" (click)="close.emit()" role="dialog" aria-modal="true" aria-labelledby="activity-modal-title">
        <div class="activity-modal-card paper-panel font-mono" (click)="$event.stopPropagation()">
          <!-- Modal Header -->
          <div class="modal-header">
            <div class="header-left">
              <i class="fi fi-rr-time-past text-amber header-icon"></i>
              <div>
                <h3 id="activity-modal-title" class="modal-title">Workspace Activity Log & History</h3>
                <span class="modal-subtitle">
                  @if (activeProject(); as proj) {
                    PROJECT: {{ proj.name }} ({{ proj.slug || proj.name.slice(0, 3).toUpperCase() }})
                  } @else {
                    GLOBAL WORKSPACE HISTORY
                  }
                </span>
              </div>
            </div>
            <button class="btn btn-ghost btn-xs close-btn" (click)="close.emit()" title="Close (Esc)" aria-label="Close activity modal">
              <span class="key-badge">ESC</span>
              <i class="fi fi-rr-cross"></i>
            </button>
          </div>

          <!-- Modal Filter Toolbar -->
          <div class="filter-toolbar font-mono">
            <div class="search-box">
              <i class="fi fi-rr-search search-icon"></i>
              <input
                type="text"
                class="form-input search-input font-mono"
                placeholder="Search activities by action, title, or description..."
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
              />
              @if (searchQuery()) {
                <button type="button" class="btn-clear-search" (click)="searchQuery.set('')" title="Clear search">
                  <i class="fi fi-rr-cross-small"></i>
                </button>
              }
            </div>

            <div class="filter-chips">
              <button
                type="button"
                class="filter-chip"
                [class.active]="selectedCategory() === 'all'"
                (click)="selectedCategory.set('all')"
              >
                All ({{ projectActivities().length }})
              </button>
              <button
                type="button"
                class="filter-chip"
                [class.active]="selectedCategory() === 'task'"
                (click)="selectedCategory.set('task')"
              >
                Tasks
              </button>
              <button
                type="button"
                class="filter-chip"
                [class.active]="selectedCategory() === 'workflow'"
                (click)="selectedCategory.set('workflow')"
              >
                Workflows
              </button>
              <button
                type="button"
                class="filter-chip"
                [class.active]="selectedCategory() === 'comment'"
                (click)="selectedCategory.set('comment')"
              >
                Comments
              </button>
            </div>
          </div>

          <!-- Modal Body Activity List -->
          <div class="modal-body">
            @if (filteredActivities().length === 0) {
              <div class="empty-state font-mono">
                <i class="fi fi-rr-time-past empty-icon"></i>
                <p>No activity logs found matching your criteria.</p>
                @if (searchQuery() || selectedCategory() !== 'all') {
                  <button type="button" class="btn btn-secondary btn-xs" (click)="resetFilters()">
                    Reset Filters
                  </button>
                }
              </div>
            } @else {
              <div class="activity-timeline-list font-mono">
                @for (act of filteredActivities(); track act.id) {
                  <div class="timeline-card">
                    <div class="timeline-icon-box" [ngClass]="getActionThemeClass(act.action)">
                      <i [class]="getActionIcon(act.action)"></i>
                    </div>

                    <div class="timeline-details">
                      <div class="timeline-title-row">
                        <span class="action-badge" [ngClass]="getActionThemeClass(act.action)">
                          {{ (act.action || 'ACTION').toUpperCase() }}
                        </span>
                        <span class="activity-time">{{ formatDate(act.timestamp) }}</span>
                      </div>
                      <p class="activity-desc">{{ act.description }}</p>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer font-mono">
            <div class="footer-left">
              <span class="status-dot dot-emerald"></span>
              <span>Showing {{ filteredActivities().length }} of {{ projectActivities().length }} activities</span>
            </div>
            <div class="footer-right">
              <button type="button" class="btn btn-secondary btn-xs" (click)="close.emit()">
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 1rem;
      animation: fadeIn 0.15s ease-out;
    }

    .activity-modal-card {
      width: 100%;
      max-width: 680px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      box-shadow: var(--shadow-modal);
      overflow: hidden;
      animation: scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 1.15rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .header-icon {
      font-size: 1.35rem;
    }
    .modal-title {
      font-size: 0.95rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-main);
    }
    .modal-subtitle {
      font-size: 0.675rem;
      color: var(--text-muted);
      letter-spacing: 0.04em;
    }
    .close-btn {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    /* Filter Toolbar */
    .filter-toolbar {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 0.75rem 1.15rem;
      background: var(--bg-surface-subtle);
      border-bottom: 1px solid var(--border-subtle);
    }
    .search-box {
      position: relative;
      width: 100%;
      display: flex;
      align-items: center;
    }
    .search-icon {
      position: absolute;
      left: 0.65rem;
      font-size: 0.85rem;
      color: var(--text-muted);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      padding: 0.4rem 1.8rem 0.4rem 2rem;
      font-size: 0.8rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-main);
    }
    .search-input:focus {
      border-color: var(--accent-cyan);
      outline: none;
    }
    .btn-clear-search {
      position: absolute;
      right: 0.5rem;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-clear-search:hover {
      color: var(--text-main);
    }

    .filter-chips {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .filter-chip {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 0.2rem 0.6rem;
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .filter-chip:hover {
      color: var(--text-main);
      border-color: var(--border-medium);
    }
    .filter-chip.active {
      background: rgba(6, 182, 212, 0.12);
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
      font-weight: 700;
    }

    /* Modal Body */
    .modal-body {
      padding: 1.15rem;
      overflow-y: auto;
      flex: 1;
      max-height: calc(85vh - 170px);
    }
    .empty-state {
      padding: 2.5rem 1rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-muted);
      font-size: 0.8rem;
    }
    .empty-icon {
      font-size: 1.8rem;
      color: var(--text-subtle);
    }

    .activity-timeline-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .timeline-card {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      transition: var(--transition-fast);
    }
    .timeline-card:hover {
      border-color: var(--border-medium);
      background: var(--bg-surface);
    }
    .timeline-icon-box {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      flex-shrink: 0;
      margin-top: 0.1rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
    }

    /* Action Theme Badges & Icons */
    .theme-emerald {
      color: var(--accent-emerald, #10b981);
      border-color: rgba(16, 185, 129, 0.3) !important;
      background: rgba(16, 185, 129, 0.08) !important;
    }
    .theme-cyan {
      color: var(--accent-cyan, #06b6d4);
      border-color: rgba(6, 182, 212, 0.3) !important;
      background: rgba(6, 182, 212, 0.08) !important;
    }
    .theme-amber {
      color: var(--accent-amber, #f59e0b);
      border-color: rgba(245, 158, 11, 0.3) !important;
      background: rgba(245, 158, 11, 0.08) !important;
    }
    .theme-rose {
      color: var(--accent-rose, #e11d48);
      border-color: rgba(225, 29, 72, 0.3) !important;
      background: rgba(225, 29, 72, 0.08) !important;
    }
    .theme-purple {
      color: #a855f7;
      border-color: rgba(168, 85, 247, 0.3) !important;
      background: rgba(168, 85, 247, 0.08) !important;
    }
    .theme-default {
      color: var(--text-muted);
      border-color: var(--border-subtle) !important;
      background: var(--bg-surface-subtle) !important;
    }

    .timeline-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .timeline-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .action-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.4rem;
      border-radius: 3px;
      letter-spacing: 0.04em;
    }
    .activity-time {
      font-size: 0.675rem;
      color: var(--text-muted);
    }
    .activity-desc {
      font-size: 0.775rem;
      color: var(--text-main);
      margin: 0;
      line-height: 1.4;
      font-family: var(--font-sans);
    }

    /* Modal Footer */
    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.65rem 1.15rem;
      background: var(--bg-surface-subtle);
      border-top: 1px solid var(--border-subtle);
      font-size: 0.675rem;
      color: var(--text-muted);
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleUp {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `]
})
export class ActivityModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  searchQuery = signal<string>('');
  selectedCategory = signal<'all' | 'task' | 'workflow' | 'comment'>('all');
  modalZIndex = 2000;
  private readonly modalId = 'activity-modal-' + Math.random().toString(36).substring(2, 9);

  constructor(
    public projectService: ProjectService,
    public workspaceService: WorkspaceService,
    private elementRef: ElementRef
  ) { }

  activeProject = computed(() => this.projectService.activeProject());

  projectActivities = computed(() => {
    const activities = this.projectService.activities();
    const activeProjId = this.activeProject()?.id;
    return activeProjId
      ? activities.filter(a => !a.project_id || a.project_id === activeProjId)
      : activities;
  });

  filteredActivities = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();
    let list = this.projectActivities();

    if (cat === 'task') {
      list = list.filter(a => {
        const act = (a.action || '').toLowerCase();
        return act.includes('task') || act.includes('create') || act.includes('status') || act.includes('priority');
      });
    } else if (cat === 'workflow') {
      list = list.filter(a => {
        const act = (a.action || '').toLowerCase();
        return act.includes('workflow') || act.includes('column') || act.includes('status');
      });
    } else if (cat === 'comment') {
      list = list.filter(a => {
        const act = (a.action || '').toLowerCase();
        return act.includes('comment') || act.includes('note');
      });
    }

    if (query) {
      list = list.filter(a =>
        (a.action || '').toLowerCase().includes(query) ||
        (a.description || '').toLowerCase().includes(query)
      );
    }

    return list;
  });

  ngOnInit() {
    if (this.isOpen) {
      this.modalZIndex = registerModal(this.modalId);
    }
  }

  ngOnDestroy() {
    unregisterModal(this.modalId);
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeydown(e: KeyboardEvent) {
    if (!this.isOpen || !isTopModal(this.modalId)) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close.emit();
      return;
    }

    if (e.key === 'Tab') {
      this.trapFocus(e);
    }
  }

  private trapFocus(e: KeyboardEvent) {
    const container = this.elementRef?.nativeElement;
    if (!container) return;

    const focusables = (Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[]).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);

    if (focusables.length === 0) return;

    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];
    const activeEl = document.activeElement;

    if (e.shiftKey) {
      if (activeEl === firstEl || !container.contains(activeEl)) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (activeEl === lastEl || !container.contains(activeEl)) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }

  resetFilters() {
    this.searchQuery.set('');
    this.selectedCategory.set('all');
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  getActionIcon(action: string): string {
    const act = (action || '').toLowerCase();
    if (act.includes('create') || act.includes('add') || act.includes('new')) return 'fi fi-rr-add';
    if (act.includes('status') || act.includes('move') || act.includes('workflow')) return 'fi fi-rr-refresh';
    if (act.includes('comment')) return 'fi fi-rr-comment';
    if (act.includes('delete') || act.includes('remove')) return 'fi fi-rr-trash';
    if (act.includes('priority')) return 'fi fi-rr-bolt';
    if (act.includes('edit') || act.includes('update')) return 'fi fi-rr-edit';
    return 'fi fi-rr-time-past';
  }

  getActionThemeClass(action: string): string {
    const act = (action || '').toLowerCase();
    if (act.includes('create') || act.includes('add') || act.includes('new')) return 'theme-emerald';
    if (act.includes('status') || act.includes('move') || act.includes('workflow')) return 'theme-cyan';
    if (act.includes('comment')) return 'theme-amber';
    if (act.includes('delete') || act.includes('remove')) return 'theme-rose';
    if (act.includes('priority')) return 'theme-purple';
    return 'theme-cyan';
  }
}
