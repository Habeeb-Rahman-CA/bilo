import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { Task } from '../../core/models/project.model';
import { TaskDetailModalComponent } from '../../shared/components/task-detail-modal';
import { TaskModalComponent } from '../../shared/components/task-modal';
import { DatePickerComponent } from '../../shared/components/date-picker';

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
  imports: [CommonModule, FormsModule, TaskDetailModalComponent, TaskModalComponent, DatePickerComponent],
  template: `
    <div class="calendar-workspace font-mono">
      <!-- Calendar Header Strip -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-left">
          <span class="badge-mono">04 CALENDAR</span>
          <h2 class="view-header-title">{{ monthTitle() }}</h2>
          <div class="nav-btn-group">
            <button class="btn btn-secondary btn-xs" (click)="prevMonth()" title="Previous Month">
              <i class="fi fi-rr-angle-left"></i>
            </button>
            <button class="btn btn-secondary btn-xs" (click)="todayMonth()" title="Jump to Current Month">
              Today
            </button>
            <button class="btn btn-secondary btn-xs" (click)="nextMonth()" title="Next Month">
              <i class="fi fi-rr-angle-right"></i>
            </button>
          </div>
        </div>

        <div class="view-header-right">
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

          <button
            class="btn btn-secondary btn-sm"
            [class.active]="showUnscheduledDrawer()"
            (click)="showUnscheduledDrawer.set(!showUnscheduledDrawer())"
            title="Toggle Unscheduled Tasks Scheduler Drawer"
          >
            <i class="fi fi-rr-time-fast"></i> Schedule ({{ unscheduledTasks().length }})
          </button>

          <button class="btn btn-primary btn-sm" (click)="workspaceService.openCreateTaskModal()">
            <i class="fi fi-rr-plus"></i> New Task
          </button>
        </div>
      </div>

      <!-- Main Layout Grid: Calendar + Unscheduled Scheduler Side Drawer -->
      <div class="calendar-body-layout">
        <!-- Calendar Month Grid Container -->
        <div class="calendar-grid-panel paper-panel">
          <!-- Weekday Headers -->
          <div class="week-header-row font-mono">
            <div class="week-day">SUN</div>
            <div class="week-day">MON</div>
            <div class="week-day">TUE</div>
            <div class="week-day">WED</div>
            <div class="week-day">THU</div>
            <div class="week-day">FRI</div>
            <div class="week-day">SAT</div>
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
          <div class="unscheduled-drawer paper-panel font-mono">
            <div class="drawer-header">
              <h3><i class="fi fi-rr-time-fast text-amber"></i> Unscheduled Tasks</h3>
              <button class="btn btn-ghost btn-xs" (click)="showUnscheduledDrawer.set(false)">
                <i class="fi fi-rr-cross"></i>
              </button>
            </div>

            <div class="drawer-hint">
              <i class="fi fi-rr-info text-cyan"></i>
              <span>Drag any task below onto a calendar day cell to schedule its due date.</span>
            </div>

            <div class="unscheduled-list">
              @if (unscheduledTasks().length === 0) {
                <div class="empty-drawer font-mono">
                  <i class="fi fi-rr-check-circle text-emerald"></i>
                  <span>All tasks have scheduled due dates!</span>
                </div>
              } @else {
                @for (t of unscheduledTasks(); track t.id) {
                  <div
                    class="unscheduled-card"
                    draggable="true"
                    (dragstart)="onDragStartTask($event, t)"
                    (touchstart)="onTouchStartTask($event, t)"
                    (touchmove)="onTouchMoveTask($event)"
                    (touchend)="onTouchEndTask($event)"
                    (touchcancel)="onTouchCancelTask()"
                    (click)="openDetail(t)"
                  >
                    <div class="card-top-row">
                      <i [class]="getTypeIcon(t.type)"></i>
                      <span class="card-title">{{ t.title }}</span>
                    </div>

                    <div class="card-bottom-row">
                      <span class="card-sub">{{ t.priority }} • {{ t.status }}</span>
                      <div class="card-date-action" (click)="$event.stopPropagation()">
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
          </div>
        }
      </div>

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
    .calendar-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 0.75rem 1.1rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      width: 100%;
      box-sizing: border-box;
    }
    .banner-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .banner-left h2 {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .nav-btn-group {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .banner-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
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
      width: 290px;
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
      display: flex;
      align-items: center;
      gap: 0.45rem;
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
      gap: 0.5rem;
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

    .unscheduled-card {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 0.55rem 0.65rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      cursor: grab;
      transition: var(--transition-fast);
      position: relative;
      overflow-x: hidden;
      box-sizing: border-box;
    }
    .unscheduled-card:hover {
      border-color: var(--border-medium);
      background: var(--bg-surface-hover);
    }
    .unscheduled-card:active { cursor: grabbing; }

    .card-top-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      width: 100%;
      overflow: hidden;
    }
    .card-title {
      font-size: 0.775rem;
      font-weight: 600;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }
    .card-bottom-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }
    .card-sub {
      font-size: 0.625rem;
      color: var(--text-muted);
      text-transform: capitalize;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-date-action {
      min-width: 90px;
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
  `]
})
export class CalendarComponent implements OnInit {
  currentDate = signal<Date>(new Date());
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

