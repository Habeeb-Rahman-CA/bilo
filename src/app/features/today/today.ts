import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
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
import { ActivityModalComponent } from '../../shared/components/activity-modal';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, FormsModule, TaskDetailModalComponent, TaskModalComponent, ActivityModalComponent],
  template: `
    <div class="today-workspace">
      <!-- Top Header Strip -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-left">
          <span class="badge-mono">01 TODAY</span>
          <h2 class="view-header-title font-mono">{{ todayDateFormatted() }}</h2>
        </div>

        <div class="view-header-right">
          <button class="btn btn-primary btn-sm desktop-only" (click)="workspaceService.openCreateTaskModal()">
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

      <!-- ROW 2: Status Overview (Donut Chart) + Recent Activity (2-Column Grid) -->
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
                <div class="empty-state-card font-mono">
                  <div class="empty-state-icon-badge">
                    <i class="fi fi-rr-sparkles text-cyan"></i>
                  </div>
                  <h4 class="empty-state-title">All Clear for Today!</h4>
                  <p class="empty-state-subtitle">No tasks scheduled or recorded for today.</p>
                  <div class="empty-state-actions">
                    <button type="button" class="btn btn-primary btn-xs" (click)="showNewTaskModal.set(true)">
                      <i class="fi fi-rr-plus"></i> Create Task
                    </button>
                  </div>
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
            @if (!isLoading() && allRecentActivities().length > 0) {
              <button
                type="button"
                class="btn btn-ghost btn-xs text-amber font-mono"
                (click)="showActivityModal.set(true)"
                title="View complete workspace activity log history"
              >
                <i class="fi fi-rr-eye"></i> View All
              </button>
            }
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
            }
          </div>
        </div>
      </div>

      <!-- ROW 3: 3-COLUMN GRID (Velocity Trend + Priority Breakdown + Types of Work) -->
      <div class="dashboard-grid-3col">
        <!-- Card 1: 7-Day Velocity & Productivity Trend Chart -->
        <div class="paper-panel grid-card velocity-card">
          <div class="card-header">
            <div class="header-left">
              <h3><i class="fi fi-rr-chart-histogram text-emerald"></i> 7-Day Velocity</h3>
            </div>
            <span class="badge-mono font-mono" [ngClass]="{
              'badge-emerald': velocityData().rateNum >= 80,
              'badge-cyan': velocityData().rateNum >= 50 && velocityData().rateNum < 80,
              'badge-amber': velocityData().rateNum < 50
            }">
              {{ velocityData().velocityRateStr }} VELOCITY
            </span>
          </div>

          <div class="card-body">
            @if (isLoading()) {
              <div class="skeleton-bars font-mono">
                <div class="skeleton-bar-col"></div>
                <div class="skeleton-bar-col"></div>
                <div class="skeleton-bar-col"></div>
              </div>
            } @else {
              <!-- Metrics Strip -->
              <div class="velocity-metrics-strip font-mono">
                <div class="v-metric-item">
                  <span class="v-metric-num" [ngClass]="{
                    'text-emerald': velocityData().rateNum >= 80,
                    'text-cyan': velocityData().rateNum >= 50 && velocityData().rateNum < 80,
                    'text-amber': velocityData().rateNum < 50
                  }">{{ velocityData().velocityRateStr }}</span>
                  <span class="v-metric-label">Velocity</span>
                </div>
                <div class="v-metric-item">
                  <span class="v-metric-num text-emerald">{{ velocityData().totalCompleted }}</span>
                  <span class="v-metric-label">Completed</span>
                </div>
                <div class="v-metric-item">
                  <span class="v-metric-num text-amber">{{ velocityData().totalCreated }}</span>
                  <span class="v-metric-label">Created</span>
                </div>
                <div class="v-metric-item">
                  <span class="v-metric-num text-cyan">{{ velocityData().peakDayLabel }}</span>
                  <span class="v-metric-label">Peak Day</span>
                </div>
              </div>

              <!-- SVG Area & Line Chart -->
              <div class="velocity-chart-wrapper">
                <svg viewBox="0 0 500 160" class="velocity-svg">
                  <defs>
                    <linearGradient id="velocity-grad-completed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
                      <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
                    </linearGradient>
                    <linearGradient id="velocity-grad-created" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.25" />
                      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0" />
                    </linearGradient>
                  </defs>

                  <!-- Horizontal Grid Lines -->
                  <line x1="30" y1="35" x2="470" y2="35" stroke="var(--border-subtle)" stroke-dasharray="3,3" stroke-width="1" />
                  <line x1="30" y1="82" x2="470" y2="82" stroke="var(--border-subtle)" stroke-dasharray="3,3" stroke-width="1" />
                  <line x1="30" y1="130" x2="470" y2="130" stroke="var(--border-subtle)" stroke-width="1" />

                  <!-- Created Area & Polyline (Amber) -->
                  <path [attr.d]="velocityData().areaCreated" fill="url(#velocity-grad-created)" />
                  <polyline [attr.points]="velocityData().polylineCreated" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,2" />

                  <!-- Completed Area & Polyline (Emerald) -->
                  <path [attr.d]="velocityData().areaCompleted" fill="url(#velocity-grad-completed)" />
                  <polyline [attr.points]="velocityData().polylineCompleted" fill="none" stroke="#10b981" stroke-width="2.5" />

                  <!-- Points & Day Labels -->
                  @for (d of velocityData().days; track d.dayLabel) {
                    <!-- Created Node (Amber Circle) -->
                    <circle [attr.cx]="d.x" [attr.cy]="d.yCreated" r="3.5" fill="#f59e0b" stroke="var(--bg-surface)" stroke-width="1.5">
                      <title>{{ d.dayLabel }} ({{ d.dateLabel }}): {{ d.created }} Created</title>
                    </circle>

                    <!-- Completed Node (Emerald Circle) -->
                    <circle [attr.cx]="d.x" [attr.cy]="d.yCompleted" r="4.5" fill="#10b981" stroke="var(--bg-surface)" stroke-width="2">
                      <title>{{ d.dayLabel }} ({{ d.dateLabel }}): {{ d.completed }} Completed</title>
                    </circle>

                    <!-- Day Label Text -->
                    <text [attr.x]="d.x" y="152" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--text-muted)">
                      {{ d.dayLabel }}
                    </text>
                  }
                </svg>

                <!-- Legend Strip -->
                <div class="velocity-legend font-mono">
                  <div class="legend-item-inline">
                    <span class="dot-emerald"></span>
                    <span>Done</span>
                  </div>
                  <div class="legend-item-inline">
                    <span class="dot-amber"></span>
                    <span>Created</span>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Card 2: Priority Breakdown (Vertical Bars) -->
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

        <!-- Card 3: Types of Work (Horizontal Bars) -->
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

      <!-- ROW 4: Workspace Pipeline Health, Top Focus & Next Due Strip (3 Items) -->
      <div class="paper-panel focus-health-strip font-mono">
        <!-- Item 1: Pipeline Health -->
        <div class="fh-item fh-left">
          <div class="fh-meta-wrap">
            <span class="fh-title">
              <i class="fi fi-rr-target text-emerald"></i>
              PIPELINE HEALTH
            </span>
            <span class="fh-subtitle">
              {{ completed7dCount() }}/{{ totalTaskCount() }} Done ({{ pipelineHealthPercent() }}%)
            </span>
          </div>
          <div class="fh-progress-track" title="Workspace pipeline completion progress">
            <div class="fh-progress-fill" [style.width]="pipelineHealthPercent() + '%'"></div>
          </div>
        </div>

        <div class="fh-divider"></div>

        <!-- Item 2: Top Focus -->
        <div class="fh-item fh-center">
          @if (topFocusTask(); as focus) {
            <div class="focus-pill" (click)="activeDetailTask.set(focus)" title="Top priority focus item — click to inspect details">
              <span class="badge-mono badge-amber">TOP FOCUS</span>
              <span class="focus-task-title">{{ focus.title }}</span>
              <i class="fi fi-rr-arrow-right text-subtle"></i>
            </div>
          } @else {
            <div class="focus-all-clear">
              <i class="fi fi-rr-check-circle text-emerald"></i>
              <span>All Priority Items Done</span>
            </div>
          }
        </div>

        <div class="fh-divider"></div>

        <!-- Item 3: Next Due Soon / Sprint Pace -->
        <div class="fh-item fh-right">
          @if (nextDueSoonTask(); as dueTask) {
            <div class="due-pill" (click)="activeDetailTask.set(dueTask)" title="Next imminent due date task — click to inspect details">
              <span class="badge-mono badge-cyan">DUE SOON</span>
              <span class="focus-task-title">{{ dueTask.title }}</span>
              <span class="due-date-tag text-cyan">{{ formatDueDate(dueTask.due_date) }}</span>
            </div>
          } @else {
            <div class="due-all-clear">
              <span class="badge-mono badge-emerald">SPRINT PACE</span>
              <span class="due-pace-text text-emerald"><i class="fi fi-rr-rocket text-emerald"></i> {{ velocityData().velocityRateStr }} Pace</span>
            </div>
          }
        </div>
      </div>

      <!-- ROW 5: Task Allocation & Assignee Summary Strip -->
      <div class="paper-panel focus-health-strip allocation-strip font-mono">
        <!-- Item 1: Assigned vs Unassigned Count -->
        <div class="fh-item fh-left">
          <div class="fh-meta-wrap">
            <span class="fh-title">
              <i class="fi fi-rr-users-alt text-cyan"></i>
              TASK ALLOCATION
            </span>
            <span class="fh-subtitle">
              {{ assignedTaskCount() }} Assigned • <span class="text-amber">{{ unassignedTaskCount() }} Unassigned</span>
            </span>
          </div>
        </div>

        <div class="fh-divider"></div>

        <!-- Item 2: Team Assignee Pills Breakdown (Who tasks belong to) -->
        <div class="fh-item fh-center assignee-pills-wrap">
          <span class="assignee-strip-label">ASSIGNED TO:</span>
          <div class="assignee-pills-list">
            @for (asg of assigneeCounts(); track asg.name) {
              <span
                class="assignee-chip"
                [class.unassigned-chip]="asg.isUnassigned"
                [title]="asg.name + ': ' + asg.count + ' tasks'"
              >
                <i [class]="asg.isUnassigned ? 'fi fi-rr-user-cross text-amber' : 'fi fi-rr-user text-cyan'"></i>
                <span class="chip-name">{{ asg.name }}</span>
                <span class="chip-count">{{ asg.count }}</span>
              </span>
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

      <app-activity-modal
        [isOpen]="showActivityModal()"
        (close)="showActivityModal.set(false)"
      />
    </div>
  `,
  styles: [`
    .today-workspace {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 0.65rem;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
      justify-content: space-between;
    }
    @media (max-width: 900px) {
      .today-workspace {
        height: auto;
        min-height: 100%;
        overflow-y: auto;
      }
    }

    /* Top Banner Strip */
    .view-header-strip {
      padding: 0.4rem 0.85rem;
      flex-shrink: 0;
    }

    /* Row 1: 4 Stat Cards Grid */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.65rem;
      flex-shrink: 0;
    }
    @media (max-width: 900px) {
      .stats-row {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 500px) {
      .stats-row {
        grid-template-columns: 1fr;
      }
    }
    .stat-card {
      padding: 0.55rem 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .stat-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stat-label {
      font-size: 0.65rem;
      color: var(--text-muted);
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .stat-icon {
      font-size: 0.9rem;
    }
    .stat-value {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.1;
    }
    .stat-sub {
      font-size: 0.675rem;
      color: var(--text-muted);
    }

    /* Row 2: 2-Column Grid (Donut & Activity) */
    .dashboard-grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.65rem;
      flex: 1.05;
      min-height: 0;
    }
    @media (max-width: 900px) {
      .dashboard-grid-2col {
        grid-template-columns: 1fr;
        flex: none;
      }
    }

    /* Row 3: 3-Column Grid (Velocity, Priority, Types) */
    .dashboard-grid-3col {
      display: grid;
      grid-template-columns: 1.25fr 0.875fr 0.875fr;
      gap: 0.65rem;
      flex: 1.15;
      min-height: 0;
    }
    @media (max-width: 1150px) {
      .dashboard-grid-3col {
        grid-template-columns: 1fr 1fr 1fr;
      }
    }
    @media (max-width: 900px) {
      .dashboard-grid-3col {
        grid-template-columns: 1fr;
        flex: none;
      }
    }

    .grid-card {
      padding: 0.65rem 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }
    .card-header h3 {
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
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
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .empty-chart {
      padding: 1.5rem 0.5rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
    }

    /* Donut/Pie Chart */
    .donut-body {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-around;
      gap: 1rem;
      padding: 0.25rem 0;
    }
    @media (max-width: 500px) {
      .donut-body { flex-direction: column; }
    }
    .donut-chart-container {
      position: relative;
      width: 105px;
      height: 105px;
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
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1;
    }
    .center-lbl {
      font-size: 0.575rem;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }

    .legend-list {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      flex: 1;
      overflow-y: auto;
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
      font-size: 0.725rem;
      padding: 0.2rem 0.4rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .legend-left {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .legend-name { color: var(--text-main); }
    .legend-right {
      display: flex;
      gap: 0.25rem;
    }
    .legend-cnt { font-weight: 700; }
    .legend-pct { color: var(--text-muted); font-size: 0.65rem; }

    /* Timeline Recent Activity */
    .timeline-list {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      padding: 0.15rem 0;
      flex: 1;
      overflow-y: auto;
    }
    .timeline-item {
      display: flex;
      align-items: flex-start;
      gap: 0.45rem;
      font-size: 0.725rem;
    }
    .timeline-dot {
      width: 5px;
      height: 5px;
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
      line-height: 1.25;
    }
    .act-time {
      font-size: 0.625rem;
      color: var(--text-muted);
    }
    .activity-footer {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
      padding-top: 0.35rem;
      border-top: 1px dashed var(--border-subtle);
    }
    .activity-footer-btn {
      background: var(--bg-surface-subtle);
      color: var(--text-main);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      font-size: 0.725rem;
      padding: 0.2rem 0.5rem;
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

    /* 7-Day Velocity & Productivity Trend Chart Styles */
    .velocity-card {
      width: 100%;
      box-sizing: border-box;
    }
    .velocity-metrics-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.4rem;
      padding: 0.45rem 0.65rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      margin-bottom: 0.45rem;
      flex-shrink: 0;
    }
    .v-metric-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.1rem;
    }
    .v-metric-num {
      font-size: 0.775rem;
      font-weight: 700;
    }
    .v-metric-label {
      font-size: 0.575rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .velocity-chart-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      flex: 1;
      min-height: 0;
      justify-content: space-between;
    }
    .velocity-svg {
      width: 100%;
      height: 105px;
      flex: 1;
      min-height: 0;
    }
    .velocity-legend {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.85rem;
      margin-top: 0.25rem;
      font-size: 0.675rem;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .legend-item-inline {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .dot-emerald {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent-emerald, #10b981);
      display: inline-block;
    }
    .dot-amber {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent-amber, #f59e0b);
      display: inline-block;
    }

    /* Vertical Bars Priority Breakdown */
    .vbars-body {
      padding: 0.25rem 0;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .vbars-container {
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      flex: 1;
      height: 100%;
      padding-top: 0.35rem;
    }
    .vbar-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      height: 100%;
      flex: 1;
    }
    .vbar-count {
      font-size: 0.725rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .vbar-track {
      flex: 1;
      width: 20px;
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
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* Horizontal Bars Types of Work */
    .hbars-body {
      padding: 0.25rem 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
    }
    .hbars-list {
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      gap: 0.35rem;
      flex: 1;
    }
    .hbar-row {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .hbar-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.725rem;
    }
    .type-name {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--text-main);
    }
    .type-count {
      font-weight: 700;
      color: var(--text-main);
    }
    .hbar-track {
      width: 100%;
      height: 6px;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      overflow: hidden;
    }
    .hbar-fill {
      height: 100%;
      border-radius: var(--radius-xs);
      transition: width 0.3s ease;
      min-width: 2px;
    }

    /* ROW 4: Workspace Health, Top Focus & Next Due Strip */
    .focus-health-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.45rem 0.85rem;
      flex-shrink: 0;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .fh-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex: 1;
      min-width: 0;
    }
    .fh-left {
      max-width: 320px;
    }
    .fh-meta-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
    }
    .fh-title {
      font-weight: 700;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
    }
    .fh-subtitle {
      color: var(--text-muted);
      font-size: 0.7rem;
    }
    .fh-progress-track {
      flex: 1;
      min-width: 60px;
      max-width: 140px;
      height: 7px;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      overflow: hidden;
    }
    .fh-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #06b6d4 100%);
      border-radius: var(--radius-xs);
      transition: width 0.4s ease;
    }
    .fh-divider {
      width: 1px;
      height: 20px;
      background: var(--border-subtle);
      flex-shrink: 0;
    }
    .fh-center, .fh-right {
      justify-content: center;
    }
    .focus-pill, .due-pill {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.25rem 0.6rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      font-size: 0.725rem;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
      width: 100%;
      max-width: 280px;
    }
    .focus-pill:hover, .due-pill:hover {
      background: var(--bg-surface-hover);
      border-color: var(--border-medium);
    }
    .focus-task-title {
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 600;
      flex: 1;
    }
    .due-date-tag {
      font-size: 0.675rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .focus-all-clear, .due-all-clear {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.725rem;
      color: var(--text-muted);
    }
    .due-pace-text {
      font-weight: 700;
      font-size: 0.725rem;
    }

    /* ROW 5: Task Allocation & Assignee Summary Strip */
    .allocation-strip {
      margin-top: 0.15rem;
    }
    .assignee-pills-wrap {
      flex: 2;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      overflow-x: auto;
      justify-content: flex-start;
    }
    .assignee-strip-label {
      font-size: 0.675rem;
      font-weight: 700;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .assignee-pills-list {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      overflow-x: auto;
    }
    .assignee-chip {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.5rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      font-size: 0.7rem;
      white-space: nowrap;
    }
    .assignee-chip.unassigned-chip {
      border-color: var(--accent-amber);
      background: rgba(245, 158, 11, 0.08);
    }
    .chip-name {
      color: var(--text-main);
      font-weight: 600;
    }
    .chip-count {
      font-weight: 700;
      color: var(--text-main);
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

      /* Mobile Pipeline Health & Task Allocation Responsive Layout */
      .focus-health-strip {
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
        padding: 0.55rem 0.65rem;
      }

      .fh-item {
        width: 100%;
        max-width: none;
        justify-content: space-between;
      }

      .fh-left {
        max-width: none;
      }

      .fh-meta-wrap {
        flex-wrap: wrap;
        gap: 0.35rem;
      }

      .fh-progress-track {
        max-width: none;
      }

      .fh-divider {
        display: none;
      }

      .focus-pill, .due-pill {
        max-width: none;
        justify-content: space-between;
      }

      .assignee-pills-wrap {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.35rem;
        width: 100%;
      }

      .assignee-pills-list {
        flex-wrap: wrap;
        width: 100%;
      }

      .assignee-chip {
        font-size: 0.675rem;
        padding: 0.15rem 0.45rem;
      }
    }

    @media (max-width: 480px) {
      .stat-value {
        font-size: 1.15rem;
      }

      .project-filter-wrap {
        width: 95px;
      }

      .velocity-metrics-strip {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.35rem;
        padding: 0.35rem 0.5rem;
      }

      .v-metric-num {
        font-size: 0.725rem;
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
export class TodayComponent implements OnInit, OnDestroy {
  showNewTaskModal = signal<boolean>(false);
  showActivityModal = signal<boolean>(false);
  activeDetailTask = signal<Task | null>(null);

  isLoading = computed(() => this.taskService.loading());
  currentDate = signal<Date>(new Date());
  private dateTimer: any = null;

  openCreateModal() {
    this.showNewTaskModal.set(true);
  }

  constructor(
    public taskService: TaskService,
    public projectService: ProjectService,
    public workspaceService: WorkspaceService,
    public workflowService: WorkflowService
  ) { }

  ngOnInit(): void {
    // Periodically update currentDate so header date stays fresh if left open overnight across midnight
    this.dateTimer = setInterval(() => {
      const now = new Date();
      const curr = this.currentDate();
      if (
        now.getDate() !== curr.getDate() ||
        now.getMonth() !== curr.getMonth() ||
        now.getFullYear() !== curr.getFullYear()
      ) {
        this.currentDate.set(now);
      }
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.dateTimer) {
      clearInterval(this.dateTimer);
      this.dateTimer = null;
    }
  }

  todayDateFormatted = computed(() => {
    const d = this.currentDate();
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

  assignedTaskCount = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    return tasks.filter(t => t.assignee && t.assignee.trim() !== '' && t.assignee.toLowerCase() !== 'unassigned').length;
  });

  unassignedTaskCount = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    return tasks.filter(t => !t.assignee || t.assignee.trim() === '' || t.assignee.toLowerCase() === 'unassigned').length;
  });

  assigneeCounts = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    const map = new Map<string, number>();
    let unassigned = 0;

    tasks.forEach(t => {
      const a = (t.assignee || '').trim();
      if (!a || a.toLowerCase() === 'unassigned') {
        unassigned++;
      } else {
        map.set(a, (map.get(a) || 0) + 1);
      }
    });

    const list: Array<{ name: string; count: number; isUnassigned: boolean }> = [];
    map.forEach((count, name) => {
      list.push({ name, count, isUnassigned: false });
    });
    list.sort((a, b) => b.count - a.count);

    if (unassigned > 0 || list.length === 0) {
      list.push({ name: 'Unassigned', count: unassigned, isUnassigned: true });
    }
    return list;
  });

  allRecentActivities = computed(() => {
    const activities = this.projectService.activities();
    const activeProjId = this.projectService.activeProject()?.id;
    return activeProjId
      ? activities.filter(a => !a.project_id || a.project_id === activeProjId)
      : activities;
  });

  pipelineHealthPercent = computed(() => {
    const total = this.totalTaskCount();
    if (total === 0) return 100;
    const done = this.completed7dCount();
    return Math.min(100, Math.round((done / total) * 100));
  });

  topFocusTask = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    const uncompleted = tasks.filter(t => !t.completed && (t.status || '').toLowerCase() !== 'done');
    if (uncompleted.length === 0) return null;
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...uncompleted].sort((a, b) => {
      const pA = priorityOrder[(a.priority || '').toLowerCase()] ?? 4;
      const pB = priorityOrder[(b.priority || '').toLowerCase()] ?? 4;
      return pA - pB;
    })[0];
  });

  nextDueSoonTask = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    const uncompleted = tasks.filter(t => !t.completed && (t.status || '').toLowerCase() !== 'done' && t.due_date);
    if (uncompleted.length === 0) return null;
    return [...uncompleted].sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];
  });

  formatDueDate(dateStr?: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  displayedActivities = computed(() => {
    return this.allRecentActivities().slice(0, 5);
  });

  recentActivities = computed(() => {
    return this.displayedActivities();
  });

  // 7-Day Velocity & Productivity Trend Data Calculation
  velocityData = computed(() => {
    const tasks = this.activeWorkspaceTasks();
    const now = this.currentDate();
    const days: Array<{
      date: Date;
      dayLabel: string;
      dateLabel: string;
      created: number;
      completed: number;
      x: number;
      yCompleted: number;
      yCreated: number;
    }> = [];

    const countsCreated: number[] = [];
    const countsCompleted: number[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + 86400000 - 1;

      const created = tasks.filter(t => {
        if (!t.created_at) return false;
        const tTime = new Date(t.created_at).getTime();
        return tTime >= startOfDay && tTime <= endOfDay;
      }).length;

      const completed = tasks.filter(t => {
        if (!t.completed && (t.status || '').toLowerCase() !== 'done') return false;
        const tTime = t.updated_at ? new Date(t.updated_at).getTime() : (t.created_at ? new Date(t.created_at).getTime() : 0);
        return tTime >= startOfDay && tTime <= endOfDay;
      }).length;

      countsCreated.push(created);
      countsCompleted.push(completed);

      days.push({
        date: d,
        dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        created,
        completed,
        x: Math.round(40 + i * 70),
        yCompleted: 0,
        yCreated: 0
      });
    }

    const maxVal = Math.max(...countsCreated, ...countsCompleted, 4);

    days.forEach(d => {
      d.yCompleted = Math.round(130 - (d.completed / maxVal) * 95);
      d.yCreated = Math.round(130 - (d.created / maxVal) * 95);
    });

    const totalCreated = countsCreated.reduce((a, b) => a + b, 0);
    const totalCompleted = countsCompleted.reduce((a, b) => a + b, 0);

    const rateNum = totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : (totalCompleted > 0 ? 100 : 0);
    const velocityRateStr = `${rateNum}%`;

    let peakDayItem = days[0];
    days.forEach(d => {
      if (d.completed > peakDayItem.completed) {
        peakDayItem = d;
      }
    });

    const polylineCompleted = days.map(d => `${d.x},${d.yCompleted}`).join(' ');
    const areaCompleted = `M 40,130 L ${polylineCompleted} L 460,130 Z`;

    const polylineCreated = days.map(d => `${d.x},${d.yCreated}`).join(' ');
    const areaCreated = `M 40,130 L ${polylineCreated} L 460,130 Z`;

    return {
      days,
      maxVal,
      totalCreated,
      totalCompleted,
      rateNum,
      velocityRateStr,
      peakDayLabel: `${peakDayItem.dayLabel} (${peakDayItem.completed} closed)`,
      polylineCompleted,
      areaCompleted,
      polylineCreated,
      areaCreated
    };
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
