import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { ProgressService } from '../../core/services/progress.service';
import { ExcelExportService } from '../../core/services/excel-export.service';
import { ExportWorkerPayload } from '../../core/workers/excel-export.worker';
import { Task, Project } from '../../core/models/project.model';
import { getTaskKey } from '../../core/utils/task-key.util';
import { getLocalDateString } from '../../core/utils/date.util';
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule, FormsModule, ScrollingModule],
  template: `
    <div class="archive-workspace">
      <!-- Header -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-left">
          <span class="badge-mono desktop-only">05 ARCHIVE</span>
          <h2 class="view-header-title">Completed Work & Audit</h2>
        </div>

        <div class="view-header-right font-mono">
          <button
            class="btn btn-primary btn-sm export-btn"
            [disabled]="isExporting()"
            (click)="exportData()"
            [title]="isExporting() ? 'Export in progress...' : 'Export workspace data to Excel spreadsheet (.xlsx)'"
          >
            @if (isExporting()) {
              <i class="fi fi-rr-spinner spinner-icon spinning"></i>
              <span class="btn-export-text">Exporting...</span>
            } @else {
              <i class="fi fi-rr-file-excel"></i> <span class="btn-export-text">Export</span>
            }
          </button>
        </div>
      </div>

      <!-- Excel Export Progress Banner -->
      @if (isExporting()) {
        <div class="export-progress-banner font-mono">
          <div class="export-progress-header">
            <span class="export-step-badge font-mono">
              <i class="fi fi-rr-spinner spinner-icon spinning text-cyan"></i>
              <span>{{ exportStepMessage() }}</span>
            </span>
            <span class="export-pct">{{ exportProgress() }}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" [style.width.%]="exportProgress()"></div>
          </div>
        </div>
      }
      <!-- Restore Notification Toast -->
      @if (restoreToastMessage()) {
        <div class="restore-toast-banner font-mono">
          <i class="fi fi-rr-check-circle text-emerald"></i>
          <span>{{ restoreToastMessage() }}</span>
          <button type="button" class="btn-close-toast" (click)="restoreToastMessage.set('')">&times;</button>
        </div>
      }

      @if (taskService.loading()) {
        <div class="archive-grid font-mono">
          <div class="paper-panel archive-box">
            <div class="box-body" style="padding: 1rem;">
              @for (i of [1, 2, 3]; track i) {
                <div class="skeleton-card" style="margin-bottom: 0.5rem;">
                  <div class="skeleton-line" style="width: 70%;"></div>
                </div>
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="archive-grid">
          <!-- Completed Tasks Section -->
          <div class="paper-panel archive-box">
            <div class="box-header">
              <h3><i class="fi fi-rr-check-circle text-emerald"></i> Completed Tasks History</h3>
              <span class="badge-mono font-mono">{{ completedTasks().length }} Items</span>
            </div>

            <!-- Filter & Search Bar -->
            <div class="archive-filter-strip font-mono">
              <div class="search-input-wrap">
                <i class="fi fi-rr-search search-icon"></i>
                <input
                  type="text"
                  class="archive-search-input"
                  [ngModel]="taskSearchQuery()"
                  (ngModelChange)="onTaskSearch($event)"
                  placeholder="Search completed tasks by title, key, assignee..."
                />
                @if (taskSearchQuery()) {
                  <button class="clear-search-btn" (click)="onTaskSearch('')" title="Clear search">
                    <i class="fi fi-rr-cross-small"></i>
                  </button>
                }
              </div>

              <div class="page-size-selector">
                <span class="text-subtle">Show:</span>
                <select
                  class="archive-select"
                  [ngModel]="taskPageSize()"
                  (ngModelChange)="setTaskPageSize($event)"
                >
                  <option [ngValue]="15">15 / page</option>
                  <option [ngValue]="25">25 / page</option>
                  <option [ngValue]="50">50 / page</option>
                  <option [ngValue]="100">100 / page</option>
                </select>
              </div>
            </div>

            <div class="box-body">
              @if (filteredCompletedTasks().length === 0) {
                <div class="empty-state-card font-mono">
                  <div class="empty-state-icon-badge">
                    <i class="fi fi-rr-box-alt text-amber"></i>
                  </div>
                  <h4 class="empty-state-title">{{ taskSearchQuery() ? 'No Matching Archive Items' : 'Archive Vault is Empty' }}</h4>
                  <p class="empty-state-subtitle">
                    {{ taskSearchQuery() ? 'No completed tasks matched your search query. Try searching with different keywords.' : 'Completed tasks and closed workspace items will automatically accumulate here for historical tracking & audit logs.' }}
                  </p>
                </div>
              } @else {
                <div class="archive-list">
                  @for (t of paginatedCompletedTasks(); track t.id) {
                    <div class="archive-item-row">
                      <div class="row-left">
                        <span class="status-dot dot-emerald"></span>
                        <span class="task-title">{{ t.title }}</span>
                        @if (isReportedTask(t)) {
                          <span class="app-report-badge font-mono" title="Reported directly by user via App Report">
                            <i class="fi fi-rr-paper-plane"></i> User Report
                          </span>
                        }
                        <span class="badge-mono">{{ getTypeLabel(t) }}</span>
                      </div>

                      <div class="row-right font-mono">
                        <span class="text-subtle">{{ getTaskKeyStr(t) }}</span>
                        <button
                          type="button"
                          class="btn btn-secondary btn-xs restore-btn font-mono"
                          (click)="restoreTask(t)"
                          [title]="'Restore task &quot;' + t.title + '&quot; to active workflow column'"
                        >
                          <i class="fi fi-rr-undo"></i> Restore
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Pagination Footer -->
            @if (filteredCompletedTasks().length > 0) {
              <div class="archive-box-footer font-mono">
                <span class="pagination-info">
                  Showing {{ taskStartIndex() }}-{{ taskEndIndex() }} of {{ filteredCompletedTasks().length }}
                </span>
                <div class="pagination-nav">
                  <button
                    class="btn btn-secondary btn-xs"
                    [disabled]="taskPage() === 1"
                    (click)="prevTaskPage()"
                    title="Previous Page"
                  >
                    <i class="fi fi-rr-angle-left"></i>
                  </button>
                  <span class="page-indicator">{{ taskPage() }} of {{ totalTaskPages() }}</span>
                  <button
                    class="btn btn-secondary btn-xs"
                    [disabled]="taskPage() === totalTaskPages()"
                    (click)="nextTaskPage()"
                    title="Next Page"
                  >
                    <i class="fi fi-rr-angle-right"></i>
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Activity Audit Log -->
          <div class="paper-panel archive-box">
            <div class="box-header">
              <h3><i class="fi fi-rr-time-past text-cyan"></i> Workspace Activity Stream</h3>
              <span class="badge-mono font-mono">{{ filteredActivities().length }} Entries</span>
            </div>

            <!-- Activity Search & Date Range Filter Strip -->
            <div class="archive-filter-strip font-mono">
              <div class="search-input-wrap">
                <i class="fi fi-rr-search search-icon"></i>
                <input
                  type="text"
                  class="archive-search-input"
                  [ngModel]="activitySearchQuery()"
                  (ngModelChange)="onActivitySearch($event)"
                  placeholder="Search activity log..."
                />
                @if (activitySearchQuery()) {
                  <button class="clear-search-btn" (click)="onActivitySearch('')" title="Clear search">
                    <i class="fi fi-rr-cross-small"></i>
                  </button>
                }
              </div>

              <div class="date-range-wrap font-mono">
                <input
                  type="date"
                  class="archive-date-input"
                  [ngModel]="activityStartDate()"
                  (ngModelChange)="onActivityStartDateChange($event)"
                  title="Filter from date"
                />
                <span class="text-subtle">to</span>
                <input
                  type="date"
                  class="archive-date-input"
                  [ngModel]="activityEndDate()"
                  (ngModelChange)="onActivityEndDateChange($event)"
                  title="Filter to date"
                />
                @if (activitySearchQuery() || activityStartDate() || activityEndDate()) {
                  <button
                    type="button"
                    class="btn btn-secondary btn-xs clear-all-filters-btn font-mono"
                    (click)="clearActivityFilters()"
                    title="Clear activity search and date filters"
                  >
                    Clear
                  </button>
                }
              </div>
            </div>

            <div class="box-body">
              @if (filteredActivities().length === 0) {
                <div class="empty-state-card font-mono">
                  <div class="empty-state-icon-badge">
                    <i class="fi fi-rr-time-past text-amber"></i>
                  </div>
                  <h4 class="empty-state-title">{{ (activitySearchQuery() || activityStartDate() || activityEndDate()) ? 'No Matching Activity Logs' : 'No Activity History' }}</h4>
                  <p class="empty-state-subtitle">
                    {{ (activitySearchQuery() || activityStartDate() || activityEndDate()) ? 'No activities matched your search or date range filters. Try clearing filter criteria.' : 'System activities, task updates, and workspace modifications will be logged here in chronological order.' }}
                  </p>
                </div>
              } @else {
                <div class="activity-timeline font-mono">
                  @for (act of paginatedActivities(); track act.id) {
                    <div class="act-row">
                      <span class="act-dot"></span>
                      <div class="act-details">
                        <span class="act-action">{{ act.action }}: {{ act.description }}</span>
                        <span class="act-date">{{ formatDate(act.timestamp) }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            @if (filteredActivities().length > 0) {
              <div class="archive-box-footer font-mono">
                <span class="pagination-info">
                  Showing {{ activityStartIndex() }}-{{ activityEndIndex() }} of {{ filteredActivities().length }}
                </span>
                <div class="pagination-nav">
                  <button
                    class="btn btn-secondary btn-xs"
                    [disabled]="activityPage() === 1"
                    (click)="prevActivityPage()"
                    title="Previous Page"
                  >
                    <i class="fi fi-rr-angle-left"></i>
                  </button>
                  <span class="page-indicator">{{ activityPage() }} of {{ totalActivityPages() }}</span>
                  <button
                    class="btn btn-secondary btn-xs"
                    [disabled]="activityPage() === totalActivityPages()"
                    (click)="nextActivityPage()"
                    title="Next Page"
                  >
                    <i class="fi fi-rr-angle-right"></i>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .archive-workspace {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .archive-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 900px) {
      .archive-grid { grid-template-columns: 1fr; }
    }

    .archive-box {
      padding: 0.85rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-height: 480px;
    }
    .box-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.45rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .box-header h3 {
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .archive-filter-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px dashed var(--border-subtle);
    }
    .search-input-wrap {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
    }
    .search-icon {
      position: absolute;
      left: 0.6rem;
      color: var(--text-muted);
      font-size: 0.8rem;
      pointer-events: none;
    }
    .archive-search-input {
      width: 100%;
      padding: 0.35rem 1.8rem 0.35rem 1.8rem;
      font-size: 0.775rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-main);
      outline: none;
      transition: border-color 0.15s ease;
    }
    .archive-search-input:focus {
      border-color: var(--color-primary);
    }
    .clear-search-btn {
      position: absolute;
      right: 0.4rem;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.15rem;
    }
    .clear-search-btn:hover {
      color: var(--text-main);
    }
    .page-size-selector {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.725rem;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .archive-select {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-main);
      padding: 0.25rem 0.4rem;
      font-size: 0.725rem;
      outline: none;
      cursor: pointer;
    }

    .empty-archive {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.8rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
    }

    .archive-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .archive-item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.45rem 0.65rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .row-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .app-report-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 0.35rem !important;
      padding: 0.18rem 0.55rem !important;
      font-size: 0.65rem !important;
      font-weight: 800 !important;
      letter-spacing: 0.04em !important;
      text-transform: uppercase !important;
      border-radius: var(--radius-xs, 4px) !important;
      background: rgba(244, 63, 94, 0.2) !important;
      color: #f43f5e !important;
      border: 1px solid rgba(244, 63, 94, 0.5) !important;
      box-shadow: 0 1px 4px rgba(244, 63, 94, 0.2) !important;
      line-height: 1.2 !important;
      white-space: nowrap !important;
      vertical-align: middle !important;
      flex-shrink: 0 !important;
    }
    .app-report-badge i {
      font-size: 0.725rem !important;
      color: #f43f5e !important;
    }
    .task-title {
      font-size: 0.825rem;
      color: var(--text-main);
      text-decoration: line-through;
    }
    .row-right {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-size: 0.725rem;
    }

    .activity-timeline {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .act-row {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
      font-size: 0.775rem;
    }
    .act-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-muted);
      margin-top: 5px;
      flex-shrink: 0;
    }
    .act-details {
      display: flex;
      flex-direction: column;
    }
    .act-action {
      color: var(--text-main);
    }
    .act-date {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    .archive-box-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.6rem;
      border-top: 1px solid var(--border-subtle);
      font-size: 0.725rem;
      color: var(--text-muted);
      margin-top: auto;
    }
    .pagination-nav {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .page-indicator {
      font-size: 0.725rem;
      color: var(--text-main);
    }
    .restore-toast-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.85rem;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      border-radius: var(--radius-xs);
      color: var(--text-main);
      font-size: 0.775rem;
    }
    .btn-close-toast {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1.1rem;
      margin-left: auto;
      line-height: 1;
    }
    .restore-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.7rem;
    }
    .date-range-wrap {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.725rem;
    }
    .archive-date-input {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-main);
      padding: 0.2rem 0.35rem;
      font-size: 0.725rem;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .archive-date-input:focus {
      border-color: var(--color-primary);
    }
    .clear-all-filters-btn {
      font-size: 0.675rem;
      padding: 0.15rem 0.35rem;
    }
    .export-progress-banner {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: rgba(6, 182, 212, 0.08);
      border: 1px solid rgba(6, 182, 212, 0.4);
      border-radius: var(--radius-xs);
      box-shadow: 0 2px 8px rgba(6, 182, 212, 0.12);
    }
    .export-progress-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-main);
    }
    .export-step-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--color-primary);
    }
    .export-pct {
      margin-left: auto;
      font-weight: 800;
      font-size: 0.825rem;
      color: var(--color-primary);
      background: rgba(6, 182, 212, 0.15);
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      border: 1px solid rgba(6, 182, 212, 0.3);
    }
    .progress-bar-track {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #06b6d4, #3b82f6);
      transition: width 0.18s ease-out;
      border-radius: 3px;
    }
    .view-header-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      gap: 0.75rem;
    }
    .view-header-left {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      min-width: 0;
    }
    .view-header-title {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .view-header-right {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .spinning {
      display: inline-block;
      animation: spin 1s linear infinite;
    }

    @media (max-width: 768px) {
      .archive-workspace {
        padding: 0.5rem;
        gap: 0.65rem;
      }
      .view-header-strip {
        padding: 0.6rem 0.75rem;
        flex-wrap: nowrap;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .view-header-title {
        font-size: 0.925rem;
      }
      .export-btn {
        padding: 0.25rem 0.55rem;
        font-size: 0.75rem;
        height: 30px;
      }
    }
  `]
})
export class ArchiveComponent {
  constructor(
    public taskService: TaskService,
    public projectService: ProjectService,
    public progressService?: ProgressService,
    private excelExportService?: ExcelExportService
  ) { }

