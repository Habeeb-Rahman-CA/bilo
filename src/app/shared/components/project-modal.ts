import { Component, EventEmitter, Input, OnInit, Output, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../core/services/project.service';
import { Project } from '../../core/models/project.model';
import { SelectComponent, SelectOption } from './select';
import { ConfirmModalComponent } from './confirm-modal';
import { sanitizeLabels } from '../../core/utils/label.util';

@Component({
  selector: 'app-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectComponent, ConfirmModalComponent],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-card paper-panel font-mono" (click)="$event.stopPropagation()">
        <!-- Header Strip -->
        <div class="modal-header">
          <div class="header-left">
            <h3>
              <span>{{ isEditMode ? 'Edit Project Setup' : 'Create Project' }}</span>
            </h3>
          </div>
          <button class="btn btn-ghost btn-xs close-btn" (click)="close.emit()" title="Close">
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>

        <form (ngSubmit)="saveProject()" class="modal-form">
          <div class="form-body">
            @if (submitted && !name.trim()) {
              <div class="form-error-banner font-mono">
                <i class="fi fi-rr-triangle-warning"></i>
                <span>Please enter a project name before saving.</span>
              </div>
            }

            <!-- Project Name -->
            <div class="form-group">
              <label class="form-label">PROJECT NAME <span class="text-rose">*</span></label>
              <input
                #nameInput
                type="text"
                class="form-input"
                [class.input-error]="submitted && !name.trim()"
                [(ngModel)]="name"
                name="name"
                placeholder="e.g. Tokio Async Microservice or bilo Core Engine"
                required
              />
              @if (submitted && !name.trim()) {
                <span class="field-error-text font-mono">
                  <i class="fi fi-rr-exclamation"></i> Project Name is required
                </span>
              } @else if (isDuplicateName) {
                <span class="field-info-text font-mono text-amber" style="font-size: 0.7rem; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.3rem;">
                  <i class="fi fi-rr-info"></i> A workspace named "{{ name.trim() }}" already exists. Saving will use "{{ suggestedUniqueName }}" for unique identity.
                </span>
              }
            </div>


            <!-- Status Row (Only visible when editing an existing project) -->
            @if (isEditMode) {
              <div class="form-group">
                <label class="form-label">PROJECT STATUS</label>
                <app-select
                  [options]="projectStatusOptions"
                  [(value)]="status"
                  placeholder="Select status..."
                ></app-select>
              </div>
            }

            <!-- Labels Input -->
            <div class="form-group">
              <label class="form-label">TAGS / TECH STACK (COMMA-SEPARATED)</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="labelsInput"
                name="labelsInput"
                placeholder="e.g. frontend, angular, rust, pwa"
              />
            </div>

            <!-- Description -->
            <div class="form-group">
              <label class="form-label">DESCRIPTION / SUMMARY</label>
              <textarea
                class="form-textarea"
                rows="3"
                [(ngModel)]="description"
                name="description"
                placeholder="High-level architecture goals, scope summary, or tech stack details..."
              ></textarea>
            </div>

            <!-- Project Image Upload -->
            <div class="form-group">
              <label class="form-label">PROJECT LOGO / IMAGE</label>
              <div class="image-upload-card">
                <div class="image-preview-box" [style.border-color]="color">
                  @if (imageUrl) {
                    <img [src]="imageUrl" alt="Project Image" class="project-img-preview" />
                  } @else {
                    <i class="fi fi-rr-picture text-muted"></i>
                  }
                </div>

                <div class="upload-controls font-mono">
                  <input
                    type="file"
                    #fileInput
                    accept="image/*"
                    (change)="onFileSelected($event)"
                    style="display: none;"
                  />
                  <button
                    type="button"
                    class="btn btn-secondary btn-xs"
                    (click)="fileInput.click()"
                    [disabled]="uploadingImage"
                    title="Upload project image to Supabase Storage"
                  >
                    @if (uploadingImage) {
                      <i class="fi fi-rr-spinner spinner font-mono"></i> Uploading...
                    } @else {
                      <i class="fi fi-rr-cloud-upload text-cyan"></i> {{ imageUrl ? 'Change Image' : 'Upload Image' }}
                    }
                  </button>

                  @if (imageUrl) {
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-rose"
                      (click)="imageUrl = ''"
                      [disabled]="uploadingImage"
                      title="Remove image"
                    >
                      <i class="fi fi-rr-trash"></i> Remove
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Color Accent Picker -->
            <div class="form-group">
              <label class="form-label">PROJECT COLOR ACCENT</label>
              <div class="color-picker">
                @for (c of availableColors; track c) {
                  <button
                    type="button"
                    class="color-btn"
                    [style.background-color]="c"
                    [class.selected]="color === c"
                    (click)="color = c"
                    [title]="c"
                  >
                    @if (color === c) {
                      <i class="fi fi-rr-check text-white"></i>
                    }
                  </button>
                }
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <div class="footer-hint">
              <span class="status-dot dot-emerald"></span>
              <span>PROJECT METADATA</span>
            </div>
            <div class="footer-actions">
              @if (isEditMode) {
                <button type="button" class="btn btn-ghost btn-sm text-rose" (click)="confirmDeleteProject()">
                  <i class="fi fi-rr-trash"></i> Delete Project
                </button>
              }
              <button type="button" class="btn btn-secondary btn-sm" (click)="close.emit()">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary btn-sm">
                <i class="fi fi-rr-check"></i>
                <span>{{ isEditMode ? 'Save Changes' : 'Create Project' }}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <app-confirm-modal
      [isOpen]="showConfirmDelete"
      title="Delete Project"
      [message]="'Are you sure you want to delete project &quot;' + name + '&quot;? This will permanently delete the project and all associated tasks, workflows, and activities.'"
      confirmText="Delete Project"
      cancelText="Cancel"
      type="danger"
      (confirm)="executeDeleteProject()"
      (cancel)="cancelDeleteProject()"
    ></app-confirm-modal>
  `,
  styles: [`
    .modal-card {
      width: 100%;
      max-width: 540px;
      max-height: 90vh;
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

    .form-label {
      font-size: 0.675rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.04em;
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
      width: 100%;
      box-sizing: border-box;
    }
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      outline: none;
      border-color: var(--border-medium);
      background: var(--bg-surface);
    }

    .input-with-icon {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .field-icon {
      position: absolute;
      left: 0.75rem;
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    .icon-padded {
      padding-left: 2.3rem;
    }

    .color-picker {
      display: flex;
      gap: 0.65rem;
      margin-top: 0.2rem;
    }
    .color-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition-fast);
    }
    .color-btn.selected {
      border-color: var(--text-main);
      transform: scale(1.15);
    }
    .text-white {
      color: #ffffff;
      font-size: 0.7rem;
    }

    .image-upload-card {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 0.65rem;
    }
    .image-preview-box {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-xs);
      border: 1.5px solid var(--border-medium);
      background: var(--bg-surface);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      overflow: hidden;
      flex-shrink: 0;
    }
    .project-img-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .upload-controls {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .spinner {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
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
export class ProjectModalComponent implements OnInit, AfterViewInit {
  @Input() projectToEdit: Partial<Project> | null = null;
  @Output() close = new EventEmitter<Project | undefined>();

  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;

  submitted = false;

  name = '';
  description = '';
  status: 'active' | 'archived' | 'completed' = 'active';
  labelsInput = '';
  color = '#06b6d4';
  imageUrl = '';
  uploadingImage = false;

  projectStatusOptions: SelectOption[] = [
    { value: 'active', label: 'Active Workspace' },
    { value: 'completed', label: 'Completed Project' },
    { value: 'archived', label: 'Archived Workspace' }
  ];

  availableColors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6'];

  get isEditMode(): boolean {
    return !!(this.projectToEdit && this.projectToEdit.id);
  }

  get isDuplicateName(): boolean {
    if (!this.name || !this.name.trim()) return false;
    const excludeId = this.projectToEdit?.id;
    const inputName = this.name.trim().toLowerCase();
    return this.projectService.projects().some(p => p.id !== excludeId && (p.name || '').trim().toLowerCase() === inputName);
  }

  get suggestedUniqueName(): string {
    const excludeId = this.projectToEdit?.id;
    return this.projectService.generateUniqueName(this.name.trim(), excludeId);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.uploadingImage = true;
      try {
        const uploadedUrl = await this.projectService.uploadProjectImage(file);
        if (uploadedUrl) {
          this.imageUrl = uploadedUrl;
        }
      } catch (e) {
        console.error('Image upload failed:', e);
      } finally {
        this.uploadingImage = false;
        input.value = '';
      }
    }
  }

  constructor(private projectService: ProjectService) { }

  ngOnInit() {
    if (this.projectToEdit) {
      this.name = this.projectToEdit.name || '';
      this.description = this.projectToEdit.description || '';
      this.status = this.projectToEdit.status || 'active';
      this.labelsInput = (this.projectToEdit.labels || []).join(', ');
      this.color = this.projectToEdit.color || '#06b6d4';
      this.imageUrl = this.projectToEdit.image_url || this.projectToEdit.icon || '';
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.nameInput) {
        this.nameInput.nativeElement.focus();
      }
    }, 50);
  }

  async saveProject() {
    this.submitted = true;
    if (!this.name.trim()) return;

    const parsedLabels = sanitizeLabels(this.labelsInput.split(','));

    let resultProject: Project | undefined = undefined;

    if (this.isEditMode && this.projectToEdit && this.projectToEdit.id) {
      const updated = await this.projectService.updateProject(this.projectToEdit.id, {
        name: this.name,
        description: this.description,
        status: this.status,
        labels: parsedLabels,
        color: this.color,
        image_url: this.imageUrl
      });
      resultProject = updated || undefined;
    } else {
      const created = await this.projectService.createProject({
        name: this.name,
        description: this.description,
        status: 'active',
        labels: parsedLabels,
        color: this.color,
        image_url: this.imageUrl
      });
      resultProject = created;
    }

    this.close.emit(resultProject);
  }

  showConfirmDelete = false;

  confirmDeleteProject() {
    this.showConfirmDelete = true;
  }

  cancelDeleteProject() {
    this.showConfirmDelete = false;
  }

  async executeDeleteProject() {
    if (this.projectToEdit?.id) {
      await this.projectService.deleteProject(this.projectToEdit.id);
      this.close.emit();
    }
  }
}
