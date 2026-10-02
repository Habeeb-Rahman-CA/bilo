import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { Task } from '../../core/models/project.model';
import { TaskDetailModalComponent } from '../../shared/components/task-detail-modal';
import { TaskModalComponent } from '../../shared/components/task-modal';
import { DatePickerComponent } from '../../shared/components/date-picker';
import { getLocalDateString, isoToLocalDateString } from '../../core/utils/date.util';
import { getTaskKey } from '../../core/utils/task-key.util';
import { ScrollingModule } from '@angular/cdk/scrolling';

export type WeekStartDay = 'sunday' | 'monday' | 'saturday';

export interface CalendarDayCell {
  dayNumber: number;
  dateStr: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  createdTasks: Task[];
  closedTasks: Task[];
  dueTasks: Task[];
}

export interface CalendarCellEvent {
  id: string;
  title: string;
  eventType: 'created' | 'closed' | 'due';
  task: Task;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, ScrollingModule, TaskDetailModalComponent, TaskModalComponent, DatePickerComponent],
  template: `
    <div class="calendar-workspace font-mono">
      <!-- Calendar Header Strip -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-top">
          <div class="view-header-title-wrap">
            <span class="badge-mono desktop-only">04 CALENDAR</span>
            <h2 class="view-header-title">{{ monthTitle() }}</h2>
          </div>

          <div class="header-action-group">
            <div class="nav-btn-group">
              <button class="btn btn-secondary btn-xs nav-icon-btn" (click)="prevMonth()" title="Previous Month">
                <i class="fi fi-rr-angle-left"></i>
              </button>
              <button class="btn btn-secondary btn-xs nav-today-btn" (click)="todayMonth()" title="Jump to Current Month">
                Today
              </button>
              <button class="btn btn-secondary btn-xs nav-icon-btn" (click)="nextMonth()" title="Next Month">
                <i class="fi fi-rr-angle-right"></i>
              </button>
            </div>

            <button
              class="btn btn-secondary btn-sm schedule-toggle-btn"
              [class.active]="showUnscheduledDrawer()"
              (click)="showUnscheduledDrawer.set(!showUnscheduledDrawer())"
              title="Toggle Unscheduled Tasks Scheduler Drawer"
            >
              <i class="fi fi-rr-time-fast text-amber"></i>
              <span>Schedule ({{ unscheduledTasks().length }})</span>
            </button>

            <button class="btn btn-primary btn-sm desktop-only" (click)="workspaceService.openCreateTaskModal()">
              <i class="fi fi-rr-plus"></i> New Task
            </button>
          </div>
        </div>

        <div class="view-header-toolbar">
          <!-- Event Type Filter Toggles -->
          <div class="filter-pills font-mono">
            <button
              class="filter-pill pill-created-toggle"
              [class.active]="showCreated()"
              (click)="showCreated.set(!showCreated())"
            >
              <i class="fi fi-rr-plus-circle"></i> Created ({{ monthCreatedCount() }})
            </button>

            <button
              class="filter-pill pill-closed-toggle"
              [class.active]="showClosed()"
              (click)="showClosed.set(!showClosed())"
            >
              <i class="fi fi-rr-check-circle"></i> Closed ({{ monthClosedCount() }})
            </button>

            <button
              class="filter-pill pill-due-toggle"
              [class.active]="showDue()"
              (click)="showDue.set(!showDue())"
            >
              <i class="fi fi-rr-clock"></i> Due ({{ monthDueCount() }})
            </button>
          </div>

          <!-- Week Start Day Toggle -->
          <div class="week-start-toggle font-mono">
            <button
              type="button"
              class="btn btn-secondary btn-xs week-start-btn"
              [class.active]="weekStart() === 'sunday'"
              (click)="setWeekStart('sunday')"
              title="Start week on Sunday"
            >
              SUN
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-xs week-start-btn"
              [class.active]="weekStart() === 'monday'"
              (click)="setWeekStart('monday')"
              title="Start week on Monday"
            >
              MON
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-xs week-start-btn"
              [class.active]="weekStart() === 'saturday'"
              (click)="setWeekStart('saturday')"
              title="Start week on Saturday"
            >
              SAT
            </button>
          </div>
        </div>
      </div>

      <!-- Main Layout Grid: Calendar + Unscheduled Scheduler Side Drawer -->
      <div class="calendar-body-layout">
        <!-- Calendar Month Grid Container -->
        <div class="calendar-grid-panel paper-panel">
          <!-- Weekday Headers -->
          <div class="week-header-row font-mono">
            @for (dayName of weekHeaders(); track dayName) {
              <div class="week-day">{{ dayName }}</div>
            }
          </div>

          <!-- Days Grid (35 or 42 cells) -->
          <div class="days-grid font-mono">
            @for (cell of calendarCells(); track cell.dateStr) {
              <div
                class="day-cell"
                [attr.data-date]="cell.dateStr"
                [class.other-month]="!cell.isCurrentMonth"
                [class.today]="cell.isToday"
                [class.has-events]="hasAnyEvents(cell)"
                [class.drag-over]="dragOverDate() === cell.dateStr"
                (click)="selectDayCell(cell)"
                (dragover)="onDragOverDay($event, cell.dateStr)"
                (dragleave)="onDragLeaveDay($event, cell.dateStr)"
                (drop)="onDropOnDay($event, cell.dateStr)"
              >
                <!-- Cell Header: Date Number + Badges -->
                <div class="cell-top">
                  <span class="day-number" [class.today-number]="cell.isToday">
                    {{ cell.dayNumber }}
                  </span>

                  @if (cell.isToday) {
                    <span class="today-badge font-mono">TODAY</span>
                  }
                </div>

                <!-- Cell Content: Truncated Draggable Event Badges -->
                <div class="cell-events">
                  @for (evt of getVisibleEvents(cell); track evt.id) {
                    <div
                      class="event-pill"
                      [class.pill-created]="evt.eventType === 'created'"
                      [class.pill-closed]="evt.eventType === 'closed'"
                      [class.pill-due]="evt.eventType === 'due'"
                      draggable="true"
                      (dragstart)="onDragStartTask($event, evt.task)"
                      (touchstart)="onTouchStartTask($event, evt.task)"
                      (touchmove)="onTouchMoveTask($event)"
                      (touchend)="onTouchEndTask($event)"
                      (touchcancel)="onTouchCancelTask()"
                      (click)="$event.stopPropagation(); openDetail(evt.task)"
                      [title]="'Drag to reschedule: ' + evt.task.title"
                    >
                      <i [class]="evt.eventType === 'created' ? 'fi fi-rr-plus-circle' : (evt.eventType === 'closed' ? 'fi fi-rr-check-circle' : 'fi fi-rr-clock')"></i>
                      <span class="event-text">{{ evt.eventType === 'created' ? 'Created' : (evt.eventType === 'closed' ? 'Closed' : 'Due') }}: {{ evt.title }}</span>
                    </div>
                  }

                  <!-- Overflow counter if total events exceed cell capacity -->
                  @if (getOverflowCount(cell) > 0) {
                    <div
                      class="event-overflow font-mono"
                      (click)="$event.stopPropagation(); selectDayCell(cell)"
                      [title]="'View all ' + getAllCellEvents(cell).length + ' events for this day'"
                    >
                      +{{ getOverflowCount(cell) }} more
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Unscheduled Tasks Scheduler Side Panel -->
        @if (showUnscheduledDrawer()) {
          <div
            class="drawer-backdrop"
            [class.touch-dragging-active]="isTouchDraggingTask()"
            (click)="showUnscheduledDrawer.set(false)"
          ></div>
          <div
            class="unscheduled-drawer paper-panel font-mono"
            [class.touch-dragging-active]="isTouchDraggingTask()"
          >
            <div class="drawer-header">
              <h3><i class="fi fi-rr-time-fast text-amber"></i> Unscheduled Tasks ({{ filteredUnscheduledTasks().length }})</h3>
              <button class="btn btn-ghost btn-xs" (click)="showUnscheduledDrawer.set(false)">
                <i class="fi fi-rr-cross"></i>
              </button>
            </div>

            <!-- Drawer Search Bar -->
            <div class="drawer-search-box">
              <i class="fi fi-rr-search search-icon"></i>
              <input
                type="text"
                class="form-input drawer-search-input font-mono"
                placeholder="Search unscheduled tasks..."
                [ngModel]="unscheduledSearchQuery()"
                (ngModelChange)="onUnscheduledSearch($event)"
              />
              @if (unscheduledSearchQuery()) {
                <button class="btn-clear-search" (click)="onUnscheduledSearch('')">
                  <i class="fi fi-rr-cross"></i>
                </button>
              }
            </div>

            <div class="drawer-hint">
              <i class="fi fi-rr-info text-cyan"></i>
              <span>Drag any task below onto a calendar day cell to schedule its due date.</span>
            </div>

            <div class="unscheduled-list">
              @if (filteredUnscheduledTasks().length === 0) {
                <div class="empty-drawer font-mono">
                  @if (unscheduledSearchQuery()) {
                    <i class="fi fi-rr-search text-muted"></i>
                    <span>No tasks match "{{ unscheduledSearchQuery() }}"</span>
                  } @else {
                    <i class="fi fi-rr-check-circle text-emerald"></i>
                    <span>All tasks have scheduled due dates!</span>
                  }
                </div>
              } @else {
                @for (t of paginatedUnscheduledTasks(); track t.id) {
                  <div
                    class="unscheduled-card paper-panel font-mono"
                    draggable="true"
                    (dragstart)="onDragStartTask($event, t)"
                    (touchstart)="onTouchStartTask($event, t)"
                    (touchmove)="onTouchMoveTask($event)"
                    (touchend)="onTouchEndTask($event)"
                    (touchcancel)="onTouchCancelTask()"
                    (click)="openDetail(t)"
                  >
                    <!-- Meta Row: Issue Type Icon, Task Key, Priority Badge, Status Badge -->
                    <div class="card-meta-row font-mono">
                      <div class="card-key-type">
                        <i [class]="getTypeIcon(t.type)"></i>
                        <span class="task-key-tag">{{ getTaskKeyStr(t) }}</span>
                      </div>

                      <div class="card-badges">
                        <span class="priority-badge" [class]="(t.priority || 'medium').toLowerCase()">
                          {{ t.priority || 'medium' }}
                        </span>
                        <span class="status-pill">{{ t.status }}</span>
                      </div>
                    </div>

                    <!-- Main Body: Task Title -->
                    <h4 class="card-title-text font-mono" [title]="t.title">
                      {{ t.title }}
                    </h4>

                    <!-- Action Footer: Project Name Pill & Date Picker Button -->
                    <div class="card-action-row font-mono" (click)="$event.stopPropagation()">
                      @if (getProjectName(t.project_id); as projName) {
                        <span class="card-project-pill font-mono">
                          <i class="fi fi-rr-folder text-amber"></i> {{ projName }}
                        </span>
                      }

                      <div class="date-picker-wrap font-mono">
                        <span class="schedule-date-label">Due:</span>
                        <app-date-picker
                          [value]="t.due_date || ''"
                          [compact]="true"
                          align="right"
                          position="top"
                          placeholder="Set date"
                          (dateChange)="scheduleTaskDirect(t.id, $event)"
                        ></app-date-picker>
                      </div>
                    </div>
                  </div>
                }
              }
            </div>

            <!-- Drawer Pagination Footer -->
            @if (filteredUnscheduledTasks().length > unscheduledPageSize) {
              <div class="drawer-pagination font-mono">
                <span class="page-info">
                  Page {{ unscheduledPage() }} of {{ totalUnscheduledPages() }}
                </span>
                <div class="page-btns">
                  <button
                    class="btn btn-secondary btn-xs"
                    [disabled]="unscheduledPage() <= 1"
                    (click)="prevUnscheduledPage()"
                    title="Previous Page"
                  >
                    <i class="fi fi-rr-angle-left"></i>
                  </button>
                  <button
                    class="btn btn-secondary btn-xs"
                    [disabled]="unscheduledPage() >= totalUnscheduledPages()"
                    (click)="nextUnscheduledPage()"
                    title="Next Page"
                  >
                    <i class="fi fi-rr-angle-right"></i>
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Touch Drag Cancel Bar (Visible during mobile touch drag) -->
      @if (isTouchDraggingTask()) {
        <div class="touch-cancel-dropzone font-mono" [class.hovering]="isOverCancelDropzone()">
          <i class="fi fi-rr-cross-circle"></i>
          <span>{{ isOverCancelDropzone() ? 'Release to Cancel Scheduling' : 'Drop here to Cancel' }}</span>
        </div>
      }

      <!-- Selected Day Detail Modal Card matching App Theme -->
      @if (selectedCell(); as sc) {
        <div class="modal-overlay" (click)="selectedCell.set(null)">
          <div class="modal-card day-detail-card font-mono" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>
                <i class="fi fi-rr-calendar text-cyan"></i>
                <span>Task Schedule for {{ formatFullDate(sc.dateStr) }}</span>
              </h3>
              <button class="btn btn-ghost btn-xs" (click)="selectedCell.set(null)">
                <i class="fi fi-rr-cross"></i>
              </button>
            </div>

            <div class="day-summary-body">
              <!-- Created Section -->
              <div class="summary-section">
                <span class="section-title text-purple">
                  <i class="fi fi-rr-plus-circle"></i> Created Tasks ({{ sc.createdTasks.length }})
                </span>
                @if (sc.createdTasks.length === 0) {
                  <div class="none-text">No tasks created on this date</div>
                } @else {
                  <div class="task-mini-list">
                    @for (t of sc.createdTasks; track t.id) {
                      <div class="task-mini-item" (click)="openDetail(t)">
                        <i [class]="getTypeIcon(t.type)"></i>
                        <span class="task-title">{{ t.title }}</span>
                        <span class="badge-mono">{{ t.status }}</span>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Closed Section -->
              <div class="summary-section">
                <span class="section-title text-emerald">
                  <i class="fi fi-rr-check-circle"></i> Closed Tasks ({{ sc.closedTasks.length }})
                </span>
                @if (sc.closedTasks.length === 0) {
                  <div class="none-text">No tasks closed on this date</div>
                } @else {
                  <div class="task-mini-list">
                    @for (t of sc.closedTasks; track t.id) {
                      <div class="task-mini-item" (click)="openDetail(t)">
                        <i [class]="getTypeIcon(t.type)"></i>
                        <span class="task-title">{{ t.title }}</span>
                        <span class="badge-mono badge-done font-mono">Done</span>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Due Section -->
              <div class="summary-section">
                <span class="section-title text-amber">
                  <i class="fi fi-rr-clock"></i> Scheduled / Due Tasks ({{ sc.dueTasks.length }})
                </span>
                @if (sc.dueTasks.length === 0) {
                  <div class="none-text">No tasks scheduled for this date</div>
                } @else {
                  <div class="task-mini-list">
                    @for (t of sc.dueTasks; track t.id) {
                      <div class="task-mini-item" (click)="openDetail(t)">
                        <i [class]="getTypeIcon(t.type)"></i>
                        <span class="task-title">{{ t.title }}</span>
                        <span class="badge-mono">{{ t.status }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="modal-footer-custom font-mono">
              <button class="btn btn-secondary btn-sm" (click)="selectedCell.set(null)">
                Close
              </button>
              <button class="btn btn-primary btn-sm" (click)="createForDate(sc.dateStr)">
                <i class="fi fi-rr-plus"></i> Schedule Task for {{ sc.dateStr }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modals -->
      @if (showCreateModal()) {
        <app-task-modal
          [defaultDueDate]="presetDueDate()"
          (close)="showCreateModal.set(false); presetDueDate.set('')"
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
    .calendar-workspace {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
    }

    /* Header Strip */
    .view-header-strip {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 0.75rem 1rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      width: 100%;
      box-sizing: border-box;
    }
    .view-header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
    }
    .view-header-title-wrap {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .view-header-title {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0;
    }
    .header-action-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .nav-btn-group {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .view-header-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
    }
    .drawer-backdrop {
      display: none;
    }

    .filter-pills {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    .filter-pill {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 0.25rem 0.55rem;
      font-size: 0.725rem;
      font-family: var(--font-mono);
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      transition: var(--transition-fast);
    }
    .filter-pill:hover {
      background: var(--bg-surface-hover);
      color: var(--text-main);
    }
    .filter-pill.active.pill-created-toggle { background: #f5f3ff; color: var(--accent-purple); border-color: #ddd6fe; }
    .filter-pill.active.pill-closed-toggle { background: #f0fdf4; color: var(--accent-emerald); border-color: #bbf7d0; }
    .filter-pill.active.pill-due-toggle { background: #fffbeb; color: var(--accent-amber); border-color: #fde68a; }

    /* Calendar Layout Grid */
    .calendar-body-layout {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .calendar-grid-panel {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      box-sizing: border-box;
    }

    .week-header-row {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: var(--bg-surface-subtle);
      border-bottom: 1px solid var(--border-subtle);
    }
    .week-start-toggle {
      display: flex;
      align-items: center;
      gap: 0.2rem;
      margin-left: 0.4rem;
    }
    .week-start-btn {
      padding: 0.15rem 0.4rem;
      font-size: 0.65rem;
      font-weight: 700;
      border-radius: var(--radius-xs);
    }
    .week-start-btn.active {
      background: var(--accent-cyan);
      color: #ffffff;
      border-color: var(--accent-cyan);
    }
    .week-day {
      padding: 0.5rem;
      text-align: center;
      font-size: 0.725rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
      border-right: 1px solid var(--border-subtle);
    }
    .week-day:last-child { border-right: none; }

    .days-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      grid-auto-rows: 125px;
    }

    .day-cell {
      height: 125px;
      max-height: 125px;
      box-sizing: border-box;
      padding: 0.35rem 0.4rem;
      border-right: 1px solid var(--border-subtle);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      cursor: pointer;
      transition: var(--transition-fast);
      min-width: 0;
      overflow: hidden;
    }
    .day-cell:nth-child(7n) { border-right: none; }
    .day-cell:hover {
      background: var(--bg-surface-hover);
    }
    .day-cell.other-month {
      background: var(--bg-surface-subtle);
      opacity: 0.5;
    }
    .day-cell.today {
      background: #fcfbf9;
      border: 1.5px solid var(--text-main);
    }
    .day-cell.drag-over {
      background: #f5f3ff !important;
      border: 2px dashed var(--accent-purple) !important;
    }

    .cell-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .day-number {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .today-number {
      color: var(--text-main);
    }
    .today-badge {
      font-size: 0.6rem;
      background: var(--text-main);
      color: var(--bg-canvas);
      padding: 0.05rem 0.3rem;
      border-radius: var(--radius-xs);
      font-weight: 700;
    }

    .cell-events {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      flex: 1;
      max-height: 86px;
      overflow: hidden;
    }

    .event-pill {
      font-size: 0.65rem;
      padding: 0.15rem 0.4rem;
      border-radius: var(--radius-xs);
      display: flex;
      align-items: center;
      gap: 0.25rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: grab;
      font-family: var(--font-mono);
      line-height: 1.2;
    }
    .event-pill:active { cursor: grabbing; }
    .event-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pill-created { background: #f5f3ff; color: var(--accent-purple); border: 1px solid #ddd6fe; }
    .pill-closed { background: #f0fdf4; color: var(--accent-emerald); border: 1px solid #bbf7d0; }
    .pill-due { background: #fffbeb; color: var(--accent-amber); border: 1px solid #fde68a; }

    .event-overflow {
      font-size: 0.65rem;
      color: var(--accent-cyan);
      background: rgba(6, 182, 212, 0.1);
      border: 1px dashed rgba(6, 182, 212, 0.3);
      border-radius: var(--radius-xs);
      font-weight: 700;
      padding: 0.1rem 0.35rem;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s ease;
      margin-top: 0.1rem;
    }
    .event-overflow:hover {
      background: var(--accent-cyan);
      color: #ffffff;
    }

    /* Unscheduled Drawer Panel */
    .unscheduled-drawer {
      width: 320px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.85rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      box-sizing: border-box;
    }
    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.45rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .drawer-header h3 {
      font-size: 0.85rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0;
    }
    .drawer-search-box {
      position: relative;
      width: 100%;
    }
    .drawer-search-input {
      width: 100%;
      padding-left: 1.8rem;
      padding-right: 1.8rem;
      font-size: 0.725rem;
      box-sizing: border-box;
    }
    .drawer-search-box .search-icon {
      position: absolute;
      left: 0.55rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 0.75rem;
    }
    .btn-clear-search {
      position: absolute;
      right: 0.4rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.7rem;
    }
    .drawer-pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border-subtle);
      font-size: 0.7rem;
      color: var(--text-muted);
    }
    .page-btns {
      display: flex;
      gap: 0.25rem;
    }
    .drawer-hint {
      display: flex;
      align-items: flex-start;
      gap: 0.4rem;
      font-size: 0.7rem;
      color: var(--text-muted);
      background: var(--bg-surface-subtle);
      padding: 0.45rem 0.65rem;
      border-radius: var(--radius-xs);
      line-height: 1.3;
      border: 1px solid var(--border-subtle);
    }

    .unscheduled-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      max-height: 520px;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 2px;
    }
    .empty-drawer {
      padding: 2rem 0.5rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.775rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
    }

    /* Unscheduled Task Card */
    .unscheduled-card {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      padding: 0.65rem 0.75rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      cursor: grab;
      transition: var(--transition-fast);
      position: relative;
      box-sizing: border-box;
      width: 100%;
    }
    .unscheduled-card:hover {
      border-color: var(--border-medium);
      background: var(--bg-surface-hover);
    }
    .unscheduled-card:active { cursor: grabbing; }

    .card-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
    }
    .card-key-type {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.725rem;
      font-weight: 700;
    }
    .task-key-tag {
      color: var(--text-subtle);
      font-size: 0.725rem;
      font-weight: 700;
    }
    .card-badges {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .priority-badge {
      font-size: 0.625rem;
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

    .status-pill {
      font-size: 0.625rem;
      padding: 0.08rem 0.35rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-muted);
      text-transform: capitalize;
    }

    .card-title-text {
      font-size: 0.825rem;
      font-weight: 600;
      color: var(--text-main);
      margin: 0;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }

    .card-action-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      margin-top: 0.15rem;
      padding-top: 0.35rem;
      border-top: 1px dashed var(--border-subtle);
    }
    .card-project-pill {
      font-size: 0.675rem;
      padding: 0.1rem 0.4rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 130px;
    }
    .date-picker-wrap {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin-left: auto;
    }
    .schedule-date-label {
      font-size: 0.675rem;
      color: var(--text-muted);
      font-weight: 700;
    }
    .date-picker-inline {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 0.15rem 0.25rem;
      font-size: 0.65rem;
      color: var(--text-main);
      outline: none;
      width: 95px;
    }

    /* Day Detail Modal Card */
    .day-detail-card {
      width: 100%;
      max-width: 550px;
    }
    .day-summary-body {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 0.5rem 0;
    }
    .summary-section {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .section-title {
      font-size: 0.775rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .none-text {
      font-size: 0.725rem;
      color: var(--text-muted);
      font-style: italic;
      padding-left: 0.5rem;
    }
    .task-mini-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .task-mini-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.65rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      cursor: pointer;
      font-size: 0.775rem;
      transition: var(--transition-fast);
    }
    .task-mini-item:hover {
      background: var(--bg-surface-hover);
      border-color: var(--border-medium);
    }
    .task-title {
      flex: 1;
      color: var(--text-main);
    }
    .badge-done {
      background: #f0fdf4;
      color: var(--accent-emerald);
      border-color: #bbf7d0;
    }
    .modal-footer-custom {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding-top: 1rem;
      margin-top: 0.5rem;
      border-top: 1px solid var(--border-subtle);
    }

    @media (max-width: 768px) {
      .calendar-workspace {
        padding: 0.5rem;
        gap: 0.65rem;
      }
      .view-header-strip {
        padding: 0.6rem 0.75rem;
        gap: 0.5rem;
      }
      .view-header-top {
        justify-content: space-between;
      }
      .view-header-title {
        font-size: 0.925rem;
      }
      .header-action-group {
        gap: 0.35rem;
      }
      .nav-btn-group .btn-xs {
        padding: 0.2rem 0.35rem;
        font-size: 0.7rem;
      }
      .schedule-toggle-btn {
        padding: 0.2rem 0.45rem;
        font-size: 0.725rem;
      }
      .view-header-toolbar {
        overflow-x: auto;
        flex-wrap: nowrap;
        justify-content: flex-start;
        padding-bottom: 0.2rem;
        gap: 0.6rem;
        -webkit-overflow-scrolling: touch;
      }
      .filter-pills {
        flex-wrap: nowrap;
        flex-shrink: 0;
        gap: 0.3rem;
      }
      .filter-pill {
        white-space: nowrap;
        font-size: 0.675rem;
        padding: 0.18rem 0.45rem;
        flex-shrink: 0;
      }
      .week-start-toggle {
        margin-left: 0;
        flex-shrink: 0;
      }
      .week-start-btn {
        padding: 0.15rem 0.35rem;
        font-size: 0.625rem;
      }
      .calendar-body-layout {
        position: relative;
      }
      .days-grid {
        grid-auto-rows: 95px;
      }
      .day-cell {
        height: 95px;
        max-height: 95px;
        padding: 0.25rem 0.3rem;
      }
      .cell-events {
        max-height: 56px;
      }
      .event-pill {
        font-size: 0.6rem;
        padding: 0.1rem 0.3rem;
      }

      /* Hide/Collapse Drawer & Backdrop during touch drag on Mobile */
      .unscheduled-drawer.touch-dragging-active,
      .drawer-backdrop.touch-dragging-active {
        opacity: 0 !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }

      /* Mobile Slide-Up Bottom Sheet for Unscheduled Drawer */
      .drawer-backdrop {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(3px);
        z-index: 1000;
        animation: fadeIn 0.2s ease-out;
      }
      .unscheduled-drawer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        max-height: 75vh;
        z-index: 1001;
        border-radius: var(--radius-md) var(--radius-md) 0 0;
        border: 1px solid var(--border-medium);
        border-bottom: none;
        box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.4);
        animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes slideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
    }

    /* Mobile Touch Drag Cancel Dropzone Bar */
    .touch-cancel-dropzone {
      position: fixed;
      bottom: 1.25rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100000;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 1.35rem;
      background: rgba(225, 29, 72, 0.95);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 24px;
      font-size: 0.8rem;
      font-weight: 700;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      user-select: none;
    }
    .touch-cancel-dropzone.hovering {
      background: #be123c;
      transform: translateX(-50%) scale(1.08);
      box-shadow: 0 12px 36px rgba(190, 18, 60, 0.6);
      border-color: #ffffff;
    }
  `]
})
export class CalendarComponent implements OnInit, OnDestroy {
  currentDate = signal<Date>(new Date());
  displayDate = signal<Date>(new Date());
  showCreated = signal<boolean>(true);
  showClosed = signal<boolean>(true);
  showDue = signal<boolean>(true);
  showUnscheduledDrawer = signal<boolean>(false);