  // Completed tasks state & signals
  taskSearchQuery = signal<string>('');
  taskPage = signal<number>(1);
  taskPageSize = signal<number>(15);
  restoreToastMessage = signal<string>('');

  // Async Excel Export state & signals
  isExporting = signal<boolean>(false);
  exportProgress = signal<number>(0);
  exportStepMessage = signal<string>('');

  async restoreTask(t: Task) {
    const restored = await this.taskService.restoreTask(t.id);
    if (restored) {
      this.restoreToastMessage.set(`Restored "${t.title}" to "${restored.status}" status.`);
      setTimeout(() => this.restoreToastMessage.set(''), 4000);
    }
  }

  completedTasks = computed(() => {
    const list = this.taskService.tasks();
    const activeProjId = this.projectService.activeProject()?.id;
    const workspaceTasks = activeProjId ? list.filter(t => t.project_id === activeProjId) : list;
    return workspaceTasks.filter(t => t.completed || t.status.toLowerCase() === 'done');
  });

  filteredCompletedTasks = computed(() => {
    const all = this.completedTasks();
    const q = this.taskSearchQuery().toLowerCase().trim();
    if (!q) return all;
    return all.filter(t => {
      const titleMatch = t.title.toLowerCase().includes(q);
      const keyMatch = this.getTaskKeyStr(t).toLowerCase().includes(q);
      const assigneeMatch = t.assignee?.toLowerCase().includes(q) ?? false;
      const typeMatch = (t.type || '').toLowerCase().includes(q);
      return titleMatch || keyMatch || assigneeMatch || typeMatch;
    });
  });

