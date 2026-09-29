import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Project, ProjectRole } from '../../core/models/project.model';
import { registerModal, unregisterModal, isTopModal, getModalZIndex } from '../../core/utils/modal-stack.util';

@Component({
  selector: 'app-join-workspace-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen) {
      <div class="modal-overlay" [style.z-index]="modalZIndex" (click)="onCancel()">
        <div class="modal-card join-card paper-panel font-mono" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-left">
              <i class="fi fi-rr-envelope-download text-cyan header-icon"></i>
              <div>
                <h3>Workspace Invitation</h3>
                <span class="subtext">You've been invited to join a workspace</span>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-xs" (click)="onCancel()" [disabled]="isSubmitting" title="Decline & Close">
              <i class="fi fi-rr-cross"></i>
            </button>
          </div>

          <div class="modal-body">
            @if (validationError) {
              <div class="join-alert font-mono error">
                <i class="fi fi-rr-shield-exclamation text-rose"></i>
                <span>{{ validationError }}</span>
              </div>
            }

            @if (project) {
              <div class="workspace-preview-box">
                <div class="avatar-large" [style.border-color]="project.color || 'var(--accent-cyan)'">
                  @if (project.image_url) {
                    <img [src]="project.image_url" alt="Workspace Avatar" class="avatar-img" />
                  } @else {
                    <i [class]="project.icon || 'fi fi-rr-folder'" [style.color]="project.color || 'var(--accent-cyan)'"></i>
                  }
                </div>

                <div class="workspace-details">
                  <div class="title-row">
                    <h2 class="workspace-name">{{ project.name }}</h2>
                    <span class="badge-mono role-tag">Role: {{ role | uppercase }}</span>
                  </div>

                  @if (project.description) {
                    <p class="workspace-desc">{{ project.description }}</p>
                  }

                  <div class="meta-row">
                    <span class="meta-item">
                      <i class="fi fi-rr-key text-muted"></i> Key: <strong>{{ project.slug || project.name.slice(0,3) | uppercase }}</strong>
                    </span>
                    <span class="meta-item">
                      <span class="status-dot dot-emerald"></span> Status: {{ project.status || 'Active' }}
                    </span>
                  </div>
                </div>
              </div>
            } @else {
              <div class="loading-box">
                <i class="fi fi-rr-spinner spinner"></i>
                <span>Loading workspace details...</span>
              </div>
            }
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" (click)="onCancel()" [disabled]="isSubmitting">
              Decline
            </button>
            <button type="button" class="btn btn-primary btn-sm" [disabled]="!project || !!validationError || isSubmitting" (click)="onJoin()">
              @if (isSubmitting) {
                <i class="fi fi-rr-spinner spinner"></i> Joining...
              } @else {
                <i class="fi fi-rr-check"></i> Accept & Join Workspace
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .join-card {
      width: 100%;
      max-width: 480px;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      box-shadow: var(--shadow-modal);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.15rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .header-icon {
      font-size: 1.25rem;
    }
    .header-left h3 {
      font-size: 0.95rem;
      font-weight: 800;
      margin: 0;
    }
    .subtext {
      font-size: 0.725rem;
      color: var(--text-muted);
    }

    .modal-body {
      padding: 1.25rem 1.15rem;
    }

    .join-alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 0.85rem;
      border-radius: var(--radius-xs);
      font-size: 0.775rem;
      margin-bottom: 0.85rem;
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fb7185;
    }

    .workspace-preview-box {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 1rem;
    }

    .avatar-large {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-xs);
      border: 2px solid var(--accent-cyan);
      background: var(--bg-surface);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      flex-shrink: 0;
      overflow: hidden;
    }
    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .workspace-details {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      flex: 1;
    }

    .title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .workspace-name {
      font-size: 1.05rem;
      font-weight: 800;
      margin: 0;
      color: var(--text-main);
    }
    .role-tag {
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-cyan);
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 0.65rem;
    }

    .workspace-desc {
      font-size: 0.775rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.4;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.725rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .loading-box {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      padding: 2rem;
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    .spinner {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.65rem;
      padding: 0.85rem 1.15rem;
      background: var(--bg-surface-subtle);
      border-top: 1px solid var(--border-subtle);
    }

    @keyframes scaleUp {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `]
})
export class JoinWorkspaceModalComponent implements OnChanges, OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() project: Project | null = null;
  @Input() role: ProjectRole = 'member';
  @Input() validationError: string | null = null;

  @Output() join = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly modalId = 'join-workspace-modal-' + Math.random().toString(36).substring(2, 9);

  get modalZIndex(): number {
    return getModalZIndex(this.modalId);
  }

  isSubmitting = false;

  ngOnInit() {
    registerModal(this.modalId);
  }

  ngOnDestroy() {
    unregisterModal(this.modalId);
  }

  constructor(private elementRef: ElementRef) {}

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.isOpen && isTopModal(this.modalId)) {
      e.preventDefault();
      this.onCancel();
      return;
    }

    if (e.key === 'Tab' && this.isOpen && isTopModal(this.modalId)) {
      this.trapFocus(e);
    }
  }

  private trapFocus(e: KeyboardEvent) {
    const container = this.elementRef?.nativeElement;
    if (!container) return;

    const focusables = (Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[]).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);

    if (focusables.length === 0) return;

    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];
    const activeEl = document.activeElement;

    if (e.shiftKey) {
      if (activeEl === firstEl || !container.contains(activeEl)) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (activeEl === lastEl || !container.contains(activeEl)) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen']) {
      this.isSubmitting = false;
    }
  }

  onJoin() {
    if (this.isSubmitting || !this.project || !!this.validationError) return;
    this.isSubmitting = true;
    this.join.emit();
  }

  onCancel() {
    if (this.isSubmitting) return;
    this.cancel.emit();
  }
}

