import { Component, Input, signal, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';
import { Project, ProjectMember, ProjectRole } from '../../core/models/project.model';
import { ConfirmModalComponent } from './confirm-modal';
import { SelectComponent, SelectOption } from './select';

@Component({
  selector: 'app-project-access-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, SelectComponent],
  template: `
    <div class="modal-overlay" (click)="closeModal()">
      <div class="modal-card access-modal-card paper-panel" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-title-box">
            <i class="fi fi-rr-users-alt text-cyan"></i>
            <div>
              <h3>Project Access & Members</h3>
              <span class="project-name-subtitle font-mono">{{ project.name }}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-xs" (click)="closeModal()">
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>

        <!-- Alert Notice -->
        @if (message()) {
          <div class="access-alert font-mono" [class.error]="isError()">
            <i [class]="isError() ? 'fi fi-rr-exclamation text-rose' : 'fi fi-rr-check-circle text-emerald'"></i>
            <span>{{ message() }}</span>
          </div>
        }

        <!-- Invite via Link Section -->
        <div class="invite-link-section paper-panel font-mono">
          <label class="form-label">
            <i class="fi fi-rr-link text-cyan"></i> INVITE VIA LINK
          </label>
          <div class="invite-link-controls">
            <app-select
              class="role-select"
              [options]="roleOptions"
              [(value)]="inviteRole"
              [searchable]="false"
              [compact]="true"
            ></app-select>
            <input
              type="text"
              class="form-input link-input"
              readonly
              [value]="getGeneratedInviteLink()"
              (click)="copyInviteLink()"
            />
            <button class="btn btn-secondary btn-sm copy-btn" (click)="copyInviteLink()">
              @if (linkCopied()) {
                <i class="fi fi-rr-check text-emerald"></i> Copied!
              } @else {
                <i class="fi fi-rr-copy"></i> Copy
              }
            </button>
          </div>
        </div>

        <!-- Add Member Form -->
        <div class="add-member-section paper-panel font-mono">
          <label class="form-label">ADD TEAM MEMBER BY USER ID / EMAIL</label>
          <div class="add-member-form">
            <input
              type="text"
              class="form-input"
              placeholder="Enter User ID or Email"
              [(ngModel)]="newUserId"
            />
            <app-select
              class="role-select"
              [options]="roleOptions"
              [(value)]="newRole"
              [searchable]="false"
              [compact]="true"
            ></app-select>
            <button
              class="btn btn-primary btn-sm"
              [disabled]="submitting() || !newUserId.trim()"
              (click)="addMember()"
            >
              <i class="fi fi-rr-user-add"></i> Add
            </button>
          </div>
        </div>

        <!-- Members List -->
        <div class="members-section font-mono">
          <div class="section-title">
            <span>CURRENT PROJECT MEMBERS ({{ members().length }})</span>
          </div>

          @if (loading()) {
            <div class="loading-state">
              <i class="fi fi-rr-spinner spinner-icon"></i> Loading project members...
            </div>
          } @else if (members().length === 0) {
            <div class="empty-state">
              <p>No explicit team members added. Only project owner has default access.</p>
            </div>
          } @else {
            <div class="members-list">
              @for (m of members(); track m.id) {
                <div class="member-item">
                  <div class="member-info">
                    <i class="fi fi-rr-user member-icon"></i>
                    <div class="member-text">
                      <span class="member-name">{{ getUserDisplayName(m) }}</span>
                      <span class="member-subtext">{{ getUserSubtext(m) }} • Added {{ m.created_at | date:'shortDate' }}</span>
                    </div>
                  </div>

                  <div class="member-actions">
                    <span class="role-badge" [ngClass]="'role-' + m.role">{{ m.role }}</span>

                    @if (isOwner() && m.role !== 'owner') {
                      <button
                        class="btn btn-ghost btn-xs text-amber"
                        (click)="transferOwnership(m.user_id)"
                        title="Transfer project ownership"
                      >
                        Transfer
                      </button>

                      <button
                        class="btn btn-ghost btn-xs text-rose"
                        (click)="removeMember(m.id)"
                        title="Remove member from project"
                      >
                        <i class="fi fi-rr-trash"></i>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="modal-footer font-mono">
          <button class="btn btn-secondary btn-sm" (click)="closeModal()">Done</button>
        </div>
      </div>
    </div>

    @if (confirmState(); as cs) {
      <app-confirm-modal
        [isOpen]="cs.open"
        [title]="cs.title"
        [message]="cs.message"
        confirmText="Confirm"
        type="danger"
        (confirm)="handleConfirm()"
        (cancel)="confirmState.set(null)"
      />
    }
  `,
  styles: [`
    .access-modal-card {
      max-width: 540px;
    }
    .header-title-box {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .header-title-box h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
    }
    .project-name-subtitle {
      font-size: 0.725rem;
      color: var(--text-muted);
    }
    .access-alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 0.75rem;
      border-radius: var(--radius-xs);
      font-size: 0.75rem;
      margin-bottom: 0.85rem;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #4ade80;
    }
    .access-alert.error {
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fb7185;
    }
    .add-member-section, .invite-link-section {
      padding: 0.75rem 0.85rem;
      margin-bottom: 0.85rem;
      background: var(--bg-surface-subtle);
    }
    .invite-link-controls {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.35rem;
    }
    .link-input {
      flex: 1;
      font-size: 0.75rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-muted);
      cursor: pointer;
    }
    .copy-btn {
      white-space: nowrap;
    }
    .form-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
      margin-bottom: 0.4rem;
      display: block;
    }
    .add-member-form {
      display: flex;
      gap: 0.4rem;
    }
    .add-member-form input {
      flex: 1;
    }
    .role-select {
      width: 110px;
      min-width: 110px;
      flex-shrink: 0;
    }
    .members-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .section-title {
      font-size: 0.675rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }
    .members-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      max-height: 240px;
      overflow-y: auto;
    }
    .member-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .member-info {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .member-icon {
      color: var(--text-muted);
    }
    .member-text {
      display: flex;
      flex-direction: column;
    }
    .member-name {
      font-size: 0.825rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .member-subtext {
      font-size: 0.675rem;
      color: var(--text-muted);
    }
    .member-actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .role-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-xs);
      text-transform: uppercase;

    }
    .role-owner {
      background: rgba(168, 85, 247, 0.18);
      color: #c084fc;
      border: 1px solid rgba(168, 85, 247, 0.35);
    }
    .role-admin {
      background: rgba(6, 182, 212, 0.18);
      color: #38bdf8;
      border: 1px solid rgba(6, 182, 212, 0.35);
    }
    .role-member {
      background: rgba(34, 197, 94, 0.18);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.35);
    }
    .role-viewer {
      background: rgba(113, 113, 122, 0.2);
      color: #a1a1aa;
      border: 1px solid rgba(113, 113, 122, 0.35);
    }
    .loading-state, .empty-state {
      padding: 1rem;
      text-align: center;
      font-size: 0.775rem;
      color: var(--text-muted);
    }
    .modal-footer {
      margin-top: 1rem;
      display: flex;
      justify-content: flex-end;
    }
    .spinner-icon {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class ProjectAccessModalComponent implements OnInit {
  @Input() project!: Project;
  @Output() close = new EventEmitter<void>();

  members = signal<ProjectMember[]>([]);
  loading = signal<boolean>(true);
  submitting = signal<boolean>(false);
  newUserId = '';
  newRole: ProjectRole = 'member';
  inviteRole: ProjectRole = 'member';
  linkCopied = signal<boolean>(false);

  roleOptions: SelectOption[] = [
    { value: 'member', label: 'Member' },
    { value: 'admin', label: 'Admin' },
    { value: 'viewer', label: 'Viewer' }
  ];

  message = signal<string>('');
  isError = signal<boolean>(false);

  getGeneratedInviteLink(): string {
    if (!this.project) return '';
    return this.projectService.generateInviteLink(this.project.id, this.inviteRole);
  }

  async copyInviteLink() {
    const link = this.getGeneratedInviteLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 3000);
    } catch (e) {
      console.warn('Failed to copy to clipboard:', e);
    }
  }

  constructor(
    public projectService: ProjectService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadMembers();
  }

  isOwner(): boolean {
    const user = this.authService.user();
    if (!user) return false;
    return this.project.user_id === user.id;
  }

  getUserDisplayName(m: ProjectMember): string {
    if (m.user_name && m.user_name.trim() && m.user_name !== m.user_id) {
      return m.user_name;
    }

    const currentUser = this.authService.user();
    if (currentUser && (m.user_id === currentUser.id || (m.user_email && m.user_email === currentUser.email))) {
      const meta = currentUser.user_metadata;
      if (meta && meta['display_name']) return meta['display_name'];
      if (meta && meta['full_name']) return meta['full_name'];
      if (meta && meta['name']) return meta['name'];
      if (currentUser.email) {
        const parts = currentUser.email.split('@')[0];
        return parts.split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      }
    }

    if (m.user_email) {
      const parts = m.user_email.split('@')[0];
      return parts.split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    if (m.user_id && m.user_id.includes('@')) {
      const parts = m.user_id.split('@')[0];
      return parts.split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.user_id);
    if (!isUuid && m.user_id) {
      const clean = m.user_id.replace(/^usr_/, '').replace(/^user_/, '');
      return clean.split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    if (m.role === 'owner' || m.user_id === this.project?.user_id) {
      return 'Project Owner';
    }

    return `Team Member (${m.user_id.slice(0, 6)})`;
  }

  getUserSubtext(m: ProjectMember): string {
    if (m.user_email) return m.user_email;
    if (m.user_id && m.user_id.includes('@')) return m.user_id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.user_id);
    if (isUuid) return `ID: ${m.user_id.slice(0, 8)}...`;
    return `ID: ${m.user_id}`;
  }

  async loadMembers() {
    if (!this.project) return;
    this.loading.set(true);
    let list = await this.projectService.getProjectMembers(this.project.id);
    const currentUser = this.authService.user();
    const ownerId = this.project.user_id || currentUser?.id;

    if (ownerId && !list.some(m => m.role === 'owner' || m.user_id === ownerId)) {
      const isCurrentOwner = currentUser && ownerId === currentUser.id;
      let ownerName = 'Project Owner';
      let ownerEmail = undefined;

      if (isCurrentOwner) {
        const meta = currentUser.user_metadata;
        ownerName = meta?.['display_name'] || meta?.['full_name'] || meta?.['name'] ||
          (currentUser.email ? currentUser.email.split('@')[0].split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : 'Project Owner');
        ownerEmail = currentUser.email;
      }

      const ownerMember: ProjectMember = {
        id: `owner-${ownerId}`,
        project_id: this.project.id,
        user_id: ownerId,
        role: 'owner',
        user_name: ownerName,
        user_email: ownerEmail,
        created_at: this.project.created_at || new Date().toISOString()
      };
      list = [ownerMember, ...list];
    } else {
      list = list.map(m => {
        if ((m.role === 'owner' || m.user_id === ownerId) && (!m.user_name || m.user_name === m.user_id)) {
          if (currentUser && ownerId === currentUser.id) {
            const meta = currentUser.user_metadata;
            const name = meta?.['display_name'] || meta?.['full_name'] || meta?.['name'] ||
              (currentUser.email ? currentUser.email.split('@')[0].split(/[\._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : 'Project Owner');
            return { ...m, user_name: name, user_email: m.user_email || currentUser.email };
          } else {
            return { ...m, user_name: m.user_name || 'Project Owner' };
          }
        }
        return m;
      });
    }

    this.members.set(list);
    this.loading.set(false);
  }

  async addMember() {
    if (!this.newUserId.trim()) return;
    this.submitting.set(true);
    this.message.set('');
    this.isError.set(false);

    const success = await this.projectService.addProjectMember(
      this.project.id,
      this.newUserId.trim(),
      this.newRole
    );

    if (success) {
      this.message.set('Member added successfully.');
      this.newUserId = '';
      await this.loadMembers();
    } else {
      this.isError.set(true);
      this.message.set('Failed to add member. Check user ID / permissions.');
    }
    this.submitting.set(false);
  }

  confirmState = signal<{ open: boolean; title: string; message: string; action: () => void } | null>(null);

  removeMember(memberId: string) {
    this.confirmState.set({
      open: true,
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the project?',
      action: async () => {
        const success = await this.projectService.removeProjectMember(this.project.id, memberId);
        if (success) {
          this.message.set('Member removed.');
          this.isError.set(false);
          await this.loadMembers();
        } else {
          this.isError.set(true);
          this.message.set('Failed to remove member.');
        }
      }
    });
  }

  transferOwnership(targetUserId: string) {
    this.confirmState.set({
      open: true,
      title: 'Transfer Ownership',
      message: `Are you sure you want to transfer project ownership of "${this.project.name}" to ${targetUserId}?`,
      action: async () => {
        const success = await this.projectService.transferOwnership(this.project.id, targetUserId);
        if (success) {
          this.message.set('Ownership transferred successfully.');
          this.isError.set(false);
          await this.loadMembers();
        } else {
          this.isError.set(true);
          this.message.set('Failed to transfer ownership.');
        }
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

  closeModal() {
    this.close.emit();
  }
}
