import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx-js-style';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { Task, Project } from '../../core/models/project.model';
import { getTaskKey } from '../../core/utils/task-key.util';

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="archive-workspace">
      <!-- Header -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-left">
          <span class="badge-mono">05 ARCHIVE</span>
          <h2 class="view-header-title">Completed Work & Audit</h2>
        </div>

        <div class="view-header-right font-mono">
          <button class="btn btn-primary btn-sm" (click)="exportData()">
            <i class="fi fi-rr-file-excel"></i> Export
          </button>
        </div>
      </div>

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

          <div class="box-body">
            @if (completedTasks().length === 0) {
              <div class="empty-archive font-mono">
                <i class="fi fi-rr-box-alt text-muted"></i>
                <span>No completed tasks in archive yet.</span>
              </div>
            } @else {
              <div class="archive-list">
                @for (t of completedTasks(); track t.id) {
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
                      <span class="text-muted">Completed</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Activity Audit Log -->
        <div class="paper-panel archive-box">
          <div class="box-header">
            <h3><i class="fi fi-rr-time-past text-cyan"></i> Workspace Activity Stream</h3>
            <span class="badge-mono font-mono">{{ activities().length }} Entries</span>
          </div>

          <div class="box-body">
            <div class="activity-timeline font-mono">
              @for (act of activities(); track act.id) {
                <div class="act-row">
                  <span class="act-dot"></span>
                  <div class="act-details">
                    <span class="act-action">{{ act.action }}: {{ act.description }}</span>
                    <span class="act-date">{{ formatDate(act.timestamp) }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
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
  `]
})
export class ArchiveComponent {
  constructor(
    public taskService: TaskService,
    public projectService: ProjectService
  ) { }

  completedTasks = computed(() => {
    const list = this.taskService.tasks();
    const activeProjId = this.projectService.activeProject()?.id;
    const workspaceTasks = activeProjId ? list.filter(t => t.project_id === activeProjId) : list;
    return workspaceTasks.filter(t => t.completed || t.status.toLowerCase() === 'done');
  });

  activities = computed(() => {
    const list = this.projectService.activities();
    const activeProjId = this.projectService.activeProject()?.id;
    if (!activeProjId) return list;
    return list.filter(a => a.project_id === activeProjId);
  });

  private createStyledSheet(
    headers: string[],
    descriptions: string[],
    dataRows: (string | number)[][]
  ): XLSX.WorkSheet {
    const ws: XLSX.WorkSheet = {};

    // 1. Row 1: Header Row (Bold white text on dark background)
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

    // 2. Row 2: Field Description Row (Italic light grey text on soft background)
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

    // 3. Row 3+: Data Rows
    dataRows.forEach((row, rowIdx) => {
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

  exportData() {
    const wb = XLSX.utils.book_new();

    // 1. Sheet: Completed Tasks
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
    const completedRows = this.completedTasks().map(t => [
      getTaskKey(t, this.projectService.projects()),
      t.title,
      (t.type || 'task').toUpperCase(),
      (t.priority || 'medium').toUpperCase(),
      'COMPLETED',
      this.getProjectName(t.project_id),
      t.assignee || 'Unassigned',
      t.due_date || 'N/A',
      t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A'
    ]);
    const completedWs = this.createStyledSheet(completedHeaders, completedDescriptions, completedRows);
    XLSX.utils.book_append_sheet(wb, completedWs, 'Completed Tasks');

    // 2. Sheet: All Workspace Tasks
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
    const allTaskRows = this.taskService.tasks().map(t => [
      getTaskKey(t, this.projectService.projects()),
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
    const allTasksWs = this.createStyledSheet(allHeaders, allDescriptions, allTaskRows);
    XLSX.utils.book_append_sheet(wb, allTasksWs, 'All Tasks');

    // 3. Sheet: Projects Summary
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
    const projectRows = this.projectService.projects().map(p => {
      const pTasks = this.taskService.tasks().filter(t => t.project_id === p.id);
      const pDone = pTasks.filter(t => t.completed || t.status.toLowerCase() === 'done').length;
      const progress = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
      return [
        `PROJ-${p.id.slice(0, 4).toUpperCase()}`,
        p.name,
        p.description || '',
        p.status.toUpperCase(),
        pTasks.length,
        pDone,
        `${progress}%`
      ];
    });
    const projectsWs = this.createStyledSheet(projectHeaders, projectDescriptions, projectRows);
    XLSX.utils.book_append_sheet(wb, projectsWs, 'Projects Summary');

    // 4. Sheet: Activity Log Stream
    const activityHeaders = ['Action', 'Description', 'Timestamp'];
    const activityDescriptions = [
      'Operation type (Created, Updated, Deleted)',
      'Detailed log event description',
      'Date and time when action occurred'
    ];
    const activityRows = this.activities().map(act => [
      act.action,
      act.description,
      this.formatDate(act.timestamp)
    ]);
    const activitiesWs = this.createStyledSheet(activityHeaders, activityDescriptions, activityRows);
    XLSX.utils.book_append_sheet(wb, activitiesWs, 'Activity Stream');

    // Generate & download formatted .xlsx file
    const filename = `bilo-workspace-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
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
