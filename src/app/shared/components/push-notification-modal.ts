import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PushNotificationService } from '../../core/services/push-notification.service';

@Component({
  selector: 'app-push-notification-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="push-modal-card paper-panel font-mono" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-left">
            <i class="fi fi-rr-bell-ring text-amber header-icon"></i>
            <div>
              <h3 class="modal-title">Push Notification Center</h3>
              <span class="modal-subtitle">Manage PWA Web Push alerts, task reminders & triggers</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-xs close-btn" (click)="close.emit()" title="Close Modal">
            <span class="key-badge">ESC</span>
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body">
          <!-- Permission Status Banner -->
          <div class="status-box" [ngClass]="{
            'status-granted': pushService.permissionStatus() === 'granted',
            'status-denied': pushService.permissionStatus() === 'denied',
            'status-default': pushService.permissionStatus() === 'default',
            'status-unsupported': pushService.permissionStatus() === 'unsupported'
          }">
            <div class="status-left">
              @if (pushService.permissionStatus() === 'granted') {
                <i class="fi fi-rr-check-circle icon-lg text-emerald"></i>
                <div>
                  <strong>Browser Permission Granted</strong>
                  <p class="status-desc">Web Push notifications are allowed in this browser.</p>
                </div>
              } @else if (pushService.permissionStatus() === 'denied') {
                <i class="fi fi-rr-cross-circle icon-lg text-rose"></i>
                <div>
                  <strong>Browser Permission Blocked</strong>
                  <p class="status-desc">Notifications are blocked in your browser site settings.</p>
                </div>
              } @else if (pushService.permissionStatus() === 'default') {
                <i class="fi fi-rr-info icon-lg text-amber"></i>
                <div>
                  <strong>Permission Action Required</strong>
                  <p class="status-desc">Click Enable Push Notifications to grant browser permission.</p>
                </div>
              } @else {
                <i class="fi fi-rr-ban icon-lg text-muted"></i>
                <div>
                  <strong>Unsupported Browser</strong>
                  <p class="status-desc">Desktop Push Notifications API is not supported here.</p>
                </div>
              }
            </div>

            <div class="status-action">
              @if (pushService.permissionStatus() === 'default') {
                <button class="btn btn-primary btn-sm" (click)="pushService.requestPermission()">
                  <i class="fi fi-rr-bell-ring"></i> Grant Permission
                </button>
              } @else if (pushService.permissionStatus() === 'granted') {
                <button class="btn btn-secondary btn-sm" (click)="pushService.sendTestNotification()">
                  <i class="fi fi-rr-paper-plane"></i> Send Test Notification
                </button>
              }
            </div>
          </div>

          <!-- Notification Toggles & Controls -->
          <div class="settings-section">
            <div class="section-title">
              <i class="fi fi-rr-settings text-cyan"></i>
              <span>ALERT PREFERENCES</span>
            </div>

            <div class="toggle-list">
              <!-- Master Push Toggle -->
              <div class="toggle-item master-toggle" [class.item-disabled]="!pushService.isSupported()">
                <div class="toggle-info">
                  <span class="toggle-title">
                    <i class="fi fi-rr-signal-alt text-amber"></i> Master Push Notification Switch
                  </span>
                  <span class="toggle-desc">Enable or pause all Web Push alerts from Bilo PWA</span>
                </div>
                <button
                  class="toggle-switch-btn"
                  [class.active]="pushService.isSupported() && pushService.notificationsEnabled()"
                  [disabled]="!pushService.isSupported()"
                  (click)="pushService.toggleNotifications()"
                  [title]="!pushService.isSupported() ? 'Push notifications not supported in this browser' : ''"
                >
                  <span class="switch-handle font-mono">
                    {{ !pushService.isSupported() ? 'N/A' : pushService.notificationsEnabled() ? 'ON' : 'OFF' }}
                  </span>
                </button>
              </div>

              <!-- Trigger 1: Task Creation -->
              <div class="toggle-item" [class.item-disabled]="!pushService.isSupported()">
                <div class="toggle-info">
                  <span class="toggle-title">
                    <i class="fi fi-rr-add text-emerald"></i> New Task Creation Alerts
                  </span>
                  <span class="toggle-desc">Receive notification whenever a new task is created</span>
                </div>
                <button
                  class="toggle-checkbox"
                  [class.checked]="pushService.isSupported() && pushService.notifyOnTaskCreate()"
                  [disabled]="!pushService.isSupported()"
                  (click)="pushService.toggleSetting('create')"
                  [title]="!pushService.isSupported() ? 'Push notifications not supported in this browser' : ''"
                >
                  <i [class]="pushService.isSupported() && pushService.notifyOnTaskCreate() ? 'fi fi-rr-check' : ''"></i>
                </button>
              </div>

              <!-- Trigger 2: Task Status Change -->
              <div class="toggle-item" [class.item-disabled]="!pushService.isSupported()">
                <div class="toggle-info">
                  <span class="toggle-title">
                    <i class="fi fi-rr-refresh text-cyan"></i> Task Status Change Alerts
                  </span>
                  <span class="toggle-desc">Receive notification when any task's status changes</span>
                </div>
                <button
                  class="toggle-checkbox"
                  [class.checked]="pushService.isSupported() && pushService.notifyOnStatusChange()"
                  [disabled]="!pushService.isSupported()"
                  (click)="pushService.toggleSetting('status_change')"
                  [title]="!pushService.isSupported() ? 'Push notifications not supported in this browser' : ''"
                >
                  <i [class]="pushService.isSupported() && pushService.notifyOnStatusChange() ? 'fi fi-rr-check' : ''"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Notification History Logs -->
          <div class="logs-section">
            <div class="logs-header">
              <div class="section-title">
                <i class="fi fi-rr-list text-purple"></i>
                <span>RECENT NOTIFICATION DISPATCH LOG</span>
                <span class="badge-mono">{{ pushService.notificationHistory().length }} ENTRIES</span>
              </div>

              @if (pushService.notificationHistory().length > 0) {
                <button class="btn btn-ghost btn-xs" (click)="pushService.clearHistory()">
                  <i class="fi fi-rr-trash"></i> Clear Log
                </button>
              }
            </div>

            @if (pushService.notificationHistory().length === 0) {
              <div class="empty-log-box font-mono">
                <i class="fi fi-rr-bell-slash text-muted empty-icon"></i>
                <p>No push notifications dispatched in this session yet.</p>
                <button class="btn btn-secondary btn-xs" (click)="pushService.sendTestNotification()">
                  <i class="fi fi-rr-paper-plane"></i> Send Test Notification
                </button>
              </div>
            } @else {
              <div class="log-list">
                @for (log of pushService.notificationHistory(); track log.id) {
                  <div class="log-item">
                    <div class="log-type-icon" [ngClass]="{
                      'type-test': log.type === 'test',
                      'type-reminder': log.type === 'reminder',
                      'type-created': log.type === 'created',
                      'type-status_change': log.type === 'status_change',
                      'type-system': log.type === 'system'
                    }">
                      @switch (log.type) {
                        @case ('test') { <i class="fi fi-rr-paper-plane"></i> }
                        @case ('created') { <i class="fi fi-rr-plus"></i> }
                        @case ('status_change') { <i class="fi fi-rr-refresh"></i> }
                        @default { <i class="fi fi-rr-bell"></i> }
                      }
                    </div>
                    <div class="log-details">
                      <div class="log-title-row">
                        <span class="log-title">{{ log.title }}</span>
                        <span class="log-time">{{ log.time }}</span>
                      </div>
                      <p class="log-body">{{ log.body }}</p>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer font-mono">
          <div class="footer-left">
            <span class="status-dot" [ngClass]="pushService.notificationsEnabled() ? 'dot-emerald' : 'dot-amber'"></span>
            <span>PUSH ALERT SERVICE: <strong>{{ pushService.notificationsEnabled() ? 'ACTIVE' : 'DISABLED' }}</strong></span>
          </div>
          <button class="btn btn-secondary btn-xs" (click)="close.emit()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .push-modal-card {
      width: 100%;
      max-width: 660px;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      box-shadow: var(--shadow-modal);
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.95rem 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .header-icon {
      font-size: 1.35rem;
    }
    .modal-title {
      font-size: 1.05rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-main);
    }
    .modal-subtitle {
      font-size: 0.725rem;
      color: var(--text-muted);
    }
    .close-btn {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .modal-body {
      padding: 1.25rem;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* Status Banner Box */
    .status-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.95rem 1.15rem;
      border-radius: var(--radius-xs);
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
      gap: 1rem;
    }
    .status-box.status-granted {
      border-color: rgba(16, 185, 129, 0.3);
      background: rgba(16, 185, 129, 0.05);
    }
    .status-box.status-denied {
      border-color: rgba(244, 63, 94, 0.3);
      background: rgba(244, 63, 94, 0.05);
    }
    .status-box.status-default {
      border-color: rgba(245, 158, 11, 0.3);
      background: rgba(245, 158, 11, 0.05);
    }
    .status-left {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .icon-lg {
      font-size: 1.6rem;
    }
    .status-desc {
      font-size: 0.725rem;
      color: var(--text-muted);
      margin: 0.15rem 0 0 0;
    }

    /* Section Headers */
    .section-title {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.04em;
    }

    /* Toggle Controls */
    .settings-section {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .toggle-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .toggle-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.65rem 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .toggle-item.master-toggle {
      border-color: var(--border-medium);
      background: var(--bg-surface);
    }
    .toggle-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .toggle-title {
      font-size: 0.825rem;
      font-weight: 700;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .toggle-desc {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    /* Master Switch Button */
    .toggle-switch-btn {
      padding: 0.25rem 0.65rem;
      background: var(--bg-surface-hover);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      cursor: pointer;
      font-size: 0.725rem;
      font-weight: 700;
      transition: var(--transition-fast);
    }
    .toggle-switch-btn.active {
      background: rgba(16, 185, 129, 0.2);
      border-color: var(--color-emerald);
      color: var(--color-emerald);
    }

    /* Checkbox Toggle Button */
    .toggle-checkbox {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-main);
    }
    .toggle-checkbox.checked {
      background: var(--text-main);
      color: var(--bg-canvas);
      border-color: var(--text-main);
    }

    /* Logs Section */
    .logs-section {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .logs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .empty-log-box {
      padding: 1.5rem;
      text-align: center;
      background: var(--bg-surface-subtle);
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-xs);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .empty-icon {
      font-size: 1.75rem;
    }

    .log-list {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      max-height: 200px;
      overflow-y: auto;
    }
    .log-item {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      padding: 0.55rem 0.75rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .log-type-icon {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      flex-shrink: 0;
      margin-top: 0.1rem;
    }
    .type-test { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .type-created { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .type-status_change { background: rgba(6, 182, 212, 0.15); color: #06b6d4; }
    .type-system { background: rgba(168, 85, 247, 0.15); color: #a855f7; }

    .log-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .log-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .log-title {
      font-size: 0.775rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .log-time {
      font-size: 0.65rem;
      color: var(--text-muted);
    }
    .log-body {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin: 0;
      font-family: var(--font-sans);
    }

    /* Footer */
    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.65rem 1.25rem;
      background: var(--bg-surface-subtle);
      border-top: 1px solid var(--border-subtle);
      font-size: 0.675rem;
      color: var(--text-muted);
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
  `]
})
export class PushNotificationModalComponent {
  @Output() close = new EventEmitter<void>();

  constructor(public pushService: PushNotificationService) {}
}
