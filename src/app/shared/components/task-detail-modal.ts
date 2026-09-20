import { Component, EventEmitter, Input, OnInit, Output, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { WorkflowService } from '../../core/services/workflow.service';
import { TaskShareService } from '../../core/services/task-share.service';
import { Task, TaskComment, TaskStatusHistory, TaskPriority, TaskSeverity, TaskReproducibility, TaskType, Workflow } from '../../core/models/project.model';
import { getTaskKey } from '../../core/utils/task-key.util';
import { SelectComponent, SelectOption } from './select';
import { DatePickerComponent } from './date-picker';
import { ConfirmModalComponent } from './confirm-modal';

@Component({
  selector: 'app-task-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectComponent, DatePickerComponent, ConfirmModalComponent],
  template: `
    <div class="task-detail-overlay" (click)="close.emit()">
      <div class="task-detail-panel font-mono" (click)="$event.stopPropagation()">
        <!-- Top Navigation Header Bar -->
        <div class="detail-nav-bar paper-panel">
          <div class="nav-left">
            <div class="header-type-row font-mono">
              <span class="badge" [class]="'badge-' + task.type">
                <i [class]="getTypeIcon(task.type)"></i> {{ task.type }}
              </span>
              <span
                class="task-key-badge font-mono clickable-key"
                (click)="taskShareService.copyTaskShareLink(task, $event)"
                title="Click to copy share link"
              >
                <i class="fi fi-rr-link link-icon"></i> {{ getTaskKeyStr(task) }}
              </span>
              <span class="priority-badge" [class]="(task.priority || 'medium').toLowerCase()">
                {{ task.priority || 'medium' }}
              </span>
              @if (getProjectName(task.project_id); as projName) {
                <span class="project-pill font-mono">
                  <i class="fi fi-rr-folder text-amber"></i> {{ projName }}
                </span>
              }
            </div>
          </div>

          <div class="nav-right">
            <button type="button" class="btn-close-page font-mono" (click)="close.emit()" title="Close Task Detail Panel (Esc)">
              <i class="fi fi-rr-cross"></i>
              <span>Close</span>
            </button>
          </div>
        </div>

        <!-- Page Main Scrollable Container -->
        <div class="detail-page-container">
          <!-- Inline Title Edit (Full Width Title Block) -->
          <div class="detail-title-block">
            @if (isEditingTitle()) {
              <div class="inline-title-edit">
                <input
                  id="inline-title-input"
                  type="text"
                  class="form-input inline-title-input font-mono"
                  [(ngModel)]="titleInputText"
                  (keydown.enter)="saveTitle()"
                  (keydown.escape)="cancelTitleEdit()"
                  (blur)="saveTitle()"
                />
              </div>
            } @else {
              <h2
                class="task-title editable-field"
                (dblclick)="startEditingTitle()"
                title="Double-click to edit title"
              >
                <span>{{ task.title }}</span>
                <i class="fi fi-rr-edit edit-hint-icon" (click)="startEditingTitle()" title="Edit title"></i>
              </h2>
            }
          </div>

          <div class="detail-body">
            <!-- Main Content Left Column -->
            <div class="main-col">
              <!-- Description Box -->
              <div class="description-box paper-panel">
                <div class="section-heading-row">
                  <h4 class="section-heading"><i class="fi fi-rr-align-left"></i> Description</h4>
                  @if (!isEditingDesc()) {
                    <button class="btn-ghost-edit" (click)="startEditingDesc()" title="Edit description">
                      <i class="fi fi-rr-edit"></i> Edit
                    </button>
                  }
                </div>

                @if (isEditingDesc()) {
                  <div class="inline-desc-edit">
                    <textarea
                      id="inline-desc-input"
                      class="form-textarea inline-desc-textarea"
                      rows="5"
                      [(ngModel)]="descInputText"
                      (keydown.control.enter)="saveDesc(); $event.preventDefault()"
                      (keydown.meta.enter)="saveDesc(); $event.preventDefault()"
                      placeholder="Add a detailed description..."
                    ></textarea>
                    <div class="inline-edit-btn-row">
                      <button class="btn btn-secondary btn-xs" (click)="cancelDescEdit()">Cancel</button>
                      <button class="btn btn-primary btn-xs" (click)="saveDesc()">Save Description</button>
                    </div>
                  </div>
                } @else {
                  <div
                    class="desc-text editable-field"
                    [class.empty-desc]="!task.description"
                    (dblclick)="startEditingDesc()"
                    title="Double-click to edit description"
                  >
                    {{ task.description || 'No description provided for this task. Double-click or click Edit to add one.' }}
                  </div>
                }
              </div>

              <!-- Labels Box -->
              <div class="labels-box paper-panel">
                <div class="section-heading-row">
                  <h4 class="section-heading"><i class="fi fi-rr-tags"></i> Labels / Tags</h4>
                  @if (!isEditingLabels()) {
                    <button class="btn-ghost-edit" (click)="startEditingLabels()" title="Edit labels">
                      <i class="fi fi-rr-edit"></i> Edit
                    </button>
                  }
                </div>

                @if (isEditingLabels()) {
                  <div class="inline-labels-edit">
                    <input
                      id="inline-labels-input"
                      type="text"
                      class="form-input inline-labels-input font-mono"
                      [(ngModel)]="labelsInputText"
                      placeholder="Comma-separated labels, e.g. frontend, angular, bug"
                      (keydown.enter)="saveLabels()"
                      (keydown.escape)="cancelLabelsEdit()"
                      (blur)="saveLabels()"
                    />
                    <span class="input-hint font-mono">Press Enter or click outside to save</span>
                  </div>
                } @else {
                  <div
                    class="chips font-mono editable-field"
                    (dblclick)="startEditingLabels()"
                    title="Double-click to edit labels"
                  >
                    @if (task.labels && task.labels.length > 0) {
                      @for (l of task.labels; track l) {
                        <span class="chip">#{{ l }}</span>
                      }
                    } @else {
                      <span class="no-labels-text">+ Double-click to add labels</span>
                    }
                  </div>
                }
              </div>

              <!-- Attachments Box (Image Only) -->
              <div class="attachments-box paper-panel">
                <div class="section-heading-row">
                  <h4 class="section-heading">
                    <i class="fi fi-rr-picture"></i> Attachments
                    @if (task.attachments && task.attachments.length > 0) {
                      <span class="attachment-count-badge font-mono">{{ task.attachments.length }}</span>
                    }
                  </h4>
                  <button type="button" class="btn-ghost-edit" (click)="detailFileInput.click()" title="Add image attachment">
                    <i class="fi fi-rr-plus"></i> Add Image
                  </button>
                  <input
                    #detailFileInput
                    type="file"
                    accept="image/*"
                    multiple
                    (change)="onDetailFileSelected($event)"
                    style="display: none;"
                  />
                </div>

                @if (task.attachments && task.attachments.length > 0) {
                  <div class="detail-attachment-grid">
                    @for (img of task.attachments; track $index) {
                      <div class="detail-thumb-card" (click)="previewImageModal.set(img)">
                        <img [src]="img" alt="Attachment" />
                        <div class="detail-thumb-overlay">
                          <i class="fi fi-rr-eye zoom-icon"></i>
                          <button
                            type="button"
                            class="thumb-remove-btn"
                            (click)="$event.stopPropagation(); removeDetailAttachment($index)"
                            title="Remove image"
                          >
                            <i class="fi fi-rr-trash"></i>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="empty-attachments font-mono clickable-dropzone" (click)="detailFileInput.click()">
                    <i class="fi fi-rr-picture text-subtle"></i>
                    <span>No image attachments. Click to add image attachment.</span>
                  </div>
                }
              </div>

              <!-- Activity & Discussion Section with Tabs -->
              <div class="activity-section paper-panel">
                <div class="activity-tab-bar font-mono">
                  <button
                    type="button"
                    class="activity-tab-btn"
                    [class.active]="activeTab() === 'comments'"
                    (click)="activeTab.set('comments')"
                  >
                    <i class="fi fi-rr-comment-alt-middle"></i> Comments
                    <span class="activity-badge">{{ comments().length }}</span>
                  </button>

                  <button
                    type="button"
                    class="activity-tab-btn"
                    [class.active]="activeTab() === 'history'"
                    (click)="activeTab.set('history')"
                  >
                    <i class="fi fi-rr-time-past"></i> Status History
                    <span class="activity-badge">{{ statusHistory().length }}</span>
                  </button>
                </div>

                <!-- Comments Tab Content -->
                @if (activeTab() === 'comments') {
                  <div class="tab-pane">
                    <!-- New Comment Input Box -->
                    <div class="add-comment-box">
                      <textarea
                        class="form-textarea comment-input"
                        rows="2"
                        placeholder="Write a comment or update..."
                        [(ngModel)]="newCommentText"
                      ></textarea>
                      <div class="comment-btn-row">
                        <button
                          class="btn btn-primary btn-sm"
                          [disabled]="!newCommentText.trim()"
                          (click)="submitComment()"
                        >
                          <i class="fi fi-rr-paper-plane"></i> Post Comment
                        </button>
                      </div>
                    </div>

                    <!-- Comments List -->
                    <div class="comments-list">
                      @if (comments().length === 0) {
                        <div class="empty-activity font-mono">
                          <i class="fi fi-rr-comment-slash text-subtle"></i>
                          <span>No comments yet. Post the first update above!</span>
                        </div>
                      } @else {
                        @for (c of comments(); track c.id) {
                          <div class="comment-item glass-panel">
                            <div class="comment-avatar">
                              <i class="fi fi-rr-user"></i>
                            </div>

                            <div class="comment-content">
                              <!-- Comment Header & Actions -->
                              <div class="comment-meta">
                                <div class="meta-left">
                                  <span class="author">{{ c.author_name }}</span>
                                  <span class="time" [title]="c.created_at">
                                    <i class="fi fi-rr-clock"></i> {{ formatDate(c.created_at) }}
                                    @if (c.updated_at) {
                                      <span class="edited-tag">(edited)</span>
                                    }
                                  </span>
                                </div>

                                <!-- Actions: Edit & Delete -->
                                <div class="comment-actions">
                                  @if (editingCommentId() !== c.id) {
                                    <button
                                      class="btn-action-icon"
                                      (click)="startEditingComment(c)"
                                      title="Edit comment"
                                    >
                                      <i class="fi fi-rr-edit"></i>
                                    </button>

                                    <button
                                      class="btn-action-icon text-rose"
                                      (click)="confirmDeleteComment(c.id)"
                                      title="Delete comment"
                                    >
                                      <i class="fi fi-rr-trash"></i>
                                    </button>
                                  }
                                </div>
                              </div>

                              <!-- Inline Edit or Read Mode -->
                              @if (editingCommentId() === c.id) {
                                <div class="inline-edit-box">
                                  <textarea
                                    class="form-textarea edit-textarea"
                                    rows="2"
                                    [(ngModel)]="editText"
                                  ></textarea>
                                  <div class="edit-btn-row">
                                    <button
                                      class="btn btn-secondary btn-xs"
                                      (click)="cancelCommentEdit()"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      class="btn btn-primary btn-xs"
                                      [disabled]="!editText.trim()"
                                      (click)="saveCommentEdit(c.id)"
                                    >
                                      Save Changes
                                    </button>
                                  </div>
                                </div>
                              } @else {
                                <p class="text">{{ c.content }}</p>
                              }
                            </div>
                          </div>
                        }
                      }
                    </div>
                  </div>
                }

                <!-- Status History Tab Content -->
                @if (activeTab() === 'history') {
                  <div class="tab-pane">
                    <div class="history-timeline font-mono">
                      @if (statusHistory().length === 0) {
                        <div class="empty-activity font-mono">
                          <i class="fi fi-rr-time-past text-subtle"></i>
                          <span>No status history logged for this task yet.</span>
                        </div>
                      } @else {
                        @for (h of statusHistory(); track h.id) {
                          <div class="history-item paper-panel">
                            <div class="history-icon-col">
                              <i class="fi fi-rr-arrows-repeat text-cyan"></i>
                            </div>
                            <div class="history-details font-mono">
                              <div class="history-transition font-mono">
                                @if (h.from_status) {
                                  <span class="status-chip old-status">{{ h.from_status }}</span>
                                  <i class="fi fi-rr-arrow-right arrow-icon"></i>
                                  <span class="status-chip new-status">{{ h.to_status }}</span>
                                } @else {
                                  <span class="status-chip new-status">Created as {{ h.to_status }}</span>
                                }
                              </div>
                              <div class="history-meta font-mono">
                                <span class="user-name"><i class="fi fi-rr-user"></i> {{ h.changed_by || 'Self' }}</span>
                                <span class="time-stamp" [title]="h.created_at"><i class="fi fi-rr-clock"></i> {{ formatDate(h.created_at) }}</span>
                              </div>
                            </div>
                          </div>
                        }
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Metadata Sidebar Right Column (Full Task Fields) -->
            <div class="meta-col paper-panel">
              <div class="meta-group">
                <label class="meta-label">Status</label>
                <app-select
                  [options]="statusOptions"
                  [value]="task.status"
                  (valueChange)="updateStatus($event)"
                  placeholder="Select status..."
                ></app-select>
              </div>

              <div class="meta-group">
                <label class="meta-label">Issue Type</label>
                <app-select
                  [options]="typeOptions"
                  [value]="task.type"
                  (valueChange)="updateType($event)"
                  placeholder="Select type..."
                ></app-select>
              </div>

              <div class="meta-group">
                <label class="meta-label">Priority</label>
                <app-select
                  [options]="priorityOptions"
                  [value]="task.priority || 'medium'"
                  (valueChange)="updatePriority($event)"
                  placeholder="Select priority..."
                ></app-select>
              </div>

              @if (task.type === 'bug') {
                <div class="meta-group">
                  <label class="meta-label">Severity</label>
                  <app-select
                    [options]="severityOptions"
                    [value]="task.severity || ''"
                    (valueChange)="updateSeverity($event)"
                    placeholder="Select severity..."
                  ></app-select>
                </div>

                <div class="meta-group">
                  <label class="meta-label">Reproducibility</label>
                  <app-select
                    [options]="reproducibilityOptions"
                    [value]="task.reproducibility || ''"
                    (valueChange)="updateReproducibility($event)"
                    placeholder="Select reproducibility..."
                  ></app-select>
                </div>
              }

              <div class="meta-group">
                <label class="meta-label">Assignee</label>
                <input
                  type="text"
                  class="form-input meta-input font-mono"
                  [ngModel]="task.assignee || ''"
                  (blur)="updateAssignee($event)"
                  (keydown.enter)="updateAssignee($event)"
                  placeholder="Assignee name..."
                />
              </div>

              <div class="meta-group">
                <label class="meta-label">Reporter / Creator</label>
                <div class="meta-subval font-mono meta-user-pill">
                  <i class="fi fi-rr-user-add text-cyan"></i>
                  <span>{{ task.reporter || 'Self' }}</span>
                </div>
              </div>

              <div class="meta-group">
                <label class="meta-label">Due Date</label>
                <app-date-picker
                  [value]="task.due_date || ''"
                  (valueChange)="updateDueDate($event)"
                  placeholder="Set due date..."
                ></app-date-picker>
              </div>

              <div class="meta-group">
                <label class="meta-label">Created Date</label>
                <div class="meta-subval font-mono">{{ formatDate(task.created_at) }}</div>
              </div>

              <div class="meta-group">
                <label class="meta-label">Last Updated</label>
                <div class="meta-subval font-mono text-cyan">{{ formatDate(task.updated_at || task.created_at) }}</div>
              </div>

              <div class="meta-actions">
                <button class="btn btn-secondary btn-sm full-width" (click)="taskShareService.copyTaskShareLink(task, $event)">
                  <i class="fi fi-rr-share"></i> Copy Share Link
                </button>
              </div>

              <!-- Danger Zone Section for Destructive Actions -->
              <div class="danger-zone-section">
                <div class="danger-zone-header">
                  <i class="fi fi-rr-triangle-warning text-rose"></i>
                  <span>DANGER ZONE</span>
                </div>
                <p class="danger-zone-desc">Permanently remove this task and its history.</p>
                <button type="button" class="btn-destructive-action full-width" (click)="deleteTask()">
                  <i class="fi fi-rr-trash"></i>
                  <span>Delete Task</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Lightbox Image Preview Modal -->
      @if (previewImageModal(); as fullImg) {
        <div class="lightbox-overlay" (click)="previewImageModal.set(null)">
          <div class="lightbox-card" (click)="$event.stopPropagation()">
            <div class="lightbox-header font-mono">
              <span class="text-muted">IMAGE PREVIEW</span>
              <button class="btn btn-ghost btn-xs close-btn" (click)="previewImageModal.set(null)">
                <i class="fi fi-rr-cross"></i>
              </button>
            </div>
            <div class="lightbox-body">
              <img [src]="fullImg" alt="Full size preview" />
            </div>
          </div>
        </div>
      }

      @if (confirmState(); as cs) {
        <app-confirm-modal
          [isOpen]="cs.open"
          [title]="cs.title"
          [message]="cs.message"
          confirmText="Delete"
          type="danger"
          (confirm)="handleConfirm()"
          (cancel)="confirmState.set(null)"
        />
      }
    </div>
  `,
  styles: [`
    .task-detail-overlay {
      position: fixed;
      inset: 0;
      top: 47px;
      z-index: 990;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(2px);
      display: flex;
      justify-content: flex-end;
      overflow: hidden;
    }

    .task-detail-panel {
      width: 50%;
      min-width: 520px;
      max-width: 900px;
      height: 100%;
      background: var(--bg-canvas);
      border-left: 1px solid var(--border-medium);
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideInRight 0.25s ease-out;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }

    .detail-nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--border-medium);
      background: var(--bg-surface);
      flex-shrink: 0;
    }
    .nav-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-weight: 700;
    }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    .btn-close-page {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-main);
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .btn-close-page:hover {
      background: rgba(244, 63, 94, 0.15);
      color: #f43f5e;
      border-color: rgba(244, 63, 94, 0.4);
    }

    .header-type-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .task-key-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-xs);
    }
    .priority-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-xs);
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      border: 1px solid transparent;
    }
    .priority-badge.urgent { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
    .priority-badge.high { background: #fef3c7; color: #d97706; border-color: #fcd34d; }
    .priority-badge.medium { background: #e0f2fe; color: #0284c7; border-color: #7dd3fc; }
    .priority-badge.low { background: #f3f4f6; color: #4b5563; border-color: #d1d5db; }

    .project-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      padding: 0.15rem 0.55rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      color: var(--text-main);
      font-weight: 600;
    }

    .detail-page-container {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
      box-sizing: border-box;
    }

    .detail-title-block {
      margin-bottom: 0.35rem;
    }
    .task-title {
      font-size: 1.45rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .task-title.editable-field {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.35rem 0.5rem;
      border-radius: var(--radius-xs);
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
    }
    .edit-hint-icon {
      font-size: 0.9rem;
      color: var(--text-subtle);
      opacity: 0.7;
      transition: var(--transition);
    }
    .task-title.editable-field:hover .edit-hint-icon {
      opacity: 1;
      color: var(--accent-cyan);
    }
    .inline-title-edit {
      width: 100%;
    }
    .inline-title-input {
      font-size: 1.35rem;
      font-weight: 700;
      padding: 0.45rem 0.75rem;
      width: 100%;
    }

    .detail-body {
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: 1.15rem;
      align-items: start;
    }

    @media (max-width: 1100px) {
      .detail-body {
        grid-template-columns: 1fr;
      }
    }
    .main-col {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .description-box, .labels-box, .attachments-box, .activity-section {
      padding: 1.15rem;
    }

    .section-heading-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.65rem;
    }
    .section-heading {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .btn-ghost-edit {
      background: transparent;
      border: none;
      color: var(--text-subtle);
      font-size: 0.75rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.15rem 0.4rem;
      border-radius: var(--radius-xs);
      transition: var(--transition);
    }
    .btn-ghost-edit:hover {
      color: var(--text-main);
      background: var(--bg-surface-hover);
    }
    .editable-field {
      cursor: pointer;
      position: relative;
      transition: var(--transition);
    }
    .editable-field:hover {
      outline: 1px dashed var(--accent-cyan);
      outline-offset: 2px;
      border-radius: var(--radius-xs);
    }
    .desc-text {
      font-size: 0.9rem;
      color: var(--text-main);
      line-height: 1.6;
      background: var(--bg-canvas);
      padding: 0.85rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      white-space: pre-wrap;
    }
    .empty-desc {
      color: var(--text-subtle) !important;
      font-style: italic;
    }
    .inline-desc-edit {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .inline-desc-textarea {
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .inline-edit-btn-row {
      display: flex;
      justify-content: flex-end;
      gap: 0.4rem;
    }
    .chips {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      padding: 0.2rem;
    }
    .chip {
      font-size: 0.75rem;
      color: var(--accent-cyan);
      background: rgba(6, 182, 212, 0.15);
      padding: 0.2rem 0.6rem;
      border-radius: var(--radius-sm);
    }
    .no-labels-text {
      font-size: 0.775rem;
      color: var(--text-subtle);
      font-style: italic;
    }
    .inline-labels-edit {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .inline-labels-input {
      font-size: 0.825rem;
      padding: 0.35rem 0.5rem;
    }
    .input-hint {
      font-size: 0.7rem;
      color: var(--text-subtle);
    }
    .attachment-count-badge {
      font-size: 0.7rem;
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-cyan);
      padding: 0.05rem 0.4rem;
      border-radius: var(--radius-full);
      margin-left: 0.25rem;
    }
    .detail-attachment-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .detail-thumb-card {
      position: relative;
      width: 84px;
      height: 84px;
      border-radius: var(--radius-xs);
      border: 1px solid var(--border-medium);
      overflow: hidden;
      background: var(--bg-canvas);
      cursor: pointer;
    }
    .detail-thumb-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .detail-thumb-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      opacity: 0;
      transition: var(--transition-fast);
    }
    .detail-thumb-card:hover .detail-thumb-overlay {
      opacity: 1;
    }
    .zoom-icon {
      color: #ffffff;
      font-size: 0.85rem;
    }
    .thumb-remove-btn {
      background: rgba(244, 63, 94, 0.85);
      border: none;
      color: #ffffff;
      width: 22px;
      height: 22px;
      border-radius: var(--radius-xs);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .thumb-remove-btn:hover {
      background: #f43f5e;
    }
    .empty-attachments {
      padding: 0.85rem;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: var(--text-subtle);
      font-size: 0.775rem;
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-xs);
      background: var(--bg-surface-subtle);
    }
    .clickable-dropzone {
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .clickable-dropzone:hover {
      border-color: var(--accent-cyan);
      color: var(--text-main);
    }

    .lightbox-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 2500;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .lightbox-card {
      max-width: 90vw;
      max-height: 90vh;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .lightbox-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.85rem;
      border-bottom: 1px solid var(--border-subtle);
      font-size: 0.75rem;
    }
    .lightbox-body {
      padding: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;
      max-height: calc(90vh - 50px);
    }
    .lightbox-body img {
      max-width: 100%;
      max-height: 80vh;
      object-fit: contain;
      border-radius: var(--radius-xs);
    }

    /* Activity Section & Tabs */
    .activity-section {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .activity-tab-bar {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 0.4rem;
    }
    .activity-tab-btn {
      background: transparent;
      border: none;
      padding: 0.35rem 0.75rem;
      font-size: 0.775rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: var(--radius-xs);
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: var(--transition-fast);
    }
    .activity-tab-btn:hover {
      background: var(--bg-surface-hover);
      color: var(--text-main);
    }
    .activity-tab-btn.active {
      background: var(--bg-surface-subtle);
      color: var(--accent-cyan);
      border: 1px solid var(--border-subtle);
    }
    .activity-badge {
      font-size: 0.7rem;
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-cyan);
      padding: 0.05rem 0.4rem;
      border-radius: var(--radius-full);
    }
    .tab-pane {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      width: 100%;
    }
    .add-comment-box {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: 100%;
    }
    .comment-input {
      font-size: 0.85rem;
      resize: vertical;
      width: 100%;
      box-sizing: border-box;
      min-height: 60px;
    }
    .comment-btn-row {
      display: flex;
      justify-content: flex-end;
      width: 100%;
    }
    .comments-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }
    .edit-textarea {
      width: 100%;
      box-sizing: border-box;
    }
    .empty-activity {
      padding: 1.5rem 1rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      color: var(--text-subtle);
      font-size: 0.825rem;
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-md);
    }
    .history-timeline {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .history-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .history-icon-col {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(6, 182, 212, 0.12);
      flex-shrink: 0;
    }
    .history-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }
    .history-transition {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
    }
    .status-chip {
      font-size: 0.7rem;
      padding: 0.1rem 0.45rem;
      border-radius: var(--radius-xs);
      font-weight: 600;
      border: 1px solid var(--border-subtle);
    }
    .old-status {
      background: var(--bg-canvas);
      color: var(--text-muted);
    }
    .new-status {
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-cyan);
      border-color: rgba(6, 182, 212, 0.3);
    }
    .arrow-icon {
      font-size: 0.7rem;
      color: var(--text-subtle);
    }
    .history-meta {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      font-size: 0.725rem;
      color: var(--text-muted);
    }
    .user-name, .time-stamp {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .comment-item {
      display: flex;
      gap: 0.75rem;
      padding: 0.85rem;
      background: var(--bg-surface);
    }
    .comment-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(6, 182, 212, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-cyan);
      font-size: 0.85rem;
      flex-shrink: 0;
    }
    .comment-content {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1;
    }
    .comment-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.775rem;
    }
    .meta-left {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .author {
      font-weight: 600;
      color: var(--text-main);
    }
    .time {
      color: var(--text-subtle);
      font-size: 0.725rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .edited-tag {
      font-style: italic;
      color: var(--text-subtle);
      opacity: 0.8;
    }
    .comment-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .btn-action-icon {
      background: transparent;
      border: none;
      color: var(--text-subtle);
      cursor: pointer;
      padding: 0.15rem 0.35rem;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      transition: var(--transition);
    }
    .btn-action-icon:hover {
      color: var(--text-main);
      background: var(--bg-surface-hover);
    }
    .text-rose { color: var(--accent-rose) !important; }
    .text-rose:hover { background: rgba(244, 63, 94, 0.15) !important; }

    .text {
      font-size: 0.875rem;
      color: var(--text-main);
      line-height: 1.45;
      white-space: pre-wrap;
    }
    .inline-edit-box {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-top: 0.2rem;
    }
    .edit-textarea {
      font-size: 0.85rem;
    }
    .edit-btn-row {
      display: flex;
      justify-content: flex-end;
      gap: 0.4rem;
    }
    .btn-xs {
      padding: 0.2rem 0.55rem;
      font-size: 0.75rem;
    }

    /* Metadata Sidebar Column */
    .meta-col {
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.95rem;
    }
    .meta-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .meta-label {
      font-size: 0.675rem;
      font-weight: 700;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .meta-val {
      font-size: 0.875rem;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .meta-subval {
      font-size: 0.775rem;
      color: var(--text-muted);
    }
    .meta-user-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.5rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      font-weight: 600;
      color: var(--text-main);
    }
    .meta-input {
      font-size: 0.825rem;
      padding: 0.35rem 0.5rem;
      height: 32px;
    }
    .full-width {
      width: 100%;
    }
    .meta-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.35rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-subtle);
    }
    .danger-zone-section {
      margin-top: 0.75rem;
      padding: 0.75rem;
      border: 1px solid rgba(244, 63, 94, 0.35);
      background: rgba(244, 63, 94, 0.04);
      border-radius: var(--radius-xs);
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .danger-zone-header {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.65rem;
      font-weight: 700;
      color: #f43f5e;
      letter-spacing: 0.05em;
      font-family: var(--font-mono);
    }
    .danger-zone-desc {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.3;
    }
    .btn-destructive-action {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      width: 100%;
      padding: 0.45rem 0.75rem;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      font-weight: 600;
      color: #f43f5e;
      background: rgba(244, 63, 94, 0.08);
      border: 1px solid rgba(244, 63, 94, 0.5);
      border-radius: var(--radius-xs);
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .btn-destructive-action:hover {
      background: #f43f5e;
      color: #ffffff;
      border-color: #f43f5e;
      box-shadow: 0 2px 8px rgba(244, 63, 94, 0.3);
    }

    /* Mobile Page Optimizations */
    @media (max-width: 768px) {
      .task-detail-panel {
        width: 100%;
        min-width: 100%;
        max-width: 100%;
        border-left: none;
      }
      .detail-nav-bar {
        padding: 0.5rem 0.75rem;
      }
      .detail-page-container {
        padding: 0.75rem;
        padding-bottom: 5.5rem;
      }
      .detail-body {
        grid-template-columns: 1fr;
        gap: 1rem;
      }
      .meta-col {
        order: 1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.6rem 0.75rem;
        padding: 0.85rem;
      }
      .meta-actions, .danger-zone-section {
        grid-column: 1 / -1;
      }
      .main-col {
        order: 2;
      }
      .task-title {
        font-size: 1.15rem;
      }
      .inline-title-input {
        font-size: 1.15rem;
      }
    }
  `]
})
export class TaskDetailModalComponent implements OnInit {
  @Input() task!: Task;
  @Output() close = new EventEmitter<void>();
  @Output() editTask = new EventEmitter<Task>();

  comments = signal<TaskComment[]>([]);
  statusHistory = signal<TaskStatusHistory[]>([]);
  activeTab = signal<'comments' | 'history'>('comments');
  newCommentText = '';

  editingCommentId = signal<string | null>(null);
  editText = '';

  // Inline edit state
  previewImageModal = signal<string | null>(null);
  isEditingTitle = signal<boolean>(false);
  titleInputText = '';

  isEditingDesc = signal<boolean>(false);
  descInputText = '';

  isEditingLabels = signal<boolean>(false);
  labelsInputText = '';

  priorityOptions: SelectOption[] = [
    { value: 'urgent', label: 'Urgent', icon: 'fi fi-rr-exclamation text-rose' },
    { value: 'high', label: 'High', icon: 'fi fi-rr-arrow-up text-amber' },
    { value: 'medium', label: 'Medium', icon: 'fi fi-rr-minus text-cyan' },
    { value: 'low', label: 'Low', icon: 'fi fi-rr-arrow-down text-subtle' }
  ];

  typeOptions: SelectOption[] = [
    { value: 'task', label: 'Task', icon: 'fi fi-rr-checkbox text-cyan' },
    { value: 'story', label: 'User Story', icon: 'fi fi-rr-book-alt text-cyan' },
    { value: 'bug', label: 'Bug', icon: 'fi fi-rr-bug text-rose' },
    { value: 'epic', label: 'Epic', icon: 'fi fi-rr-rocket text-amber' }
  ];

  severityOptions: SelectOption[] = [
    { value: 'critical', label: 'Critical', icon: 'fi fi-rr-triangle-warning text-rose' },
    { value: 'major', label: 'Major', icon: 'fi fi-rr-angle-up text-rose' },
    { value: 'minor', label: 'Minor', icon: 'fi fi-rr-minus text-amber' },
    { value: 'trivial', label: 'Trivial', icon: 'fi fi-rr-angle-down text-subtle' }
  ];

  reproducibilityOptions: SelectOption[] = [
    { value: 'always', label: 'Always' },
    { value: 'often', label: 'Often' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'rarely', label: 'Rarely' },
    { value: 'unable', label: 'Unable to Reproduce' }
  ];

  constructor(
    private taskService: TaskService,
    private projectService: ProjectService,
    private workflowService: WorkflowService,
    public taskShareService: TaskShareService
  ) { }

  @HostListener('window:keydown.escape')
  onEscapePress() {
    if (!this.previewImageModal() && !this.isEditingTitle() && !this.isEditingDesc() && !this.isEditingLabels()) {
      this.close.emit();
    }
  }

  async ngOnInit() {
    if (this.task) {
      const [commList, historyList] = await Promise.all([
        this.taskService.loadCommentsForTask(this.task.id),
        this.taskService.loadStatusHistoryForTask(this.task.id)
      ]);
      this.comments.set(commList);
      this.statusHistory.set(historyList);
    }
  }

  getAvailableStatuses(): Workflow[] {
    return this.workflowService.getWorkflowsForProject(this.task?.project_id);
  }

  get statusOptions(): SelectOption[] {
    return this.getAvailableStatuses().map(s => ({
      value: s.name,
      label: s.name
    }));
  }

  getTaskKeyStr(task?: Task): string {
    return getTaskKey(task, this.projectService.projects());
  }

  getProjectName(projectId?: string): string | null {
    if (!projectId) return null;
    const proj = this.projectService.projects().find(p => p.id === projectId);
    return proj ? proj.name : null;
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'story': return 'fi fi-rr-book-alt';
      case 'bug': return 'fi fi-rr-bug';
      case 'epic': return 'fi fi-rr-rocket';
      default: return 'fi fi-rr-checkbox';
    }
  }

  // Inline Title Editing
  startEditingTitle() {
    this.titleInputText = this.task.title;
    this.isEditingTitle.set(true);
    setTimeout(() => {
      const el = document.getElementById('inline-title-input');
      if (el) (el as HTMLInputElement).focus();
    }, 50);
  }

  cancelTitleEdit() {
    this.isEditingTitle.set(false);
  }

  async saveTitle() {
    if (!this.isEditingTitle()) return;
    this.isEditingTitle.set(false);
    const trimmed = this.titleInputText.trim();
    if (trimmed && trimmed !== this.task.title) {
      const updated = await this.taskService.updateTask(this.task.id, { title: trimmed });
      if (updated) this.task = updated;
    }
  }

  // Inline Description Editing
  startEditingDesc() {
    this.descInputText = this.task.description || '';
    this.isEditingDesc.set(true);
    setTimeout(() => {
      const el = document.getElementById('inline-desc-input');
      if (el) (el as HTMLTextAreaElement).focus();
    }, 50);
  }

  cancelDescEdit() {
    this.isEditingDesc.set(false);
  }

  async saveDesc() {
    if (!this.isEditingDesc()) return;
    this.isEditingDesc.set(false);
    if (this.descInputText !== (this.task.description || '')) {
      const updated = await this.taskService.updateTask(this.task.id, { description: this.descInputText });
      if (updated) this.task = updated;
    }
  }

  // Inline Labels Editing
  startEditingLabels() {
    this.labelsInputText = (this.task.labels || []).join(', ');
    this.isEditingLabels.set(true);
    setTimeout(() => {
      const el = document.getElementById('inline-labels-input');
      if (el) (el as HTMLInputElement).focus();
    }, 50);
  }

  cancelLabelsEdit() {
    this.isEditingLabels.set(false);
  }

  async saveLabels() {
    if (!this.isEditingLabels()) return;
    this.isEditingLabels.set(false);
    const parsed = this.labelsInputText
      .split(',')
      .map(l => l.trim().toLowerCase())
      .filter(l => l.length > 0);
    const updated = await this.taskService.updateTask(this.task.id, { labels: parsed });
    if (updated) this.task = updated;
  }

  // Metadata Field Handlers
  async updateStatus(newStatus: string) {
    const available = this.getAvailableStatuses();
    const wf = available.find(w => w.name === newStatus);

    const updated = await this.taskService.updateTask(this.task.id, {
      status: newStatus,
      workflow_id: wf?.id
    });
    if (updated) {
      this.task = updated;
      const historyList = await this.taskService.loadStatusHistoryForTask(this.task.id);
      this.statusHistory.set(historyList);
    }
  }

  async updatePriority(newPriority: TaskPriority) {
    const updated = await this.taskService.updateTask(this.task.id, { priority: newPriority });
    if (updated) this.task = updated;
  }

  async updateType(newType: TaskType) {
    const updated = await this.taskService.updateTask(this.task.id, { type: newType });
    if (updated) this.task = updated;
  }

  async updateSeverity(newSeverity: string) {
    const updated = await this.taskService.updateTask(this.task.id, { severity: newSeverity as TaskSeverity });
    if (updated) this.task = updated;
  }

  async updateReproducibility(newReproducibility: string) {
    const updated = await this.taskService.updateTask(this.task.id, { reproducibility: newReproducibility as TaskReproducibility });
    if (updated) this.task = updated;
  }

  async updateDueDate(newDueDate: string) {
    const updated = await this.taskService.updateTask(this.task.id, { due_date: newDueDate });
    if (updated) this.task = updated;
  }

  async updateAssignee(event: Event) {
    const val = (event.target as HTMLInputElement).value.trim();
    if (val !== (this.task.assignee || '')) {
      const updated = await this.taskService.updateTask(this.task.id, { assignee: val });
      if (updated) this.task = updated;
    }
  }

  async submitComment() {
    if (!this.newCommentText.trim()) return;
    const added = await this.taskService.addComment(this.task.id, this.newCommentText.trim());
    this.comments.update(list => [...list, added]);
    this.newCommentText = '';
  }

  startEditingComment(comment: TaskComment) {
    this.editingCommentId.set(comment.id);
    this.editText = comment.content;
  }

  cancelCommentEdit() {
    this.editingCommentId.set(null);
    this.editText = '';
  }

  async saveCommentEdit(commentId: string) {
    if (!this.editText.trim()) return;
    const updated = await this.taskService.updateComment(commentId, this.task.id, this.editText.trim());
    if (updated) {
      this.comments.update(list => list.map(c => c.id === commentId ? updated : c));
    }
    this.cancelCommentEdit();
  }

  confirmState = signal<{ open: boolean; title: string; message: string; action: () => void } | null>(null);

  confirmDeleteComment(commentId: string) {
    this.confirmState.set({
      open: true,
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment? This action cannot be undone.',
      action: async () => {
        await this.taskService.deleteComment(commentId, this.task.id);
        this.comments.update(list => list.filter(c => c.id !== commentId));
      }
    });
  }

  deleteTask() {
    this.confirmState.set({
      open: true,
      title: 'Delete Task',
      message: `Are you sure you want to permanently delete issue "${this.task.title}"?`,
      action: async () => {
        await this.taskService.deleteTask(this.task.id);
        this.close.emit();
      }
    });
  }

  handleConfirm() {
    const current = this.confirmState();
    if (current && current.action) {
      current.action();
    }
    this.confirmState.set(null);
  }

  async onDetailFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files).filter(f => f.type.startsWith('image/'));
    input.value = '';
    if (files.length === 0) return;

    const currentAttachments = [...(this.task.attachments || [])];
    const newImgs: string[] = [];

    for (const file of files) {
      const imgData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.readAsDataURL(file);
      });
      if (imgData) newImgs.push(imgData);
    }

    if (newImgs.length > 0) {
      const updatedAttachments = [...currentAttachments, ...newImgs];
      const updated = await this.taskService.updateTask(this.task.id, { attachments: updatedAttachments });
      if (updated) this.task = updated;
    }
  }

  async removeDetailAttachment(index: number) {
    const currentAttachments = [...(this.task.attachments || [])];
    currentAttachments.splice(index, 1);
    const updated = await this.taskService.updateTask(this.task.id, { attachments: currentAttachments });
    if (updated) this.task = updated;
  }

  formatDate(isoString: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
