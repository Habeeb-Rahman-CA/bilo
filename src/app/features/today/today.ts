import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { Task } from '../../core/models/project.model';
import { TaskDetailModalComponent } from '../../shared/components/task-detail-modal';
import { TaskModalComponent } from '../../shared/components/task-modal';
import { SelectComponent, SelectOption } from '../../shared/components/select';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, FormsModule, TaskDetailModalComponent, TaskModalComponent, SelectComponent],
  template: `
    <div class="today-workspace">
      <!-- Top Header Strip -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-left">
          <span class="badge-mono">01 TODAY</span>
          <h2 class="view-header-title font-mono">{{ todayDateFormatted() }}</h2>
        </div>

        <div class="view-header-right">
          <button class="btn btn-primary btn-sm" (click)="workspaceService.openCreateTaskModal()">
            <i class="fi fi-rr-plus"></i> New Task
          </button>
        </div>
      </div>

      <!-- ROW 1: 4 Stat Cards (Last 7 Days & Due Soon) -->
      @if (taskService.loading()) {
        <div class="stats-row">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="skeleton-card paper-panel font-mono">
              <div class="skeleton-line" style="width: 40%; height: 14px;"></div>
              <div class="skeleton-line" style="width: 60%; height: 28px; margin: 0.4rem 0;"></div>
              <div class="skeleton-line" style="width: 80%; height: 12px;"></div>
            </div>
          }
        </div>
      } @else {
        <div class="stats-row">
        <!-- Card 1: Completed -->
        <div class="stat-card paper-panel">
          <div class="stat-top font-mono">
            <span class="stat-label">COMPLETED</span>
            <i class="fi fi-rr-check-circle text-emerald stat-icon"></i>
          </div>
          <div class="stat-value font-mono">{{ completed7dCount() }}</div>
          <div class="stat-sub font-mono">Tasks finished in last 7d</div>
        </div>

        <!-- Card 2: Updated -->
        <div class="stat-card paper-panel">
          <div class="stat-top font-mono">
            <span class="stat-label">UPDATED</span>
            <i class="fi fi-rr-refresh text-cyan stat-icon"></i>
          </div>
          <div class="stat-value font-mono">{{ updated7dCount() }}</div>
          <div class="stat-sub font-mono">Tasks modified in last 7d</div>
        </div>

        <!-- Card 3: Created -->
        <div class="stat-card paper-panel">
          <div class="stat-top font-mono">
            <span class="stat-label">CREATED</span>
            <i class="fi fi-rr-plus text-purple stat-icon"></i>
          </div>
          <div class="stat-value font-mono">{{ created7dCount() }}</div>
          <div class="stat-sub font-mono">New issues in last 7d</div>
        </div>

        <!-- Card 4: Due Soon -->
        <div class="stat-card paper-panel">
          <div class="stat-top font-mono">
            <span class="stat-label">DUE SOON</span>
            <i class="fi fi-rr-clock text-amber stat-icon"></i>
          </div>
          <div class="stat-value font-mono">{{ dueSoonCount() }}</div>
          <div class="stat-sub font-mono">Due within next 7d</div>
        </div>
      </div>

      <!-- ROW 2: Status Overview (Pie/Donut Chart) + Recent Activity (Latest 5) -->
      <div class="dashboard-grid-2col">
        <!-- Card 1: Status Overview (Pie/Donut Chart) -->
        <div class="paper-panel grid-card">
          <div class="card-header">
            <h3><i class="fi fi-rr-chart-pie text-cyan"></i> Status Overview</h3>
            <div class="card-header-actions">
              <div class="project-filter-wrap">
                <app-select
                  [options]="projectOptions()"
                  [value]="selectedStatusProjectId()"
                  (valueChange)="selectedStatusProjectId.set($event)"
                  [compact]="true"
                ></app-select>
              </div>
              <span class="badge-mono font-mono">{{ filteredStatusTasksCount() }} Tasks</span>
            </div>
          </div>

          <div class="card-body donut-body">
            @if (filteredStatusTasksCount() === 0) {
              <div class="empty-chart font-mono">
                <i class="fi fi-rr-chart-pie text-subtle"></i>
                <span>No tasks available for status overview</span>
              </div>
            } @else {
              <div class="donut-chart-container">
                <!-- SVG Donut Chart -->
                <svg class="donut-svg" viewBox="0 0 100 100">
                  @for (seg of donutSegments(); track seg.name) {
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      [attr.stroke]="seg.color"
                      stroke-width="16"
                      [attr.stroke-dasharray]="seg.dashArray"
                      [attr.stroke-dashoffset]="seg.dashOffset"
                    />
                  }
                </svg>
                <div class="donut-center-text font-mono">
                  <span class="center-num">{{ filteredStatusTasksCount() }}</span>
                  <span class="center-lbl">TASKS</span>
                </div>
              </div>

              <!-- Donut Legend -->
              <div class="legend-list font-mono">
                @for (st of statusCounts(); track st.name) {
                  <div class="legend-item">
                    <div class="legend-left">
                      <span class="status-dot" [style.background-color]="st.color"></span>
                      <span class="legend-name">{{ st.name }}</span>
                    </div>
                    <div class="legend-right">
                      <span class="legend-cnt">{{ st.count }}</span>
                      <span class="legend-pct">({{ st.percent }}%)</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Card 2: Recent Activity (Latest 5 Entries) -->
        <div class="paper-panel grid-card">
          <div class="card-header">
            <h3><i class="fi fi-rr-time-past text-amber"></i> Recent Activity</h3>
            <span class="badge-mono font-mono">Latest 5</span>
          </div>

          <div class="card-body">
            @if (recentActivities().length === 0) {
              <div class="empty-chart font-mono">
                <i class="fi fi-rr-time-past text-subtle"></i>
                <span>No recent activity logged</span>
              </div>
            } @else {
              <div class="timeline-list font-mono">
                @for (act of recentActivities(); track act.id) {
                  <div class="timeline-item">
                    <span class="timeline-dot"></span>
                    <div class="timeline-content">
                      <span class="act-text">{{ act.action }}: {{ act.description }}</span>
                      <span class="act-time">{{ formatDate(act.timestamp) }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>

      <!-- ROW 3: Priority Breakdown (Vertical Bars) + Types of Work (Horizontal Bars) -->
      <div class="dashboard-grid-2col">
        <!-- Card 1: Priority Breakdown (Vertical Bars) -->
        <div class="paper-panel grid-card">
          <div class="card-header">
            <h3><i class="fi fi-rr-stats text-rose"></i> Priority Breakdown</h3>
          </div>

          <div class="card-body vbars-body">
            @if (totalTaskCount() === 0) {
              <div class="empty-chart font-mono">
                <i class="fi fi-rr-stats text-subtle"></i>
                <span>No task priority data available</span>
              </div>
            } @else {
              <div class="vbars-container font-mono">
                @for (pri of priorityCounts(); track pri.name) {
                  <div class="vbar-col">
                    <span class="vbar-count">{{ pri.count }}</span>
                    <div class="vbar-track">
                      <div
                        class="vbar-fill"
                        [style.height]="pri.percent + '%'"
                        [style.background-color]="pri.color"
                      ></div>
                    </div>
                    <span class="vbar-label">{{ pri.name }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Card 2: Types of Work (Horizontal Bars) -->
        <div class="paper-panel grid-card">
          <div class="card-header">
            <h3><i class="fi fi-rr-box text-purple"></i> Types of Work</h3>
          </div>

          <div class="card-body hbars-body">
            @if (totalTaskCount() === 0) {
              <div class="empty-chart font-mono">
                <i class="fi fi-rr-box text-subtle"></i>
                <span>No task type data available</span>
              </div>
            } @else {
              <div class="hbars-list font-mono">
                @for (tp of typeCounts(); track tp.name) {
                  <div class="hbar-row">
                    <div class="hbar-meta">
                      <div class="type-name">
                        <i [class]="tp.icon"></i>
                        <span>{{ tp.name }}</span>
                      </div>
                      <span class="type-count">{{ tp.count }}</span>
                    </div>
                    <div class="hbar-track">
                      <div
                        class="hbar-fill"
                        [style.width]="tp.percent + '%'"
                        [style.background-color]="tp.color"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }

      <!-- Task Modals -->
      @if (showNewTaskModal()) {
        <app-task-modal
          (close)="showNewTaskModal.set(false)"
        ></app-task-modal>
      }

      @if (activeDetailTask(); as dt) {
        <app-task-detail-modal
          [task]="dt"
          (close)="activeDetailTask.set(null)"
        ></app-task-detail-modal>
      }
    </div>
  `,
  styles: [`
    .today-workspace {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      width: 100%;
    }

    /* Top Banner Strip */
    .today-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1.1rem;
      background: var(--bg-surface);
    }
    .banner-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .banner-date {
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .banner-right {
      display: flex;
      align-items: center;
    }

    /* Row 1: 4 Stat Cards Grid */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .stat-card {
      padding: 0.85rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .stat-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stat-label {
      font-size: 0.675rem;
      color: var(--text-muted);
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .stat-icon {
      font-size: 1rem;
    }
    .stat-value {
      font-size: 1.6rem;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.1;
    }
    .stat-sub {
      font-size: 0.725rem;
      color: var(--text-muted);
    }

    /* Row 2 & 3: 2-Column Grid */
    .dashboard-grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 900px) {
      .dashboard-grid-2col {
        grid-template-columns: 1fr;
      }
    }

    .grid-card {
      padding: 0.85rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.45rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .card-header h3 {
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .card-header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .project-filter-wrap {
      width: 140px;
    }
    .card-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .empty-chart {
      padding: 2.5rem 1rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.8rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
    }

    /* Donut/Pie Chart */
    .donut-body {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-around;
      gap: 1.5rem;
      padding: 0.5rem 0;
    }
    @media (max-width: 500px) {
      .donut-body { flex-direction: column; }
    }
    .donut-chart-container {
      position: relative;
      width: 130px;
      height: 130px;
      flex-shrink: 0;
    }
    .donut-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .donut-center-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
    }
    .center-num {
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1;
    }
    .center-lbl {
      font-size: 0.625rem;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }

    .legend-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      flex: 1;
    }
    .legend-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.775rem;
      padding: 0.25rem 0.45rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .legend-left {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .legend-name { color: var(--text-main); }
    .legend-right {
      display: flex;
      gap: 0.35rem;
    }
    .legend-cnt { font-weight: 700; }
    .legend-pct { color: var(--text-muted); font-size: 0.7rem; }

    /* Timeline Recent Activity */
    .timeline-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 0.25rem 0;
    }
    .timeline-item {
      display: flex;
      align-items: flex-start;
      gap: 0.55rem;
      font-size: 0.775rem;
    }
    .timeline-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-amber);
      margin-top: 5px;
      flex-shrink: 0;
    }
    .timeline-content {
      display: flex;
      flex-direction: column;
    }
    .act-text {
      color: var(--text-main);
      line-height: 1.3;
    }
    .act-time {
      font-size: 0.675rem;
      color: var(--text-muted);
    }

    /* Vertical Bars Priority Breakdown */
    .vbars-body {
      padding: 1rem 0 0.5rem 0;
    }
    .vbars-container {
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      height: 140px;
      padding-top: 1rem;
    }
    .vbar-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      height: 100%;
      flex: 1;
    }
    .vbar-count {
      font-size: 0.775rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .vbar-track {
      flex: 1;
      width: 24px;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      display: flex;
      align-items: flex-end;
      overflow: hidden;
    }
    .vbar-fill {
      width: 100%;
      border-radius: var(--radius-xs);
      transition: height 0.3s ease;
      min-height: 2px;
    }
    .vbar-label {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* Horizontal Bars Types of Work */
    .hbars-body {
      padding: 0.5rem 0;
    }
    .hbars-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .hbar-row {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .hbar-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.775rem;
    }
    .type-name {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--text-main);
    }
    .type-count {
      font-weight: 700;
      color: var(--text-main);
    }
    .hbar-track {
      width: 100%;
      height: 7px;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      overflow: hidden;
    }
    .hbar-fill {
      height: 100%;
      transition: width 0.3s ease;
      min-width: 2px;
    }

    /* ==========================================================================
       Mobile Responsive Overhaul for Today / Dashboard (< 768px & < 480px)
       - Compact 2x2 grid for stat cards (reduces 4 vertical rows to 2)
       - Streamlined chart sizes & compact card padding to minimize scrolling
       ========================================================================== */
    @media (max-width: 768px) {
      .today-workspace {
        padding: 0.5rem;
        gap: 0.65rem;
      }

      /* 2x2 Grid for Stat Cards on Mobile */
      .stats-row {
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
      }

      .stat-card {
        padding: 0.55rem 0.75rem;
        gap: 0.2rem;
      }

      .stat-label {
        font-size: 0.6rem;
      }

      .stat-icon {
        font-size: 0.85rem;
      }

      .stat-value {
        font-size: 1.25rem;
      }

      .stat-sub {
        font-size: 0.65rem;
      }

      /* Compact Dashboard Cards & Grids */
      .dashboard-grid-2col {
        gap: 0.65rem;
      }

      .grid-card {
        padding: 0.65rem 0.75rem;
        gap: 0.5rem;
      }

      .card-header h3 {
        font-size: 0.825rem;
      }

      .project-filter-wrap {
        width: 110px;
      }

      .donut-body {
        gap: 0.85rem;
        padding: 0.25rem 0;
      }

      .donut-chart-container {
        width: 100px;
        height: 100px;
      }

      .center-num {
        font-size: 1.1rem;
      }

      .legend-item {
        font-size: 0.725rem;
        padding: 0.15rem 0.35rem;
      }

      .vbars-container {
        height: 100px;
        padding-top: 0.5rem;
      }

      .vbar-count {
        font-size: 0.7rem;
      }

      .vbar-label {
        font-size: 0.625rem;
      }

      .hbars-list {
        gap: 0.45rem;
      }

      .hbar-meta {
        font-size: 0.725rem;
      }

      .timeline-list {
        gap: 0.45rem;
      }

      .timeline-item {
        font-size: 0.725rem;
      }
    }

    @media (max-width: 480px) {
      .stat-value {
        font-size: 1.15rem;
      }

      .project-filter-wrap {
        width: 95px;
      }
    }
  `]
})
export class TodayComponent {
  showNewTaskModal = signal<boolean>(false);
  activeDetailTask = signal<Task | null>(null);

