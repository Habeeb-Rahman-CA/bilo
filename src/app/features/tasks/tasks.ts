import { Component, signal, computed, effect, OnInit, OnDestroy, AfterViewInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, CdkDragStart, CdkDrag } from '@angular/cdk/drag-drop';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { WorkflowService } from '../../core/services/workflow.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { TaskShareService } from '../../core/services/task-share.service';
import { Project, Task, Workflow } from '../../core/models/project.model';
import { getTaskKey } from '../../core/utils/task-key.util';
import { compareDueDates } from '../../core/utils/date.util';
import { TaskModalComponent } from '../../shared/components/task-modal';
import { TaskDetailModalComponent } from '../../shared/components/task-detail-modal';
import { SelectComponent, SelectOption } from '../../shared/components/select';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    TaskModalComponent,
    TaskDetailModalComponent,
    SelectComponent
  ],
  template: `
    <div class="tasks-page-container">
      <!-- Restricted Transition Toast Notification -->
      @if (restrictedToastMessage()) {
        <div class="workflow-restriction-banner font-mono">
          <i class="fi fi-rr-lock text-amber"></i>
          <span>{{ restrictedToastMessage() }}</span>
          <button type="button" class="btn-close-toast" (click)="clearRestrictedToast()">&times;</button>
        </div>
      }

      <!-- 1. Standalone Top Header Bar -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-left">
          <span class="badge-mono">03 BOARD • {{ activeColumns().length }} COLUMNS</span>
          <h2 class="view-header-title">Kanban Board</h2>
        </div>

        <div class="view-header-right">
          <button
            class="btn btn-primary btn-sm"
            [disabled]="activeColumns().length === 0"
            (click)="workspaceService.openCreateTaskModal()"
          >
            <i class="fi fi-rr-plus"></i> New Task
          </button>
        </div>
      </div>

      <!-- 2. Standalone Filter Toolbar -->
      <div class="filter-bar paper-panel font-mono">
        <div class="filters-left">

          <!-- Issue Type Filter -->
          <div class="filter-group">
            <label class="filter-label">TYPE</label>
            <app-select
              [options]="typeFilterOptions"
              [value]="selectedType()"
              (valueChange)="selectedType.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Priority Filter -->
          <div class="filter-group">
            <label class="filter-label">PRIORITY</label>
            <app-select
              [options]="priorityFilterOptions"
              [value]="selectedPriority()"
              (valueChange)="selectedPriority.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Severity Filter -->
          <div class="filter-group">
            <label class="filter-label">SEVERITY</label>
            <app-select
              [options]="severityFilterOptions"
              [value]="selectedSeverity()"
              (valueChange)="selectedSeverity.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Reproducibility Filter -->
          <div class="filter-group">
            <label class="filter-label">REPRO</label>
            <app-select
              [options]="reproducibilityFilterOptions"
              [value]="selectedReproducibility()"
              (valueChange)="selectedReproducibility.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Label Filter -->
          <div class="filter-group">
            <label class="filter-label">LABEL</label>
            <app-select
              [options]="labelFilterOptions()"
              [value]="selectedLabel()"
              (valueChange)="selectedLabel.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Due Date Filter -->
          <div class="filter-group">
            <label class="filter-label">DUE DATE</label>
            <app-select
              [options]="dueDateFilterOptions"
              [value]="selectedDueDateFilter()"
              (valueChange)="selectedDueDateFilter.set($event)"
              [compact]="true"
            ></app-select>
          </div>

          <!-- Sort By & Direction -->
          <div class="filter-group sort-group">
            <label class="filter-label">SORT</label>
            <div class="sort-controls">
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
          </div>

          @if (hasActiveFilters()) {
            <div class="filter-group reset-group">
              <label class="filter-label">&nbsp;</label>
              <button class="btn btn-ghost btn-xs reset-btn" (click)="resetFilters()">
                <i class="fi fi-rr-refresh"></i> Clear Filters
              </button>
            </div>
          }
        </div>

        <!-- Search Box -->
        <div class="search-box">
          <i class="fi fi-rr-search search-icon"></i>
          <input
            type="text"
            class="form-input search-input"
            placeholder="Search title, description..."
            [ngModel]="rawSearchQuery()"
            (ngModelChange)="onSearchInput($event)"
          />
          @if (rawSearchQuery()) {
            <button class="btn-clear" (click)="clearSearch()"><i class="fi fi-rr-cross"></i></button>
          }
        </div>
      </div>

      <!-- Kanban Board -->
      @if (activeColumns().length === 0) {
        <div class="empty-board paper-panel font-mono">
          <i class="fi fi-rr-folder-open empty-board-icon"></i>
          <h3>No Status Workflow Configured</h3>
          <p>Configure status columns for this project in the <strong>06 SETTINGS</strong> workspace.</p>
          <button class="btn btn-secondary btn-sm" (click)="workspaceService.setWorkspace('06 SETTINGS')">
            <i class="fi fi-rr-settings"></i> Go to Settings
          </button>
        </div>
      } @else {
        @if (activeColumns().length > 3) {
          <div class="column-quick-nav font-mono paper-panel">
            <span class="quick-nav-label"><i class="fi fi-rr-list text-cyan"></i> WORKFLOW COLUMNS ({{ activeColumns().length }}):</span>
            <div class="quick-nav-chips">
              @for (col of activeColumns(); track col.id) {
                <button
                  type="button"
                  class="col-nav-chip"
                  (click)="scrollToColumn(col.id)"
                  [title]="'Jump to column ' + col.name"
                >
                  <span class="status-dot-sm" [style.background-color]="col.color || '#0284c7'"></span>
                  <span class="col-chip-name">{{ col.name }}</span>
                  <span class="col-chip-count">{{ getColumnTasks(col.name).length }}</span>
                </button>
              }
            </div>
          </div>
        }

        <div class="kanban-board-wrapper">
          @if (canScrollLeft()) {
            <button
              type="button"
              class="board-scroll-indicator left font-mono"
              (click)="scrollBoard('left')"
              title="Scroll left to view off-screen columns"
            >
              <i class="fi fi-rr-angle-left"></i>
              <span>{{ offScreenLeftCount() }} OFF-SCREEN</span>
            </button>
          }

          @if (canScrollRight()) {
            <button
              type="button"
              class="board-scroll-indicator right font-mono"
              (click)="scrollBoard('right')"
              title="Scroll right to view off-screen columns"
            >
              <span>{{ offScreenRightCount() }} OFF-SCREEN</span>
              <i class="fi fi-rr-angle-right"></i>
            </button>
          }

          <div
            #kanbanBoardContainer
            class="kanban-board"
            cdkDropListGroup
            (scroll)="onBoardScroll($event)"
          >
            @for (col of activeColumns(); track col.id) {
              <div class="kanban-column paper-panel" [id]="'col-' + col.id">
              <!-- Column Header -->
              <div class="column-header">
                <div class="column-title">
                  <span class="status-dot" [style.background-color]="col.color || '#0284c7'"></span>
                  <h3>{{ col.name }}</h3>
                  <span class="badge-mono font-mono">{{ getColumnTasks(col.name).length }}</span>
                </div>
              </div>

              <!-- CDK Drop List Container -->
              <div
                class="column-cards"
                cdkDropList
                [cdkDropListData]="getColumnTasks(col.name)"
                (cdkDropListDropped)="drop($event, col)"
              >
                @for (t of getColumnTasks(col.name); track t.id) {
                  <div
                    class="task-card paper-panel"
                    cdkDrag
                    [cdkDragData]="t"
                    (cdkDragStarted)="onDragStarted($event)"
                    (cdkDragEnded)="onDragEnded()"
                    (click)="openDetailModal(t)"
                  >
                    <!-- Card Top Row: Issue Type, Key, Priority, Drag Handle -->
                    <div class="card-top font-mono">
                      <div class="type-badge-wrap">
                        <span class="badge-type" [class]="getTypeBadgeClass(t)">
                          <i [class]="getTypeIcon(t)"></i> {{ getTypeLabel(t) }}
                        </span>
                        <span
                          class="task-key font-mono clickable-key"
                          [class.copied]="taskShareService.lastCopiedTaskId() === t.id"
                          (click)="taskShareService.copyTaskShareLink(t, $event)"
                          [title]="taskShareService.lastCopiedTaskId() === t.id ? 'Copied link for ' + getTaskKeyStr(t) : 'Click to copy share link'"
                        >
                          @if (taskShareService.lastCopiedTaskId() === t.id) {
                            <span class="copied-pill text-emerald"><i class="fi fi-rr-check"></i> COPIED!</span>
                          } @else {
                            {{ getTaskKeyStr(t) }} <i class="fi fi-rr-link link-icon"></i>
                          }
                        </span>
                        <span class="priority-badge" [class]="(t.priority || 'medium').toLowerCase()">
                          {{ t.priority || 'medium' }}
                        </span>
                      </div>
                      <i class="fi fi-rr-grip-dots-vertical drag-grip" title="Drag to move"></i>
                    </div>

                    <!-- Project Pill -->
                    @if (getProjectName(t.project_id); as projName) {
                      <div class="card-project-row">
                        <span class="card-project-pill font-mono">
                          <i class="fi fi-rr-folder text-amber"></i> {{ projName }}
                        </span>
                      </div>
                    }

                    <!-- Card Title -->
                    <h4 class="card-title">
                      <span>{{ t.title }}</span>
                      @if (isReportedTask(t)) {
                        <span class="app-report-badge font-mono" title="Reported directly by user via App Report">
                          <i class="fi fi-rr-paper-plane"></i> User Report
                        </span>
                      }
                    </h4>

                    <!-- Card Labels -->
                    @if (t.labels && t.labels.length > 0) {
                      <div class="card-labels font-mono">
                        @for (lbl of t.labels.slice(0, 3); track lbl) {
                          <span
                            class="label-chip"
                            [class.active-label]="selectedLabel() === lbl"
                            (click)="$event.stopPropagation(); selectedLabel.set(selectedLabel() === lbl ? 'all' : lbl)"
                            title="Filter by #{{ lbl }}"
                          >
                            #{{ lbl }}
                          </span>
                        }
                        @if (t.labels.length > 3) {
                          <span
                            class="label-chip label-chip-more"
                            (click)="$event.stopPropagation(); openDetailModal(t)"
                            [title]="'All labels (' + t.labels.length + '): ' + t.labels.join(', ')"
                          >
                            +{{ t.labels.length - 3 }} more
                          </span>
                        }
                      </div>
                    }

                    <!-- Card Footer: Assignee & Due Date -->
                    <div class="card-bottom font-mono">
                      <span class="assignee">
                        <i class="fi fi-rr-user"></i> {{ (t.assignee && t.assignee !== 'Self') ? t.assignee : 'Unassigned' }}
                      </span>

                      @if (t.due_date) {
                        <span class="due-date" [class.overdue]="isOverdue(t.due_date)">
                          <i class="fi fi-rr-calendar"></i> {{ t.due_date }}
                        </span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
      }

      <!-- Quick Create Modal -->
      @if (showCreateModal()) {
        <app-task-modal
          [taskToEdit]="editingTask()"
          [defaultProjectId]="selectedProjectId() === 'all' ? (projectService.projects()[0]?.id || '') : selectedProjectId()"
          [defaultStatus]="createDefaultStatus()"
          (close)="closeCreateModal()"
        ></app-task-modal>
      }

      <!-- Detail Modal -->
      @if (activeDetailTask(); as detailTask) {
        <app-task-detail-modal
          [task]="detailTask"
          (close)="closeDetailModal()"
          (editTask)="openEditModal($event)"
        ></app-task-detail-modal>
      }
    </div>
  `,
  styles: [`
    .tasks-page-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      width: 100%;
    }
    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0.75rem 1rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .filters-left {
      display: flex;
      gap: 0.65rem;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .filter-label {
      font-size: 0.675rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .filter-select {
      width: 130px;
      padding: 0.25rem 0.45rem;
      font-size: 0.775rem;
    }
    .sort-controls {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .sort-dir-btn {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      height: 28px;
    }
    .reset-btn {
      color: var(--accent-rose);
    }
    .search-box {
      position: relative;
      align-self: flex-end;
    }
    .search-icon {
      position: absolute;
      left: 0.55rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 0.8rem;
    }
    .search-input {
      padding-left: 1.8rem;
      width: 180px;
      font-size: 0.775rem;
    }
    .empty-board {
      padding: 3rem 1.5rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }
    .empty-board-icon {
      font-size: 2rem;
      color: var(--accent-cyan);
    }
    .empty-board h3 {
      font-size: 1.1rem;
      color: var(--text-main);
    }
    .empty-board p {
      color: var(--text-muted);
      font-size: 0.825rem;
      max-width: 400px;
    }
    .kanban-board-wrapper {
      position: relative;
      width: 100%;
      overflow: hidden;
      border-radius: var(--radius-xs);
    }
    .column-quick-nav {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.5rem 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      margin-bottom: 0.75rem;
      overflow-x: auto;
      white-space: nowrap;
    }
    .quick-nav-label {
      font-size: 0.675rem;
      color: var(--text-muted);
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
    }
    .quick-nav-chips {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .col-nav-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.55rem;
      font-size: 0.725rem;
      font-weight: 600;
      border-radius: var(--radius-xs);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      cursor: pointer;
      transition: var(--transition-fast);
      flex-shrink: 0;
    }
    .col-nav-chip:hover {
      background: var(--bg-surface-hover);
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
    }
    .status-dot-sm {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .col-chip-count {
      font-size: 0.65rem;
      padding: 0.05rem 0.3rem;
      background: var(--bg-surface-subtle);
      border-radius: 4px;
      color: var(--text-muted);
    }
    .kanban-board {
      display: flex;
      gap: 1rem;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0.25rem 0.25rem 0.85rem 0.25rem;
      scroll-behavior: smooth;
      scrollbar-width: auto;
      -webkit-overflow-scrolling: touch;
    }
    .kanban-column {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.85rem;
      min-height: 520px;
      width: 310px;
      min-width: 310px;
      max-width: 310px;
      flex-shrink: 0;
      background: var(--bg-surface);
    }
    .board-scroll-indicator {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 0.75rem;
      font-size: 0.725rem;
      font-weight: 700;
      border-radius: 20px;
      background: var(--bg-surface);
      color: var(--accent-cyan);
      border: 1px solid var(--accent-cyan);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      transition: all 0.2s ease;
      backdrop-filter: blur(8px);
    }
    .board-scroll-indicator:hover {
      background: var(--accent-cyan);
      color: #ffffff;
      box-shadow: 0 6px 18px rgba(6, 182, 212, 0.4);
    }
    .board-scroll-indicator.left {
      left: 0.75rem;
    }
    .board-scroll-indicator.right {
      right: 0.75rem;
    }
    .column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .column-title {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .column-title h3 {
      font-size: 0.875rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-main);
    }
    .column-cards {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-height: 420px;
      flex: 1;
    }
    .task-card {
      padding: 0.75rem 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      cursor: pointer;
      transition: var(--transition-fast);
      background: var(--bg-surface);
    }
    .task-card:hover {
      background: var(--bg-surface-hover);
      border-color: var(--border-medium);
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .type-badge-wrap {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .badge-type {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.1rem 0.35rem;
      border-radius: var(--radius-xs);
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
    }
    .badge-type.bug { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
    .badge-type.story { background: #e0f2fe; color: #0284c7; border-color: #7dd3fc; }
    .badge-type.epic { background: #fef3c7; color: #d97706; border-color: #fcd34d; }
    .task-key {
      font-size: 0.725rem;
      font-weight: 700;
      color: var(--text-subtle);
    }
    .task-key.copied {
      color: #10b981 !important;
      animation: pulse-copy 0.3s ease-out;
    }
    @keyframes pulse-copy {
      0% { transform: scale(0.92); }
      50% { transform: scale(1.08); }
      100% { transform: scale(1); }
    }
    .priority-badge {
      font-size: 0.65rem;
      padding: 0.08rem 0.35rem;
      border-radius: var(--radius-xs);
      font-weight: 700;
      text-transform: uppercase;
      border: 1px solid var(--border-subtle);
    }
    .priority-badge.urgent { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
    .priority-badge.high { background: #fef3c7; color: #d97706; border-color: #fcd34d; }
    .priority-badge.medium { background: #e0f2fe; color: #0284c7; border-color: #7dd3fc; }
    .priority-badge.low { background: #f3f4f6; color: #4b5563; border-color: #d1d5db; }
    .drag-grip {
      font-size: 0.85rem;
      color: var(--text-subtle);
      cursor: grab;
      opacity: 0.5;
    }
    .drag-grip:hover {
      opacity: 1;
    }
    .card-project-row {
      display: flex;
    }
    .card-project-pill {
      font-size: 0.675rem;
      padding: 0.1rem 0.4rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-muted);
    }
    .card-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-main);
      margin: 0;
      line-height: 1.35;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
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
    .card-labels {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
      align-items: center;
      max-height: 2.3rem;
      overflow: hidden;
    }
    .label-chip {
      font-size: 0.65rem;
      color: var(--text-subtle);
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      padding: 0.08rem 0.35rem;
      border-radius: var(--radius-xs);
      cursor: pointer;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .label-chip:hover,
    .label-chip.active-label {
      background: var(--accent-cyan);
      color: #ffffff;
      border-color: var(--accent-cyan);
    }
    .label-chip-more {
      font-weight: 700;
      color: var(--accent-cyan);
      background: rgba(6, 182, 212, 0.12);
      border-color: rgba(6, 182, 212, 0.35);
    }
    .label-chip-more:hover {
      background: var(--accent-cyan);
      color: #ffffff;
      border-color: var(--accent-cyan);
    }
    .card-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.725rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }
    .assignee, .due-date {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .due-date.overdue {
      color: var(--accent-rose);
      font-weight: 700;
    }

    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: var(--radius-xs);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
      border: 1px dashed var(--border-medium);
      border-radius: var(--radius-xs);
    }
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    .column-cards.cdk-drop-list-dragging .task-card:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .workflow-restriction-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #f59e0b;
      padding: 0.65rem 1rem;
      border-radius: var(--radius-xs);
      font-size: 0.775rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      animation: fadeIn 0.2s ease-out;
    }
    .btn-close-toast {
      background: none;
      border: none;
      color: #f59e0b;
      font-size: 1.1rem;
      cursor: pointer;
      line-height: 1;
      padding: 0 0.25rem;
    }
    .text-amber {
      color: #f59e0b;
    }
  `]
})
export class TasksComponent implements OnInit, OnDestroy, AfterViewInit {
  canScrollLeft = signal<boolean>(false);
  canScrollRight = signal<boolean>(false);
  offScreenLeftCount = signal<number>(0);
  offScreenRightCount = signal<number>(0);

