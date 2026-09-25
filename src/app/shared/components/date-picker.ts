import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getLocalDateString, getOffsetDateString } from '../../core/utils/date.util';
import { registerOpenPopover, unregisterOpenPopover } from './select';

export interface DatePickerDay {
  dayNumber: number;
  dateStr: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div 
      class="bilo-date-picker font-mono" 
      [class.compact]="compact"
    >
      <!-- Trigger Input Button -->
      <div 
        #triggerEl
        class="picker-trigger"
        [class.active]="isOpen()"
        [class.has-value]="!!value"
        (click)="toggleOpen($event)"
        tabindex="0"
        (keydown.space)="toggleOpen($event)"
        (keydown.enter)="toggleOpen($event)"
        title="Select date"
      >
        <i class="fi fi-rr-calendar trigger-icon"></i>
        <span class="trigger-text">{{ displayLabel() }}</span>

        @if (value) {
          <button 
            type="button" 
            class="clear-date-btn" 
            (click)="clearDate($event)" 
            title="Clear date"
          >
            <i class="fi fi-rr-cross-small"></i>
          </button>
        } @else {
          <i class="fi fi-rr-angle-small-down arrow-icon"></i>
        }
      </div>

      <!-- Viewport Fixed Popover Calendar Panel -->
      @if (isOpen()) {
        <div 
          class="picker-popover paper-panel font-mono" 
          [ngStyle]="popoverStyles()"
          (click)="$event.stopPropagation()"
        >
          <!-- Month Header & Navigation -->
          <div class="popover-header">
            <button type="button" class="nav-btn" (click)="prevMonth()" title="Previous Month">
              <i class="fi fi-rr-angle-left"></i>
            </button>

            <span class="month-title">{{ viewMonthTitle() }}</span>

            <button type="button" class="nav-btn" (click)="nextMonth()" title="Next Month">
              <i class="fi fi-rr-angle-right"></i>
            </button>
          </div>

          <!-- Quick Shortcuts -->
          <div class="quick-presets">
            <button type="button" class="preset-btn" (click)="selectToday()">Today</button>
            <button type="button" class="preset-btn" (click)="selectTomorrow()">Tomorrow</button>
            <button type="button" class="preset-btn" (click)="selectNextWeek()">+7 Days</button>
            @if (value) {
              <button type="button" class="preset-btn preset-clear" (click)="clearDate($event)">Clear</button>
            }
          </div>

          <!-- Weekday Headers -->
          <div class="week-row">
            <span class="week-col">SU</span>
            <span class="week-col">MO</span>
            <span class="week-col">TU</span>
            <span class="week-col">WE</span>
            <span class="week-col">TH</span>
            <span class="week-col">FR</span>
            <span class="week-col">SA</span>
          </div>

          <!-- Days Matrix -->
          <div class="days-matrix">
            @for (day of calendarDays(); track day.dateStr) {
              <button
                type="button"
                class="day-btn"
                [class.other-month]="!day.isCurrentMonth"
                [class.is-today]="day.isToday"
                [class.is-selected]="day.isSelected"
                (click)="selectDate(day.dateStr)"
              >
                {{ day.dayNumber }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .bilo-date-picker {
      position: relative;
      display: inline-block;
      width: 100%;
      user-select: none;
    }

    /* Trigger styling */
    .picker-trigger {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.65rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-muted);
      font-size: 0.775rem;
      cursor: pointer;
      transition: var(--transition-fast);
      min-height: 34px;
      box-sizing: border-box;
      width: 100%;
    }

    .picker-trigger:hover, .picker-trigger.active {
      background: var(--bg-surface-hover);
      border-color: var(--border-medium);
      color: var(--text-main);
    }

    .picker-trigger.has-value {
      color: var(--text-main);
      border-color: var(--border-subtle);
    }

    .trigger-icon {
      font-size: 0.85rem;
      color: var(--accent-cyan);
    }

    .trigger-text {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .arrow-icon {
      font-size: 0.8rem;
      color: var(--text-subtle);
    }

    .clear-date-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-xs);
      font-size: 0.85rem;
      transition: var(--transition-fast);
    }

    .clear-date-btn:hover {
      color: var(--accent-rose, #f43f5e);
      background: rgba(244, 63, 94, 0.1);
    }

    /* Compact Trigger Mode */
    .compact .picker-trigger {
      padding: 0.2rem 0.45rem;
      font-size: 0.675rem;
      min-height: 26px;
      gap: 0.35rem;
    }

    .compact .trigger-icon {
      font-size: 0.75rem;
    }

    /* Viewport Fixed Popover Calendar Container */
    .picker-popover {
      padding: 0.75rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
      animation: popoverFadeIn 0.15s ease-out;
      box-sizing: border-box;
    }

    @keyframes popoverFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .popover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .month-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-main);
      letter-spacing: 0.04em;
    }

