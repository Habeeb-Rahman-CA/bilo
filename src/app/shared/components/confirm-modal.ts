import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen) {
      <div class="confirm-overlay" (click)="onCancel()" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-desc">
        <div #modalCard class="confirm-card paper-panel font-mono" (click)="$event.stopPropagation()">
          <div class="confirm-header" [class.header-danger]="type === 'danger'" [class.header-warning]="type === 'warning'">
            <div class="header-icon" aria-hidden="true">
              @switch (type) {
                @case ('danger') { <i class="fi fi-rr-trash text-rose"></i> }
                @case ('warning') { <i class="fi fi-rr-triangle-warning text-amber"></i> }
                @default { <i class="fi fi-rr-info text-cyan"></i> }
              }
            </div>
            <h3 id="confirm-modal-title" class="confirm-title">{{ title }}</h3>
            <button type="button" class="btn btn-ghost btn-xs close-btn" (click)="onCancel()" title="Close" aria-label="Close dialog">
              <i class="fi fi-rr-cross"></i>
            </button>
          </div>

          <div class="confirm-body">
            <p id="confirm-modal-desc" class="confirm-message">{{ message }}</p>

            @if (requireText) {
              <div class="confirm-input-box">
                <label class="confirm-input-label">
                  To confirm, type <strong class="text-amber">"{{ requireText }}"</strong> below:
                </label>
                <input
                  type="text"
                  class="form-input confirm-text-input font-mono"
                  [placeholder]="inputPlaceholder || ('Type ' + requireText + ' to confirm')"
                  [(ngModel)]="typedText"
                  (keydown.enter)="isConfirmDisabled() ? null : onConfirm()"
                />
              </div>
            }
          </div>

          <div class="confirm-footer">
            <button type="button" class="btn btn-secondary btn-sm" (click)="onCancel()">
              {{ cancelText }}
            </button>
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-danger]="type === 'danger'"
              [class.btn-warning]="type === 'warning'"
              [class.btn-primary]="type === 'info'"
              [disabled]="isConfirmDisabled()"
              (click)="onConfirm()"
            >
              @if (type === 'danger') {
                <i class="fi fi-rr-trash"></i>
              } @else if (type === 'warning') {
                <i class="fi fi-rr-check"></i>
              }
              <span>{{ confirmText }}</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 1rem;
      animation: fadeIn 0.15s ease-out;
    }

    .confirm-card {
      width: 100%;
      max-width: 440px;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      box-shadow: var(--shadow-modal);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .confirm-header {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.85rem 1.15rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
    }
    .header-icon {
      font-size: 1.1rem;
      display: flex;
      align-items: center;
    }
    .confirm-title {
      font-size: 0.9rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0;
      flex: 1;
      letter-spacing: 0.02em;
    }
    .close-btn {
      color: var(--text-muted);
    }

    .confirm-body {
      padding: 1.25rem 1.15rem;
    }
    .confirm-message {
      font-size: 0.825rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.5;
    }
    .confirm-input-box {
      margin-top: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .confirm-input-label {
      font-size: 0.725rem;
      color: var(--text-main);
    }
    .confirm-text-input {
      font-size: 0.8rem;
      width: 100%;
      box-sizing: border-box;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-medium);
      padding: 0.4rem 0.6rem;
      border-radius: var(--radius-xs);
      color: var(--text-main);
    }

    .confirm-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.65rem;
      padding: 0.85rem 1.15rem;
      background: var(--bg-surface-subtle);
      border-top: 1px solid var(--border-subtle);
    }

    .btn-danger {
      background: rgba(244, 63, 94, 0.15);
      color: #f43f5e;
      border: 1px solid rgba(244, 63, 94, 0.4);
    }
    .btn-danger:hover {
      background: #f43f5e;
      color: #ffffff;
    }

    .btn-warning {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }
    .btn-warning:hover {
      background: #f59e0b;
      color: #ffffff;
    }
    .btn-warning[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: auto;
    }

    .text-rose { color: #f43f5e; }
    .text-amber { color: #f59e0b; }
    .text-cyan { color: var(--accent-cyan); }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleUp {
      from { transform: scale(0.94); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `]
})
export class ConfirmModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed?';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() type: 'danger' | 'warning' | 'info' = 'warning';
  @Input() requireText?: string;
  @Input() inputPlaceholder?: string;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('modalCard') modalCard?: ElementRef<HTMLElement>;

  typedText = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.typedText = '';
      setTimeout(() => this.focusInitialElement(), 50);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.onCancel();
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  public focusInitialElement() {
    if (!this.modalCard) return;
    const focusables = this.getFocusableElements();
    if (focusables.length > 0) {
      const inputEl = this.modalCard.nativeElement.querySelector<HTMLElement>('input');
      if (inputEl) {
        inputEl.focus();
      } else {
        focusables[0].focus();
      }
    }
  }

  public getFocusableElements(): HTMLElement[] {
    if (!this.modalCard) return [];
    const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(this.modalCard.nativeElement.querySelectorAll<HTMLElement>(selector))
      .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);
  }

  public trapFocus(event: KeyboardEvent) {
    const focusables = this.getFocusableElements();
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !this.modalCard?.nativeElement.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !this.modalCard?.nativeElement.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  isConfirmDisabled(): boolean {
    if (!this.requireText) return false;
    return this.typedText.trim().toLowerCase() !== this.requireText.trim().toLowerCase();
  }

  onConfirm() {
    if (this.isConfirmDisabled()) return;
    this.confirm.emit();
    this.typedText = '';
  }

  onCancel() {
    this.cancel.emit();
    this.typedText = '';
  }
}

