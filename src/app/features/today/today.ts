import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { WorkflowService } from '../../core/services/workflow.service';
import { Task } from '../../core/models/project.model';
import { isDueSoon } from '../../core/utils/date.util';
import { TaskDetailModalComponent } from '../../shared/components/task-detail-modal';
import { TaskModalComponent } from '../../shared/components/task-modal';
@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, FormsModule, TaskDetailModalComponent, TaskModalComponent],
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
            <div class="stat-value font-mono">
              @if (isLoading()) {
                <span class="skeleton-stat"></span>
              } @else {
                {{ completed7dCount() }}
              }
            </div>
            <div class="stat-sub font-mono">Tasks finished in last 7d</div>
          </div>

          <!-- Card 2: Updated -->
          <div class="stat-card paper-panel">
            <div class="stat-top font-mono">
              <span class="stat-label">UPDATED</span>
              <i class="fi fi-rr-refresh text-cyan stat-icon"></i>
            </div>
            <div class="stat-value font-mono">
              @if (isLoading()) {
                <span class="skeleton-stat"></span>
              } @else {
                {{ updated7dCount() }}
              }
            </div>
            <div class="stat-sub font-mono">Tasks modified in last 7d</div>
          </div>

          <!-- Card 3: Created -->
          <div class="stat-card paper-panel">
            <div class="stat-top font-mono">
              <span class="stat-label">CREATED</span>
              <i class="fi fi-rr-plus text-purple stat-icon"></i>
            </div>
            <div class="stat-value font-mono">
              @if (isLoading()) {
                <span class="skeleton-stat"></span>
              } @else {
                {{ created7dCount() }}
              }
            </div>
            <div class="stat-sub font-mono">New issues in last 7d</div>
          </div>

          <!-- Card 4: Due Soon -->
          <div class="stat-card paper-panel">
            <div class="stat-top font-mono">
              <span class="stat-label">DUE SOON</span>
              <i class="fi fi-rr-clock text-amber stat-icon"></i>
            </div>
            <div class="stat-value font-mono">
              @if (isLoading()) {
                <span class="skeleton-stat"></span>
              } @else {
                {{ dueSoonCount() }}
              }
            </div>
            <div class="stat-sub font-mono">Due within next 7d</div>
          </div>
        </div>

      <!-- ROW 2: Status Overview (Pie/Donut Chart) + Recent Activity (Latest 5) -->
      <div class="dashboard-grid-2col">
        <!-- Card 1: Status Overview (Pie/Donut Chart) -->
        <div class="paper-panel grid-card">
          <div class="card-header">
            <h3><i class="fi fi-rr-chart-pie text-cyan"></i> Status Overview</h3>
            <span class="badge-mono font-mono">
              @if (isLoading()) {
                Loading...
              } @else {
                {{ filteredStatusTasksCount() }} Tasks
              }
            </span>
          </div>

          <div class="card-body donut-body">
            @if (isLoading()) {
              <div class="skeleton-donut-container">
                <div class="skeleton-circle"></div>
                <div class="skeleton-legend font-mono">
                  <div class="skeleton-line"></div>
                  <div class="skeleton-line"></div>
                  <div class="skeleton-line"></div>
                </div>
              </div>
            } @else {
              <div class="donut-chart-container">
                <!-- SVG Donut Chart -->
                <svg class="donut-svg" viewBox="0 0 100 100">
                  <!-- Background track ring -->
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="var(--border-subtle)"
                    stroke-width="16"
                    [attr.stroke-dasharray]="filteredStatusTasksCount() === 0 ? '6 4' : null"
                    [attr.opacity]="filteredStatusTasksCount() === 0 ? '0.6' : '0.25'"
                  />
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

              @if (filteredStatusTasksCount() === 0) {
                <div class="empty-legend font-mono">
                  <div class="empty-legend-title">
                    <i class="fi fi-rr-chart-pie text-cyan"></i> No tasks recorded
                  </div>
                  <p class="empty-legend-desc">Create tasks or select a project with tasks to view status overview.</p>
                </div>
              } @else {
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
            }
          </div>
        </div>

        <!-- Card 2: Recent Activity -->
        <div class="paper-panel grid-card">
          <div class="card-header">
            <h3><i class="fi fi-rr-time-past text-amber"></i> Recent Activity</h3>
            <span class="badge-mono font-mono">
              @if (isLoading()) {
                Loading...
              } @else if (allRecentActivities().length === 0) {
                0 Activities
              } @else {
                Showing {{ displayedActivities().length }} of {{ allRecentActivities().length }}
              }
            </span>
          </div>

          <div class="card-body">
            @if (isLoading()) {
              <div class="skeleton-timeline font-mono">
                <div class="skeleton-timeline-item"></div>
                <div class="skeleton-timeline-item"></div>
                <div class="skeleton-timeline-item"></div>
              </div>
            } @else if (allRecentActivities().length === 0) {
              <div class="empty-chart font-mono">
                <i class="fi fi-rr-time-past text-subtle"></i>
                <span>No recent activity logged</span>
              </div>
            } @else {
              <div class="timeline-list font-mono">
                @for (act of displayedActivities(); track act.id) {
                  <div class="timeline-item">
                    <span class="timeline-dot"></span>
                    <div class="timeline-content">
                      <span class="act-text">{{ act.action }}: {{ act.description }}</span>
                      <span class="act-time">{{ formatDate(act.timestamp) }}</span>
                    </div>
                  </div>
                }
              </div>

              @if (allRecentActivities().length > 5) {
                <div class="activity-footer font-mono">
                  @if (hasMoreActivities()) {
                    <button class="activity-footer-btn" (click)="loadMoreActivities()">
                      <i class="fi fi-rr-angle-small-down"></i> Load More (+5)
                    </button>
                    <button class="activity-footer-btn" (click)="viewAllActivities()">
                      <i class="fi fi-rr-eye"></i> View All ({{ allRecentActivities().length }})
                    </button>
                  } @else {
                    <button class="activity-footer-btn" (click)="collapseActivities()">
                      <i class="fi fi-rr-angle-small-up"></i> Show Less
                    </button>
                  }
                </div>
              }
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
            @if (isLoading()) {
              <div class="skeleton-bars font-mono">
                <div class="skeleton-bar-col"></div>
                <div class="skeleton-bar-col"></div>
                <div class="skeleton-bar-col"></div>
                <div class="skeleton-bar-col"></div>
              </div>
            } @else if (totalTaskCount() === 0) {
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
                        [style.height]="pri.barHeight + '%'"
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
            @if (isLoading()) {
              <div class="skeleton-timeline font-mono">
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
              </div>
            } @else if (totalTaskCount() === 0) {
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
                        [style.width]="tp.barWidth + '%'"
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
    .empty-legend {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0.75rem 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-xs);
      gap: 0.35rem;
    }
    .empty-legend-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .empty-legend-desc {
      font-size: 0.7rem;
      color: var(--text-muted);
      line-height: 1.35;
      margin: 0;
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
    .activity-footer {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
      padding-top: 0.5rem;
      border-top: 1px dashed var(--border-subtle);
    }
    .activity-footer-btn {
      background: var(--bg-surface-subtle);
      color: var(--text-main);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      font-size: 0.725rem;
      padding: 0.25rem 0.6rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .activity-footer-btn:hover {
      background: var(--bg-surface);
      border-color: var(--border-main);
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

    /* Skeleton Loading Placeholders */
    @keyframes skeleton-pulse {
      0% { opacity: 0.4; }
      50% { opacity: 0.85; }
      100% { opacity: 0.4; }
    }
    .skeleton-stat {
      display: inline-block;
      width: 44px;
      height: 24px;
      background: var(--bg-surface-subtle);
      border-radius: var(--radius-xs);
      animation: skeleton-pulse 1.5s ease-in-out infinite;
    }
    .skeleton-donut-container {
      display: flex;
      align-items: center;
      justify-content: space-around;
      width: 100%;
      padding: 0.5rem 0;
    }
    .skeleton-circle {
      width: 110px;
      height: 110px;
      border-radius: 50%;
      border: 14px solid var(--bg-surface-subtle);
      animation: skeleton-pulse 1.5s ease-in-out infinite;
      flex-shrink: 0;
    }
    .skeleton-legend {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1;
      padding-left: 1rem;
    }
    .skeleton-line {
      height: 20px;
      background: var(--bg-surface-subtle);
      border-radius: var(--radius-xs);
      animation: skeleton-pulse 1.5s ease-in-out infinite;
    }
    .skeleton-timeline {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.5rem 0;
    }
    .skeleton-timeline-item {
      height: 26px;
      background: var(--bg-surface-subtle);
      border-radius: var(--radius-xs);
      animation: skeleton-pulse 1.5s ease-in-out infinite;
    }
    .skeleton-bars {
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      height: 140px;
      padding: 1rem 0 0.5rem 0;
    }
    .skeleton-bar-col {
      width: 24px;
      height: 65%;
      background: var(--bg-surface-subtle);
      border-radius: var(--radius-xs);
      animation: skeleton-pulse 1.5s ease-in-out infinite;
    }
  `]
})
export class TodayComponent {
  showNewTaskModal = signal<boolean>(false);
  activeDetailTask = signal<Task | null>(null);

  isLoading = computed(() => this.taskService.loading());

  openCreateModal() {
    this.showNewTaskModal.set(true);
  }

  constructor(
    public taskService: TaskService,
    public projectService: ProjectService,
    public workspaceService: WorkspaceService,
    public workflowService: WorkflowService
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
    return tasks.filter(t => !t.completed && (t.status || '').toLowerCase() !== 'done' && isDueSoon(t.due_date, false, 7)).length;
  });

  totalTaskCount = computed(() => this.activeWorkspaceTasks().length);

  activityLimit = signal<number>(5);

  allRecentActivities = computed(() => {
    const activities = this.projectService.activities();
    const activeProjId = this.projectService.activeProject()?.id;
    return activeProjId
      ? activities.filter(a => !a.project_id || a.project_id === activeProjId)
      : activities;
  });

  displayedActivities = computed(() => {
    return this.allRecentActivities().slice(0, this.activityLimit());
  });

  hasMoreActivities = computed(() => {
    return this.allRecentActivities().length > this.activityLimit();
  });

  loadMoreActivities(): void {
    this.activityLimit.update(l => l + 5);
  }

  viewAllActivities(): void {
    this.activityLimit.set(this.allRecentActivities().length);
  }

  collapseActivities(): void {
    this.activityLimit.set(5);
  }

  recentActivities = computed(() => {
    return this.displayedActivities();
  });

  getTasksForStatusOverview = computed(() => {
    return this.activeWorkspaceTasks();
  });

  filteredStatusTasksCount = computed(() => {
    return this.getTasksForStatusOverview().length;
  });

  // Dynamic Status Breakdown & Donut SVG calculation across configured workflow statuses
  statusCounts = computed(() => {
    const tasks = this.getTasksForStatusOverview();
    const total = tasks.length;
    const activeProjId = this.projectService.activeProject()?.id;
    const configuredWorkflows = this.workflowService.getWorkflowsForProject(activeProjId);

    const statusMap = new Map<string, { name: string; color: string; count: number }>();

    // Initialize with all configured workflow statuses (including 0-count statuses)
    configuredWorkflows.forEach(wf => {
      const key = wf.name.toLowerCase().trim();
      statusMap.set(key, {
        name: wf.name,
        color: wf.color || '#0284c7',
        count: 0
      });
    });

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

    // Tally tasks into status map
    tasks.forEach(t => {
      const raw = (t.status || 'Todo').trim();
      const lowerKey = raw.toLowerCase().replace('_', ' ');

      let entry = statusMap.get(lowerKey);
      if (!entry) {
        const matchedKey = Array.from(statusMap.keys()).find(k => k.replace('_', ' ') === lowerKey);
        if (matchedKey) {
          entry = statusMap.get(matchedKey);
        } else {
          const displayStatus = raw.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          const color = knownColors[lowerKey] || '#06b6d4';
          entry = { name: displayStatus, color, count: 0 };
          statusMap.set(lowerKey, entry);
        }
      }
      if (entry) {
        entry.count++;
      }
    });

    const rawItems = Array.from(statusMap.values());
    return this.calculateIntegerPercentages(rawItems, total);
  });

  donutSegments = computed(() => {
    const list = this.statusCounts().filter(st => st.count > 0);
    const total = this.filteredStatusTasksCount();
    if (total === 0) return [];

    const circumference = 2 * Math.PI * 38; // ~238.76
    let currentOffset = 0;

    return list.map(st => {
      const fraction = st.count / total;
      // Cap dashLength slightly below full circumference (by 0.01) to avoid degenerate 2π SVG arc wrap-around
      const dashLength = fraction >= 0.9999 ? circumference - 0.01 : fraction * circumference;
      const dashArray = `${dashLength} ${circumference}`;
      const dashOffset = -currentOffset;
      currentOffset += fraction * circumference;

      return {
        name: st.name,
        color: st.color,
        dashArray,
        dashOffset
      };
    });
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

    const rawItems = priorities.map(p => {
      const count = tasks.filter(t => t.priority === p.key).length;
      return { name: p.name, count, color: p.color };
    });

    const maxCount = Math.max(...rawItems.map(i => i.count), 0);
    const withPercentages = this.calculateIntegerPercentages(rawItems, total);

    return withPercentages.map(item => {
      const rawBarHeight = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
      const barHeight = Number.isFinite(rawBarHeight) ? Math.round(rawBarHeight) : 0;
      return {
        ...item,
        barHeight
      };
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

    const rawItems = types.map(tp => {
      const count = tasks.filter(t => t.type === tp.key).length;
      return { name: tp.name, count, icon: tp.icon, color: tp.color };
    });

    const maxCount = Math.max(...rawItems.map(i => i.count), 0);
    const withPercentages = this.calculateIntegerPercentages(rawItems, total);

    return withPercentages.map(item => {
      const rawBarWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
      const barWidth = Number.isFinite(rawBarWidth) ? Math.round(rawBarWidth) : 0;
      return {
        ...item,
        barWidth
      };
    });
  });

  // Hamilton-Appell Largest Remainder Method for 100% total integer percentage calculation
  private calculateIntegerPercentages<T extends { count: number }>(items: T[], total: number): (T & { percent: number })[] {
    const sumCounts = items.reduce((acc, curr) => acc + curr.count, 0);
    if (!total || total <= 0 || sumCounts === 0 || !Number.isFinite(total)) {
      return items.map(item => ({ ...item, percent: 0 }));
    }

    const safeTotal = Math.max(total, 1);
    const calcItems = items.map(item => {
      const exactPct = (item.count / safeTotal) * 100;
      const floorPct = Math.floor(exactPct);
      const remainder = exactPct - floorPct;
      return {
        ...item,
        percent: Number.isFinite(floorPct) ? floorPct : 0,
        remainder: Number.isFinite(remainder) ? remainder : 0
      };
    });

    const sumFloors = calcItems.reduce((acc, curr) => acc + curr.percent, 0);
    const targetSum = sumCounts === safeTotal ? 100 : Math.round((sumCounts / safeTotal) * 100);
    let diff = targetSum - sumFloors;

    if (diff > 0) {
      const sortedByRemainder = [...calcItems].sort((a, b) => b.remainder - a.remainder);
      for (let i = 0; i < diff && i < sortedByRemainder.length; i++) {
        sortedByRemainder[i].percent += 1;
      }
    }

    return calcItems.map(({ remainder, ...rest }) => rest as T & { percent: number });
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
