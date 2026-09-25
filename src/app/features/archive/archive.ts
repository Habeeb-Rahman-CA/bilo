import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx-js-style';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { Task, Project } from '../../core/models/project.model';
import { getTaskKey } from '../../core/utils/task-key.util';
import { getLocalDateString } from '../../core/utils/date.util';

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="archive-workspace">
      <!-- Header -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-left">
          <span class="badge-mono">05 ARCHIVE</span>
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
              <span>Exporting ({{ exportProgress() }}%)...</span>
            } @else {
              <i class="fi fi-rr-file-excel"></i> Export
            }
          </button>
        </div>
      </div>

      <!-- Excel Export Progress Banner -->
      @if (isExporting()) {
        <div class="export-progress-banner font-mono">
          <div class="export-progress-header">
            <i class="fi fi-rr-spinner spinner-icon spinning text-cyan"></i>
            <span>{{ exportStepMessage() }}</span>
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
                <div class="empty-archive font-mono">
                  <i class="fi fi-rr-box-alt text-muted"></i>
                  <span>{{ taskSearchQuery() ? 'No completed tasks matching search query.' : 'No completed tasks in archive yet.' }}</span>
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
                    <i class="fi fi-rr-angle-left"></i> Prev
                  </button>
                  <span class="page-indicator">Page {{ taskPage() }} of {{ totalTaskPages() }}</span>
                  <button
                    class="btn btn-secondary btn-xs"
                    [disabled]="taskPage() === totalTaskPages()"
                    (click)="nextTaskPage()"
                    title="Next Page"
                  >
                    Next <i class="fi fi-rr-angle-right"></i>
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Activity Audit Log -->
          <div class="paper-panel archive-box">
            <div class="box-header">
              <h3><i class="fi fi-rr-time-past text-cyan"></i> Workspace Activity Stream</h3>
              <span class="badge-mono font-mono">{{ activities().length }} Entries</span>
            </div>

            <div class="box-body">
              @if (activities().length === 0) {
                <div class="empty-archive font-mono">
                  <i class="fi fi-rr-box-alt text-muted"></i>
                  <span>No activities recorded yet.</span>
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

            @if (activities().length > 0) {
              <div class="archive-box-footer font-mono">
                <span class="pagination-info">
                  Showing {{ activityStartIndex() }}-{{ activityEndIndex() }} of {{ activities().length }}
                </span>
                <div class="pagination-nav">
                  <button
                    class="btn btn-secondary btn-xs"
                    [disabled]="activityPage() === 1"
                    (click)="prevActivityPage()"
                    title="Previous Page"
                  >
                    <i class="fi fi-rr-angle-left"></i> Prev
                  </button>
                  <span class="page-indicator">Page {{ activityPage() }} of {{ totalActivityPages() }}</span>
                  <button
                    class="btn btn-secondary btn-xs"
                    [disabled]="activityPage() === totalActivityPages()"
                    (click)="nextActivityPage()"
                    title="Next Page"
                  >
                    Next <i class="fi fi-rr-angle-right"></i>
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
    .export-progress-banner {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      padding: 0.65rem 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .export-progress-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.775rem;
      color: var(--text-main);
    }
    .export-pct {
      margin-left: auto;
      font-weight: 700;
      color: var(--color-primary);
    }
    .progress-bar-track {
      width: 100%;
      height: 6px;
      background: var(--border-subtle);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--color-primary);
      transition: width 0.15s ease;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .spinning {
      animation: spin 1s linear infinite;
    }
  `]
})
export class ArchiveComponent {
  constructor(
    public taskService: TaskService,
    public projectService: ProjectService
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

  activities = computed(() => {
    const list = this.projectService.activities();
    const activeProjId = this.projectService.activeProject()?.id;
    if (!activeProjId) return list;
    return list.filter(a => a.project_id === activeProjId);
  });

  totalActivityPages = computed(() => {
    const total = this.activities().length;
    return Math.max(1, Math.ceil(total / this.activityPageSize));
  });

  paginatedActivities = computed(() => {
    const list = this.activities();
    const page = Math.min(this.activityPage(), this.totalActivityPages());
    const start = (page - 1) * this.activityPageSize;
    return list.slice(start, start + this.activityPageSize);
  });

  activityStartIndex = computed(() => {
    if (this.activities().length === 0) return 0;
    const page = Math.min(this.activityPage(), this.totalActivityPages());
    return (page - 1) * this.activityPageSize + 1;
  });

  activityEndIndex = computed(() => {
    const page = Math.min(this.activityPage(), this.totalActivityPages());
    const end = page * this.activityPageSize;
    return Math.min(end, this.activities().length);
  });

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

  private async createStyledSheetAsync(
    headers: string[],
    descriptions: string[],
    dataRows: (string | number)[][],
    baseProgress: number = 0,
    progressWeight: number = 25
  ): Promise<XLSX.WorkSheet> {
    const ws: XLSX.WorkSheet = {};
    const chunkSize = 250;

    // 1. Header Row
    headers.forEach((h, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
      ws[cellRef] = {
        v: h,
        t: 's',
        s: {
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
          fill: { fgColor: { rgb: '1C1917' } },
          alignment: { vertical: 'center', horizontal: 'left' }
        }
      };
    });

    // 2. Field Description Row
    descriptions.forEach((desc, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 1, c: colIdx });
      ws[cellRef] = {
        v: desc,
        t: 's',
        s: {
          font: { italic: true, color: { rgb: '78716C' }, sz: 9, name: 'Calibri' },
          fill: { fgColor: { rgb: 'F3F0E6' } },
          alignment: { vertical: 'center', horizontal: 'left' }
        }
      };
    });

    // 3. Data Rows (Chunked to prevent thread locking)
    const totalDataRows = dataRows.length;
    for (let i = 0; i < totalDataRows; i += chunkSize) {
      const chunk = dataRows.slice(i, i + chunkSize);
      chunk.forEach((row, rowIdxInChunk) => {
        const rowIdx = i + rowIdxInChunk;
        row.forEach((val, colIdx) => {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 2, c: colIdx });
          const isNum = typeof val === 'number';
          ws[cellRef] = {
            v: val ?? '',
            t: isNum ? 'n' : 's',
            s: {
              font: { sz: 10, name: 'Calibri', color: { rgb: '1C1917' } },
              alignment: { vertical: 'center', horizontal: isNum ? 'right' : 'left' }
            }
          };
        });
      });

      if (totalDataRows > 0) {
        const rowProgress = Math.min(i + chunkSize, totalDataRows) / totalDataRows;
        const currentPct = Math.round(baseProgress + (rowProgress * progressWeight));
        this.exportProgress.set(Math.min(99, currentPct));
      }
      await this.yieldToMain();
    }

    // Range bounds definition
    const totalRows = dataRows.length + 2;
    const totalCols = headers.length;
    ws['!ref'] = XLSX.utils.encode_range(
      { r: 0, c: 0 },
      { r: Math.max(totalRows - 1, 1), c: totalCols - 1 }
    );

    // Auto Column Widths calculation
    ws['!cols'] = headers.map((h, colIdx) => {
      let maxLen = Math.max(h.length, (descriptions[colIdx] || '').length);
      dataRows.forEach(r => {
        const str = String(r[colIdx] ?? '');
        if (str.length > maxLen) maxLen = str.length;
      });
      return { wch: Math.min(Math.max(maxLen + 4, 15), 55) };
    });

    return ws;
  }

  async exportData() {
    if (this.isExporting()) return;

    this.isExporting.set(true);
    this.exportProgress.set(0);
    this.exportStepMessage.set('Preparing export data...');

    try {
      await this.yieldToMain();
      const wb = XLSX.utils.book_new();

      // 1. Sheet: Completed Tasks (Progress Weight: 30%)
      this.exportStepMessage.set('Formatting Completed Tasks...');
      const completedHeaders = ['Task ID', 'Title / Summary', 'Issue Type', 'Priority', 'Status', 'Project Name', 'Assignee', 'Due Date', 'Created Date'];
      const completedDescriptions = [
        'Unique task identifier code',
        'Brief summary title of completed work',
        'Work category (Task, Bug, Story, Epic)',
        'Urgency priority level',
        'Completion status state',
        'Parent workspace project',
        'Assigned team member',
        'Target due date (YYYY-MM-DD)',
        'Timestamp when task was logged'
      ];

      const completedTasksList = this.completedTasks();
      const projList = this.projectService.projects();
      const allTaskList = this.taskService.tasks();
      const completedRows: (string | number)[][] = [];

      for (let i = 0; i < completedTasksList.length; i += 250) {
        const chunk = completedTasksList.slice(i, i + 250);
        chunk.forEach(t => {
          completedRows.push([
            getTaskKey(t, projList, allTaskList),
            t.title,
            (t.type || 'task').toUpperCase(),
            (t.priority || 'medium').toUpperCase(),
            'COMPLETED',
            this.getProjectName(t.project_id),
            t.assignee || 'Unassigned',
            t.due_date || 'N/A',
            t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A'
          ]);
        });
        await this.yieldToMain();
      }

      const completedWs = await this.createStyledSheetAsync(
        completedHeaders,
        completedDescriptions,
        completedRows,
        0,
        30
      );
      XLSX.utils.book_append_sheet(wb, completedWs, 'Completed Tasks');

      // 2. Sheet: All Workspace Tasks (Progress Weight: 40%)
      this.exportStepMessage.set('Formatting All Workspace Tasks...');
      const allHeaders = ['Task ID', 'Title / Summary', 'Issue Type', 'Priority', 'Status', 'Completed', 'Project Name', 'Assignee', 'Due Date', 'Created Date'];
      const allDescriptions = [
        'Unique task identifier code',
        'Brief summary title of work item',
        'Work category (Task, Bug, Story, Epic)',
        'Urgency priority level',
        'Current workflow state (Todo, In Progress, Done)',
        'Completion status indicator (YES/NO)',
        'Parent workspace project',
        'Assigned team member',
        'Target due date (YYYY-MM-DD)',
        'Timestamp when task was logged'
      ];

      const allTaskRows: (string | number)[][] = [];
      for (let i = 0; i < allTaskList.length; i += 250) {
        const chunk = allTaskList.slice(i, i + 250);
        chunk.forEach(t => {
          allTaskRows.push([
            getTaskKey(t, projList, allTaskList),
            t.title,
            (t.type || 'task').toUpperCase(),
            (t.priority || 'medium').toUpperCase(),
            t.status.toUpperCase(),
            t.completed ? 'YES' : 'NO',
            this.getProjectName(t.project_id),
            t.assignee || 'Unassigned',
            t.due_date || 'N/A',
            t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A'
          ]);
        });
        await this.yieldToMain();
      }

      const allTasksWs = await this.createStyledSheetAsync(
        allHeaders,
        allDescriptions,
        allTaskRows,
        30,
        40
      );
      XLSX.utils.book_append_sheet(wb, allTasksWs, 'All Tasks');

      // 3. Sheet: Projects Summary (Progress Weight: 10%)
      this.exportStepMessage.set('Formatting Projects Summary...');
      const projectHeaders = ['Project Key', 'Project Name', 'Description', 'Status', 'Total Tasks', 'Completed Tasks', 'Progress (%)'];
      const projectDescriptions = [
        'Unique project code identifier',
        'Name of workspace project',
        'Project overview and objectives',
        'Lifecycle status (Active, Completed)',
        'Total count of assigned tasks',
        'Count of finished tasks',
        'Calculated completion percentage'
      ];

      const projectRows = projList.map(p => {
        const pTasks = allTaskList.filter(t => t.project_id === p.id);
        const pDone = pTasks.filter(t => t.completed || t.status.toLowerCase() === 'done').length;
        const progress = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
        return [
          `PROJ-${p.id.slice(0, 4).toUpperCase()}`,
          p.name,
          p.description || '',
          (p.status || 'active').toUpperCase(),
          pTasks.length,
          pDone,
          `${progress}%`
        ];
      });

      const projectsWs = await this.createStyledSheetAsync(
        projectHeaders,
        projectDescriptions,
        projectRows,
        70,
        10
      );
      XLSX.utils.book_append_sheet(wb, projectsWs, 'Projects Summary');

      // 4. Sheet: Activity Log Stream (Progress Weight: 10%)
      this.exportStepMessage.set('Formatting Activity Stream...');
      const activityHeaders = ['Action', 'Description', 'Timestamp'];
      const activityDescriptions = [
        'Operation type (Created, Updated, Deleted)',
        'Detailed log event description',
        'Date and time when action occurred'
      ];

      const activityList = this.activities();
      const activityRows = activityList.map(act => [
        act.action,
        act.description,
        this.formatDate(act.timestamp)
      ]);

      const activitiesWs = await this.createStyledSheetAsync(
        activityHeaders,
        activityDescriptions,
        activityRows,
        80,
        10
      );
      XLSX.utils.book_append_sheet(wb, activitiesWs, 'Activity Stream');

      // 5. Generate & download formatted .xlsx file (Progress Weight: 10%)
      this.exportStepMessage.set('Generating Excel Spreadsheet file...');
      this.exportProgress.set(95);
      await this.yieldToMain();

      const filename = `bilo-workspace-export-${getLocalDateString()}.xlsx`;
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      this.exportProgress.set(100);
      this.exportStepMessage.set('Export completed successfully!');
      await this.yieldToMain();
    } catch (err) {
      console.error('[ArchiveComponent] Error during Excel export:', err);
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
