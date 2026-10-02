import { Component, EventEmitter, Input, OnInit, Output, AfterViewInit, ViewChild, ElementRef, OnDestroy, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../core/services/project.service';
import { Project } from '../../core/models/project.model';
import { SelectComponent, SelectOption } from './select';
import { ConfirmModalComponent } from './confirm-modal';
import { sanitizeLabels } from '../../core/utils/label.util';
import { registerModal, unregisterModal, isTopModal } from '../../core/utils/modal-stack.util';

@Component({
  selector: 'app-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectComponent, ConfirmModalComponent],
  template: `
    <div class="modal-overlay" [style.z-index]="modalZIndex" (click)="close.emit()">
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
              <div class="label-with-hint">
                <label class="form-label">PROJECT NAME <span class="text-rose">*</span></label>
              </div>
              <input
                #nameInput
                type="text"
                class="form-input"
                [class.input-error]="submitted && !name.trim()"
                [ngModel]="name"
                (ngModelChange)="onNameChange($event)"
                name="name"
                placeholder="e.g. Tokio Async Microservice or bilo Core Engine"
                maxlength="50"
                required
              />
              @if (submitted && !name.trim()) {
                <span class="field-error-text font-mono">
                  <i class="fi fi-rr-exclamation"></i> Project Name is required
                </span>
              } @else if (isDuplicateName) {
                <div class="duplicate-warning-box font-mono">
                  <i class="fi fi-rr-info text-amber"></i>
                  <span>A workspace named <strong>"{{ name.trim() }}"</strong> already exists.</span>
                  <button type="button" class="btn btn-ghost btn-xs text-cyan apply-unique-btn" (click)="useSuggestedName()">
                    Use "{{ suggestedUniqueName }}"
                  </button>
                </div>
              }
            </div>

            <!-- Project Code / Key (Slug) -->
            <div class="form-group">
              <div class="label-with-hint">
                <label class="form-label">PROJECT CODE / KEY <span class="text-rose">*</span></label>
              </div>
              <input
                type="text"
                class="form-input font-mono"
                [class.input-error]="submitted && !slug.trim()"
                [ngModel]="slug"
                (ngModelChange)="onSlugChange($event)"
                name="slug"
                placeholder="e.g. TOK, BIL, DEMO"
                maxlength="15"
                required
              />
              @if (submitted && !slug.trim()) {
                <span class="field-error-text font-mono">
                  <i class="fi fi-rr-exclamation"></i> Project Code is required
                </span>
              } @else if (isDuplicateSlug) {
                <div class="duplicate-warning-box font-mono">
                  <i class="fi fi-rr-info text-amber"></i>
                  <span>Project Code <strong>"{{ slug.trim().toUpperCase() }}"</strong> is already in use.</span>
                  <button type="button" class="btn btn-ghost btn-xs text-cyan apply-unique-btn" (click)="useSuggestedSlug()">
                    Use "{{ suggestedUniqueSlug }}"
                  </button>
                </div>
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
                placeholder="e.g. frontend, backend, mobile, pwa"
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
                    title="Upload project image"
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
                      (click)="removeImage()"
                      [disabled]="uploadingImage"
                      title="Remove image"
                    >
                      <i class="fi fi-rr-trash"></i> Remove
                    </button>
                  }
                </div>
              </div>
              @if (imageError) {
                <span class="field-error-text font-mono">
                  <i class="fi fi-rr-exclamation"></i> {{ imageError }}
                </span>
              }
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
              <button
                type="submit"
                class="btn btn-primary btn-sm"
                [disabled]="submitting() || (submitted && !name.trim())"
              >
                @if (submitting()) {
                  <i class="fi fi-rr-spinner spinner font-mono"></i>
                  <span>Saving...</span>
                } @else {
                  <i class="fi fi-rr-check"></i>
                  <span>{{ isEditMode ? 'Save Changes' : 'Create Project' }}</span>
                }
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
    .duplicate-warning-box {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.725rem;
      margin-top: 0.35rem;
      padding: 0.35rem 0.5rem;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: var(--radius-xs);
      color: var(--text-main);
    }
    .apply-unique-btn {
      padding: 0.1rem 0.4rem;
      font-size: 0.7rem;
      white-space: nowrap;
      text-decoration: underline;
    }
  `]
})
export class ProjectModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() projectToEdit: Partial<Project> | null = null;
  @Output() close = new EventEmitter<Project | undefined>();

  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;

  submitted = false;

  name = '';
  slug = '';
  userEditedSlug = false;
  description = '';
  status: 'active' | 'archived' | 'completed' = 'active';
  labelsInput = '';
  color = '#06b6d4';
  imageUrl = '';
  uploadingImage = false;
  imageError = '';
  modalZIndex = 2000;
  private readonly modalId = 'project-modal-' + Math.random().toString(36).substring(2, 9);

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

  useSuggestedName() {
    this.name = this.suggestedUniqueName;
    if (!this.userEditedSlug && !this.isEditMode) {
      this.slug = this.projectService.generateSlug(this.name).toUpperCase();
    }
  }

  get isDuplicateSlug(): boolean {
    if (!this.slug || !this.slug.trim()) return false;
    const excludeId = this.projectToEdit?.id;
    const inputSlug = this.slug.trim().toLowerCase();
    return this.projectService.projects().some(p => p.id !== excludeId && (p.slug || '').trim().toLowerCase() === inputSlug);
  }

  get suggestedUniqueSlug(): string {
    const excludeId = this.projectToEdit?.id;
    const raw = this.slug.trim() || this.name.trim() || 'PRJ';
    return this.projectService.generateUniqueSlug(raw, excludeId).toUpperCase();
  }

  useSuggestedSlug() {
    this.slug = this.suggestedUniqueSlug;
  }

  onNameChange(newName: string) {
    this.name = newName;
    if (!this.userEditedSlug && !this.isEditMode && newName.trim()) {
      this.slug = this.projectService.generateSlug(newName).toUpperCase();
    }
  }

  onSlugChange(newSlug: string) {
    this.slug = newSlug;
    this.userEditedSlug = true;
  }

  removeImage() {
    this.imageUrl = '';
    this.imageError = '';
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.imageError = '';

    if (input.files && input.files[0]) {
      const file = input.files[0];

      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
      if (!allowedMimeTypes.includes((file.type || '').toLowerCase())) {
        this.imageError = 'Invalid file type. Please select a JPEG, PNG, WebP, or GIF image.';
        input.value = '';
        return;
      }

      const MAX_PROJECT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_PROJECT_IMAGE_SIZE_BYTES) {
        this.imageError = `Image file size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 5MB limit.`;
        input.value = '';
        return;
      }

      this.uploadingImage = true;
      try {
        const uploadedUrl = await this.projectService.uploadProjectImage(file);
        if (uploadedUrl) {
          this.imageUrl = uploadedUrl;
          this.imageError = '';
        } else {
          this.imageError = 'Failed to process image. File may be corrupt or invalid.';
        }
      } catch (e: any) {
        console.error('Image upload failed:', e);
        this.imageError = e?.message || 'Failed to upload project image.';
      }
    }
  }

  constructor(
    public projectService: ProjectService,
    private elementRef: ElementRef
  ) { }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isTopModal(this.modalId) && !this.showConfirmDelete) {
      e.preventDefault();
      this.close.emit();
      return;
    }

    if (e.key === 'Tab' && isTopModal(this.modalId) && !this.showConfirmDelete) {
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

  ngOnInit() {
    this.modalZIndex = registerModal(this.modalId);
    if (this.projectToEdit) {
      this.name = this.projectToEdit.name || '';
      this.slug = (this.projectToEdit.slug || this.projectService.generateSlug(this.name)).toUpperCase();
      this.description = this.projectToEdit.description || '';
      this.status = this.projectToEdit.status || 'active';
      this.labelsInput = (this.projectToEdit.labels || []).join(', ');
      this.color = this.projectToEdit.color || '#06b6d4';
      this.imageUrl = this.projectToEdit.image_url || this.projectToEdit.icon || '';
    }
  }

  ngOnDestroy() {
    unregisterModal(this.modalId);
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.nameInput) {
        this.nameInput.nativeElement.focus();
      }
    }, 50);
  }

  submitting = signal<boolean>(false);

  async saveProject() {
    this.submitted = true;
    if (!this.name.trim()) return;

    if (!this.slug.trim()) {
      this.slug = this.projectService.generateSlug(this.name).toUpperCase();
    }

    this.submitting.set(true);
    try {
      if (this.isDuplicateName) {
        this.name = this.suggestedUniqueName;
      }
      if (this.isDuplicateSlug) {
        this.slug = this.suggestedUniqueSlug;
      }

      const finalSlug = this.slug.trim().toUpperCase();
      const parsedLabels = sanitizeLabels(this.labelsInput.split(','));

      let resultProject: Project | undefined = undefined;

      if (this.isEditMode && this.projectToEdit && this.projectToEdit.id) {
        const updated = await this.projectService.updateProject(this.projectToEdit.id, {
          name: this.name,
          slug: finalSlug,
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
          slug: finalSlug,
          description: this.description,
          status: 'active',
          labels: parsedLabels,
          color: this.color,
          image_url: this.imageUrl
        });
        resultProject = created;
      }

      this.close.emit(resultProject);
    } catch (e) {
      console.error('Error saving project:', e);
    } finally {
      this.submitting.set(false);
    }
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
