import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../core/services/project.service';
import { WorkflowService } from '../../core/services/workflow.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { TaskService } from '../../core/services/task.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { Project, Workflow } from '../../core/models/project.model';
import { ProjectAccessModalComponent } from '../../shared/components/project-access-modal';
import { ProjectModalComponent } from '../../shared/components/project-modal';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal';

export type SettingsSection = 'overview' | 'workflow' | 'notifications';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ProjectAccessModalComponent, ProjectModalComponent, ConfirmModalComponent],
  template: `
    <div class="settings-workspace font-mono">
      <!-- Top Banner Bar -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-left">
          @if (activeSection() !== 'overview') {
            <button
              type="button"
              class="btn btn-ghost btn-xs back-btn font-mono"
              (click)="activeSection.set('overview')"
              title="Back to Settings Overview"
            >
              <i class="fi fi-rr-arrow-left"></i> Back to Settings
            </button>
            <span class="header-sep">/</span>
          }
          <span class="badge-mono">06 SETTINGS</span>
          <h2 class="view-header-title">
            @switch (activeSection()) {
              @case ('workflow') { Status Workflow Configuration }
              @case ('notifications') { Push Notification Settings }
              @default { Workspace Settings }
            }
          </h2>
          @if (activeProject(); as proj) {
            <span class="badge-mono text-cyan">
              <i [class]="proj.icon || 'fi fi-rr-folder'"></i> {{ proj.name }}
            </span>
          }
        </div>
      </div>

      <div class="settings-content">
        @switch (activeSection()) {

          <!-- SECTION 1: OVERVIEW & CARDS GRID -->
          @case ('overview') {
            @if (activeProject(); as proj) {
              <!-- Workspace Details Card -->
              <div class="settings-card paper-panel">
                <div class="card-header">
                  <div class="header-title">
                    <div class="proj-avatar-box" [style.border-color]="proj.color || '#06b6d4'">
                      @if (proj.image_url) {
                        <img [src]="proj.image_url" alt="Workspace Logo" class="proj-avatar-img" />
                      } @else {
                        <i [class]="proj.icon || 'fi fi-rr-folder'" [style.color]="proj.color || '#06b6d4'"></i>
                      }
                    </div>
                    <div>
                      <div class="title-with-badge">
                        <h3>{{ proj.name }}</h3>
                        <span class="badge-mono" [ngClass]="{
                          'badge-emerald': proj.status === 'active',
                          'badge-amber': proj.status === 'archived',
                          'badge-cyan': proj.status === 'completed'
                        }">
                          {{ (proj.status || 'active').toUpperCase() }}
                        </span>
                      </div>
                      <span class="sub-key-text">KEY: {{ proj.slug || proj.name.slice(0, 3).toUpperCase() }} • ID: {{ proj.id }}</span>
                    </div>
                  </div>
                  <div class="header-actions">
                    <button class="btn btn-secondary btn-xs" (click)="editProjectModalOpen.set(true)">
                      <i class="fi fi-rr-edit"></i> Edit Details
                    </button>
                    <button class="btn btn-secondary btn-xs" (click)="accessModalOpen.set(true)">
                      <i class="fi fi-rr-users-alt"></i> Members & Access
                    </button>
                  </div>
                </div>

                <!-- Workspace Quick Metrics Strip -->
                <div class="metrics-strip">
                  <div class="metric-item">
                    <span class="metric-num">{{ getWorkspaceTaskCount(proj.id) }}</span>
                    <span class="metric-label">Total Tasks</span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-num text-emerald">{{ getWorkspaceCompletedTaskCount(proj.id) }}</span>
                    <span class="metric-label">Completed</span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-num text-cyan">{{ columns.length }}</span>
                    <span class="metric-label">Status Columns</span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-num text-amber">{{ getWorkspaceMemberCount(proj.id) }}</span>
                    <span class="metric-label">Members</span>
                  </div>
                </div>

                <!-- Detailed Information Grid -->
                <div class="project-info-grid">
                  <div class="info-group">
                    <label class="info-label">WORKSPACE SLUG / KEY</label>
                    <div class="info-value">
                      <span class="badge-mono">{{ proj.slug || proj.name.slice(0, 3).toUpperCase() }}</span>
                    </div>
                  </div>

                  <div class="info-group">
                    <label class="info-label">COLOR ACCENT</label>
                    <div class="info-value">
                      <span class="color-swatch-pill" [style.background-color]="proj.color || '#06b6d4'"></span>
                      <span>{{ proj.color || '#06b6d4' }}</span>
                    </div>
                  </div>


                  <div class="info-group">
                    <label class="info-label">CREATED DATE</label>
                    <div class="info-value">
                      <i class="fi fi-rr-calendar text-muted"></i>
                      <span>{{ formatDate(proj.created_at) }}</span>
                    </div>
                  </div>

                  <div class="info-group full-width">
                    <label class="info-label">TAGS / TECH STACK</label>
                    <div class="info-labels-row">
                      @if (proj.labels && proj.labels.length > 0) {
                        @for (lbl of proj.labels; track lbl) {
                          <span class="tag-pill font-mono">#{{ lbl }}</span>
                        }
                      } @else {
                        <span class="text-muted font-mono">No tech stack labels assigned</span>
                      }
                    </div>
                  </div>

                  <div class="info-group full-width">
                    <label class="info-label">DESCRIPTION / SUMMARY</label>
                    <p class="info-desc">{{ proj.description || 'No description configured for this workspace.' }}</p>
                  </div>
                </div>
              </div>

              <!-- Settings Categories Cards Grid -->
              <div class="settings-cards-grid">
                <!-- Card 1: Workflow Configuration -->
                <div class="setting-nav-card paper-panel" (click)="activeSection.set('workflow')">
                  <div class="nav-card-header">
                    <div class="nav-card-icon text-cyan">
                      <i class="fi fi-rr-layout-fluid"></i>
                    </div>
                    <div class="nav-card-info">
                      <h4 class="nav-card-title">
                        <span>Status Workflow</span>
                        <span class="badge-mono text-cyan">{{ columns.length }} COLUMNS</span>
                      </h4>
                      <p class="nav-card-desc">
                        Configure Kanban board columns, status names, and custom colors per workspace.
                      </p>
                    </div>
                  </div>
                  <div class="nav-card-footer">
                    <span class="footer-hint">Customize Kanban & Backlog statuses</span>
                    <button type="button" class="btn btn-secondary btn-xs">
                      Configure <i class="fi fi-rr-angle-small-right"></i>
                    </button>
                  </div>
                </div>

                <!-- Card 2: Push Notifications -->
                <div class="setting-nav-card paper-panel" (click)="activeSection.set('notifications')">
                  <div class="nav-card-header">
                    <div class="nav-card-icon text-amber">
                      <i class="fi fi-rr-bell-ring"></i>
                    </div>
                    <div class="nav-card-info">
                      <h4 class="nav-card-title">
                        <span>Push Notifications</span>
                        <span class="badge-mono" [ngClass]="pushService.notificationsEnabled() ? 'badge-emerald' : 'badge-amber'">
                          {{ pushService.notificationsEnabled() ? 'ACTIVE' : 'PAUSED' }}
                        </span>
                      </h4>
                      <p class="nav-card-desc">
                        Manage PWA web push alerts, browser permissions, triggers, and dispatch logs.
                      </p>
                    </div>
                  </div>
                  <div class="nav-card-footer">
                    <span class="footer-hint">Manage permissions & triggers</span>
                    <button type="button" class="btn btn-secondary btn-xs">
                      Manage <i class="fi fi-rr-angle-small-right"></i>
                    </button>
                  </div>
                </div>
              </div>
            } @else {
              <div class="empty-state paper-panel font-mono">
                <i class="fi fi-rr-folder-open empty-icon"></i>
                <h3>No Active Workspace Selected</h3>
                <p>Please select a workspace project from the workspace switcher in the top bar.</p>
              </div>
            }
          }

          <!-- SECTION 2: WORKFLOW CONFIGURATION PAGE -->
          @case ('workflow') {
            @if (activeProject(); as proj) {
              <div class="settings-card paper-panel">
                <div class="card-header">
                  <div class="header-title">
                    <i class="fi fi-rr-layout-fluid text-cyan"></i>
                    <h3>Status Workflow Configuration</h3>
                  </div>
                  <div class="header-actions">
                    <button
                      type="button"
                      class="btn btn-secondary btn-xs"
                      (click)="applySequentialPreset(proj.id)"
                      title="Set strict sequential pipeline (Start -> To Do -> In Progress -> In Review -> Done)"
                    >
                      <i class="fi fi-rr-diagram-project text-cyan"></i> Sequential Pipeline
                    </button>
                    <button
                      type="button"
                      class="btn btn-secondary btn-xs"
                      (click)="applyAllowAllPreset(proj.id)"
                      title="Allow transitions between all status columns"
                    >
                      <i class="fi fi-rr-globe text-emerald"></i> Allow All
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-rose"
                      (click)="resetToDefaults(proj.id)"
                      title="Reset status columns to default backlog workflow"
                    >
                      <i class="fi fi-rr-refresh"></i> Reset Defaults
                    </button>
                  </div>
                </div>

                <p class="section-subtext">
                  Configure status columns and Jira-style allowed transition rules for <strong>{{ proj.name }}</strong>.
                </p>

                <div class="rules-section-wrapper">
                  <div class="columns-list">
                    @if (columns.length === 0) {
                        <div class="empty-list">
                          <i class="fi fi-rr-info empty-icon"></i>
                          <p>No workflow status columns defined. Add your first status column below!</p>
                        </div>
                      } @else {
                        @for (col of columns; track col.id; let i = $index) {
                          @let isAllowAll = col.allow_all_transitions !== false;

                          <div class="column-item-card paper-panel font-mono">
                            <div class="column-item-top">
                              <span class="drag-handle"><i class="fi fi-rr-menu-dots-vertical"></i></span>

                              <input
                                type="color"
                                class="color-picker-inline"
                                [(ngModel)]="col.color"
                                title="Column accent color"
                              />

                              <input
                                type="text"
                                class="form-input col-name-input"
                                [(ngModel)]="col.name"
                                placeholder="Status Column Name (e.g. In Review, Testing)"
                              />

                              <div class="col-actions">
                                @if (i > 0) {
                                  <button type="button" class="btn btn-ghost btn-xs btn-icon" (click)="moveColumn(i, -1)" title="Move left / up">
                                    <i class="fi fi-rr-angle-left"></i>
                                  </button>
                                }
                                @if (i < columns.length - 1) {
                                  <button type="button" class="btn btn-ghost btn-xs btn-icon" (click)="moveColumn(i, 1)" title="Move right / down">
                                    <i class="fi fi-rr-angle-right"></i>
                                  </button>
                                }
                                <button type="button" class="btn btn-ghost btn-xs btn-icon btn-danger" (click)="removeColumn(col, i)" title="Delete status column">
                                  <i class="fi fi-rr-trash"></i>
                                </button>
                              </div>
                            </div>

                            <!-- Jira Transition Rules Configuration Row -->
                            <div class="transition-rules-config">
                              <div class="rule-toggle-line">
                                <label class="checkbox-label">
                                  <input
                                    type="checkbox"
                                    [checked]="isAllowAll"
                                    (change)="toggleAllowAllForColumn(col, $event)"
                                  />
                                  <span>Allow transitions from <strong>ANY</strong> status</span>
                                </label>
                              </div>

                              @if (!isAllowAll) {
                                <div class="allowed-from-picker">
                                  <span class="picker-label">Allowed Predecessors (Incoming Statuses):</span>
                                  <div class="predecessor-chips">
                                    @for (pred of columns; track pred.id) {
                                      @if (pred.id !== col.id) {
                                        @let isChecked = (col.allowed_transitions || []).includes(pred.id);
                                        <button
                                          type="button"
                                          class="pred-toggle-chip"
                                          [class.chip-active]="isChecked"
                                          (click)="togglePredecessor(col, pred.id)"
                                        >
                                          <span class="dot" [style.background-color]="pred.color"></span>
                                          {{ pred.name }}
                                          @if (isChecked) { <i class="fi fi-rr-check"></i> }
                                        </button>
                                      }
                                    }
                                  </div>
                                </div>
                              }
                            </div>
                          </div>
                        }
                      }
                    </div>

                    <!-- Add Column Row -->
                    <div class="add-col-row">
                      <input
                        type="text"
                        class="form-input new-col-input"
                        placeholder="New status column name (e.g. QA Review, Deployment)..."
                        [(ngModel)]="newColumnName"
                        (keyup.enter)="addNewWorkflowColumn(proj.id)"
                      />
                    </div>
                  </div>

                <div class="card-footer">
                  @if (savedToast()) {
                    <span class="save-toast-msg text-emerald font-mono">
                      <i class="fi fi-rr-check-circle"></i> Workflow transition rules saved successfully!
                    </span>
                  } @else {
                    <span>&nbsp;</span>
                  }

                  <button type="button" class="btn btn-primary btn-sm font-mono" (click)="saveWorkflowChanges(proj.id)">
                    <i class="fi fi-rr-check"></i> Save Workflow Rules
                  </button>
                </div>
              </div>
            }
          }

          <!-- SECTION 3: PUSH NOTIFICATIONS PAGE -->
          @case ('notifications') {
            <div class="settings-card paper-panel">
              <div class="card-header">
                <div class="header-title">
                  <i class="fi fi-rr-bell-ring text-amber"></i>
                  <h3>Push Notification Settings</h3>
                </div>
              </div>

              <p class="section-subtext">
                Manage Web Push notification alerts, browser permissions, and real-time event triggers.
              </p>

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
                      <p class="status-desc">Click Grant Permission to enable Web Push alerts.</p>
                    </div>
                  } @else {
                    <i class="fi fi-rr-ban icon-lg text-muted"></i>
                    <div>
                      <strong>Unsupported Browser</strong>
                      <p class="status-desc">Desktop Push Notifications API is not supported in this browser.</p>
                    </div>
                  }
                </div>

                <div class="status-action">
                  @if (pushService.permissionStatus() === 'default') {
                    <button class="btn btn-primary btn-xs" (click)="pushService.requestPermission()">
                      <i class="fi fi-rr-bell-ring"></i> Grant Permission
                    </button>
                  } @else if (pushService.permissionStatus() === 'granted') {
                    <button class="btn btn-secondary btn-xs" (click)="pushService.sendTestNotification()">
                      <i class="fi fi-rr-paper-plane"></i> Send Test Notification
                    </button>
                  }
                </div>
              </div>

              <!-- Notification Toggles & Controls -->
              <div class="toggle-list">
                <!-- Master Push Toggle -->
                <div class="toggle-item master-toggle">
                  <div class="toggle-info">
                    <span class="toggle-title">
                      <i class="fi fi-rr-signal-alt text-amber"></i> Master Push Notification Switch
                    </span>
                    <span class="toggle-desc">Enable or pause all Web Push alerts from Bilo PWA</span>
                  </div>
                  <button
                    class="btn btn-xs font-mono"
                    [class.btn-primary]="pushService.notificationsEnabled()"
                    [class.btn-secondary]="!pushService.notificationsEnabled()"
                    (click)="pushService.toggleNotifications()"
                  >
                    {{ pushService.notificationsEnabled() ? 'ENABLED' : 'DISABLED' }}
                  </button>
                </div>

                <!-- Trigger 1: Task Creation -->
                <div class="toggle-item">
                  <div class="toggle-info">
                    <span class="toggle-title">
                      <i class="fi fi-rr-add text-emerald"></i> New Task Creation Alerts
                    </span>
                    <span class="toggle-desc">Receive notification whenever a new task is created</span>
                  </div>
                  <button class="toggle-checkbox" [class.checked]="pushService.notifyOnTaskCreate()" (click)="pushService.toggleSetting('create')">
                    <i [class]="pushService.notifyOnTaskCreate() ? 'fi fi-rr-check' : ''"></i>
                  </button>
                </div>

                <!-- Trigger 2: Task Status Change -->
                <div class="toggle-item">
                  <div class="toggle-info">
                    <span class="toggle-title">
                      <i class="fi fi-rr-refresh text-cyan"></i> Task Status Change Alerts
                    </span>
                    <span class="toggle-desc">Receive notification when any task's status changes</span>
                  </div>
                  <button class="toggle-checkbox" [class.checked]="pushService.notifyOnStatusChange()" (click)="pushService.toggleSetting('status_change')">
                    <i [class]="pushService.notifyOnStatusChange() ? 'fi fi-rr-check' : ''"></i>
                  </button>
                </div>
              </div>

              <!-- Recent Dispatched Notifications Log -->
              <div class="logs-section">
                <div class="logs-header">
                  <span class="info-label">RECENT NOTIFICATION DISPATCH LOG ({{ pushService.notificationHistory().length }})</span>
                  @if (pushService.notificationHistory().length > 0) {
                    <button class="btn btn-ghost btn-xs text-rose" (click)="pushService.clearHistory()">
                      <i class="fi fi-rr-trash"></i> Clear Log
                    </button>
                  }
                </div>

                @if (pushService.notificationHistory().length === 0) {
                  <div class="empty-log-box font-mono">
                    <i class="fi fi-rr-bell-slash text-muted empty-icon"></i>
                    <p>No push notifications dispatched in this session yet.</p>
                  </div>
                } @else {
                  <div class="log-list">
                    @for (log of pushService.notificationHistory(); track log.id) {
                      <div class="log-item">
                        <div class="log-details">
                          <div class="log-title-row">
                            <span class="log-title"><i class="fi fi-rr-bell text-amber"></i> {{ log.title }}</span>
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
          }
        }
      </div>

      @if (accessModalOpen() && activeProject(); as proj) {
        <app-project-access-modal [project]="proj" (close)="accessModalOpen.set(false)" />
      }

      @if (editProjectModalOpen() && activeProject(); as proj) {
        <app-project-modal [projectToEdit]="proj" (close)="editProjectModalOpen.set(false)" />
      }

      <app-confirm-modal
        [isOpen]="resetConfirmOpen()"
        title="Reset Workflow Defaults"
        message="Are you sure you want to reset status columns and transition rules for this workspace to default?"
        confirmText="Reset Defaults"
        type="warning"
        (confirm)="executeResetToDefaults()"
        (cancel)="resetConfirmOpen.set(false)"
      />
    </div>
  `,
  styles: [`
    .settings-workspace {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      width: 100%;
    }
    .back-btn {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .header-sep {
      color: var(--text-subtle);
    }
    .settings-content {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      width: 100%;
    }
    .settings-card {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
      background: var(--bg-surface);
      width: 100%;
      box-sizing: border-box;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-subtle);
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .header-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .header-title h3 {
      font-size: 1rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-main);
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .proj-avatar-box {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-xs);
      border: 2px solid var(--accent-cyan);
      background: var(--bg-surface-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      overflow: hidden;
      flex-shrink: 0;
    }
    .proj-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .title-with-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .sub-key-text {
      font-size: 0.675rem;
      color: var(--text-muted);
    }

    /* Workspace Quick Metrics Strip */
    .metrics-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .metric-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
    }
    .metric-num {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .metric-label {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .section-subtext {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.45;
    }
    .project-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .full-width {
      grid-column: 1 / -1;
    }
    .info-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .info-label {
      font-size: 0.675rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 700;
    }
    .info-value {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-main);
    }
    .info-desc {
      font-size: 0.825rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.4;
    }
    .color-swatch-pill {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      display: inline-block;
      border: 1px solid var(--border-subtle);
    }
    .repo-link {
      color: var(--accent-cyan);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      word-break: break-all;
    }
    .repo-link:hover {
      text-decoration: underline;
    }
    .info-labels-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .tag-pill {
      font-size: 0.7rem;
      padding: 0.15rem 0.45rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-muted);
    }

    /* Cards Navigation Grid */
    .settings-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.25rem;
      width: 100%;
    }
    .setting-nav-card {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1.25rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .setting-nav-card:hover {
      background: var(--bg-surface-hover);
      border-color: var(--border-medium);
      transform: translateY(-2px);
    }
    .nav-card-header {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
    }
    .nav-card-icon {
      font-size: 1.5rem;
      padding: 0.65rem;
      border-radius: var(--radius-xs);
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .nav-card-info {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .nav-card-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-main);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .nav-card-desc {
      font-size: 0.775rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.45;
    }
    .nav-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-subtle);
    }
    .footer-hint {
      font-size: 0.725rem;
      color: var(--text-muted);
    }

    .columns-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      overflow-y: auto;
    }
    .empty-list {
      padding: 1.5rem;
      text-align: center;
      color: var(--text-subtle);
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-xs);
      font-size: 0.825rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    .column-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background: var(--bg-surface-subtle);
      padding: 0.45rem 0.65rem;
      border-radius: var(--radius-xs);
      border: 1px solid var(--border-subtle);
    }
    .drag-handle {
      color: var(--text-subtle);
      font-size: 0.8rem;
    }
    .color-picker-inline {
      width: 26px;
      height: 26px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 0;
    }
    .col-name-input {
      flex: 1;
      padding: 0.35rem 0.6rem;
      font-size: 0.825rem;
    }
    .col-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .btn-danger {
      color: var(--accent-rose);
    }
    .add-col-row {
      display: flex;
      gap: 0.65rem;
    }
    .new-col-input {
      flex: 1;
      font-size: 0.825rem;
    }
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-subtle);
    }
    .save-toast-msg {
      font-size: 0.8rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    /* Notification Settings Styles */
    .status-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 1rem;
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
      gap: 0.75rem;
    }
    .icon-lg {
      font-size: 1.4rem;
    }
    .status-desc {
      font-size: 0.725rem;
      color: var(--text-muted);
      margin: 0.15rem 0 0 0;
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
    .toggle-checkbox {
      width: 22px;
      height: 22px;
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
    .logs-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .logs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .empty-log-box {
      padding: 1.25rem;
      text-align: center;
      background: var(--bg-surface-subtle);
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-xs);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      color: var(--text-muted);
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
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .log-time {
      font-size: 0.65rem;
      color: var(--text-muted);
    }
    .log-body {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin: 0;
    }

    .empty-state {
      padding: 3rem 1.5rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }
    .empty-icon {
      font-size: 2rem;
      color: var(--accent-cyan);
    }

    /* Workflow Diagram & Transition Rules Styles */
    .workflow-tabs-strip {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 0.65rem;
      margin-bottom: 1rem;
    }
    .wf-tab-btn {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      border-radius: var(--radius-xs);
      padding: 0.4rem 0.85rem;
      font-size: 0.775rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      transition: var(--transition-fast);
    }
    .wf-tab-btn:hover {
      color: var(--text-main);
      border-color: var(--border-medium);
    }
    .wf-tab-btn.active {
      background: var(--bg-surface);
      color: var(--accent-cyan);
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 1px rgba(6, 182, 212, 0.2);
    }

    .section-subtitle {
      font-size: 0.825rem;
      font-weight: 700;
      color: var(--text-main);
      margin: 1.25rem 0 0.85rem 0;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .column-item-card {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 0.85rem 1rem;
      margin-bottom: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .column-item-top {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .transition-rules-config {
      padding-top: 0.5rem;
      border-top: 1px dashed var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .rule-toggle-line {
      display: flex;
      align-items: center;
    }
    .checkbox-label {
      font-size: 0.75rem;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.45rem;
      cursor: pointer;
    }
    .checkbox-label input[type="checkbox"] {
      accent-color: var(--accent-cyan);
      cursor: pointer;
    }

    .allowed-from-picker {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding-left: 1.25rem;
      margin-top: 0.2rem;
    }
    .picker-label {
      font-size: 0.675rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.04em;
    }
    .predecessor-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .pred-toggle-chip {
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      color: var(--text-muted);
      border-radius: 12px;
      padding: 0.2rem 0.55rem;
      font-size: 0.7rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      transition: var(--transition-fast);
    }
    .pred-toggle-chip:hover {
      border-color: var(--text-main);
      color: var(--text-main);
    }
    .pred-toggle-chip.chip-active {
      background: rgba(6, 182, 212, 0.12);
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
    }
    .pred-toggle-chip .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
  `]
})
export class SettingsComponent {
  activeSection = signal<SettingsSection>('overview');
  activeProject = computed(() => this.projectService.activeProject());
  accessModalOpen = signal<boolean>(false);
  editProjectModalOpen = signal<boolean>(false);
  resetConfirmOpen = signal<boolean>(false);
  columns: Workflow[] = [];
  deletedColumnIds: string[] = [];
  newColumnName = '';
  savedToast = signal<boolean>(false);

