import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen) {
      <div class="confirm-overlay" (click)="onCancel()">
        <div class="confirm-card paper-panel font-mono" (click)="$event.stopPropagation()">
          <div class="confirm-header" [class.header-danger]="type === 'danger'" [class.header-warning]="type === 'warning'">
            <div class="header-icon">
              @switch (type) {
                @case ('danger') { <i class="fi fi-rr-trash text-rose"></i> }
                @case ('warning') { <i class="fi fi-rr-triangle-warning text-amber"></i> }
                @default { <i class="fi fi-rr-info text-cyan"></i> }
              }
            </div>
            <h3 class="confirm-title">{{ title }}</h3>
            <button type="button" class="btn btn-ghost btn-xs close-btn" (click)="onCancel()" title="Close">
              <i class="fi fi-rr-cross"></i>
            </button>
          </div>

          <div class="confirm-body">
            <p class="confirm-message">{{ message }}</p>
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
      max-width: 420px;
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
export class ConfirmModalComponent {
  @Input() isOpen = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed?';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() type: 'danger' | 'warning' | 'info' = 'warning';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm() {
    this.confirm.emit();
  }

  onCancel() {
    this.cancel.emit();
  }
}
