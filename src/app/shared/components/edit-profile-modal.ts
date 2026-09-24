import { Component, EventEmitter, HostListener, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TaskShareService } from '../../core/services/task-share.service';

@Component({
  selector: 'app-edit-profile-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-card paper-panel font-mono" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-left">
            <h3>
              <i class="fi fi-rr-user-pen text-cyan"></i>
              <span>Edit Profile Details</span>
            </h3>
          </div>
          <button type="button" class="btn btn-ghost btn-xs close-btn" (click)="close.emit()" title="Close (Esc)">
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>

        <form (ngSubmit)="saveProfile()" class="modal-form">
          <div class="form-body">
            @if (submitted && !displayName.trim()) {
              <div class="form-error-banner font-mono">
                <i class="fi fi-rr-triangle-warning"></i>
                <span>Please enter a display name.</span>
              </div>
            }

            <!-- Avatar Picture Upload Section -->
            <div class="form-group avatar-upload-group">
              <label class="form-label">PROFILE PICTURE / AVATAR</label>

              <div
                class="avatar-uploader-box"
                [class.drag-over]="isDragging()"
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave($event)"
                (drop)="onDrop($event)"
              >
                <div class="avatar-preview-wrapper">
                  @if (uploadingAvatar()) {
                    <div class="avatar-placeholder font-mono">
                      <i class="fi fi-rr-spinner spinner text-cyan"></i>
                    </div>
                  } @else if (avatarUrl) {
                    <img [src]="avatarUrl" alt="Avatar Preview" class="avatar-image-preview" />
                  } @else {
                    <div class="avatar-placeholder font-mono">
                      <i class="fi fi-rr-user-check text-cyan"></i>
                    </div>
                  }
                </div>

                <div class="avatar-upload-info font-mono">
                  @if (uploadingAvatar()) {
                    <div class="upload-status-badge text-cyan">
                      <i class="fi fi-rr-spinner spinner"></i>
                      <span>Uploading profile image...</span>
                    </div>
                  } @else {
                    <div class="avatar-action-row">
                      <button
                        type="button"
                        class="btn btn-secondary btn-xs"
                        [disabled]="uploadingAvatar()"
                        (click)="avatarInput.click()"
                      >
                        <i class="fi fi-rr-picture"></i> Upload Photo
                      </button>

                      @if (avatarUrl) {
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs text-rose"
                          (click)="removeAvatar()"
                          title="Remove profile image"
                        >
                          <i class="fi fi-rr-trash"></i> Remove
                        </button>
                      }
                    </div>
                    <span class="upload-hint">Drag & drop image file or click Upload (PNG, JPG, WebP)</span>
                  }
                </div>

                <input
                  #avatarInput
                  type="file"
                  accept="image/*"
                  (change)="onFileSelected($event)"
                  style="display: none;"
                />
              </div>
            </div>

            <!-- Display Name -->
            <div class="form-group">
              <label class="form-label">DISPLAY NAME <span class="text-rose">*</span></label>
              <input
                type="text"
                class="form-input font-mono"
                [class.input-error]="submitted && (!displayName.trim() || displayName.trim().length > 20)"
                [(ngModel)]="displayName"
                name="displayName"
                placeholder="e.g. Habeeb Rahman or Alex Smith"
                maxlength="20"
                required
              />
              @if (submitted && !displayName.trim()) {
                <span class="field-error-text font-mono text-rose" style="font-size: 0.7rem;">Display name is required.</span>
              }
              @if (submitted && displayName.trim().length > 20) {
                <span class="field-error-text font-mono text-rose" style="font-size: 0.7rem;">Display name cannot exceed 20 characters.</span>
              }
            </div>

            <!-- Email Address (Read-Only) -->
            <div class="form-group">
              <label class="form-label">EMAIL ADDRESS (READ-ONLY)</label>
              <div class="readonly-input-wrap font-mono">
                <i class="fi fi-rr-lock text-muted"></i>
                <input
                  type="email"
                  class="form-input readonly-input"
                  [value]="authService.userEmail()"
                  readonly
                  tabindex="-1"
                />
              </div>
            </div>
          </div>

          <!-- Form Footer Actions -->
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              (click)="close.emit()"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="saving()"
            >
              <i [class]="saving() ? 'fi fi-rr-spinner spinner' : 'fi fi-rr-disk'"></i>
              <span>{{ saving() ? 'Saving...' : 'Save Profile' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-card {
      width: 100%;
      max-width: 480px;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: scaleUp 0.15s ease-out;
    }

    @keyframes scaleUp {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 1.15rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
    }
    .header-left h3 {
      font-size: 0.95rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
    }
    .close-btn {
      color: var(--text-muted);
    }
    .close-btn:hover {
      color: var(--accent-rose);
    }

    .modal-form {
      display: flex;
      flex-direction: column;
    }
    .form-body {
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 70vh;
      overflow-y: auto;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .form-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }
    .form-input {
      font-size: 0.825rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-main);
      padding: 0.45rem 0.65rem;
      outline: none;
      transition: var(--transition-fast);
    }
    .form-input:focus {
      border-color: var(--accent-cyan);
    }
    .input-error {
      border-color: #f43f5e !important;
    }

    .readonly-input-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--bg-canvas);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 0.45rem 0.65rem;
      opacity: 0.85;
    }
    .readonly-input-wrap i {
      font-size: 0.8rem;
    }
    .readonly-input {
      border: none !important;
      background: transparent !important;
      padding: 0 !important;
      flex: 1;
      font-size: 0.8rem;
      color: var(--text-muted);
      outline: none;
      pointer-events: none;
    }

    /* Avatar Upload Card */
    .avatar-uploader-box {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1.5px dashed var(--border-medium);
      border-radius: var(--radius-xs);
      transition: var(--transition-fast);
    }
    .avatar-uploader-box.drag-over {
      border-color: var(--accent-cyan);
      background: rgba(6, 182, 212, 0.08);
    }
    .avatar-preview-wrapper {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      background: rgba(6, 182, 212, 0.15);
      border: 2px solid var(--border-medium);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatar-image-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-placeholder {
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .avatar-upload-info {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1;
    }
    .avatar-action-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .upload-status-badge {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.775rem;
      font-weight: 600;
      color: var(--accent-cyan);
    }
    .upload-hint {
      font-size: 0.675rem;
      color: var(--text-muted);
      line-height: 1.3;
    }

    .form-error-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(244, 63, 94, 0.3);
      border-radius: var(--radius-xs);
      color: #f43f5e;
      font-size: 0.75rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.65rem;
      padding: 0.75rem 1.15rem;
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
    }

    .spinner {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
  `]
})
export class EditProfileModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  displayName: string = '';
  avatarUrl: string | null = null;
  saving = signal<boolean>(false);
  uploadingAvatar = signal<boolean>(false);
  submitted = false;
  isDragging = signal<boolean>(false);

  private pendingFile: File | null = null;

  constructor(
    public authService: AuthService,
    private taskShareService: TaskShareService
  ) {}

  ngOnInit() {
    this.displayName = this.authService.userName();
    this.avatarUrl = this.authService.userAvatar();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close.emit();
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.set(false);

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

  private handleFiles(files: File[]) {
    const imageFile = files.find(f => f.type.startsWith('image/'));
    if (!imageFile) {
      this.taskShareService.showToast('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    this.pendingFile = imageFile;
    // Create instant local blob object URL for UI preview without heavy base64 strings
    if (this.avatarUrl && this.avatarUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.avatarUrl);
    }
    this.avatarUrl = URL.createObjectURL(imageFile);
    this.taskShareService.showToast('Image selected. Click "Save Profile" to update.');
  }

  removeAvatar() {
    if (this.avatarUrl && this.avatarUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.avatarUrl);
    }
    this.avatarUrl = null;
    this.pendingFile = null;
  }

  async saveProfile() {
    this.submitted = true;
    const trimmed = this.displayName ? this.displayName.trim() : '';
    if (!trimmed || trimmed.length > 20 || this.saving()) {
      if (!trimmed) {
        this.taskShareService.showToast('Display name cannot be empty.');
      } else if (trimmed.length > 20) {
        this.taskShareService.showToast('Display name cannot exceed 20 characters.');
      }
      return;
    }

    this.saving.set(true);
    try {
      let finalAvatarUrl = this.avatarUrl;

      if (this.pendingFile) {
        this.uploadingAvatar.set(true);
        const uploadedUrl = await this.authService.uploadAvatarFile(this.pendingFile);
        if (uploadedUrl) {
          finalAvatarUrl = uploadedUrl;
        }
        this.uploadingAvatar.set(false);
      }

      await this.authService.updateProfile({
        display_name: trimmed,
        avatar_url: finalAvatarUrl
      });

      this.taskShareService.showToast('Profile updated successfully!');
      this.close.emit();
    } catch (e: any) {
      console.error('Error updating profile:', e);
      this.taskShareService.showToast(e?.message || 'Failed to update profile. Please try again.');
    } finally {
      this.saving.set(false);
      this.uploadingAvatar.set(false);
    }
  }
}
