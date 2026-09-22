import { Component, EventEmitter, Input, OnInit, Output, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { WorkflowService } from '../../core/services/workflow.service';
import { TaskShareService } from '../../core/services/task-share.service';
import { Task, TaskPriority, TaskSeverity, TaskReproducibility, TaskType, Workflow } from '../../core/models/project.model';
import { DatePickerComponent } from './date-picker';
import { SelectComponent, SelectOption } from './select';
import { RichEditorComponent } from './rich-editor';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, SelectComponent, RichEditorComponent],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-card paper-panel font-mono" (click)="$event.stopPropagation()">
        <!-- Header Strip -->
        <div class="modal-header">
          <div class="header-left">
            <h3>
              <span>{{ isEditMode ? 'Edit Task Details' : 'Create New Task' }}</span>
            </h3>
          </div>
          <button class="btn btn-ghost btn-xs close-btn" (click)="close.emit()" title="Close">
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>

        <form (ngSubmit)="saveTask()" class="modal-form">
          <div class="form-body">
            @if (submitted && !title.trim()) {
              <div class="form-error-banner font-mono">
                <i class="fi fi-rr-triangle-warning"></i>
                <span>Please complete all required fields below before saving.</span>
              </div>
            }

            <!-- Title -->
            <div class="form-group">
              <label class="form-label">SUMMARY / TITLE <span class="text-rose">*</span></label>
              <input
                #titleInput
                type="text"
                class="form-input"
                [class.input-error]="submitted && !title.trim()"
                [(ngModel)]="title"
                name="title"
                placeholder="e.g. Implement JWT Auth interceptor or Fix CSS grid layout"
                required
              />
              @if (submitted && !title.trim()) {
                <span class="field-error-text font-mono">
                  <i class="fi fi-rr-exclamation"></i> Summary / Title is required
                </span>
              }
            </div>

            <!-- Issue Type -->
            <div class="form-group">
              <label class="form-label">ISSUE TYPE</label>
              <app-select [options]="typeOptions" [(value)]="type" placeholder="Select type..."></app-select>
            </div>

            <!-- Priority & Status Row -->
            @if (isEditMode) {
              <div class="form-row">
                <div class="form-group half">
                  <label class="form-label">STATUS COLUMN</label>
                  <app-select [options]="statusOptions" [(value)]="status" placeholder="Select status..."></app-select>
                </div>

                <div class="form-group half">
                  <label class="form-label">PRIORITY</label>
                  <app-select [options]="priorityOptions" [(value)]="priority" placeholder="Select priority..."></app-select>
                </div>
              </div>
            } @else {
              <div class="form-group">
                <label class="form-label">PRIORITY</label>
                <app-select [options]="priorityOptions" [(value)]="priority" placeholder="Select priority..."></app-select>
              </div>
            }

            <!-- Severity & Reproducibility Row (Only for Bug) -->
            @if (type === 'bug') {
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

            <!-- Assignee & Due Date Row -->
            <div class="form-row">
              <div class="form-group half">
                <label class="form-label">ASSIGNEE</label>
                <app-select
                  [options]="assigneeOptions"
                  [(value)]="assignee"
                  placeholder="Select assignee..."
                ></app-select>
              </div>

              <div class="form-group half">
                <label class="form-label">DUE DATE</label>
                <app-date-picker
                  [value]="dueDate"
                  (valueChange)="dueDate = $event"
                  placeholder="Select due date..."
                ></app-date-picker>
              </div>
            </div>

            <!-- Labels Input -->
            <div class="form-group">
              <label class="form-label">TAGS / LABELS (COMMA-SEPARATED)</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="labelsInput"
                name="labelsInput"
                placeholder="e.g. backend, security, priority"
              />
            </div>

            <!-- Description -->
            <div class="form-group">
              <div class="label-with-hint">
                <label class="form-label">DESCRIPTION / NOTES</label>
              </div>
              <app-rich-editor
                [(value)]="description"
                placeholder="Acceptance criteria, headers, bullet points, technical notes..."
              ></app-rich-editor>
            </div>

            <!-- Attachments Section (Image Only) -->
            <div class="form-group">
              <div class="label-with-hint">
                <label class="form-label">ATTACHMENTS (IMAGE ONLY)</label>
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
                  <div class="dropzone-content">
                    <i class="fi fi-rr-picture dropzone-icon"></i>
                    <div class="dropzone-text">
                      <span class="dropzone-title">Click to upload or drag & drop images</span>
                      <span class="dropzone-sub">PNG, JPG, WEBP, GIF supported</span>
                    </div>
                  </div>
                }
              </div>

              <!-- Thumbnails Grid -->
              @if (attachments().length > 0) {
                <div class="attachment-grid">
                  @for (img of attachments(); track $index) {
                    <div class="attachment-thumb-card" (click)="previewImage.set(img)">
                      <img [src]="img" alt="Attachment" />
                      <div class="thumb-overlay">
                        <i class="fi fi-rr-eye zoom-icon"></i>
                        <button
                          type="button"
                          class="thumb-remove-btn"
                          (click)="$event.stopPropagation(); removeAttachment($index)"
                          title="Remove image"
                        >
                          <i class="fi fi-rr-trash"></i>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <div class="modal-footer">
            <div class="footer-hint">
              <span class="status-dot dot-emerald"></span>
              <span>BILO WORKSPACE ITEM</span>
            </div>
            <div class="footer-actions">
              <button type="button" class="btn btn-secondary btn-sm" (click)="close.emit()">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary btn-sm">
                <i class="fi fi-rr-check"></i>
                <span>{{ isEditMode ? 'Save Changes' : 'Create Task' }}</span>
              </button>
            </div>
          </div>
        </form>

        <!-- Lightbox Image Preview Modal -->
        @if (previewImage(); as fullImg) {
          <div class="lightbox-overlay" (click)="previewImage.set(null)">
            <div class="lightbox-card" (click)="$event.stopPropagation()">
              <div class="lightbox-header">
                <span class="font-mono text-muted">IMAGE PREVIEW</span>
                <button class="btn btn-ghost btn-xs close-btn" (click)="previewImage.set(null)">
                  <i class="fi fi-rr-cross"></i>
                </button>
              </div>
              <div class="lightbox-body">
                <img [src]="fullImg" alt="Full size preview" />
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .modal-card {
      width: 100%;
      max-width: 580px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      box-shadow: var(--shadow-modal);
      overflow: hidden;
      position: relative;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 1.15rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .header-left h3 {
      font-size: 0.95rem;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .close-btn {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .modal-form {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
    }
    .form-body {
      padding: 1.15rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      max-height: calc(90vh - 120px);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .form-row {
      display: flex;
      gap: 0.85rem;
    }
    .half {
      flex: 1;
    }

    .form-label {
      font-size: 0.675rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.04em;
    }
    .label-with-hint {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .desc-hint {
      font-size: 0.65rem;
      color: var(--text-muted);
      font-weight: 500;
      opacity: 0.8;
    }

    .form-input, .form-select, .form-textarea {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-main);
      font-family: var(--font-mono);
      font-size: 0.8rem;
      padding: 0.45rem 0.65rem;
      transition: var(--transition-fast);
    }
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      outline: none;
      border-color: var(--border-medium);
      background: var(--bg-surface);
    }

    /* Attachment Upload Styles */
    .attachment-count {
      font-size: 0.65rem;
      color: var(--accent-cyan);
      font-weight: 600;
    }
    .attachment-dropzone {
      border: 1px dashed var(--border-medium);
      border-radius: var(--radius-xs);
      background: var(--bg-surface-subtle);
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: var(--transition-fast);
      text-align: center;
    }
    .attachment-dropzone:hover, .attachment-dropzone.drag-over {
      border-color: var(--accent-cyan);
      background: rgba(6, 182, 212, 0.05);
    }
    .dropzone-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.65rem;
    }
    .dropzone-icon {
      font-size: 1.25rem;
      color: var(--accent-cyan);
    }
    .dropzone-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
    }
    .dropzone-title {
      font-size: 0.775rem;
      font-weight: 600;
      color: var(--text-main);
    }
    .dropzone-sub {
      font-size: 0.675rem;
      color: var(--text-muted);
    }
    .attachment-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.35rem;
    }
    .attachment-thumb-card {
      position: relative;
      width: 72px;
      height: 72px;
      border-radius: var(--radius-xs);
      border: 1px solid var(--border-medium);
      overflow: hidden;
      background: var(--bg-canvas);
      cursor: pointer;
    }
    .attachment-thumb-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumb-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      opacity: 0;
      transition: var(--transition-fast);
    }
    .attachment-thumb-card:hover .thumb-overlay {
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

    /* Lightbox Modal */
    .lightbox-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 1100;
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

    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1.15rem;
      background: var(--bg-surface-subtle);
      border-top: 1px solid var(--border-subtle);
    }
    .footer-hint {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.675rem;
      color: var(--text-muted);
    }
    .footer-actions {
      display: flex;
      gap: 0.5rem;
    }
    .form-error-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(244, 63, 94, 0.1);
      border: 1px solid rgba(244, 63, 94, 0.4);
      color: #f43f5e;
      padding: 0.6rem 0.85rem;
      border-radius: var(--radius-xs);
      font-size: 0.775rem;
      font-weight: 600;
    }
    .input-error {
      border-color: #f43f5e !important;
      box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.2) !important;
      background: rgba(244, 63, 94, 0.03) !important;
    }
    .field-error-text {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: #f43f5e;
      font-size: 0.725rem;
      font-weight: 600;
      margin-top: 0.25rem;
    }
  `]
})
export class TaskModalComponent implements OnInit, AfterViewInit {
  @Input() taskToEdit: Task | null = null;
  @Input() defaultProjectId: string = '';
  @Input() defaultStatus: string = '';
  @Input() defaultDueDate: string = '';
  @Output() close = new EventEmitter<Task | undefined>();

  @ViewChild('titleInput') titleInput!: ElementRef<HTMLInputElement>;

  submitted = false;
  title = '';
  description = '';
  projectId = '';
  type: TaskType = 'task';
  status: string = '';
  priority: TaskPriority = 'medium';
  severity: TaskSeverity | '' = '';
  reproducibility: TaskReproducibility | '' = '';
  assignee = 'Unassigned';
  assigneeOptions: SelectOption[] = [];
  dueDate = '';
  labelsInput = '';

  attachments = signal<string[]>([]);
  uploadingAttachments = signal<boolean>(false);
  uploadCount = signal<number>(0);
  previewImage = signal<string | null>(null);
  isDraggingOver = signal<boolean>(false);

  typeOptions: SelectOption[] = [
    { value: 'task', label: 'Task', icon: 'fi fi-rr-checkbox text-cyan' },
    { value: 'story', label: 'Story', icon: 'fi fi-rr-book-alt text-cyan' },
    { value: 'bug', label: 'Bug', icon: 'fi fi-rr-bug text-rose' },
    { value: 'epic', label: 'Epic', icon: 'fi fi-rr-rocket text-amber' }
  ];

  priorityOptions: SelectOption[] = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  severityOptions: SelectOption[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'major', label: 'Major' },
    { value: 'minor', label: 'Minor' },
    { value: 'trivial', label: 'Trivial' }
  ];

  reproducibilityOptions: SelectOption[] = [
    { value: 'always', label: 'Always' },
    { value: 'often', label: 'Often' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'rarely', label: 'Rarely' },
    { value: 'unable', label: 'Unable to Reproduce' }
  ];

  get projectOptions(): SelectOption[] {
    return this.projectService.projects().map(p => ({
      value: p.id,
      label: p.name,
      icon: 'fi fi-rr-folder'
    }));
  }

  get statusOptions(): SelectOption[] {
    const statuses = this.getAvailableStatuses();
    return statuses.map(s => ({
      value: s.name,
      label: s.name
    }));
  }

  get isEditMode(): boolean {
    return !!this.taskToEdit;
  }

  constructor(
    private taskService: TaskService,
    public projectService: ProjectService,
    public workflowService: WorkflowService,
    private taskShareService: TaskShareService
  ) { }

  async ngOnInit() {
    if (this.taskToEdit) {
      this.title = this.taskToEdit.title;
      this.description = this.taskToEdit.description || '';
      this.projectId = this.taskToEdit.project_id || this.projectService.activeProject()?.id || (this.projectService.projects()[0]?.id || '');
      this.type = this.taskToEdit.type || 'task';
      this.status = this.taskToEdit.status || '';
      this.priority = this.taskToEdit.priority || 'medium';
      this.severity = this.taskToEdit.severity || '';
      this.reproducibility = this.taskToEdit.reproducibility || '';
      this.assignee = (this.taskToEdit.assignee && this.taskToEdit.assignee !== 'Self') ? this.taskToEdit.assignee : 'Unassigned';
      this.dueDate = this.taskToEdit.due_date || '';
      this.labelsInput = (this.taskToEdit.labels || []).join(', ');
      if (this.taskToEdit.attachments && Array.isArray(this.taskToEdit.attachments)) {
        this.attachments.set([...this.taskToEdit.attachments]);
      }
    } else {
      const activeProjId = this.projectService.activeProject()?.id;
      if (activeProjId) {
        this.projectId = activeProjId;
      } else if (this.defaultProjectId && this.defaultProjectId !== 'ALL' && this.defaultProjectId !== 'all') {
        this.projectId = this.defaultProjectId;
      } else {
        this.projectId = this.projectService.projects()[0]?.id || '';
      }
      this.severity = '';
      this.reproducibility = '';
      if (this.defaultStatus) this.status = this.defaultStatus;
      if (this.defaultDueDate) this.dueDate = this.defaultDueDate;
    }
    await this.loadAssigneeOptions();
  }

  async loadAssigneeOptions() {
    const opts = await this.projectService.getWorkspaceMemberOptions(this.projectId, this.assignee);
    this.assigneeOptions = opts as SelectOption[];
    if (!this.assignee || this.assignee === 'Self') {
      this.assignee = 'Unassigned';
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.titleInput) {
        this.titleInput.nativeElement.focus();
      }
    }, 50);
  }

  getAvailableStatuses(): Workflow[] {
    return this.workflowService.getWorkflowsForProject(this.projectId);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(Array.from(input.files));
    }
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processFiles(Array.from(event.dataTransfer.files));
    }
  }

  async processFiles(files: File[]) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      this.taskShareService.showToast('Please select valid image files.');
      return;
    }

    this.uploadingAttachments.set(true);
    this.uploadCount.set(imageFiles.length);

    try {
      for (const file of imageFiles) {
        const imgData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || '');
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(file);
        });

        if (imgData) {
          this.attachments.update(curr => [...curr, imgData]);
        }
      }
      this.taskShareService.showToast(`${imageFiles.length} image(s) attached.`);
    } catch (err) {
      console.error('Error uploading image file:', err);
      this.taskShareService.showToast('Failed to load image file. Please try again.');
    } finally {
      this.uploadingAttachments.set(false);
      this.uploadCount.set(0);
    }
  }

  removeAttachment(index: number) {
    this.attachments.update(curr => curr.filter((_, i) => i !== index));
  }

  async saveTask() {
    this.submitted = true;
    if (!this.title.trim()) return;

    if (!this.projectId) {
      this.projectId = this.projectService.activeProject()?.id || (this.projectService.projects()[0]?.id || '');
    }

    const parsedLabels = this.labelsInput
      .split(',')
      .map(l => l.trim().toLowerCase())
      .filter(l => l.length > 0);

    const available = this.getAvailableStatuses();
    const finalStatus = this.isEditMode
      ? (this.status || (available.length > 0 ? available[0].name : 'todo'))
      : (this.defaultStatus || (available.length > 0 ? available[0].name : 'todo'));
    const activeWf = available.find(w => w.name === finalStatus) || (available.length > 0 ? available[0] : undefined);

    const targetSeverity = (this.type === 'bug' && this.severity) ? (this.severity as TaskSeverity) : undefined;
    const targetReproducibility = (this.type === 'bug' && this.reproducibility) ? (this.reproducibility as TaskReproducibility) : undefined;

    let resTask: Task | undefined = undefined;

    if (this.isEditMode && this.taskToEdit) {
      const updated = await this.taskService.updateTask(this.taskToEdit.id, {
        title: this.title,
        description: this.description,
        project_id: this.projectId,
        workflow_id: activeWf?.id,
        type: this.type,
        status: finalStatus,
        priority: this.priority,
        severity: targetSeverity,
        reproducibility: targetReproducibility,
        assignee: this.assignee,
        due_date: this.dueDate,
        labels: parsedLabels,
        attachments: this.attachments()
      });
      resTask = updated || undefined;
    } else {
      const created = await this.taskService.createTask({
        title: this.title,
        description: this.description,
        project_id: this.projectId,
        workflow_id: activeWf?.id,
        type: this.type,
        status: finalStatus,
        priority: this.priority,
        severity: targetSeverity,
        reproducibility: targetReproducibility,
        assignee: this.assignee,
        due_date: this.dueDate,
        labels: parsedLabels,
        attachments: this.attachments()
      });
      resTask = created;
    }

    this.close.emit(resTask);
  }
}

