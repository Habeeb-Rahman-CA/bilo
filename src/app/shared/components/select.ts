import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SelectOption {
  value: any;
  label: string;
  icon?: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div 
      class="bilo-select font-mono" 
      [class.compact]="compact"
      [class.disabled]="disabled"
    >
      <!-- Trigger Input Box -->
      <div 
        #triggerEl
        class="select-trigger"
        [class.active]="isOpen()"
        [class.has-value]="valueSignal() !== null && valueSignal() !== undefined && valueSignal() !== ''"
        (click)="toggleOpen($event)"
        (keydown)="onTriggerKeydown($event)"
        tabindex="0"
        title="Select option"
      >
        @if (selectedOption()?.icon) {
          <i [class]="selectedOption()!.icon + ' trigger-icon'"></i>
        }

        <span class="trigger-label">
          {{ selectedOption() ? selectedOption()!.label : (valueSignal() !== null && valueSignal() !== undefined && valueSignal() !== '' ? valueSignal() : placeholder) }}
        </span>

        @if (clearable && valueSignal() !== null && valueSignal() !== undefined && valueSignal() !== '') {
          <button 
            type="button" 
            class="clear-btn" 
            (click)="clearSelection($event)" 
            title="Clear selection"
          >
            <i class="fi fi-rr-cross-small"></i>
          </button>
        } @else {
          <i class="fi fi-rr-angle-small-down arrow-icon" [class.rotated]="isOpen()"></i>
        }
      </div>

      <!-- Viewport Fixed Dropover Panel -->
      @if (isOpen()) {
        <div 
          #popoverEl
          class="select-popover paper-panel font-mono" 
          [ngStyle]="popoverStyles()"
          (click)="$event.stopPropagation()"
          (keydown)="onPopoverKeydown($event)"
        >
          <!-- Search Box Input -->
          @if (searchable && normalizedOptions().length > 4) {
            <div class="search-box">
              <i class="fi fi-rr-search search-icon"></i>
              <input 
                #searchInput
                type="text" 
                class="search-input" 
                [placeholder]="searchPlaceholder"
                [ngModel]="searchQuery()" 
                (ngModelChange)="onSearchChange($event)"
              />
              @if (searchQuery()) {
                <button type="button" class="clear-search-btn" (click)="searchQuery.set('')">
                  <i class="fi fi-rr-cross-small"></i>
                </button>
              }
            </div>
          }

          <!-- Options List -->
          <div class="options-list" #optionsListEl (mousemove)="isKeyboardNav = false">
            @for (opt of filteredOptions(); track opt.value; let i = $index) {
              <div 
                class="option-item"
                [class.is-selected]="opt.value === valueSignal()"
                [class.is-focused]="i === activeIndex()"
                [class.is-disabled]="opt.disabled"
                (click)="selectOption(opt)"
                (mouseenter)="onOptionMouseEnter(i)"
              >
                @if (opt.icon) {
                  <i [class]="opt.icon + ' option-icon'"></i>
                }
                
                <div class="option-content">
                  <span class="option-label">{{ opt.label }}</span>
                  @if (opt.description) {
                    <span class="option-desc">{{ opt.description }}</span>
                  }
                </div>

                @if (opt.badge) {
                  <span class="option-badge">{{ opt.badge }}</span>
                }

                @if (opt.value === valueSignal()) {
                  <i class="fi fi-rr-check check-icon"></i>
                }
              </div>
            } @empty {
              <div class="no-options">
                <i class="fi fi-rr-search-alt"></i>
                <span>No matching options</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .bilo-select {
      position: relative;
      display: inline-block;
      width: 100%;
      user-select: none;
    }

    .bilo-select.disabled {
      opacity: 0.6;
      pointer-events: none;
    }

    /* Trigger Button */
    .select-trigger {
      display: flex;
      align-items: center;
      gap: 0.5rem;
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
      outline: none;
    }

    .select-trigger:hover, .select-trigger.active, .select-trigger:focus-visible {
      background: var(--bg-surface-hover);
      border-color: var(--border-medium);
      color: var(--text-main);
    }

    .select-trigger.has-value {
      color: var(--text-main);
    }

    .trigger-icon {
      font-size: 0.85rem;
      color: var(--accent-cyan);
    }

    .trigger-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .arrow-icon {
      font-size: 0.75rem;
      color: var(--text-subtle);
      transition: transform 0.15s ease;
    }

    .arrow-icon.rotated {
      transform: rotate(180deg);
    }

    .clear-btn {
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

    .clear-btn:hover {
      color: var(--accent-rose, #f43f5e);
      background: rgba(244, 63, 94, 0.1);
    }

    /* Compact Mode */
    .compact .select-trigger {
      padding: 0.25rem 0.5rem;
      font-size: 0.7rem;
      min-height: 28px;
    }

    /* Viewport Fixed Popover Container */
    .select-popover {
      display: flex;
      flex-direction: column;
      padding: 0.4rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
      animation: selectFadeIn 0.12s ease-out;
      box-sizing: border-box;
      gap: 0.35rem;
    }

    @keyframes selectFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Search Input Box */
    .search-box {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.35rem 0.55rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }

    .search-icon {
      font-size: 0.75rem;
      color: var(--text-subtle);
    }

    .search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-main);
      font-family: var(--font-mono);
      font-size: 0.725rem;
      padding: 0;
    }

    .clear-search-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
    }

    /* Options List */
    .options-list {
      display: flex;
      flex-direction: column;
      max-height: 220px;
      overflow-y: auto;
      gap: 2px;
    }

    .option-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.6rem;
      border-radius: var(--radius-xs);
      font-size: 0.75rem;
      color: var(--text-main);
      cursor: pointer;
      transition: var(--transition-fast);
    }

    .option-item:hover, .option-item.is-focused {
      background: var(--bg-surface-hover);
    }

    .option-item.is-selected {
      background: var(--bg-surface-hover);
      color: var(--accent-cyan);
      font-weight: 600;
    }

    .option-item.is-disabled {
      opacity: 0.4;
      pointer-events: none;
    }

    .option-icon {
      font-size: 0.8rem;
      color: var(--accent-cyan);
    }

    .option-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .option-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .option-desc {
      font-size: 0.625rem;
      color: var(--text-muted);
    }

    .option-badge {
      font-size: 0.6rem;
      padding: 0.1rem 0.35rem;
      border-radius: var(--radius-xs);
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
    }

    .check-icon {
      font-size: 0.75rem;
      color: var(--accent-cyan);
      margin-left: auto;
    }

    .no-options {
      padding: 1.25rem 0.5rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.725rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
    }
  `]
})
export class SelectComponent implements OnChanges, OnDestroy {
  private optionsSignal = signal<SelectOption[] | string[]>([]);
  valueSignal = signal<any>(null);

  @Input() 
  set options(opts: SelectOption[] | string[]) {
    this.optionsSignal.set(opts || []);
  }
  get options(): SelectOption[] | string[] {
    return this.optionsSignal();
  }

  @Input() 
  set value(v: any) {
    this.valueSignal.set(v);
  }
  get value(): any {
    return this.valueSignal();
  }

  @Input() placeholder: string = 'Select option...';
  @Input() searchPlaceholder: string = 'Search options...';
  @Input() searchable: boolean = true;
  @Input() disabled: boolean = false;
  @Input() compact: boolean = false;
  @Input() clearable: boolean = false;

  @Output() valueChange = new EventEmitter<any>();
  @Output() selectionChange = new EventEmitter<SelectOption>();

  @ViewChild('triggerEl') triggerEl!: ElementRef<HTMLDivElement>;
  @ViewChild('popoverEl') popoverEl?: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') searchInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('optionsListEl') optionsListEl?: ElementRef<HTMLDivElement>;

  isOpen = signal<boolean>(false);
  searchQuery = signal<string>('');
  activeIndex = signal<number>(-1);
  triggerRect = signal<{ top: number; left: number; right: number; bottom: number; width: number; height: number } | null>(null);

  normalizedOptions = computed<SelectOption[]>(() => {
    const opts = this.optionsSignal();
    if (!opts || !Array.isArray(opts)) return [];
    return opts.map(opt => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: opt, label: String(opt) };
      }
      return opt;
    });
  });

  filteredOptions = computed<SelectOption[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.normalizedOptions();
    if (!query) return list;
    return list.filter(opt =>
      opt.label.toLowerCase().includes(query) ||
      (opt.description && opt.description.toLowerCase().includes(query)) ||
      String(opt.value).toLowerCase().includes(query)
    );
  });

  selectedOption = computed<SelectOption | null>(() => {
    const val = this.valueSignal();
    const list = this.normalizedOptions();
    return list.find(opt => opt.value === val) || null;
  });

  popoverStyles = computed(() => {
    if (!this.isOpen()) return { display: 'none' };
    const rect = this.triggerRect();
    if (!rect) return { display: 'none' };

    const popoverWidth = Math.max(rect.width, 180);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;

    let top: number;
    let maxHeight: number;

    if (openAbove) {
      maxHeight = Math.min(spaceAbove, 240);
      top = rect.top - 4;
    } else {
      maxHeight = Math.min(spaceBelow, 240);
      top = rect.bottom + 4;
    }

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - popoverWidth - 10);
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
      'max-height': `${maxHeight}px`,
      transform: openAbove ? 'translateY(-100%)' : 'none',
      'z-index': '10000',
      opacity: '1'
    };
  });

  constructor(private elementRef: ElementRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['options']) {
      this.optionsSignal.set(changes['options'].currentValue || []);
    }
    if (changes['value']) {
      this.valueSignal.set(changes['value'].currentValue);
      this.updateActiveIndex();
    }
  }

  ngOnDestroy() {
    this.closePopover();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Node;
    const isInsideTrigger = this.elementRef.nativeElement.contains(target);
    const isInsidePopover = this.popoverEl?.nativeElement?.contains(target);
    if (!isInsideTrigger && !isInsidePopover) {
      this.closePopover();
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (this.isOpen()) {
      this.closePopover();
    }
  }

  private onScrollCapture = (event: Event) => {
    if (this.isOpen()) {
      if (this.optionsListEl?.nativeElement && this.optionsListEl.nativeElement.contains(event.target as Node)) {
        return;
      }
      this.closePopover();
    }
  };

  toggleOpen(event?: Event) {
    if (event) event.stopPropagation();
    if (this.disabled) return;

    if (!this.isOpen()) {
      this.openPopover();
    } else {
      this.closePopover();
    }
  }

  openPopover() {
    this.updateRect();
    this.searchQuery.set('');
    this.isOpen.set(true);
    this.updateActiveIndex();

    document.addEventListener('scroll', this.onScrollCapture, true);

    setTimeout(() => {
      if (this.popoverEl?.nativeElement) {
        document.body.appendChild(this.popoverEl.nativeElement);
      }
      if (this.searchInputEl) {
        this.searchInputEl.nativeElement.focus();
      }
    }, 0);
  }

  closePopover() {
    document.removeEventListener('scroll', this.onScrollCapture, true);
    if (this.popoverEl?.nativeElement && this.popoverEl.nativeElement.parentNode === document.body) {
      this.popoverEl.nativeElement.remove();
    }
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.activeIndex.set(-1);
  }

  selectOption(opt: SelectOption) {
    if (opt.disabled) return;
    this.valueSignal.set(opt.value);
    this.valueChange.emit(opt.value);
    this.selectionChange.emit(opt);
    this.closePopover();
  }

  clearSelection(event?: Event) {
    if (event) event.stopPropagation();
    this.valueSignal.set(null);
    this.valueChange.emit(null);
    this.closePopover();
  }

  isKeyboardNav = false;

  onOptionMouseEnter(i: number) {
    if (!this.isKeyboardNav) {
      this.activeIndex.set(i);
    }
  }

  onSearchChange(query: string) {
    this.searchQuery.set(query);
    this.activeIndex.set(0);
  }

  onTriggerKeydown(event: KeyboardEvent) {
    if (this.disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.isOpen()) {
        this.openPopover();
      }
    }
  }

  onPopoverKeydown(event: KeyboardEvent) {
    this.handleKeyNavigation(event);
  }

  private handleKeyNavigation(event: KeyboardEvent) {
    const opts = this.filteredOptions();
    if (opts.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      this.isKeyboardNav = true;
      const next = (this.activeIndex() + 1) % opts.length;
      this.activeIndex.set(next);
      this.scrollToFocusedOption();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      this.isKeyboardNav = true;
      const prev = (this.activeIndex() - 1 + opts.length) % opts.length;
      this.activeIndex.set(prev);
      this.scrollToFocusedOption();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const idx = this.activeIndex();
      if (idx >= 0 && idx < opts.length) {
        this.selectOption(opts[idx]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closePopover();
      if (this.triggerEl) {
        this.triggerEl.nativeElement.focus();
      }
    }
  }

  private scrollToFocusedOption() {
    setTimeout(() => {
      if (!this.optionsListEl) return;
      const focusedEl = this.optionsListEl.nativeElement.querySelector('.option-item.is-focused') as HTMLElement;
      if (focusedEl) {
        focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 10);
  }

  private updateActiveIndex() {
    const list = this.filteredOptions();
    const idx = list.findIndex(opt => opt.value === this.valueSignal());
    this.activeIndex.set(idx >= 0 ? idx : 0);
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
}