  readonly maxVisibleEventsPerType = 2;

  constructor(
    public taskService: TaskService,
    public projectService: ProjectService,
    public workspaceService: WorkspaceService
  ) { }

  ngOnInit() {
    this.taskService.loadTasksFromSupabase();
  }

  monthTitle = computed(() => {
    const d = this.currentDate();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  });

  tasks = computed(() => {
    const list = this.taskService.tasks();
    const activeProjId = this.projectService.activeProject()?.id;
    if (!activeProjId) return list;
    return list.filter(t => t.project_id === activeProjId);
  });

  // Tasks that do NOT have a due_date set
  unscheduledTasks = computed(() => {
    return this.tasks().filter(t => !t.due_date);
  });

  // Generate Month Grid Days
  calendarCells = computed<CalendarDayCell[]>(() => {
    const curr = this.currentDate();
    const year = curr.getFullYear();
    const month = curr.getMonth();

    const todayStr = new Date().toISOString().split('T')[0];

    // First day of current month
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...

    // Days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: CalendarDayCell[] = [];
    const allTasksList = this.tasks();

    // 1. Previous month padding days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
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
    const createdTasks = allTasks.filter(t => t.created_at && t.created_at.startsWith(dateStr));

    const closedTasks = allTasks.filter(t => {
      if (!t.completed && (t.status || '').toLowerCase() !== 'done') return false;
      const closedDate = t.updated_at ? t.updated_at.split('T')[0] : (t.created_at ? t.created_at.split('T')[0] : '');
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
    this.currentDate.update(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth() {
    this.currentDate.update(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  todayMonth() {
    this.currentDate.set(new Date());
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
    this.draggedTaskId.set(task.id);

    // Create a floating visual ghost for touch feedback
    this.cleanupTouchGhost();
    const ghost = document.createElement('div');
    ghost.className = 'touch-drag-ghost font-mono';
    ghost.innerText = `📅 ${task.title}`;
    ghost.style.position = 'fixed';
    ghost.style.left = `${touch.clientX - 40}px`;
    ghost.style.top = `${touch.clientY - 20}px`;
    ghost.style.zIndex = '99999';
    ghost.style.pointerEvents = 'none';
    ghost.style.padding = '0.4rem 0.75rem';
    ghost.style.background = 'var(--accent-purple)';
    ghost.style.color = '#ffffff';
    ghost.style.borderRadius = 'var(--radius-xs)';
    ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
    ghost.style.fontSize = '0.75rem';
    ghost.style.fontWeight = '700';
    ghost.style.border = '1px solid rgba(255,255,255,0.3)';

    document.body.appendChild(ghost);
    this.touchGhostEl = ghost;
  }

  onTouchMoveTask(e: TouchEvent) {
    if (!this.touchGhostEl || !e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    this.touchGhostEl.style.left = `${touch.clientX - 40}px`;
    this.touchGhostEl.style.top = `${touch.clientY - 20}px`;

    // Identify target day cell under touch pointer
    if (typeof document !== 'undefined') {
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      if (targetEl) {
        const dayCell = targetEl.closest('.day-cell') as HTMLElement;
        if (dayCell && dayCell.dataset['date']) {
          const dateStr = dayCell.dataset['date'];
          if (this.dragOverDate() !== dateStr) {
            this.dragOverDate.set(dateStr);
          }
          return;
        }
      }
    }
    if (this.dragOverDate() !== null) {
      this.dragOverDate.set(null);
    }
  }

  async onTouchEndTask(e: TouchEvent) {
    const taskId = this.draggedTaskId();
    const dateStr = this.dragOverDate();

    this.cleanupTouchGhost();
    this.dragOverDate.set(null);
    this.draggedTaskId.set(null);

    if (taskId && dateStr) {
      await this.taskService.updateTask(taskId, { due_date: dateStr });
    }
  }

  onTouchCancelTask() {
    this.cleanupTouchGhost();
    this.dragOverDate.set(null);
    this.draggedTaskId.set(null);
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