  constructor(
    public projectService: ProjectService,
    public workflowService: WorkflowService,
    public workspaceService: WorkspaceService,
    public taskService: TaskService,
    public pushService: PushNotificationService
  ) {
    effect(() => {
      const proj = this.activeProject();
      if (proj) {
        this.loadProjectColumns(proj.id);
      } else {
        this.columns = [];
      }
    });
  }

  loadProjectColumns(projectId: string) {
    const existing = this.workflowService.getWorkflowsForProject(projectId);
    this.columns = JSON.parse(JSON.stringify(existing));
    this.deletedColumnIds = [];
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  getWorkspaceTaskCount(projectId: string): number {
    return this.taskService.tasks().filter(t => t.project_id === projectId).length;
  }

  getWorkspaceCompletedTaskCount(projectId: string): number {
    return this.taskService.tasks().filter(t => t.project_id === projectId && (t.completed || t.status?.toLowerCase() === 'done')).length;
  }

  getWorkspaceMemberCount(projectId: string): number {
    return 1;
  }

  async addNewWorkflowColumn(projectId: string) {
    if (!this.newColumnName.trim()) return;
    const name = this.newColumnName.trim();
    const created = await this.workflowService.createWorkflow(projectId, name);
    this.columns.push(JSON.parse(JSON.stringify(created)));
    this.newColumnName = '';
  }

  removeColumn(col: Workflow, index: number) {
    this.columns.splice(index, 1);
    if (col.id && !col.id.startsWith('wf-')) {
      this.deletedColumnIds.push(col.id);
    }
  }

  moveColumn(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= this.columns.length) return;
    const temp = this.columns[index];
    this.columns[index] = this.columns[target];
    this.columns[target] = temp;
  }

