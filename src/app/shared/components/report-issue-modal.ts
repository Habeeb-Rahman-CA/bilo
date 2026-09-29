import { Component, EventEmitter, Output, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';
import { TaskShareService } from '../../core/services/task-share.service';
import { SelectComponent, SelectOption } from './select';
import { RichEditorComponent } from './rich-editor';
import { TaskPriority, TaskSeverity, TaskReproducibility, TaskType, Project } from '../../core/models/project.model';
import { compressImageFile, canAddAttachment, MAX_ATTACHMENT_FILE_SIZE_BYTES, MAX_ATTACHMENTS_PER_TASK } from '../../core/utils/image-compressor.util';
import { registerModal, unregisterModal, isTopModal, getModalZIndex } from '../../core/utils/modal-stack.util';

@Component({
  selector: 'app-report-issue-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectComponent, RichEditorComponent],
  template: `
    <div class="modal-overlay" [style.z-index]="modalZIndex" (click)="close.emit()">
      <div class="modal-card report-modal-card paper-panel font-mono" (click)="$event.stopPropagation()">
        <!-- Header Strip -->
        <div class="modal-header">
          <div class="header-left">
            <i class="fi fi-rr-bug text-rose icon-lg"></i>
            <div>
              <h3>Submit Feedback & Bug Report</h3>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-xs close-btn" (click)="close.emit()" title="Close">
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>

        @if (submittedSuccessfully()) {
          <div class="success-confirmation-body font-mono">
            <div class="success-icon-badge">
              <i class="fi fi-rr-check-circle text-emerald"></i>
            </div>
            <h3 class="success-title text-emerald">Report Submitted Successfully!</h3>
            <p class="success-desc font-mono">
              Your feedback report has been logged into the backlog under project <strong>"{{ getTargetProjectName() }}"</strong>.
            </p>
            <div class="success-actions">
              <button type="button" class="btn btn-primary btn-sm" (click)="close.emit()">
                <i class="fi fi-rr-check"></i> Done
              </button>
            </div>
          </div>
        } @else {
          <form (ngSubmit)="submitIssue()" class="modal-form">
            <div class="form-body">
              @if (submitted && titleError) {
                <div class="form-error-banner font-mono">
                  <i class="fi fi-rr-triangle-warning"></i>
                  <span>{{ titleError }}</span>
                </div>
              }

              <!-- Issue Title / Summary -->
              <div class="form-group">
                <label class="form-label">ISSUE SUMMARY / TITLE <span class="text-rose">*</span></label>
                <input
                  #titleInput
                  type="text"
                  class="form-input"
                  [class.input-error]="submitted && !!titleError"
                  [(ngModel)]="title"
                  name="title"
                  placeholder="e.g. Kanban board drag & drop issue or Notification permission reset"
                  maxlength="255"
                  required
                />
                @if (submitted && titleError) {
                  <span class="field-error-text font-mono">
                    <i class="fi fi-rr-exclamation"></i> {{ titleError }}
                  </span>
                }
              </div>

              <!-- Category & Priority Row -->
              <div class="form-row">
                <div class="form-group half">
                  <label class="form-label">CATEGORY / TYPE</label>
                  <app-select [options]="categoryOptions" [(value)]="category" placeholder="Select category..."></app-select>
                </div>

                <div class="form-group half">
                  <label class="form-label">PRIORITY</label>
                  <app-select [options]="priorityOptions" [(value)]="priority" placeholder="Select priority..."></app-select>
                </div>
              </div>

              <!-- Severity & Reproducibility Row (Only for Bug category) -->
              @if (category === 'bug') {
                <div class="form-row">
                  <div class="form-group half">
                    <label class="form-label">SEVERITY</label>
                    <app-select [options]="severityOptions" [(value)]="severity" placeholder="Select severity..."></app-select>
                  </div>

                  <div class="form-group half">
                    <label class="form-label">REPRODUCIBILITY</label>
                    <app-select [options]="reproducibilityOptions" [(value)]="reproducibility" placeholder="Select reproducibility..."></app-select>
                  </div>
                </div>
              }

              <!-- Description / Steps to Reproduce -->
              <div class="form-group">
                <label class="form-label">DESCRIPTION & STEPS TO REPRODUCE</label>
                <app-rich-editor
                  [(value)]="description"
                  placeholder="Describe what went wrong, expected result, or steps to reproduce..."
                  [minRows]="4"
                ></app-rich-editor>
              </div>

              <!-- Attachments Section (Screenshots / Images) -->
              <div class="form-group">
                <div class="label-with-hint">
                  <label class="form-label">SCREENSHOTS / ATTACHMENTS</label>
                  @if (attachments().length > 0) {
                    <span class="attachment-count font-mono">{{ attachments().length }} attached</span>
                  }
                </div>

                <div
                  class="attachment-dropzone"
                  [class.drag-over]="isDraggingOver()"
                  [class.is-uploading]="uploadingAttachments()"
                  (dragover)="onDragOver($event)"
                  (dragleave)="onDragLeave($event)"
                  (drop)="onDrop($event)"
                  (click)="!uploadingAttachments() && fileInput.click()"
                >
                  <input
                    #fileInput
                    type="file"
                    accept="image/*"
                    multiple
                    (change)="onFileSelected($event)"
                    style="display: none;"
                  />
                  @if (uploadingAttachments()) {
                    <div class="dropzone-content font-mono">
                      <i class="fi fi-rr-spinner spinner dropzone-icon text-cyan"></i>
                      <div class="dropzone-text">
                        <span class="dropzone-title text-cyan">Uploading {{ uploadCount() }} image(s)...</span>
                        <span class="dropzone-sub">Generating image preview, please wait...</span>
                      </div>
                    </div>
                  } @else {
                    <div class="dropzone-content font-mono">
                      <i class="fi fi-rr-picture dropzone-icon text-cyan"></i>
                      <div class="dropzone-text">
                        <span class="dropzone-title">Click to upload screenshot or drag & drop</span>
                        <span class="dropzone-sub">PNG, JPG, WEBP, GIF supported</span>
                      </div>
                    </div>
                  }
                </div>

                @if (attachments().length > 0) {
                  <div class="attachment-preview-grid">
                    @for (img of attachments(); track $index) {
                      <div class="preview-card">
                        <img [src]="img" alt="Screenshot" />
                        <button
                          type="button"
                          class="remove-img-btn"
                          (click)="removeAttachment($index)"
                          title="Remove image"
                        >
                          <i class="fi fi-rr-cross"></i>
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Footer Strip -->
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" (click)="close.emit()">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" [disabled]="submitting()">
                @if (submitting()) {
                  <i class="fi fi-rr-spinner spinner-icon"></i> Submitting...
                } @else {
                  <i class="fi fi-rr-paper-plane"></i> Submit Issue to {{ getTargetProjectName() }}
                }
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    .report-modal-card {
      width: 100%;
      max-width: 580px;
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
      padding: 0.85rem 1.15rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .header-left h3 {
      font-size: 0.95rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-main);
    }
    .header-subtext {
      font-size: 0.7rem;
      color: var(--text-muted);
    }
    .icon-lg {
      font-size: 1.35rem;
    }
    .close-btn {
      color: var(--text-muted);
    }
    .close-btn:hover {
      color: var(--text-main);
    }
    .modal-form {
      display: flex;
      flex-direction: column;
    }
    .form-body {
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      max-height: 70vh;
      overflow-y: auto;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .form-row {
      display: flex;
      gap: 0.75rem;
    }
    .half {
      flex: 1;
      width: 50%;
    }
    .form-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }
    .form-input, .form-textarea {
      font-size: 0.825rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-main);
      padding: 0.45rem 0.65rem;
    }
    .form-input:focus, .form-textarea:focus {
      border-color: var(--accent-cyan);
      outline: none;
    }
    .input-error {
      border-color: #f43f5e !important;
    }
    .form-error-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fb7185;
      font-size: 0.75rem;
      border-radius: var(--radius-xs);
    }
    .field-error-text {
      font-size: 0.675rem;
      color: #fb7185;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .label-with-hint {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .attachment-count {
      font-size: 0.65rem;
      color: var(--accent-cyan);
    }
    .attachment-dropzone {
      padding: 0.85rem;
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-xs);
      background: var(--bg-surface-subtle);
      text-align: center;
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .attachment-dropzone:hover, .attachment-dropzone.drag-over {
      border-color: var(--accent-cyan);
      background: var(--bg-surface-hover);
    }
    .dropzone-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
    }
    .dropzone-icon {
      font-size: 1.35rem;
    }
    .dropzone-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .dropzone-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .dropzone-sub {
      font-size: 0.65rem;
      color: var(--text-muted);
    }
    .attachment-preview-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .preview-card {
      position: relative;
      width: 64px;
      height: 64px;
      border-radius: var(--radius-xs);
      border: 1px solid var(--border-subtle);
      overflow: hidden;
    }
    .preview-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .remove-img-btn {
      position: absolute;
      top: 2px;
      right: 2px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      border: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      cursor: pointer;
    }
    .remove-img-btn:hover {
      background: #f43f5e;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding: 0.75rem 1.15rem;
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
    }
    .spinner-icon {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .success-confirmation-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 1.5rem;
      text-align: center;
      background: var(--bg-surface);
    }
    .success-icon-badge {
      font-size: 3.25rem;
      margin-bottom: 0.75rem;
      line-height: 1;
    }
    .success-title {
      font-size: 1.15rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .success-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
      max-width: 420px;
    }
    .success-actions {
      display: flex;
      justify-content: center;
    }
  `]
})
export class ReportIssueModalComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();

  private readonly modalId = 'report-issue-modal-' + Math.random().toString(36).substring(2, 9);

  get modalZIndex(): number {
    return getModalZIndex(this.modalId);
  }

  @HostListener('window:keydown.escape')
  onEscape() {
    if (isTopModal(this.modalId)) {
      this.close.emit();
    }
  }

  ngOnInit() {
    registerModal(this.modalId);
  }

  ngOnDestroy() {
    unregisterModal(this.modalId);
  }

  title = '';
  category = 'bug';
  priority: TaskPriority = 'high';
  severity: TaskSeverity = 'major';
  reproducibility: TaskReproducibility = 'always';
  description = '';
  attachments = signal<string[]>([]);
  uploadingAttachments = signal<boolean>(false);
  uploadCount = signal<number>(0);

  submitted = false;
  submitting = signal<boolean>(false);
  submittedSuccessfully = signal<boolean>(false);
  isDraggingOver = signal<boolean>(false);

  categoryOptions: SelectOption[] = [
    { value: 'bug', label: 'Bug / Defect', icon: 'fi fi-rr-bug text-rose' },
    { value: 'ui_ux', label: 'UI / UX Issue', icon: 'fi fi-rr-layout-fluid text-cyan' },
    { value: 'feature', label: 'Feature Request', icon: 'fi fi-rr-rocket text-amber' },
    { value: 'other', label: 'Other Issue', icon: 'fi fi-rr-info text-subtle' }
  ];

  priorityOptions: SelectOption[] = [
    { value: 'urgent', label: 'Urgent', icon: 'fi fi-rr-exclamation text-rose' },
    { value: 'high', label: 'High', icon: 'fi fi-rr-arrow-up text-amber' },
    { value: 'medium', label: 'Medium', icon: 'fi fi-rr-minus text-cyan' },
    { value: 'low', label: 'Low', icon: 'fi fi-rr-arrow-down text-subtle' }
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
    private authService: AuthService,
    private taskShareService: TaskShareService
  ) {}

  getTargetProject(): Project | null {
    const allProjects = this.projectService.projects();
    if (!allProjects || allProjects.length === 0) return null;

    const biloProj = allProjects.find(p =>
      p.name.trim().toLowerCase() === 'bilo' ||
      p.slug.trim().toLowerCase() === 'bilo' ||
      p.id === 'proj-bilo-main'
    );
    if (biloProj) return biloProj;

    const active = this.projectService.activeProject();
    if (active && allProjects.some(p => p.id === active.id)) {
      return active;
    }

    return allProjects[0];
  }

  getTargetProjectName(): string {
    const target = this.getTargetProject();
    return target ? target.name : 'Project';
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDraggingOver.set(true);
  }

  onDragLeave(e: DragEvent) {
    e.preventDefault();
    this.isDraggingOver.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDraggingOver.set(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      this.handleFiles(Array.from(e.dataTransfer.files));
    }
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(Array.from(input.files));
    }
  }

  private async handleFiles(files: File[]) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      this.taskShareService.showToast('Please select valid image files.');
      return;
    }

    if (this.attachments().length + imageFiles.length > MAX_ATTACHMENTS_PER_TASK) {
      this.taskShareService.showToast(`Maximum ${MAX_ATTACHMENTS_PER_TASK} attachments allowed.`);
      return;
    }

    this.uploadingAttachments.set(true);
    this.uploadCount.set(imageFiles.length);

    try {
      let processedCount = 0;
      for (const file of imageFiles) {
        if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
          this.taskShareService.showToast(`File "${file.name}" exceeds 10MB limit and was skipped.`);
          continue;
        }

        const compressed = await compressImageFile(file);
        if (compressed) {
          const check = canAddAttachment(this.attachments(), compressed);
          if (!check.allowed) {
            this.taskShareService.showToast(check.reason || 'Cumulative task attachment size limit (1.5MB) reached.');
            break;
          }
          this.attachments.update(list => [...list, compressed]);
          processedCount++;
        }
      }
      if (processedCount > 0) {
        this.taskShareService.showToast(`${processedCount} screenshot(s) attached.`);
      }
    } catch (err) {
      console.error('Error uploading screenshot:', err);
      this.taskShareService.showToast('Failed to process image file. Please try again.');
    } finally {
      this.uploadingAttachments.set(false);
      this.uploadCount.set(0);
    }
  }

  removeAttachment(idx: number) {
    this.attachments.update(list => list.filter((_, i) => i !== idx));
  }

  get titleError(): string | null {
    const trimmed = (this.title || '').trim();
    if (!trimmed) {
      return 'Please enter a summary / title for the reported issue.';
    }
    if (trimmed.length < 2) {
      return 'Issue title must be at least 2 characters long.';
    }
    if (trimmed.length > 255) {
      return 'Issue title cannot exceed 255 characters.';
    }
    return null;
  }

  async submitIssue() {
    this.submitted = true;
    if (this.titleError || this.submitting()) return;

    this.submitting.set(true);

    try {
      let targetProject = this.getTargetProject();

      if (!targetProject) {
        targetProject = await this.projectService.createProject({
          name: 'General Workspace',
          color: '#06b6d4',
          description: 'Primary workspace for tasks'
        });
      }

      if (!targetProject || !targetProject.id) {
        this.taskShareService.showToast('No valid project found to submit issue. Please create a project first.');
        return;
      }

      const targetProjectId = targetProject.id;
      const currentUser = this.authService.user();
      const reporterName = currentUser?.user_metadata?.['display_name'] ||
        currentUser?.user_metadata?.['full_name'] ||
        (currentUser?.email ? currentUser.email.split('@')[0] : null) ||
        'User';
      const userAgentStr = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

      // Map selected issue category to task type (bug, story, or task)
      let taskType: TaskType = 'bug';
      if (this.category === 'feature') {
        taskType = 'story';
      } else if (this.category === 'ui_ux' || this.category === 'other') {
        taskType = 'task';
      }

      const formattedDesc = [
        this.description.trim() ? this.description.trim() : 'No additional description provided.',
        '\n--- Issue Report Details ---',
        `Reporter: ${reporterName}${currentUser?.email ? ' (' + currentUser.email + ')' : ''}`,
        `Submitted At: ${new Date().toLocaleString()}`,
        `Category: ${this.category.toUpperCase()}`,
        `User Agent: ${userAgentStr}`
      ].join('\n');

      const newTask = await this.taskService.createTask({
        project_id: targetProjectId,
        title: this.title.trim(),
        type: taskType,
        is_app_report: true,
        report_category: this.category,
        status: 'Backlog',
        priority: this.priority,
        severity: this.category === 'bug' ? this.severity : undefined,
        reproducibility: this.category === 'bug' ? this.reproducibility : undefined,
        reporter: reporterName,
        assignee: 'Unassigned',
        labels: ['app-report', 'user-issue', this.category],
        description: formattedDesc,
        attachments: this.attachments()
      });

      if (newTask) {
        this.submittedSuccessfully.set(true);
        this.taskShareService.showToast(`Feedback report "${newTask.title}" submitted successfully under project "${targetProject.name}".`);
        setTimeout(() => {
          this.close.emit();
        }, 1800);
      } else {
        this.taskShareService.showToast('Failed to submit issue report. Please try again.');
      }
    } catch (e) {
      console.error('Failed to submit application issue:', e);
      this.taskShareService.showToast('Failed to submit issue. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