  showCreateModal = signal<boolean>(false);
  presetDueDate = signal<string>('');
  activeDetailTask = signal<Task | null>(null);
  selectedCell = signal<CalendarDayCell | null>(null);

  draggedTaskId = signal<string | null>(null);
  dragOverDate = signal<string | null>(null);
  isTouchDraggingTask = signal<boolean>(false);
  isOverCancelDropzone = signal<boolean>(false);

  weekStart = signal<WeekStartDay>('sunday');

  setWeekStart(start: WeekStartDay) {
    this.weekStart.set(start);
    localStorage.setItem('bilo_calendar_week_start', start);
  }

  weekHeaders = computed<string[]>(() => {
    switch (this.weekStart()) {
      case 'monday':
        return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      case 'saturday':
        return ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];
      case 'sunday':
      default:
        return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    }
  });

  private navDebounceTimer: any = null;

  constructor(
    public taskService: TaskService,
    public projectService: ProjectService,
    public workspaceService: WorkspaceService
  ) { }

  ngOnInit() {
    this.taskService.loadTasksFromSupabase();
    const savedStart = localStorage.getItem('bilo_calendar_week_start') as WeekStartDay;
    if (savedStart && ['sunday', 'monday', 'saturday'].includes(savedStart)) {
      this.weekStart.set(savedStart);
    }
  }

  ngOnDestroy(): void {
    if (this.navDebounceTimer) {
      clearTimeout(this.navDebounceTimer);
      this.navDebounceTimer = null;
    }
  }

  monthTitle = computed(() => {
    const d = this.displayDate();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  });

  tasks = computed(() => {
    const list = this.taskService.tasks();
    const activeProjId = this.projectService.activeProject()?.id;
    if (!activeProjId) return list;
    return list.filter(t => t.project_id === activeProjId);
  });

  // Tasks that do NOT have a due_date set and are NOT completed / done
  unscheduledTasks = computed(() => {
    return this.tasks().filter(t => {
      if (t.due_date) return false;
      if (t.completed) return false;
      const status = (t.status || '').toLowerCase();
      if (status === 'done' || status === 'closed' || status === 'completed') return false;
      return true;
    });
  });

  unscheduledSearchQuery = signal<string>('');
  unscheduledPage = signal<number>(1);
  readonly unscheduledPageSize = 10;

  filteredUnscheduledTasks = computed(() => {
    const all = this.unscheduledTasks();
    const q = this.unscheduledSearchQuery().toLowerCase().trim();
    if (!q) return all;
    return all.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.status && t.status.toLowerCase().includes(q)) ||
      (t.priority && t.priority.toLowerCase().includes(q))
    );
  });

  totalUnscheduledPages = computed(() => {
    const total = this.filteredUnscheduledTasks().length;
    return Math.max(1, Math.ceil(total / this.unscheduledPageSize));
  });

  paginatedUnscheduledTasks = computed(() => {
    const list = this.filteredUnscheduledTasks();
    const page = Math.min(this.unscheduledPage(), this.totalUnscheduledPages());
    const start = (page - 1) * this.unscheduledPageSize;
    return list.slice(start, start + this.unscheduledPageSize);
  });

  onUnscheduledSearch(q: string) {
    this.unscheduledSearchQuery.set(q);
    this.unscheduledPage.set(1);
  }

  prevUnscheduledPage() {
    if (this.unscheduledPage() > 1) {
      this.unscheduledPage.update(p => p - 1);
    }
  }

  nextUnscheduledPage() {
    if (this.unscheduledPage() < this.totalUnscheduledPages()) {
      this.unscheduledPage.update(p => p + 1);
    }
  }

  // Generate Month Grid Days
  calendarCells = computed<CalendarDayCell[]>(() => {
    const curr = this.currentDate();
    const year = curr.getFullYear();
    const month = curr.getMonth();

    const todayStr = getLocalDateString();

    // First day of current month
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...

    const offsetMap: Record<WeekStartDay, number> = {
      sunday: 0,
      monday: 1,
      saturday: 6
    };
    const weekStartOffset = offsetMap[this.weekStart()] || 0;
    const startOffset = (firstDayOfWeek - weekStartOffset + 7) % 7;

    // Days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: CalendarDayCell[] = [];
    const allTasksList = this.tasks();

    // 1. Previous month padding days
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = this.formatToISO(prevDate);
      cells.push(this.buildDayCell(dayNum, dateStr, false, dateStr === todayStr, allTasksList));
    }

    // 2. Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const curDate = new Date(year, month, dayNum);
      const dateStr = this.formatToISO(curDate);
      cells.push(this.buildDayCell(dayNum, dateStr, true, dateStr === todayStr, allTasksList));
    }

    // 3. Next month padding days to complete 35 or 42 cells grid
    const totalSoFar = cells.length;
    const totalGridCells = totalSoFar > 35 ? 42 : 35;
    const remaining = totalGridCells - totalSoFar;

    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(year, month + 1, dayNum);
      const dateStr = this.formatToISO(nextDate);
      cells.push(this.buildDayCell(dayNum, dateStr, false, dateStr === todayStr, allTasksList));
    }

    return cells;
  });

  // Aggregated Month Counts for Filter Badges
  monthCreatedCount = computed(() => {
    return this.calendarCells()
      .filter(c => c.isCurrentMonth)
      .reduce((sum, c) => sum + c.createdTasks.length, 0);
  });

  monthClosedCount = computed(() => {
    return this.calendarCells()
      .filter(c => c.isCurrentMonth)
      .reduce((sum, c) => sum + c.closedTasks.length, 0);
  });

  monthDueCount = computed(() => {
    return this.calendarCells()
      .filter(c => c.isCurrentMonth)
      .reduce((sum, c) => sum + c.dueTasks.length, 0);
  });

  private buildDayCell(dayNumber: number, dateStr: string, isCurrentMonth: boolean, isToday: boolean, allTasks: Task[]): CalendarDayCell {
    const createdTasks = allTasks.filter(t => t.created_at && isoToLocalDateString(t.created_at) === dateStr);

    const closedTasks = allTasks.filter(t => {
      if (!t.completed && (t.status || '').toLowerCase() !== 'done') return false;
      const closedDate = t.updated_at ? isoToLocalDateString(t.updated_at) : (t.created_at ? isoToLocalDateString(t.created_at) : '');
      return closedDate === dateStr;
    });

    const dueTasks = allTasks.filter(t => t.due_date === dateStr);

    return {
      dayNumber,
      dateStr,
      isCurrentMonth,
      isToday,
      createdTasks,
      closedTasks,
      dueTasks
    };
  }

  prevMonth() {
    this.stepMonth(-1);
  }

  nextMonth() {
    this.stepMonth(1);
  }

  todayMonth() {
    const now = new Date();
    this.displayDate.set(now);
    this.scheduleDateSync(now);
  }

  private stepMonth(delta: number) {
    const current = this.displayDate();
    const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    this.displayDate.set(next);
    this.scheduleDateSync(next);
  }

  private scheduleDateSync(targetDate: Date) {
    if (this.navDebounceTimer) {
      clearTimeout(this.navDebounceTimer);
    }
    this.navDebounceTimer = setTimeout(() => {
      this.currentDate.set(targetDate);
      this.navDebounceTimer = null;
    }, 120);
  }

  readonly maxVisibleCellEvents = 3;

  getAllCellEvents(cell: CalendarDayCell): CalendarCellEvent[] {
    const events: CalendarCellEvent[] = [];
    if (this.showCreated() && cell.createdTasks) {
      cell.createdTasks.forEach((t: Task) => events.push({ id: `c-${t.id}`, title: t.title, eventType: 'created', task: t }));
    }
    if (this.showClosed() && cell.closedTasks) {
      cell.closedTasks.forEach((t: Task) => events.push({ id: `x-${t.id}`, title: t.title, eventType: 'closed', task: t }));
    }
    if (this.showDue() && cell.dueTasks) {
      cell.dueTasks.forEach((t: Task) => events.push({ id: `d-${t.id}`, title: t.title, eventType: 'due', task: t }));
    }
    return events;
  }

  hasAnyEvents(cell: CalendarDayCell): boolean {
    return this.getAllCellEvents(cell).length > 0;
  }

  getVisibleEvents(cell: CalendarDayCell): CalendarCellEvent[] {
    return this.getAllCellEvents(cell).slice(0, this.maxVisibleCellEvents);
  }

  getOverflowCount(cell: CalendarDayCell): number {
    const total = this.getAllCellEvents(cell).length;
    return Math.max(0, total - this.maxVisibleCellEvents);
  }

  // --- Drag and Drop Scheduling Methods ---

  onDragStartTask(e: DragEvent, task: Task) {
    this.draggedTaskId.set(task.id);
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOverDay(e: DragEvent, dateStr: string) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (this.dragOverDate() !== dateStr) {
      this.dragOverDate.set(dateStr);
    }
  }

  onDragLeaveDay(e: DragEvent, dateStr: string) {
    if (this.dragOverDate() === dateStr) {
      this.dragOverDate.set(null);
    }
  }

  async onDropOnDay(e: DragEvent, dateStr: string) {
    e.preventDefault();
    this.dragOverDate.set(null);
    const taskId = this.draggedTaskId() || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);

    if (taskId) {
      await this.taskService.updateTask(taskId, { due_date: dateStr });
      this.draggedTaskId.set(null);
    }
  }

  // --- Mobile Touch Drag Scheduling ---
  private touchGhostEl: HTMLElement | null = null;

  onTouchStartTask(e: TouchEvent, task: Task) {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    this.draggedTaskId?.set?.(task.id);
    this.isTouchDraggingTask?.set?.(true);
    this.isOverCancelDropzone?.set?.(false);

    // Create a floating visual ghost for touch feedback
    this.cleanupTouchGhost();
    const ghost = document.createElement('div');
    ghost.className = 'touch-drag-ghost font-mono';
    ghost.innerHTML = `<i class="fi fi-rr-calendar" style="margin-right:0.35rem; font-size:0.85rem;"></i> ${task.title}`;
    ghost.style.position = 'fixed';
    ghost.style.left = `${touch.clientX - 40}px`;
    ghost.style.top = `${touch.clientY - 20}px`;
    ghost.style.zIndex = '999999';
    ghost.style.pointerEvents = 'none';
    ghost.style.padding = '0.45rem 0.85rem';
    ghost.style.background = 'var(--accent-purple)';
    ghost.style.color = '#ffffff';
    ghost.style.borderRadius = 'var(--radius-xs)';
    ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
    ghost.style.fontSize = '0.775rem';
    ghost.style.fontWeight = '700';
    ghost.style.border = '1px solid rgba(255,255,255,0.4)';

    document.body.appendChild(ghost);
    this.touchGhostEl = ghost;
  }

  onTouchMoveTask(e: TouchEvent) {
    if (!this.touchGhostEl || !e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    this.touchGhostEl.style.left = `${touch.clientX - 40}px`;
    this.touchGhostEl.style.top = `${touch.clientY - 20}px`;

    // Identify target element under touch pointer
    if (typeof document !== 'undefined') {
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      if (targetEl) {
        // Check if over cancel dropzone bar
        if (targetEl.closest('.touch-cancel-dropzone')) {
          if (!this.isOverCancelDropzone?.()) {
            this.isOverCancelDropzone?.set?.(true);
          }
          if (this.dragOverDate?.() !== null) {
            this.dragOverDate?.set?.(null);
          }
          return;
        }

        if (this.isOverCancelDropzone?.()) {
          this.isOverCancelDropzone?.set?.(false);
        }

        // Check if over a calendar day cell
        const dayCell = targetEl.closest('.day-cell') as HTMLElement;
        if (dayCell && dayCell.dataset['date']) {
          const dateStr = dayCell.dataset['date'];
          if (this.dragOverDate?.() !== dateStr) {
            this.dragOverDate?.set?.(dateStr);
          }
          return;
        }
      }
    }

    if (this.dragOverDate?.() !== null) {
      this.dragOverDate?.set?.(null);
    }
  }

  async onTouchEndTask(e: TouchEvent) {
    const taskId = this.draggedTaskId ? this.draggedTaskId() : null;
    const dateStr = this.dragOverDate ? this.dragOverDate() : null;
    const isCancelled = this.isOverCancelDropzone ? this.isOverCancelDropzone() : false;

    this.cleanupTouchGhost();
    this.dragOverDate?.set?.(null);
    this.draggedTaskId?.set?.(null);
    this.isTouchDraggingTask?.set?.(false);
    this.isOverCancelDropzone?.set?.(false);

    if (taskId && dateStr && !isCancelled) {
      await this.taskService.updateTask(taskId, { due_date: dateStr });
    }
  }

  onTouchCancelTask() {
    this.cleanupTouchGhost();
    this.dragOverDate?.set?.(null);
    this.draggedTaskId?.set?.(null);
    this.isTouchDraggingTask?.set?.(false);
    this.isOverCancelDropzone?.set?.(false);
  }

  private cleanupTouchGhost() {
    if (this.touchGhostEl) {
      this.touchGhostEl.remove();
      this.touchGhostEl = null;
    }
  }

  async scheduleTaskDirect(taskId: string, targetDate: string) {
    await this.taskService.updateTask(taskId, { due_date: targetDate });
  }

  selectDayCell(cell: CalendarDayCell) {
    this.selectedCell.set(cell);
  }

  openDetail(t: Task) {
    this.activeDetailTask.set(t);
  }

  openCreateModal() {
    this.presetDueDate.set('');
    this.showCreateModal.set(true);
  }

  createForDate(dateStr: string) {
    this.selectedCell.set(null);
    this.presetDueDate.set(dateStr);
    this.showCreateModal.set(true);
  }

  getTaskKeyStr(t: Task): string {
    return getTaskKey(t, this.projectService.projects());
  }

  getProjectName(projectId?: string): string {
    if (!projectId) return '';
    const proj = this.projectService.projects().find(p => p.id === projectId);
    return proj ? proj.name : '';
  }

  getTypeIcon(type: string): string {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'story': return 'fi fi-rr-book-alt text-cyan';
      case 'bug': return 'fi fi-rr-bug text-rose';
      case 'epic': return 'fi fi-rr-rocket text-purple';
      default: return 'fi fi-rr-check-circle text-emerald';
    }
  }

  formatFullDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  private formatToISO(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
