import { Component, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="closeModal()">
      <div class="modal-card auth-modal-card paper-panel" (click)="$event.stopPropagation()">
        <!-- Header Strip -->
        <div class="modal-header">
          <div class="header-title-box">
            <i class="fi fi-rr-shield-check text-cyan"></i>
            <h3>{{ mode() === 'login' ? 'Sign In to bilo' : 'Create bilo Account' }}</h3>
          </div>
          <button class="btn btn-ghost btn-xs" (click)="closeModal()">
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>

        <!-- Mode Toggle Tabs -->
        <div class="auth-tabs font-mono">
          <button class="tab-btn" [class.active]="mode() === 'login'" (click)="setMode('login')">
            Sign In
          </button>
          <button class="tab-btn" [class.active]="mode() === 'signup'" (click)="setMode('signup')">
            Create Account
          </button>
        </div>

        <!-- Error / Info Alert Banner -->
        @if (errorMessage()) {
          <div class="auth-alert error-alert font-mono">
            <i class="fi fi-rr-exclamation text-rose"></i>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        @if (successMessage()) {
          <div class="auth-alert success-alert font-mono">
            <i class="fi fi-rr-check-circle text-emerald"></i>
            <span>{{ successMessage() }}</span>
          </div>
        }

        <!-- Auth Form -->
        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label class="form-label font-mono">EMAIL ADDRESS</label>
            <div class="input-with-icon">
              <i class="fi fi-rr-envelope input-icon"></i>
              <input
                type="email"
                class="form-input font-mono"
                placeholder="developer@example.com"
                [(ngModel)]="email"
                name="email"
                required
                autocomplete="email"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label font-mono">PASSWORD</label>
            <div class="input-with-icon">
              <i class="fi fi-rr-lock input-icon"></i>
              <input
                [type]="showPassword() ? 'text' : 'password'"
                class="form-input font-mono"
                placeholder="••••••••••••"
                [(ngModel)]="password"
                name="password"
                required
                autocomplete="current-password"
              />
              <button
                type="button"
                class="toggle-pwd-btn btn btn-ghost btn-xs"
                (click)="showPassword.set(!showPassword())"
                title="Toggle password visibility"
              >
                <i [class]="showPassword() ? 'fi fi-rr-eye-crossed' : 'fi fi-rr-eye'"></i>
              </button>
            </div>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary btn-block font-mono"
              [disabled]="submitting() || !email || !password"
            >
              @if (submitting()) {
                <i class="fi fi-rr-spinner spinner-icon"></i> Processing...
              } @else {
                <i [class]="mode() === 'login' ? 'fi fi-rr-sign-in-alt' : 'fi fi-rr-user-add'"></i>
                {{ mode() === 'login' ? 'Sign In' : 'Create Account' }}
              }
            </button>
          </div>
        </form>

        <!-- Footer / Data Claim Note -->
        <div class="auth-footer font-mono">
          <p class="auth-note">
            <i class="fi fi-rr-lock text-amber"></i>
            Row Level Security (RLS) ensures only authenticated project members can access workspace data.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-modal-card {
      max-width: 440px;
    }
    .header-title-box {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }
    .header-title-box h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
    }
    .auth-tabs {
      display: flex;
      gap: 0.25rem;
      background: var(--bg-surface-subtle);
      padding: 0.25rem;
      border-radius: var(--radius-xs);
      border: 1px solid var(--border-subtle);
      margin-bottom: 1.15rem;
    }
    .tab-btn {
      flex: 1;
      padding: 0.45rem 0.5rem;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.775rem;
      font-weight: 600;
      border-radius: var(--radius-xs);
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .tab-btn.active {
      background: var(--bg-surface);
      color: var(--text-main);
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .auth-alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 0.85rem;
      border-radius: var(--radius-xs);
      font-size: 0.775rem;
      margin-bottom: 1rem;
    }
    .error-alert {
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fb7185;
    }
    .success-alert {
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #4ade80;
    }
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
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
      letter-spacing: 0.05em;
    }
    .input-with-icon {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      left: 0.65rem;
      color: var(--text-subtle);
      font-size: 0.85rem;
    }
    .form-input {
      padding-left: 2.2rem;
      padding-right: 2.2rem;
    }
    .toggle-pwd-btn {
      position: absolute;
      right: 0.35rem;
      color: var(--text-subtle);
    }
    .btn-block {
      width: 100%;
      padding: 0.6rem 1rem;
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }
    .auth-footer {
      margin-top: 1.25rem;
      padding-top: 0.85rem;
      border-top: 1px solid var(--border-subtle);
      text-align: center;
    }
    .auth-note {
      margin: 0;
      font-size: 0.7rem;
      color: var(--text-subtle);
      line-height: 1.4;
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
export class AuthModalComponent {
  @Output() close = new EventEmitter<void>();

  mode = signal<'login' | 'signup'>('login');
  email = '';
  password = '';
  showPassword = signal<boolean>(false);
  submitting = signal<boolean>(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');

  constructor(public authService: AuthService) {}

  setMode(m: 'login' | 'signup') {
    this.mode.set(m);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  closeModal() {
    this.authService.closeAuthModal();
    this.close.emit();
  }

  async onSubmit() {
    if (!this.email || !this.password) return;

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      if (this.mode() === 'login') {
        const { error } = await this.authService.signInWithEmailPassword(this.email, this.password);
        if (error) {
          this.errorMessage.set(error.message || 'Failed to sign in. Please check credentials.');
        } else {
          this.successMessage.set('Signed in successfully!');
          setTimeout(() => this.closeModal(), 600);
        }
      } else {
        const { data, error } = await this.authService.signUpWithEmailPassword(this.email, this.password);
        if (error) {
          this.errorMessage.set(error.message || 'Sign up failed.');
        } else if (data?.user && !data?.session) {
          this.successMessage.set('Account created! Please check your email to confirm registration.');
        } else {
          this.successMessage.set('Account created and signed in successfully!');
          setTimeout(() => this.closeModal(), 800);
        }
      }
    } catch (e: any) {
      this.errorMessage.set(e?.message || 'An unexpected authentication error occurred.');
    } finally {
      this.submitting.set(false);
    }
  }
}