  openCreateModal() {
    this.showNewTaskModal.set(true);
  }

  constructor(
    public taskService: TaskService,
    public projectService: ProjectService,
    public workspaceService: WorkspaceService
  ) { }

  todayDateFormatted = computed(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  });

  activeWorkspaceTasks = computed(() => {
    const tasks = this.taskService.tasks();
    const activeProjId = this.projectService.activeProject()?.id;
    if (!activeProjId) return tasks;
    return tasks.filter(t => t.project_id === activeProjId);
  });

  // Last 7 Days Calculations
  completed7dCount = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    return tasks.filter(t => t.completed || t.status.toLowerCase() === 'done').length;
  });

  updated7dCount = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    const now = new Date().getTime();
    const sevenDaysAgo = now - 7 * 86400000;
    return tasks.filter(t => {
      if (!t.updated_at) return true;
      return new Date(t.updated_at).getTime() >= sevenDaysAgo;
    }).length;
  });

  created7dCount = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    const now = new Date().getTime();
    const sevenDaysAgo = now - 7 * 86400000;
    return tasks.filter(t => {
      if (!t.created_at) return true;
      return new Date(t.created_at).getTime() >= sevenDaysAgo;
    }).length;
  });

  dueSoonCount = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAhead = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    return tasks.filter(t => !t.completed && t.due_date && t.due_date >= todayStr && t.due_date <= sevenDaysAhead).length;
  });

  selectedStatusProjectId = signal<string>('all');

  projectOptions = computed<SelectOption[]>(() => [
    { value: 'all', label: 'All Projects', icon: 'fi fi-rr-apps' },
    ...this.projectService.projects().map(p => ({
      value: p.id,
      label: p.name,
      icon: 'fi fi-rr-folder'
    }))
  ]);

  totalTaskCount = computed(() => this.activeWorkspaceTasks().length);

  filteredStatusTasksCount = computed(() => {
    let tasks = this.activeWorkspaceTasks();
    const projId = this.selectedStatusProjectId();
    if (projId !== 'all') {
      tasks = tasks.filter(t => t.project_id === projId);
    }
    return tasks.length;
  });

  // Dynamic Status Breakdown & Donut SVG calculation across projects
  statusCounts = computed(() => {
    let tasks = this.activeWorkspaceTasks();
    const projId = this.selectedStatusProjectId();
    if (projId !== 'all') {
      tasks = tasks.filter(t => t.project_id === projId);
    }
    const total = tasks.length;
    if (total === 0) return [];

    const countMap = new Map<string, number>();
    tasks.forEach(t => {
      const raw = (t.status || 'Todo').trim();
      const displayStatus = raw
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      countMap.set(displayStatus, (countMap.get(displayStatus) || 0) + 1);
    });

    const COLOR_PALETTE = ['#0284c7', '#16a34a', '#d97706', '#8c857b', '#7c3aed', '#dc2626', '#06b6d4', '#ec4899', '#f59e0b'];

    const knownColors: Record<string, string> = {
      'to do': '#3b82f6',
      'todo': '#3b82f6',
      'backlog': '#64748b',
      'in progress': '#eab308',
      'in_progress': '#eab308',
      'in review': '#a855f7',
      'in_review': '#a855f7',
      'review': '#a855f7',
      'done': '#22c55e',
      'completed': '#22c55e'
    };

    let paletteIdx = 0;
    const result: { name: string; count: number; percent: number; color: string }[] = [];

    countMap.forEach((count, statusName) => {
      const lower = statusName.toLowerCase();
      let color = knownColors[lower];
      if (!color) {
        color = COLOR_PALETTE[paletteIdx % COLOR_PALETTE.length];
        paletteIdx++;
      }
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      result.push({ name: statusName, count, percent, color });
    });

    result.sort((a, b) => b.count - a.count);
    return result;
  });

  donutSegments = computed(() => {
    const list = this.statusCounts();
    const total = this.filteredStatusTasksCount();
    if (total === 0) return [];

    const circumference = 2 * Math.PI * 38; // ~238.76
    let currentOffset = 0;

    return list.map(st => {
      const fraction = st.count / total;
      const dashLength = fraction * circumference;
      const dashArray = `${dashLength} ${circumference - dashLength}`;
      const dashOffset = -currentOffset;
      currentOffset += dashLength;

      return {
        name: st.name,
        color: st.color,
        dashArray,
        dashOffset
      };
    });
  });

  // Recent Activity (Latest 5 Entries for active workspace)
  recentActivities = computed(() => {
    const activeProjId = this.projectService.activeProject()?.id;
    return this.projectService.activities()
      .filter(a => !activeProjId || a.project_id === activeProjId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  });

  // Priority Breakdown
  priorityCounts = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    const total = tasks.length;

    const priorities = [
      { name: 'Urgent', key: 'urgent', color: '#dc2626' },
      { name: 'High', key: 'high', color: '#d97706' },
      { name: 'Medium', key: 'medium', color: '#0284c7' },
      { name: 'Low', key: 'low', color: '#8c857b' }
    ];

    return priorities.map(p => {
      const count = tasks.filter(t => t.priority === p.key).length;
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      return { name: p.name, count, percent, color: p.color };
    });
  });

  // Types of Work
  typeCounts = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    const total = tasks.length;

    const types = [
      { name: 'Story', key: 'story', icon: 'fi fi-rr-book-alt', color: '#0284c7' },
      { name: 'Bug', key: 'bug', icon: 'fi fi-rr-bug', color: '#dc2626' },
      { name: 'Task', key: 'task', icon: 'fi fi-rr-check-circle', color: '#16a34a' },
      { name: 'Epic', key: 'epic', icon: 'fi fi-rr-rocket', color: '#7c3aed' }
    ];

    return types.map(tp => {
      const count = tasks.filter(t => t.type === tp.key).length;
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      return { name: tp.name, count, percent, icon: tp.icon, color: tp.color };
    });
  });

  formatDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