  toggleAllowAllForColumn(col: Workflow, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    col.allow_all_transitions = checked;
    if (checked) {
      col.allowed_transitions = [];
    }
  }

  togglePredecessor(col: Workflow, predId: string) {
    if (!col.allowed_transitions) col.allowed_transitions = [];
    const idx = col.allowed_transitions.indexOf(predId);
    if (idx >= 0) {
      col.allowed_transitions.splice(idx, 1);
    } else {
      col.allowed_transitions.push(predId);
    }
  }

  async applySequentialPreset(projectId: string) {
    await this.workflowService.resetToSequentialPipeline(projectId);
    this.loadProjectColumns(projectId);
    this.triggerSavedToast();
  }

  async applyAllowAllPreset(projectId: string) {
    await this.workflowService.allowAllTransitionsForProject(projectId);
    this.loadProjectColumns(projectId);
    this.triggerSavedToast();
  }

  resetToDefaults(projectId: string) {
    this.resetConfirmOpen.set(true);
  }

  async executeResetToDefaults() {
    this.resetConfirmOpen.set(false);
    const proj = this.activeProject();
    if (!proj) return;
    const defaults = await this.workflowService.resetToDefaultWorkflows(proj.id);
    this.columns = JSON.parse(JSON.stringify(defaults));
    this.triggerSavedToast();
  }

  async saveWorkflowChanges(projectId: string) {
    this.triggerSavedToast();
    for (const delId of this.deletedColumnIds) {
      this.workflowService.deleteWorkflow(delId, projectId);
    }
    this.workflowService.updateWorkflowPositions(projectId, this.columns);
    for (const col of this.columns) {
      this.workflowService.updateWorkflowTransitions(
        projectId,
        col.id,
        col.allow_all_transitions !== false,
        col.allowed_transitions || []
      );
    }
  }

  private triggerSavedToast() {
    this.savedToast.set(true);
    setTimeout(() => {
      this.savedToast.set(false);
    }, 3000);
  }
}