    .nav-btn {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.2rem 0.4rem;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition-fast);
    }

    .nav-btn:hover {
      background: var(--bg-surface-hover);
      color: var(--text-main);
      border-color: var(--border-medium);
    }

    /* Quick Presets Bar */
    .quick-presets {
      display: flex;
      gap: 0.25rem;
      margin-bottom: 0.65rem;
    }

    .preset-btn {
      flex: 1;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-muted);
      font-size: 0.625rem;
      padding: 0.2rem 0;
      cursor: pointer;
      font-family: var(--font-mono);
      transition: var(--transition-fast);
    }

    .preset-btn:hover {
      background: var(--bg-surface-hover);
      color: var(--text-main);
      border-color: var(--border-medium);
    }

    .preset-clear:hover {
      color: var(--accent-rose, #f43f5e);
      border-color: var(--accent-rose, #f43f5e);
    }

    /* Weekday Headers */
    .week-row {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      text-align: center;
      margin-bottom: 0.35rem;
    }

    .week-col {
      font-size: 0.625rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    /* Days Grid */
    .days-matrix {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }

    .day-btn {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-xs);
      font-size: 0.7rem;
      font-family: var(--font-mono);
      color: var(--text-main);
      cursor: pointer;
      transition: var(--transition-fast);
    }

    .day-btn:hover {
      background: var(--bg-surface-hover);
      border-color: var(--border-subtle);
    }

    .day-btn.other-month {
      color: var(--text-subtle);
      opacity: 0.4;
    }

    .day-btn.is-today {
      font-weight: 700;
      color: var(--accent-cyan);
      border-color: var(--accent-cyan);
    }

    .day-btn.is-selected {
      background: var(--text-main) !important;
      color: var(--bg-canvas) !important;
      font-weight: 700;
      border-color: var(--text-main) !important;
    }
  `]
})
export class DatePickerComponent implements OnChanges {
  @Input() value: string = ''; // YYYY-MM-DD
  @Input() placeholder: string = 'Select date...';
  @Input() compact: boolean = false;
  @Input() align: 'left' | 'right' = 'left';
  @Input() position: 'bottom' | 'top' | 'auto' = 'auto';

  @Output() valueChange = new EventEmitter<string>();
  @Output() dateChange = new EventEmitter<string>();

  @ViewChild('triggerEl') triggerEl!: ElementRef<HTMLDivElement>;

  isOpen = signal<boolean>(false);
  viewDate = signal<Date>(new Date());
  triggerRect = signal<{ top: number; left: number; right: number; bottom: number; width: number; height: number } | null>(null);

  popoverStyles = computed(() => {
    if (!this.isOpen()) return { display: 'none' };
    const rect = this.triggerRect();
    if (!rect) return { display: 'none' };

    const popoverWidth = 240;
    const popoverHeight = 270;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = this.position === 'top' || (this.position === 'auto' && spaceBelow < popoverHeight && rect.top > popoverHeight);

    let top: number;
    if (openAbove) {
      top = rect.top - popoverHeight - 6;
    } else {
      top = rect.bottom + 6;
    }
    top = Math.max(10, Math.min(window.innerHeight - popoverHeight - 10, top));

    let left: number;
    if (this.align === 'right') {
      left = rect.right - popoverWidth;
    } else {
      left = rect.left;
    }
    left = Math.max(10, Math.min(window.innerWidth - popoverWidth - 10, left));

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
      'z-index': '10000',
      opacity: '1'
    };
  });

  constructor(private elementRef: ElementRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value'] && this.value) {
      const parsed = new Date(this.value);
      if (!isNaN(parsed.getTime())) {
        this.viewDate.set(parsed);
      }
    }
  }

  closePopover() {
    unregisterOpenPopover(this);
    this.isOpen.set(false);
  }

  openPopover() {
    registerOpenPopover(this);
    this.updateRect();
    this.isOpen.set(true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closePopover();
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onWindowChange() {
    if (this.isOpen()) {
      this.closePopover();
    }
  }

  toggleOpen(event?: Event) {
    if (event) event.stopPropagation();
    if (!this.isOpen()) {
      this.openPopover();
    } else {
      this.closePopover();
    }
  }

  private updateRect() {
    if (this.triggerEl) {
      const rect = this.triggerEl.nativeElement.getBoundingClientRect();
      this.triggerRect.set({
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      });
    }
  }

  displayLabel(): string {
    if (!this.value) return this.placeholder;
    const parts = this.value.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
    return this.value;
  }

  viewMonthTitle(): string {
    const d = this.viewDate();
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  }

  prevMonth() {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth() {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  selectDate(dateStr: string) {
    this.value = dateStr;
    this.valueChange.emit(dateStr);
    this.dateChange.emit(dateStr);
    this.isOpen.set(false);
  }

  clearDate(event?: Event) {
    if (event) event.stopPropagation();
    this.value = '';
    this.valueChange.emit('');
    this.dateChange.emit('');
    this.isOpen.set(false);
  }

  selectToday() {
    this.selectDate(getLocalDateString());
  }

  selectTomorrow() {
    this.selectDate(getOffsetDateString(1));
  }

  selectNextWeek() {
    this.selectDate(getOffsetDateString(7));
  }

  calendarDays(): DatePickerDay[] {
    const curr = this.viewDate();
    const year = curr.getFullYear();
    const month = curr.getMonth();

    const todayStr = getLocalDateString();
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: DatePickerDay[] = [];

    // Leading days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const pDay = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, pDay);
      const dateStr = this.formatYMD(prevDate);
      days.push({
        dayNumber: pDay,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === this.value
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const cDate = new Date(year, month, d);
      const dateStr = this.formatYMD(cDate);
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === this.value
      });
    }

    // Trailing days for next month to complete 35 or 42 grid cells
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let n = 1; n <= remaining; n++) {
      const nDate = new Date(year, month + 1, n);
      const dateStr = this.formatYMD(nDate);
      days.push({
        dayNumber: n,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === this.value
      });
    }

    return days;
  }

  private formatYMD(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
