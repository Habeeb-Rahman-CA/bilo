import { Component, EventEmitter, Input, Output, ElementRef, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export const DEFAULT_PRESET_COLORS = [
  '#64748b', // Slate
  '#3b82f6', // Blue
  '#eab308', // Yellow
  '#a855f7', // Purple
  '#22c55e', // Green
  '#ef4444', // Red
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#8b5cf6'  // Violet
];

@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="color-picker-container" [attr.title]="title">
      <!-- Trigger Button -->
      <button
        type="button"
        class="color-trigger-btn"
        [style.background-color]="color || '#3b82f6'"
        (click)="togglePopover($event)"
        aria-label="Select Color"
      >
        <span class="trigger-indicator"></span>
      </button>

      <!-- Popover Menu -->
      @if (isOpen()) {
        <div class="color-popover paper-panel">
          <div class="popover-header">
            <span class="popover-title font-mono">Select Color</span>
            <button type="button" class="close-btn" (click)="closePopover()">
              <i class="fi fi-rr-cross-small"></i>
            </button>
          </div>

          <!-- Preset Swatches Grid -->
          <div class="swatch-grid">
            @for (preset of presetColors; track preset) {
              <button
                type="button"
                class="swatch-btn"
                [style.background-color]="preset"
                [class.active]="isSameColor(color, preset)"
                (click)="selectColor(preset)"
                [attr.aria-label]="preset"
              >
                @if (isSameColor(color, preset)) {
                  <i class="fi fi-rr-check check-icon"></i>
                }
              </button>
            }
          </div>

          <!-- Custom Hex Input & Native Picker Fallback -->
          <div class="custom-color-row">
            <div class="hex-input-wrap">
              <span class="hex-hash font-mono">#</span>
              <input
                type="text"
                class="form-input hex-input font-mono"
                [ngModel]="hexValue"
                (ngModelChange)="onHexInputChange($event)"
                placeholder="3b82f6"
                maxLength="6"
              />
            </div>

            <!-- Native fallback trigger -->
            <label class="native-color-label" title="Custom OS Color Wheel">
              <input
                type="color"
                class="native-color-input"
                [ngModel]="color"
                (ngModelChange)="selectColor($event)"
              />
              <i class="fi fi-rr-palette palette-icon"></i>
            </label>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .color-picker-container {
      position: relative;
      display: inline-block;
    }

    .color-trigger-btn {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 2px solid var(--border-subtle, #334155);
      cursor: pointer;
      padding: 0;
      transition: transform 0.15s ease, border-color 0.15s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        transform: scale(1.08);
        border-color: var(--text-muted, #94a3b8);
      }

      &:focus-visible {
        outline: 2px solid var(--accent-primary, #3b82f6);
        outline-offset: 2px;
      }
    }

    .color-popover {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 1000;
      width: 220px;
      padding: 0.75rem;
      background: var(--bg-surface, #1e293b);
      border: 1px solid var(--border-subtle, #334155);
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
    }

    .popover-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--border-subtle, #334155);
    }

    .popover-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted, #94a3b8);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--text-subtle, #64748b);
      cursor: pointer;
      padding: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;

      &:hover {
        color: var(--text-main, #f8fafc);
        background: rgba(255, 255, 255, 0.1);
      }
    }

    .swatch-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .swatch-btn {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 6px;
      border: 2px solid transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: transform 0.12s ease, border-color 0.12s ease;
      min-height: 32px;

      &:hover {
        transform: scale(1.1);
      }

      &.active {
        border-color: #ffffff;
        box-shadow: 0 0 0 2px var(--accent-primary, #3b82f6);
      }
    }

    .check-icon {
      color: #ffffff;
      font-size: 0.85rem;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }

    .custom-color-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .hex-input-wrap {
      display: flex;
      align-items: center;
      flex: 1;
      background: var(--bg-surface-elevated, #0f172a);
      border: 1px solid var(--border-subtle, #334155);
      border-radius: 6px;
      padding: 0 0.5rem;

      &:focus-within {
        border-color: var(--accent-primary, #3b82f6);
      }
    }

    .hex-hash {
      color: var(--text-subtle, #64748b);
      font-size: 0.85rem;
      margin-right: 2px;
    }

    .hex-input {
      border: none;
      background: transparent;
      padding: 0.3rem 0;
      font-size: 0.825rem;
      color: var(--text-main, #f8fafc);
      width: 100%;
      outline: none;

      &::placeholder {
        color: var(--text-subtle, #64748b);
      }
    }

    .native-color-label {
      position: relative;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: var(--bg-surface-elevated, #0f172a);
      border: 1px solid var(--border-subtle, #334155);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-muted, #94a3b8);
      transition: color 0.15s ease, border-color 0.15s ease;

      &:hover {
        color: var(--text-main, #f8fafc);
        border-color: var(--text-muted, #94a3b8);
      }
    }

    .native-color-input {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      cursor: pointer;
    }

    .palette-icon {
      font-size: 0.9rem;
      pointer-events: none;
    }
  `]
})
export class ColorPickerComponent {
  @Input() color: string = '#3b82f6';
  @Input() title: string = 'Select Color';
  @Input() presetColors: string[] = DEFAULT_PRESET_COLORS;
  @Output() colorChange = new EventEmitter<string>();

  isOpen = signal<boolean>(false);

  constructor(private elementRef: ElementRef) {}

  get hexValue(): string {
    if (!this.color) return '';
    return this.color.replace(/^#/, '');
  }

  togglePopover(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  closePopover() {
    this.isOpen.set(false);
  }

  selectColor(newColor: string) {
    if (!newColor) return;
    const formatted = newColor.startsWith('#') ? newColor : `#${newColor}`;
    this.color = formatted;
    this.colorChange.emit(this.color);
  }

  onHexInputChange(val: string) {
    const clean = val.replace(/[^0-9a-fA-F]/g, '');
    if (clean.length === 3 || clean.length === 6) {
      this.selectColor(`#${clean}`);
    }
  }

  isSameColor(c1: string, c2: string): boolean {
    if (!c1 || !c2) return false;
    return c1.toLowerCase().trim() === c2.toLowerCase().trim();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.closePopover();
    }
  }
}
