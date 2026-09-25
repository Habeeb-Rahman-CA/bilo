import { Component, signal, computed, effect, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { WorkflowService } from '../../core/services/workflow.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { TaskShareService } from '../../core/services/task-share.service';
import { Task } from '../../core/models/project.model';
import { getTaskKey } from '../../core/utils/task-key.util';
import { compareDueDates } from '../../core/utils/date.util';
import { TaskDetailModalComponent } from '../../shared/components/task-detail-modal';
import { TaskModalComponent } from '../../shared/components/task-modal';
import { SelectComponent, SelectOption } from '../../shared/components/select';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal';

@Component({
  selector: 'app-backlog',
  standalone: true,
  imports: [CommonModule, FormsModule, TaskDetailModalComponent, TaskModalComponent, SelectComponent, ConfirmModalComponent],
  template: `
    <div class="backlog-workspace font-mono">
      <!-- Top Banner Bar -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-left">
          <span class="badge-mono">02 BACKLOG</span>
          <h2 class="view-header-title">Task Backlog</h2>
          <span class="badge-mono text-muted">{{ filteredTasks().length }} of {{ allTasks().length }} Tasks</span>
        </div>

        <div class="view-header-right">
          <button class="btn btn-primary btn-sm" (click)="workspaceService.openCreateTaskModal()">
            <i class="fi fi-rr-plus"></i> New Task
          </button>
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="filter-toolbar paper-panel">
        <div class="search-box">
          <i class="fi fi-rr-search search-icon"></i>
          <input
            type="text"
            class="search-input font-mono"
            placeholder="Search tasks by key, title, description..."
            [ngModel]="rawSearchQuery()"
            (ngModelChange)="onSearchInput($event)"
          />
          @if (rawSearchQuery()) {
            <button class="btn-clear" (click)="clearSearch()"><i class="fi fi-rr-cross"></i></button>
          }
        </div>

        <div class="filter-dropdowns">
          <!-- Type Filter -->
          <div class="filter-group">
            <span class="filter-label">TYPE:</span>
            <app-select
              [options]="typeFilterOptions"
              [value]="selectedType()"
              (valueChange)="selectedType.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Priority Filter -->
          <div class="filter-group">
            <span class="filter-label">PRIORITY:</span>
            <app-select
              [options]="priorityFilterOptions"
              [value]="selectedPriority()"
              (valueChange)="selectedPriority.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Severity Filter -->
          <div class="filter-group">
            <span class="filter-label">SEVERITY:</span>
            <app-select
              [options]="severityFilterOptions"
              [value]="selectedSeverity()"
              (valueChange)="selectedSeverity.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Reproducibility Filter -->
          <div class="filter-group">
            <span class="filter-label">REPRO:</span>
            <app-select
              [options]="reproducibilityFilterOptions"
              [value]="selectedReproducibility()"
              (valueChange)="selectedReproducibility.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Label Filter -->
          <div class="filter-group">
            <span class="filter-label">LABEL:</span>
            <app-select
              [options]="labelFilterOptions()"
              [value]="selectedLabel()"
              (valueChange)="selectedLabel.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Due Date Filter -->
          <div class="filter-group">
            <span class="filter-label">DUE DATE:</span>
            <app-select
              [options]="dueDateFilterOptions"
              [value]="selectedDueDateFilter()"
              (valueChange)="selectedDueDateFilter.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Status Filter -->
          <div class="filter-group">
            <span class="filter-label">STATUS:</span>
            <app-select
              [options]="statusFilterOptions()"
              [value]="selectedStatus()"
              (valueChange)="selectedStatus.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Sort By & Direction -->
          <div class="filter-group sort-group">
            <span class="filter-label">SORT:</span>
            <app-select
              [options]="sortOptions"
              [value]="sortBy()"
              (valueChange)="sortBy.set($event)"
              [compact]="true"
            ></app-select>
            <button
              type="button"
              class="btn btn-secondary btn-xs sort-dir-btn font-mono"
              (click)="toggleSortOrder()"
              [title]="'Sort order: ' + sortOrder().toUpperCase()"
            >
              <i [class]="sortOrder() === 'asc' ? 'fi fi-rr-arrow-small-up' : 'fi fi-rr-arrow-small-down'"></i>
              <span>{{ sortOrder().toUpperCase() }}</span>
            </button>
          </div>

          @if (hasActiveFilters()) {
            <button class="btn btn-ghost btn-xs reset-btn" (click)="resetFilters()" title="Reset all filters">
              <i class="fi fi-rr-rotate-left"></i> Reset Filters
            </button>
          }
        </div>
      </div>

      <!-- Batch Progress Bar Overlay -->
      @if (taskService.batchProgress(); as progress) {
        <div class="batch-progress-bar paper-panel font-mono">
          <div class="batch-progress-info">
            <span class="batch-progress-label">
              <i class="fi fi-rr-spinner spinner-icon text-cyan"></i>
              {{ progress.label }} ({{ progress.current }}/{{ progress.total }})
            </span>
            <span class="batch-progress-pct">{{ progress.percentage }}%</span>
          </div>
          <div class="batch-progress-track">
            <div class="batch-progress-fill" [style.width.%]="progress.percentage"></div>
          </div>
        </div>
      }

      <!-- Batch Selection Bar -->
      @if (visibleSelectedTaskIds().length > 0) {
        <div class="batch-bar paper-panel font-mono">
          <span class="batch-text">{{ visibleSelectedTaskIds().length }} task{{ visibleSelectedTaskIds().length > 1 ? 's' : '' }} selected</span>
          <div class="batch-actions">
            <button class="btn btn-secondary btn-xs" (click)="batchUpdateStatus('done')">
              <i class="fi fi-rr-check text-emerald"></i> Mark Done
            </button>
            <button class="btn btn-secondary btn-xs" (click)="batchUpdatePriority('urgent')">
              <i class="fi fi-rr-angle-up text-rose"></i> Set Urgent
            </button>
            <button class="btn btn-ghost btn-xs text-rose" (click)="batchDelete()">
              <i class="fi fi-rr-trash"></i> Delete
            </button>
            <button class="btn btn-ghost btn-xs" (click)="clearSelection()">Clear Selection</button>
          </div>
        </div>
      }

      <!-- Unified Backlog Table Container -->
      <div class="backlog-table-container paper-panel">
        <!-- Table Header -->
        <div class="table-header-row font-mono">
          <div class="cell-check">
            <input
              type="checkbox"
              [checked]="isAllSelected()"
              (change)="toggleSelectAll()"
              title="Select all tasks"
            />
          </div>
          <div class="cell-type">TYPE</div>
          <div class="cell-key">KEY</div>
          <div class="cell-summary">TITLE / SUMMARY</div>
          <div class="cell-project">PROJECT</div>
          <div class="cell-priority">PRIORITY</div>
          <div class="cell-status">STATUS</div>
          <div class="cell-due">DUE DATE</div>
          <div class="cell-created">CREATED DATE</div>
          <div class="cell-actions">ACTIONS</div>
        </div>

        <!-- Table Body -->
        <div class="table-body">
          @if (filteredTasks().length === 0) {
            <div class="empty-backlog font-mono">
              <i class="fi fi-rr-search text-muted"></i>
              <span>No tasks found matching current filters.</span>
              @if (hasActiveFilters()) {
                <button class="btn btn-secondary btn-xs margin-top" (click)="resetFilters()">Clear Filters</button>
              }
            </div>
          } @else {
            @for (t of filteredTasks(); track t.id) {
              <div
                class="task-table-row"
                [class.selected]="isTaskSelected(t.id)"
                (click)="openDetail(t)"
              >
                <!-- Checkbox -->
                <div class="cell-check" (click)="$event.stopPropagation()">
                  <input
                    type="checkbox"
                    [checked]="isTaskSelected(t.id)"
                    (change)="toggleSelectTask(t.id)"
                  />
                </div>

                <!-- Type Icon & Label -->
                <div class="cell-type" [title]="'Type / Category: ' + getTypeLabel(t)">
                  <i [class]="getTypeIcon(t)" [style.color]="getTypeColor(t)"></i>
                  <span class="type-name">{{ getTypeLabel(t) }}</span>
                </div>

                <!-- Task Key / Identifier -->
                <div
                  class="cell-key font-mono clickable-key"
                  (click)="taskShareService.copyTaskShareLink(t, $event)"
                  title="Click to copy share link"
                >
                  <span>{{ getTaskKeyStr(t) }} <i class="fi fi-rr-link link-icon"></i></span>
                </div>

                <!-- Title / Summary -->
                <div class="cell-summary">
                  <span class="summary-text" [class.completed]="t.completed || isDone(t.status)">{{ t.title }}</span>
                  @if (isReportedTask(t)) {
                    <span class="app-report-badge font-mono" title="Reported directly by user via App Report">
                      <i class="fi fi-rr-paper-plane"></i> User Report
                    </span>
                  }
                </div>

                <!-- Project -->
                <div class="cell-project">
                  <span class="project-pill font-mono">{{ getProjectName(t.project_id) }}</span>
                </div>

                <!-- Priority -->
                <div class="cell-priority font-mono">
                  <span class="priority-badge" [class]="(t.priority || 'medium').toLowerCase()">
                    {{ t.priority || 'medium' }}
                  </span>
                </div>

                <!-- Status Select -->
                <div class="cell-status font-mono" (click)="$event.stopPropagation()">
                  <app-select
                    [options]="rowStatusOptions()"
                    [value]="normalizeStatus(t.status)"
                    (valueChange)="updateStatus(t.id, $event)"
                    [compact]="true"
                  ></app-select>
                </div>

                <!-- Due Date -->
                <div class="cell-due font-mono">
                  @if (t.due_date) {
                    <span class="due-pill" [class.overdue]="isOverdue(t)">
                      <i class="fi fi-rr-calendar"></i> {{ t.due_date }}
                    </span>
                  } @else {
                    <span class="no-due">No due date</span>
                  }
                </div>

                <!-- Created Date -->
                <div class="cell-created font-mono">
                  @if (t.created_at) {
                    <span class="created-pill" [title]="t.created_at">
                      <i class="fi fi-rr-clock"></i> {{ formatCreatedDate(t.created_at) }}
                    </span>
                  } @else {
                    <span class="no-created">-</span>
                  }
                </div>

                <!-- Actions -->
                <div class="cell-actions" (click)="$event.stopPropagation()">
                  <button class="action-btn btn-danger-action" (click)="deleteTask(t)" title="Delete task permanently">
                    <i class="fi fi-rr-trash"></i>
                  </button>
                </div>
              </div>
            }
          }
        </div>
      </div>

      <!-- Task Modals -->
      @if (showCreateModal()) {
        <app-task-modal
          (close)="showCreateModal.set(false)"
        ></app-task-modal>
      }

      @if (activeDetailTask(); as dt) {
        <app-task-detail-modal
          [task]="dt"
          (close)="activeDetailTask.set(null)"
        ></app-task-detail-modal>
      }

      @if (confirmState(); as cs) {
        <app-confirm-modal
          [isOpen]="cs.open"
          [title]="cs.title"
          [message]="cs.message"
          confirmText="Delete"
          type="danger"
          (confirm)="handleConfirm()"
          (cancel)="confirmState.set(null)"
        />
      }
    </div>
  `,
  styles: [`
    .backlog-workspace {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      width: 100%;
    }

    /* Top Banner Bar */
    .backlog-banner {
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
    .banner-left h2 {
      font-size: 1.1rem;
      font-weight: 700;
    }
    .banner-count {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .banner-right {
      display: flex;
      align-items: center;
    }

    /* Filter & Search Toolbar */
    .filter-toolbar {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--bg-surface-subtle);
    }
    .search-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 0.4rem 0.75rem;
    }
    .search-icon {
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .search-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 0.825rem;
      color: var(--text-main);
      outline: none;
    }
    .btn-clear {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.75rem;
    }

    .filter-dropdowns {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      flex-wrap: wrap;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .filter-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }
    .filter-select {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      color: var(--text-main);
      outline: none;
      cursor: pointer;
    }
    .filter-select:hover {
      border-color: var(--border-medium);
    }
    .reset-btn {
      color: var(--accent-rose);
    }

    /* Batch Selection Bar */
    .batch-progress-bar {
      margin-bottom: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--bg-surface, #18181b);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
      border-radius: var(--radius-xs, 4px);
    }
    .batch-progress-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      font-size: 0.8rem;
    }
    .batch-progress-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      color: var(--text-main, #f4f4f5);
    }
    .batch-progress-pct {
      font-weight: 700;
      color: #38bdf8;
    }
    .batch-progress-track {
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      overflow: hidden;
    }
    .batch-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #0284c7 0%, #38bdf8 100%);
      transition: width 0.15s ease-out;
      border-radius: 3px;
    }
    .spinner-icon {
      animation: spin 1s linear infinite;
      display: inline-block;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .batch-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1rem;
      background: var(--text-main);
      color: var(--bg-canvas);
      border-radius: var(--radius-xs);
    }
    .batch-text {
      font-size: 0.8rem;
      font-weight: 700;
    }
    .batch-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Unified Backlog Table */
    .backlog-table-container {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-surface);
    }

    .table-header-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 1rem;
      background: var(--bg-surface-subtle);
      border-bottom: 1px solid var(--border-subtle);
      font-size: 0.675rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }

    .table-body {
      display: flex;
      flex-direction: column;
    }

    .empty-backlog {
      padding: 3rem 1rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.825rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    .margin-top { margin-top: 0.5rem; }

    /* Task Row */
    .task-table-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.55rem 1rem;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      cursor: pointer;
      transition: var(--transition-fast);
      font-size: 0.8rem;
    }
    .task-table-row:hover {
      background: var(--bg-surface-hover);
    }
    .task-table-row.selected {
      background: var(--bg-surface-subtle);
      border-left: 3px solid var(--accent-cyan);
    }

    .cell-check {
      display: flex;
      align-items: center;
      width: 24px;
    }
    .cell-type {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      width: 75px;
      font-size: 0.75rem;
    }
    .type-name {
      text-transform: capitalize;
      color: var(--text-muted);
    }
    .cell-key {
      font-size: 0.725rem;
      font-weight: 700;
      color: var(--text-muted);
      width: 85px;
    }
    .cell-summary {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      overflow: hidden;
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
    .summary-text {
      color: var(--text-main);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .summary-text.completed {
      text-decoration: line-through;
      color: var(--text-muted);
    }

    .cell-project {
      width: 120px;
    }
    .project-pill {
      font-size: 0.7rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      padding: 0.1rem 0.45rem;
      border-radius: var(--radius-xs);
      color: var(--text-muted);
      display: inline-block;
      max-width: 110px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cell-priority {
      width: 85px;
    }
    .priority-badge {
      font-size: 0.675rem;
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-xs);
      font-weight: 700;
      text-transform: uppercase;
      border: 1px solid var(--border-subtle);
    }
    .priority-badge.urgent { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
    .priority-badge.high { background: #fef3c7; color: #d97706; border-color: #fcd34d; }
    .priority-badge.medium { background: #e0f2fe; color: #0284c7; border-color: #7dd3fc; }
    .priority-badge.low { background: #f3f4f6; color: #4b5563; border-color: #d1d5db; }

    .cell-status {
      width: 110px;
    }
    .status-select {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 0.15rem 0.4rem;
      font-size: 0.725rem;
      color: var(--text-main);
      outline: none;
      cursor: pointer;
      width: 100%;
    }

    .cell-due {
      width: 105px;
      font-size: 0.725rem;
    }
    .due-pill {
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .due-pill.overdue {
      color: var(--accent-rose);
      font-weight: 700;
    }
    .no-due {
      color: var(--text-subtle);
      font-style: italic;
      font-size: 0.7rem;
      opacity: 0.75;
    }

    .cell-created {
      width: 110px;
      font-size: 0.725rem;
    }
    .created-pill {
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .no-created { color: var(--text-subtle); }

    .cell-actions {
      width: 50px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
    .action-btn {
      background: transparent;
      border: none;
      padding: 0.2rem 0.4rem;
      cursor: pointer;
      font-size: 0.8rem;
      border-radius: var(--radius-xs);
      opacity: 0.7;
    }
    .action-btn:hover {
      opacity: 1;
      background: var(--bg-surface-subtle);
    }
    .action-btn.btn-danger-action {
      color: #f43f5e;
      border: 1px solid rgba(244, 63, 94, 0.3);
      background: rgba(244, 63, 94, 0.06);
      opacity: 0.85;
      transition: var(--transition-fast);
    }
    .action-btn.btn-danger-action:hover {
      opacity: 1;
      background: #f43f5e;
      color: #ffffff;
      border-color: #f43f5e;
    }

    /* ==========================================================================
       Mobile Backlog Optimizations (< 768px & < 480px)
       Only show important data: Checkbox, Key/Title, Priority, Status.
       Hide project, created date, due date, action button, and type label text.
       ========================================================================== */
    @media (max-width: 768px) {
      .backlog-workspace {
        padding: 0.5rem;
        gap: 0.65rem;
      }

      /* Horizontal Scrolling Filter Toolbar on Mobile */
      .filter-toolbar {
        padding: 0.5rem 0.65rem;
        gap: 0.5rem;
      }

      .filter-dropdowns {
        overflow-x: auto;
        flex-wrap: nowrap;
        padding-bottom: 0.2rem;
        -webkit-overflow-scrolling: touch;
      }

      .filter-label {
        display: none;
      }

      .filter-group {
        flex-shrink: 0;
      }

      /* Backlog Table Container & Row */
      .backlog-table-container {
        border-radius: var(--radius-xs);
        overflow-x: hidden;
      }

      .table-header-row {
        padding: 0.5rem 0.65rem;
        gap: 0.5rem;
      }

      /* Hide non-essential columns on mobile */
      .table-header-row .cell-project,
      .table-header-row .cell-due,
      .table-header-row .cell-created,
      .table-header-row .cell-actions,
      .task-table-row .cell-project,
      .task-table-row .cell-due,
      .task-table-row .cell-created,
      .task-table-row .cell-actions {
        display: none !important;
      }

      .table-header-row .cell-type {
        display: none !important;
      }

      /* Compact mobile task row */
      .task-table-row {
        padding: 0.55rem 0.65rem;
        gap: 0.45rem;
      }

      .cell-check {
        width: 20px;
        flex-shrink: 0;
      }

      .cell-type {
        width: auto;
        flex-shrink: 0;
      }

      .type-name {
        display: none;
      }

      .cell-key {
        width: auto;
        min-width: 60px;
        flex-shrink: 0;
        font-size: 0.7rem;
      }

      .cell-summary {
        flex: 1;
        min-width: 0;
      }

      .summary-text {
        font-size: 0.775rem;
      }

      .cell-priority {
        width: auto;
        flex-shrink: 0;
      }

      .priority-badge {
        font-size: 0.625rem;
        padding: 0.08rem 0.3rem;
      }

      .cell-status {
        width: 90px;
        flex-shrink: 0;
      }

      .batch-bar {
        padding: 0.4rem 0.65rem;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.4rem;
      }

      .batch-actions {
        flex-wrap: wrap;
        width: 100%;
        justify-content: flex-start;
      }
    }

    @media (max-width: 480px) {
      .cell-key {
        font-size: 0.675rem;
      }

      .cell-status {
        width: 82px;
      }
    }
  `]
})
export class BacklogComponent implements OnInit, OnDestroy {
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
    }, 200);
  }

  clearSearch(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.rawSearchQuery.set('');
    this.searchQuery.set('');
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }
  selectedProject = signal<string>('ALL');
  selectedType = signal<string>('ALL');
  selectedPriority = signal<string>('ALL');
  selectedStatus = signal<string>('ALL');
  selectedSeverity = signal<string>('ALL');
  selectedReproducibility = signal<string>('ALL');
  selectedLabel = signal<string>('ALL');
  selectedDueDateFilter = signal<string>('ALL');
  sortBy = signal<string>('created_at');
  sortOrder = signal<'asc' | 'desc'>('desc');

  typeFilterOptions: SelectOption[] = [
    { value: 'ALL', label: 'All Types' },
    { value: 'task', label: 'Task', icon: 'fi fi-rr-checkbox' },
    { value: 'story', label: 'Story', icon: 'fi fi-rr-book-alt' },
    { value: 'bug', label: 'Bug', icon: 'fi fi-rr-bug' },
    { value: 'epic', label: 'Epic', icon: 'fi fi-rr-rocket' }
  ];

  priorityFilterOptions: SelectOption[] = [
    { value: 'ALL', label: 'All Priorities' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  severityFilterOptions: SelectOption[] = [
    { value: 'ALL', label: 'All Severities' },
    { value: 'critical', label: 'Critical' },
    { value: 'major', label: 'Major' },
    { value: 'minor', label: 'Minor' },
    { value: 'trivial', label: 'Trivial' }
  ];

  reproducibilityFilterOptions: SelectOption[] = [
    { value: 'ALL', label: 'All Reproducibility' },
    { value: 'always', label: 'Always' },
    { value: 'often', label: 'Often' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'rarely', label: 'Rarely' },
    { value: 'unable', label: 'Unable to Reproduce' }
  ];

  dueDateFilterOptions: SelectOption[] = [
    { value: 'ALL', label: 'All Due Dates' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Due Today' },
    { value: 'week', label: 'Due This Week' },
    { value: 'has_date', label: 'Has Due Date' },
    { value: 'no_date', label: 'No Due Date' }
  ];

  statusFilterOptions = computed<SelectOption[]>(() => [
    { value: 'ALL', label: 'All Statuses' },
    ...this.workflowService.globalWorkflows().map(w => ({
      value: w.name,
      label: w.name
    }))
  ]);

  labelFilterOptions = computed<SelectOption[]>(() => [
    { value: 'ALL', label: 'All Labels' },
    ...this.availableLabels().map(lbl => ({
      value: lbl,
      label: `#${lbl}`
    }))
  ]);

  sortOptions: SelectOption[] = [
    { value: 'created_at', label: 'Created Date' },
    { value: 'updated_at', label: 'Last Updated' },
    { value: 'priority', label: 'Priority' },
    { value: 'severity', label: 'Severity' },
    { value: 'due_date', label: 'Due Date' },
    { value: 'title', label: 'Title / Key' },
    { value: 'status', label: 'Status' }
  ];

  availableLabels = computed<string[]>(() => {
    const list = this.taskService.tasks();
    const set = new Set<string>();
    list.forEach(t => {
      t.labels?.forEach(l => {
        if (l.trim()) set.add(l.trim().toLowerCase());
      });
    });
    return Array.from(set).sort();
  });

  rowStatusOptions = computed<SelectOption[]>(() =>
    this.workflowService.globalWorkflows().map(w => ({
      value: w.name,
      label: w.name
    }))
  );

  showCreateModal = signal<boolean>(false);
  activeDetailTask = signal<Task | null>(null);

  selectedTaskIds = signal<string[]>([]);

  visibleSelectedTaskIds = computed<string[]>(() => {
    const visibleIds = new Set(this.filteredTasks().map(t => t.id));
    return this.selectedTaskIds().filter(id => visibleIds.has(id));
  });

  constructor(
    public taskService: TaskService,
    public projectService: ProjectService,
    public workflowService: WorkflowService,
    public workspaceService: WorkspaceService,
    public taskShareService: TaskShareService
  ) {
    const saved = localStorage.getItem('bilo_backlog_filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.searchQuery !== undefined) {
          this.rawSearchQuery.set(parsed.searchQuery);
          this.searchQuery.set(parsed.searchQuery);
        }
        if (parsed.selectedType !== undefined) this.selectedType.set(parsed.selectedType);
        if (parsed.selectedPriority !== undefined) this.selectedPriority.set(parsed.selectedPriority);
        if (parsed.selectedStatus !== undefined) this.selectedStatus.set(parsed.selectedStatus);
        if (parsed.selectedSeverity !== undefined) this.selectedSeverity.set(parsed.selectedSeverity);
        if (parsed.selectedReproducibility !== undefined) this.selectedReproducibility.set(parsed.selectedReproducibility);
        if (parsed.selectedLabel !== undefined) this.selectedLabel.set(parsed.selectedLabel);
        if (parsed.selectedDueDateFilter !== undefined) this.selectedDueDateFilter.set(parsed.selectedDueDateFilter);
        if (parsed.sortBy !== undefined) this.sortBy.set(parsed.sortBy);
        if (parsed.sortOrder !== undefined) this.sortOrder.set(parsed.sortOrder);
      } catch (e) {}
    }

    // Auto-prune selection when filters change so hidden/invisible items are deselected
    effect(() => {
      const visibleSet = new Set(this.filteredTasks().map(t => t.id));
      const current = this.selectedTaskIds();
      if (current.length > 0) {
        const pruned = current.filter(id => visibleSet.has(id));
        if (pruned.length !== current.length) {
          this.selectedTaskIds.set(pruned);
        }
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const filters = {
        searchQuery: this.searchQuery(),
        selectedType: this.selectedType(),
        selectedPriority: this.selectedPriority(),
        selectedStatus: this.selectedStatus(),
        selectedSeverity: this.selectedSeverity(),
        selectedReproducibility: this.selectedReproducibility(),
        selectedLabel: this.selectedLabel(),
        selectedDueDateFilter: this.selectedDueDateFilter(),
        sortBy: this.sortBy(),
        sortOrder: this.sortOrder()
      };
      localStorage.setItem('bilo_backlog_filters', JSON.stringify(filters));
    });
  }

  toggleSortOrder() {
    this.sortOrder.update(o => o === 'asc' ? 'desc' : 'asc');
  }

  getTaskKeyStr(t: Task): string {
    return getTaskKey(t, this.projectService.projects(), this.taskService.tasks());
  }

  ngOnInit() {
    this.taskService.loadTasksFromSupabase();
  }

  allTasks = computed(() => this.taskService.tasks());

  hasActiveFilters = computed(() => {
    return (
      this.rawSearchQuery().trim() !== '' ||
      this.searchQuery().trim() !== '' ||
      this.selectedType() !== 'ALL' ||
      this.selectedPriority() !== 'ALL' ||
      this.selectedStatus() !== 'ALL' ||
      this.selectedSeverity() !== 'ALL' ||
      this.selectedReproducibility() !== 'ALL' ||
      this.selectedLabel() !== 'ALL' ||
      this.selectedDueDateFilter() !== 'ALL' ||
      this.sortOrder() !== 'desc'
    );
  });

  filteredTasks = computed(() => {
    let list = [...this.allTasks()];
    const activeWorkspaceProjId = this.projectService.activeProject()?.id;
    if (activeWorkspaceProjId) {
      list = list.filter(t => t.project_id === activeWorkspaceProjId);
    }
    const q = this.searchQuery().toLowerCase().trim();
    const type = this.selectedType().toLowerCase();
    const pri = this.selectedPriority().toLowerCase();
    const st = this.selectedStatus().toLowerCase();
    const sev = this.selectedSeverity().toLowerCase();
    const repro = this.selectedReproducibility().toLowerCase();
    const lbl = this.selectedLabel().toLowerCase();
    const dueFilter = this.selectedDueDateFilter().toLowerCase();
    const sort = this.sortBy();

    if (q) {
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        t.id.toLowerCase().includes(q)
      );
    }

    if (type !== 'all') {
      list = list.filter(t => (t.type || 'task').toLowerCase() === type);
    }

    if (pri !== 'all') {
      list = list.filter(t => (t.priority || 'medium').toLowerCase() === pri);
    }

    if (st !== 'all') {
      list = list.filter(t => this.normalizeStatus(t.status).toLowerCase() === st);
    }

    if (sev !== 'all') {
      list = list.filter(t => (t.severity || '').toLowerCase() === sev);
    }

    if (repro !== 'all') {
      list = list.filter(t => (t.reproducibility || '').toLowerCase() === repro);
    }

    if (lbl !== 'all') {
      list = list.filter(t => (t.labels || []).some(l => l.toLowerCase() === lbl));
    }

    if (dueFilter !== 'all') {
      const todayStr = new Date().toISOString().split('T')[0];
      const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      if (dueFilter === 'overdue') list = list.filter(t => t.due_date && t.due_date < todayStr && !t.completed);
      else if (dueFilter === 'today') list = list.filter(t => t.due_date === todayStr);
      else if (dueFilter === 'week') list = list.filter(t => t.due_date && t.due_date >= todayStr && t.due_date <= weekAhead);
      else if (dueFilter === 'has_date') list = list.filter(t => !!t.due_date);
      else if (dueFilter === 'no_date') list = list.filter(t => !t.due_date);
    }

    // Sort logic
    const mult = this.sortOrder() === 'asc' ? 1 : -1;
    const priorityWeight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    const severityWeight: Record<string, number> = { critical: 4, major: 3, minor: 2, trivial: 1 };

    list.sort((a, b) => {
      let diff = 0;
      if (sort === 'created_at') {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        diff = da - db;
      } else if (sort === 'updated_at') {
        const da = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const db = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        diff = da - db;
      } else if (sort === 'priority') {
        const pa = priorityWeight[(a.priority || 'medium').toLowerCase()] || 0;
        const pb = priorityWeight[(b.priority || 'medium').toLowerCase()] || 0;
        diff = pa - pb;
      } else if (sort === 'severity') {
        const sa = severityWeight[(a.severity || '').toLowerCase()] || 0;
        const sb = severityWeight[(b.severity || '').toLowerCase()] || 0;
        diff = sa - sb;
      } else if (sort === 'due_date') {
        return compareDueDates(a.due_date, b.due_date, mult, a.created_at, b.created_at);
      } else if (sort === 'title') {
        diff = a.title.localeCompare(b.title);
      } else if (sort === 'status') {
        diff = (a.status || '').localeCompare(b.status || '');
      }
      return diff * mult;
    });

    return list;
  });

  resetFilters() {
    this.clearSearch();
    this.selectedType.set('ALL');
    this.selectedPriority.set('ALL');
    this.selectedStatus.set('ALL');
    this.selectedSeverity.set('ALL');
    this.selectedReproducibility.set('ALL');
    this.selectedLabel.set('ALL');
    this.selectedDueDateFilter.set('ALL');
    this.sortBy.set('created_at');
    this.sortOrder.set('desc');
    localStorage.removeItem('bilo_backlog_filters');
  }

  isAllSelected(): boolean {
    const list = this.filteredTasks();
    if (list.length === 0) return false;
    const selected = this.visibleSelectedTaskIds();
    return list.every(t => selected.includes(t.id));
  }

  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.selectedTaskIds.set([]);
    } else {
      this.selectedTaskIds.set(this.filteredTasks().map(t => t.id));
    }
  }

  isTaskSelected(id: string): boolean {
    return this.visibleSelectedTaskIds().includes(id);
  }

  toggleSelectTask(id: string) {
    this.selectedTaskIds.update(ids => {
      if (ids.includes(id)) {
        return ids.filter(i => i !== id);
      } else {
        return [...ids, id];
      }
    });
  }

  clearSelection() {
    this.selectedTaskIds.set([]);
  }

  async batchUpdateStatus(status: string) {
    const ids = this.visibleSelectedTaskIds();
    if (ids.length === 0) return;
    await this.taskService.batchUpdateTasks(ids, { status, completed: status.toLowerCase() === 'done' });
    this.clearSelection();
  }

  async batchUpdatePriority(priority: 'urgent' | 'high' | 'medium' | 'low') {
    const ids = this.visibleSelectedTaskIds();
    if (ids.length === 0) return;
    await this.taskService.batchUpdateTasks(ids, { priority });
    this.clearSelection();
  }

  confirmState = signal<{ open: boolean; title: string; message: string; action: () => void } | null>(null);

  batchDelete() {
    const ids = this.visibleSelectedTaskIds();
    if (ids.length === 0) return;
    this.confirmState.set({
      open: true,
      title: 'Delete Selected Tasks',
      message: `Are you sure you want to permanently delete ${ids.length} visible task${ids.length > 1 ? 's' : ''}?`,
      action: async () => {
        await this.taskService.batchDeleteTasks(ids);
        this.clearSelection();
      }
    });
  }

  async updateStatus(id: string, statusVal: string) {
    await this.taskService.updateTask(id, { status: statusVal, completed: statusVal === 'done' });
  }

  deleteTask(t: Task) {
    this.confirmState.set({
      open: true,
      title: 'Delete Task',
      message: `Are you sure you want to permanently delete task "${t.title}"?`,
      action: async () => {
        await this.taskService.deleteTask(t.id);
        this.selectedTaskIds.update(ids => ids.filter(id => id !== t.id));
      }
    });
  }

  handleConfirm() {
    const current = this.confirmState();
    if (current && current.action) {
      current.action();
    }
    this.confirmState.set(null);
  }

  openDetail(t: Task) {
    this.activeDetailTask.set(t);
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

  getTypeIcon(t: Task | string): string {
    if (typeof t === 'object' && t !== null && this.isReportedTask(t)) {
      const cat = this.getReportCategory(t);
      switch (cat) {
        case 'ui_ux': return 'fi fi-rr-layout-fluid';
        case 'feature': return 'fi fi-rr-rocket';
        case 'other': return 'fi fi-rr-info';
        case 'bug': default: return 'fi fi-rr-bug';
      }
    }
    const typeStr = (typeof t === 'string' ? t : t?.type || '').toLowerCase();
    switch (typeStr) {
      case 'story': return 'fi fi-rr-book-alt';
      case 'bug': return 'fi fi-rr-bug';
      case 'epic': return 'fi fi-rr-rocket';
      default: return 'fi fi-rr-checkbox';
    }
  }

  getTypeColor(t: Task | string): string {
    if (typeof t === 'object' && t !== null && this.isReportedTask(t)) {
      const cat = this.getReportCategory(t);
      switch (cat) {
        case 'ui_ux': return '#06b6d4';
        case 'feature': return '#f59e0b';
        case 'other': return '#71717a';
        case 'bug': default: return '#f43f5e';
      }
    }
    const typeStr = (typeof t === 'string' ? t : t?.type || '').toLowerCase();
    switch (typeStr) {
      case 'story': return '#0284c7';
      case 'bug': return '#dc2626';
      case 'epic': return '#7c3aed';
      default: return '#16a34a';
    }
  }

  normalizeStatus(status: string): string {
    if (!status) return 'Backlog';
    const s = status.trim();
    const workflows = this.workflowService.globalWorkflows();
    const found = workflows.find(w => w.name.toLowerCase() === s.toLowerCase());
    if (found) return found.name;

    const lower = s.toLowerCase();
    if (lower.includes('backlog')) return 'Backlog';
    if (lower.includes('todo') || lower === 'to do' || lower === 'open') return 'To Do';
    if (lower.includes('progress') || lower.includes('doing') || lower === 'wip') return 'In Progress';
    if (lower.includes('review') || lower.includes('testing')) return 'In Review';
    if (lower.includes('done') || lower.includes('complete')) return 'Done';

    return workflows[0]?.name || 'Backlog';
  }

  isDone(status: string): boolean {
    return (status || '').toLowerCase().includes('done') || (status || '').toLowerCase().includes('complete');
  }

  isOverdue(t: Task): boolean {
    if (!t.due_date || t.completed || this.isDone(t.status)) return false;
    const today = new Date().toISOString().split('T')[0];
    return t.due_date < today;
  }

  formatCreatedDate(isoString?: string): string {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}