  totalTaskPages = computed(() => {
    const total = this.filteredCompletedTasks().length;
    return Math.max(1, Math.ceil(total / this.taskPageSize()));
  });

  paginatedCompletedTasks = computed(() => {
    const list = this.filteredCompletedTasks();
    const page = Math.min(this.taskPage(), this.totalTaskPages());
    const size = this.taskPageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  taskStartIndex = computed(() => {
    if (this.filteredCompletedTasks().length === 0) return 0;
    const page = Math.min(this.taskPage(), this.totalTaskPages());
    return (page - 1) * this.taskPageSize() + 1;
  });

  taskEndIndex = computed(() => {
    const page = Math.min(this.taskPage(), this.totalTaskPages());
    const end = page * this.taskPageSize();
    return Math.min(end, this.filteredCompletedTasks().length);
  });

  onTaskSearch(query: string) {
    this.taskSearchQuery.set(query);
    this.taskPage.set(1);
  }

  setTaskPageSize(size: number) {
    this.taskPageSize.set(Number(size));
    this.taskPage.set(1);
  }

  prevTaskPage() {
    if (this.taskPage() > 1) {
      this.taskPage.update(p => p - 1);
    }
  }

  nextTaskPage() {
    if (this.taskPage() < this.totalTaskPages()) {
      this.taskPage.update(p => p + 1);
    }
  }

  // Activity stream state & signals
  activityPage = signal<number>(1);
  readonly activityPageSize = 15;
  activitySearchQuery = signal<string>('');
  activityStartDate = signal<string>('');
  activityEndDate = signal<string>('');

  activities = computed(() => {
    const list = this.projectService.activities();
    const activeProjId = this.projectService.activeProject()?.id;
    if (!activeProjId) return list;
    return list.filter(a => a.project_id === activeProjId);
  });

  filteredActivities = computed(() => {
    let list = this.activities();
    const q = this.activitySearchQuery().toLowerCase().trim();
    const startDate = this.activityStartDate();
    const endDate = this.activityEndDate();

    if (q) {
      list = list.filter(a =>
        (a.action && a.action.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q))
      );
    }

    if (startDate) {
      const startMs = new Date(startDate + 'T00:00:00').getTime();
      list = list.filter(a => {
        if (!a.timestamp) return false;
        const tMs = new Date(a.timestamp).getTime();
        return !isNaN(tMs) && tMs >= startMs;
      });
    }

    if (endDate) {
      const endMs = new Date(endDate + 'T23:59:59.999').getTime();
      list = list.filter(a => {
        if (!a.timestamp) return false;
        const tMs = new Date(a.timestamp).getTime();
        return !isNaN(tMs) && tMs <= endMs;
      });
    }

    return list;
  });

  totalActivityPages = computed(() => {
    const total = this.filteredActivities().length;
    return Math.max(1, Math.ceil(total / this.activityPageSize));
  });

  paginatedActivities = computed(() => {
    const list = this.filteredActivities();
    const page = Math.min(this.activityPage(), this.totalActivityPages());
    const start = (page - 1) * this.activityPageSize;
    return list.slice(start, start + this.activityPageSize);
  });

  activityStartIndex = computed(() => {
    if (this.filteredActivities().length === 0) return 0;
    const page = Math.min(this.activityPage(), this.totalActivityPages());
    return (page - 1) * this.activityPageSize + 1;
  });

  activityEndIndex = computed(() => {
    const page = Math.min(this.activityPage(), this.totalActivityPages());
    const end = page * this.activityPageSize;
    return Math.min(end, this.filteredActivities().length);
  });

  onActivitySearch(query: string) {
    this.activitySearchQuery.set(query);
    this.activityPage.set(1);
  }

  onActivityStartDateChange(date: string) {
    this.activityStartDate.set(date);
    this.activityPage.set(1);
  }

  onActivityEndDateChange(date: string) {
    this.activityEndDate.set(date);
    this.activityPage.set(1);
  }

  clearActivityFilters() {
    this.activitySearchQuery.set('');
    this.activityStartDate.set('');
    this.activityEndDate.set('');
    this.activityPage.set(1);
  }

  prevActivityPage() {
    if (this.activityPage() > 1) {
      this.activityPage.update(p => p - 1);
    }
  }

  nextActivityPage() {
    if (this.activityPage() < this.totalActivityPages()) {
      this.activityPage.update(p => p + 1);
    }
  }

  private yieldToMain(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  parseExcelDate(dateStr?: string | null): Date | string {
    if (!dateStr || dateStr.trim() === '') return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d;
  }

  async exportData() {
    if (this.isExporting()) return;

    const exportId = `excel-export-${Date.now()}`;
    this.isExporting.set(true);
    this.exportProgress.set(0);
    this.exportStepMessage.set('Preparing export data for Web Worker...');
    this.progressService?.start(exportId, 'export', 'Excel Export Generation', { message: 'Preparing export data...' });

    try {
      const projList = this.projectService.projects();
      const allTaskList = this.taskService.tasks();
      const completedTasksList = this.completedTasks();
      const activitiesList = this.activities();

      const payload: ExportWorkerPayload = {
        completedTasks: completedTasksList.map(t => ({
          id: t.id,
          taskKey: getTaskKey(t, projList, allTaskList),
          title: t.title,
          type: t.type,
          priority: t.priority,
          status: t.status,
          completed: t.completed,
          projectName: this.getProjectName(t.project_id),
          assignee: t.assignee,
          dueDate: t.due_date,
          createdAt: t.created_at
        })),
        allTasks: allTaskList.map(t => ({
          id: t.id,
          taskKey: getTaskKey(t, projList, allTaskList),
          title: t.title,
          type: t.type,
          priority: t.priority,
          status: t.status,
          completed: t.completed,
          projectName: this.getProjectName(t.project_id),
          assignee: t.assignee,
          dueDate: t.due_date,
          createdAt: t.created_at
        })),
        projects: projList.map(p => {
          const pTasks = allTaskList.filter(t => t.project_id === p.id);
          const pDone = pTasks.filter(t => t.completed || t.status.toLowerCase() === 'done').length;
          const progress = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
          return {
            id: p.id,
            key: `PROJ-${p.id.slice(0, 4).toUpperCase()}`,
            name: p.name,
            description: p.description || '',
            status: p.status || 'active',
            totalTasks: pTasks.length,
            completedTasks: pDone,
            progressPct: `${progress}%`
          };
        }),
        activities: activitiesList.map(act => ({
          action: act.action,
          description: act.description,
          timestamp: act.timestamp
        }))
      };

      const exportService = this.excelExportService || new ExcelExportService();

      const arrayBuffer = await exportService.exportToExcel(payload, (progress, stepMessage) => {
        this.exportProgress.set(progress);
        this.exportStepMessage.set(stepMessage);
        this.progressService?.update(exportId, progress, stepMessage);
      });

      this.exportProgress.set(100);
      this.exportStepMessage.set('Export completed successfully!');

      const filename = `bilo-workspace-export-${getLocalDateString()}.xlsx`;
      const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      this.progressService?.complete(exportId, 'Excel spreadsheet downloaded!');
    } catch (err) {
      console.error('[ArchiveComponent] Error during Excel export:', err);
      this.progressService?.fail(exportId, 'Excel export failed');
    } finally {
      setTimeout(() => {
        this.isExporting.set(false);
        this.exportProgress.set(0);
        this.exportStepMessage.set('');
      }, 1200);
    }
  }

  getTaskKeyStr(t: Task): string {
    return getTaskKey(t, this.projectService.projects(), this.taskService.tasks());
  }

  getProjectName(id: string): string {
    if (!id) return 'General';
    const p = this.projectService.projects().find(item => item.id === id);
    return p ? p.name : 'General';
  }

  isReportedTask(t: Task): boolean {
    if (!t) return false;
    return !!(t.is_app_report || t.report_category || t.labels?.includes('app-report') || t.title?.startsWith('[App Report]'));
  }

  getReportCategory(t: Task): string {
    if (t?.report_category) return t.report_category;
    if (t?.labels?.includes('ui_ux')) return 'ui_ux';
    if (t?.labels?.includes('feature')) return 'feature';
    if (t?.labels?.includes('other')) return 'other';
    return 'bug';
  }

  getTypeLabel(t: Task): string {
    if (this.isReportedTask(t)) {
      const cat = this.getReportCategory(t);
      switch (cat) {
        case 'ui_ux': return 'UI / UX';
        case 'feature': return 'Feature';
        case 'other': return 'Other';
        case 'bug': default: return 'Bug';
      }
    }
    return t.type || 'task';
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