  @ViewChild('kanbanBoardContainer') kanbanBoardContainer?: ElementRef<HTMLDivElement>;

  selectedProjectId = signal<string>('all');
  selectedType = signal<string>('all');
  selectedPriority = signal<string>('all');
  selectedSeverity = signal<string>('all');
  selectedReproducibility = signal<string>('all');
  selectedLabel = signal<string>('all');
  selectedDueDateFilter = signal<string>('all');
  sortBy = signal<string>('created_at');
  sortOrder = signal<'asc' | 'desc'>('desc');
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
    this.clearRestrictedToast();
  }

  projectFilterOptions = computed<SelectOption[]>(() => [
    { value: 'all', label: 'All Projects', icon: 'fi fi-rr-apps' },
    ...this.projectService.projects().map(p => ({
      value: p.id,
      label: p.name,
      icon: 'fi fi-rr-folder'
    }))
  ]);

  typeFilterOptions: SelectOption[] = [
    { value: 'all', label: 'All Types' },
    { value: 'task', label: 'Task', icon: 'fi fi-rr-checkbox' },
    { value: 'story', label: 'Story', icon: 'fi fi-rr-book-alt' },
    { value: 'bug', label: 'Bug', icon: 'fi fi-rr-bug' },
    { value: 'epic', label: 'Epic', icon: 'fi fi-rr-rocket' }
  ];

  priorityFilterOptions: SelectOption[] = [
    { value: 'all', label: 'All Priorities' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  severityFilterOptions: SelectOption[] = [
    { value: 'all', label: 'All Severities' },
    { value: 'critical', label: 'Critical' },
    { value: 'major', label: 'Major' },
    { value: 'minor', label: 'Minor' },
    { value: 'trivial', label: 'Trivial' }
  ];

  reproducibilityFilterOptions: SelectOption[] = [
    { value: 'all', label: 'All Reproducibility' },
    { value: 'always', label: 'Always' },
    { value: 'often', label: 'Often' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'rarely', label: 'Rarely' },
    { value: 'unable', label: 'Unable to Reproduce' }
  ];

  labelFilterOptions = computed<SelectOption[]>(() => [
    { value: 'all', label: 'All Labels' },
    ...this.availableLabels().map(lbl => ({
      value: lbl,
      label: `#${lbl}`
    }))
  ]);

  dueDateFilterOptions: SelectOption[] = [
    { value: 'all', label: 'All Dates' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Due Today' },
    { value: 'week', label: 'Due This Week' },
    { value: 'has_date', label: 'Has Due Date' },
    { value: 'no_date', label: 'No Due Date' }
  ];

  sortOptions: SelectOption[] = [
    { value: 'created_at', label: 'Created Date' },
    { value: 'updated_at', label: 'Last Updated' },
    { value: 'priority', label: 'Priority' },
    { value: 'severity', label: 'Severity' },
    { value: 'due_date', label: 'Due Date' },
    { value: 'title', label: 'Title / Key' },
    { value: 'status', label: 'Status' }
  ];

  showCreateModal = signal<boolean>(false);
  createDefaultStatus = signal<string>('');
  editingTask = signal<Task | null>(null);
  activeDetailTask = signal<Task | null>(null);
  restrictedToastMessage = signal<string>('');

  constructor(
    public taskService: TaskService,
    public projectService: ProjectService,
    public workflowService: WorkflowService,
    public workspaceService: WorkspaceService,
    public taskShareService: TaskShareService
  ) {
    effect(() => {
      const filters = {
        selectedProjectId: this.selectedProjectId(),
        selectedType: this.selectedType(),
        selectedPriority: this.selectedPriority(),
        selectedSeverity: this.selectedSeverity(),
        selectedReproducibility: this.selectedReproducibility(),
        selectedLabel: this.selectedLabel(),
        selectedDueDateFilter: this.selectedDueDateFilter(),
        sortBy: this.sortBy(),
        sortOrder: this.sortOrder(),
        searchQuery: this.searchQuery()
      };
      localStorage.setItem('bilo_board_filters', JSON.stringify(filters));
    });
  }

  toggleSortOrder() {
    this.sortOrder.update(o => o === 'asc' ? 'desc' : 'asc');
  }

  ngOnInit() {
    const explicitId = this.projectService.explicitBoardProjectId();
    if (explicitId) {
      this.selectedProjectId.set(explicitId);
      this.projectService.explicitBoardProjectId.set(null);
    } else {
      const saved = localStorage.getItem('bilo_board_filters');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.selectedProjectId !== undefined) this.selectedProjectId.set(parsed.selectedProjectId);
          if (parsed.selectedType !== undefined) this.selectedType.set(parsed.selectedType);
          if (parsed.selectedPriority !== undefined) this.selectedPriority.set(parsed.selectedPriority);
          if (parsed.selectedSeverity !== undefined) this.selectedSeverity.set(parsed.selectedSeverity);
          if (parsed.selectedReproducibility !== undefined) this.selectedReproducibility.set(parsed.selectedReproducibility);
          if (parsed.selectedLabel !== undefined) this.selectedLabel.set(parsed.selectedLabel);
          if (parsed.selectedDueDateFilter !== undefined) this.selectedDueDateFilter.set(parsed.selectedDueDateFilter);
          if (parsed.sortBy !== undefined) this.sortBy.set(parsed.sortBy);
          if (parsed.sortOrder !== undefined) this.sortOrder.set(parsed.sortOrder);
          if (parsed.searchQuery !== undefined) {
            this.rawSearchQuery.set(parsed.searchQuery);
            this.searchQuery.set(parsed.searchQuery);
          }
        } catch (e) {}
      } else {
        this.selectedProjectId.set('all');
      }
    }

    // Deleted Project Safeguard:
    // If selectedProjectId points to a project that was deleted, auto-fallback to 'all'
    effect(() => {
      const projId = this.selectedProjectId();
      if (projId && projId !== 'all') {
        const projects = this.projectService.projects();
        if (projects.length > 0 && !projects.some(p => p.id === projId)) {
          console.warn(`[TasksBoard] Selected project "${projId}" no longer exists. Falling back to "all".`);
          this.selectedProjectId.set('all');
        }
      }
    }, { allowSignalWrites: true });

    effect(() => {
      this.activeColumns();
      this.filteredTasks();
      setTimeout(() => this.updateScrollState(), 100);
    });
  }

  onProjectChange(projId: string) {
    this.selectedProjectId.set(projId);
    if (projId !== 'all') {
      this.projectService.setActiveProject(projId);
    }
  }

  activeColumns = computed<Workflow[]>(() => {
    const activeProjId = this.projectService.activeProject()?.id;
    return this.workflowService.getWorkflowsForProject(activeProjId || this.selectedProjectId());
  });

  availableLabels = computed<string[]>(() => {
    const list = this.taskService.tasks();
    const activeProjId = this.projectService.activeProject()?.id;
    const projId = activeProjId || this.selectedProjectId();
    const set = new Set<string>();
    list.forEach(t => {
      if (projId === 'all' || t.project_id === projId) {
        t.labels?.forEach(l => {
          if (l.trim()) set.add(l.trim().toLowerCase());
        });
      }
    });
    return Array.from(set).sort();
  });

  hasActiveFilters = computed(() => {
    return (
      this.selectedType() !== 'all' ||
      this.selectedPriority() !== 'all' ||
      this.selectedSeverity() !== 'all' ||
      this.selectedReproducibility() !== 'all' ||
      this.selectedLabel() !== 'all' ||
      this.selectedDueDateFilter() !== 'all' ||
      this.sortOrder() !== 'desc' ||
      this.rawSearchQuery().trim() !== '' ||
      this.searchQuery().trim() !== ''
    );
  });

  filteredTasks = computed(() => {
    let list = [...this.taskService.tasks()];
    const activeProjId = this.projectService.activeProject()?.id;
    if (activeProjId) {
      list = list.filter(t => t.project_id === activeProjId);
    }
    const projId = this.selectedProjectId();
    const type = this.selectedType();
    const priority = this.selectedPriority();
    const severity = this.selectedSeverity();
    const repro = this.selectedReproducibility();
    const label = this.selectedLabel().toLowerCase();
    const dueFilter = this.selectedDueDateFilter();
    const q = this.searchQuery().toLowerCase().trim();
    const sort = this.sortBy();

    const todayStr = new Date().toISOString().split('T')[0];

    list = list.filter(t => {
      if (projId !== 'all' && t.project_id !== projId) return false;
      if (type !== 'all' && t.type !== type) return false;
      if (priority !== 'all' && t.priority !== priority) return false;
      if (severity !== 'all' && (t.severity || '').toLowerCase() !== severity) return false;
      if (repro !== 'all' && (t.reproducibility || '').toLowerCase() !== repro) return false;

      if (label !== 'all') {
        if (!t.labels || !t.labels.some(l => l.toLowerCase() === label)) return false;
      }

      if (dueFilter !== 'all') {
        if (dueFilter === 'has_date' && !t.due_date) return false;
        if (dueFilter === 'no_date' && t.due_date) return false;
        if (dueFilter === 'overdue') {
          if (!t.due_date || t.due_date >= todayStr || t.completed) return false;
        }
        if (dueFilter === 'today') {
          if (!t.due_date || t.due_date !== todayStr) return false;
        }
        if (dueFilter === 'week') {
          if (!t.due_date) return false;
          const taskDate = new Date(t.due_date).getTime();
          const now = new Date().getTime();
          const weekFromNow = now + 7 * 86400000;
          if (taskDate < now - 86400000 || taskDate > weekFromNow) return false;
        }
      }

      if (q) {
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesLabel = t.labels?.some(l => l.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesLabel) return false;
      }

      return true;
    });

    // Sorting
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

  getColumnTasks(statusName: string): Task[] {
    return this.filteredTasks().filter(t => t.status === statusName);
  }

  getSelectedProjectObj(): Project | null {
    const id = this.selectedProjectId();
    if (!id || id === 'all') return null;
    return this.projectService.projects().find(p => p.id === id) || null;
  }

  getTaskKeyStr(t: Task): string {
    return getTaskKey(t, this.projectService.projects(), this.taskService.tasks());
  }

  getProjectName(projectId?: string): string {
    if (!projectId) return '';
    const p = this.projectService.projects().find(item => item.id === projectId);
    return p ? p.name : '';
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

  getTypeBadgeClass(t: Task): string {
    if (this.isReportedTask(t)) {
      return 'badge-' + this.getReportCategory(t);
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
      default: return 'fi fi-rr-check-circle';
    }
  }

  isOverdue(dueDate?: string): boolean {
    if (!dueDate) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return dueDate < todayStr;
  }

  private activeDragItem: CdkDrag<Task> | null = null;

  onDragStarted(event: CdkDragStart<Task>): void {
    this.activeDragItem = event.source;
  }

  onDragEnded(): void {
    this.activeDragItem = null;
    this.cleanupStrayDragElements();
  }

  @HostListener('window:blur')
  @HostListener('document:visibilitychange')
  onWindowBlurOrHide(): void {
    if (this.activeDragItem) {
      try {
        this.activeDragItem.reset();
      } catch (e) {}
      this.activeDragItem = null;
    }
    this.cancelActiveDrag();
  }

  cancelActiveDrag(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    }
    this.cleanupStrayDragElements();
  }

  cleanupStrayDragElements(): void {
    if (typeof document !== 'undefined') {
      const previews = document.querySelectorAll('.cdk-drag-preview');
      previews.forEach(el => el.remove());
      const placeholders = document.querySelectorAll('.cdk-drag-placeholder');
      placeholders.forEach(el => el.remove());
    }
  }

  private restrictedToastTimer: any = null;

  showRestrictedToast(message: string, durationMs: number = 4000): void {
    if (this.restrictedToastTimer) {
      clearTimeout(this.restrictedToastTimer);
      this.restrictedToastTimer = null;
    }
    this.restrictedToastMessage.set(message);
    this.restrictedToastTimer = setTimeout(() => {
      this.restrictedToastMessage.set('');
      this.restrictedToastTimer = null;
    }, durationMs);
  }

  clearRestrictedToast(): void {
    if (this.restrictedToastTimer) {
      clearTimeout(this.restrictedToastTimer);
      this.restrictedToastTimer = null;
    }
    this.restrictedToastMessage.set('');
  }

  async drop(event: CdkDragDrop<Task[]>, targetColumn: Workflow) {
    this.activeDragItem = null;
    const task: Task = event.item.data;
    if (task && task.status !== targetColumn.name) {
      const allowed = this.workflowService.canTransition(task.status, targetColumn.id, task.project_id);
      if (!allowed) {
        this.showRestrictedToast(`Workflow Rule: Transitioning from "${task.status}" to "${targetColumn.name}" is restricted.`);
        this.cleanupStrayDragElements();
        return;
      }

      await this.taskService.updateTask(task.id, {
        status: targetColumn.name,
        workflow_id: targetColumn.id
      });
    }
    this.cleanupStrayDragElements();
  }

  resetFilters() {
    this.clearSearch();
    this.selectedProjectId.set('all');
    this.selectedType.set('all');
    this.selectedPriority.set('all');
    this.selectedSeverity.set('all');
    this.selectedReproducibility.set('all');
    this.selectedLabel.set('all');
    this.selectedDueDateFilter.set('all');
    this.sortBy.set('created_at');
    this.sortOrder.set('desc');
    localStorage.removeItem('bilo_board_filters');
  }

  openCreateModal(defaultStatus: string = '') {
    this.editingTask.set(null);
    this.createDefaultStatus.set(defaultStatus);
    this.showCreateModal.set(true);
  }

  openEditModal(task: Task) {
    this.activeDetailTask.set(null);
    this.editingTask.set(task);
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
    this.editingTask.set(null);
  }

  openDetailModal(task: Task) {
    this.activeDetailTask.set(task);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateScrollState(), 100);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateScrollState();
  }

  updateScrollState(el?: HTMLElement): void {
    const container = el || this.kanbanBoardContainer?.nativeElement;
    if (!container) return;

    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    this.canScrollLeft.set(scrollLeft > 10);
    this.canScrollRight.set(scrollLeft + clientWidth < scrollWidth - 10);

    const colWidth = 326;
    const leftCount = Math.max(0, Math.floor(scrollLeft / colWidth));
    const rightCount = Math.max(0, Math.ceil((scrollWidth - scrollLeft - clientWidth) / colWidth));

    this.offScreenLeftCount.set(leftCount);
    this.offScreenRightCount.set(rightCount);
  }

  onBoardScroll(event: Event): void {
    this.updateScrollState(event.target as HTMLElement);
  }

  scrollBoard(direction: 'left' | 'right'): void {
    const container = this.kanbanBoardContainer?.nativeElement;
    if (container) {
      container.scrollBy({ left: direction === 'left' ? -340 : 340, behavior: 'smooth' });
    }
  }

  scrollToColumn(columnId: string): void {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(`col-${columnId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }

  closeDetailModal() {
    this.activeDetailTask.set(null);
  }
}
