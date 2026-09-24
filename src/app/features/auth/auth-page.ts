import { Component, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ThemeService } from '../../core/services/theme.service';
import { BiloLogoComponent } from '../../shared/components/bilo-logo';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BiloLogoComponent],
  template: `
    <div class="auth-page-container">
      <!-- Theme Switcher Top Header Bar -->
      <header class="auth-page-header">
        <app-bilo-logo size="md" [showText]="true"></app-bilo-logo>
        <button
          class="btn btn-ghost btn-sm theme-toggle-btn"
          (click)="themeService.toggleTheme()"
          [title]="themeService.isDarkMode() ? 'Switch to Light Theme' : 'Switch to Dark Theme'"
        >
          <i [class]="themeService.isDarkMode() ? 'fi fi-rr-sun' : 'fi fi-rr-moon-stars'"></i>
          <span class="font-mono text-xs">{{ themeService.isDarkMode() ? 'Light Mode' : 'Dark Mode' }}</span>
        </button>
      </header>

      <!-- Main Split Auth Box -->
      <main class="auth-card-wrapper">
        <div class="auth-card paper-panel">
          <!-- Left Feature Showcase Banner (Desktop) -->
          <div class="auth-hero-banner font-mono">
            <div class="hero-content">
              <span class="hero-badge"><i class="fi fi-rr-shield-check"></i> RLS ISOLATED WORKSPACE</span>
              <h1 class="hero-title">Developer Project & Kanban Hub</h1>
              <p class="hero-desc">
                Minimalist personal workspace with backlog, custom workflows, offline PWA sync, and row-level security.
              </p>

              <div class="hero-features font-mono">
                <div class="feature-item">
                  <i class="fi fi-rr-check-circle text-emerald"></i>
                  <span>User-based data isolation & project ownership</span>
                </div>
                <div class="feature-item">
                  <i class="fi fi-rr-check-circle text-cyan"></i>
                  <span>Today focus metrics & interactive Kanban board</span>
                </div>
                <div class="feature-item">
                  <i class="fi fi-rr-check-circle text-amber"></i>
                  <span>Supabase Authentication & Row Level Security</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Interactive Form Box -->
          <div class="auth-form-box">
            <!-- Mode Switcher Tabs -->
            <div class="auth-mode-tabs font-mono">
              <button
                class="mode-tab-btn"
                [class.active]="mode() === 'login'"
                (click)="setMode('login')"
              >
                <i class="fi fi-rr-sign-in-alt"></i> Sign In
              </button>
              <button
                class="mode-tab-btn"
                [class.active]="mode() === 'signup'"
                (click)="setMode('signup')"
              >
                <i class="fi fi-rr-user-add"></i> Create Account
              </button>
            </div>

            <!-- Header Info -->
            <div class="form-header">
              <h2>{{ mode() === 'login' ? 'Welcome Back' : 'Get Started with bilo' }}</h2>
              <p class="form-subtext font-mono">
                {{ mode() === 'login' ? 'Sign in to access your projects and Today dashboard' : 'Create an account to start managing projects with security' }}
              </p>
            </div>

            <!-- Error / Success Alerts -->
            @if (!authService.isSupabaseConfigured) {
              <div class="auth-alert error-alert font-mono">
                <i class="fi fi-rr-exclamation text-rose"></i>
                <span>Supabase credentials missing or unconfigured. Running in local storage mode; cloud sync is disabled.</span>
              </div>
            }

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

            <!-- Form -->
            <form (ngSubmit)="onSubmit()" class="auth-main-form font-mono">
              <div class="form-group">
                <label class="form-label">EMAIL ADDRESS</label>
                <div class="input-field-wrapper">
                  <i class="fi fi-rr-envelope field-icon"></i>
                  <input
                    type="email"
                    class="form-input"
                    placeholder="developer@example.com"
                    [(ngModel)]="email"
                    name="email"
                    required
                    autocomplete="email"
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">PASSWORD</label>
                <div class="input-field-wrapper">
                  <i class="fi fi-rr-lock field-icon"></i>
                  <input
                    [type]="showPassword() ? 'text' : 'password'"
                    class="form-input"
                    placeholder="••••••••••••"
                    [(ngModel)]="password"
                    name="password"
                    required
                    autocomplete="current-password"
                  />
                  <button
                    type="button"
                    class="pwd-toggle-btn btn btn-ghost btn-xs"
                    (click)="showPassword.set(!showPassword())"
                    title="Toggle password visibility"
                    aria-label="Toggle password visibility"
                    [attr.aria-pressed]="showPassword()"
                  >
                    <i [class]="showPassword() ? 'fi fi-rr-eye-crossed' : 'fi fi-rr-eye'"></i>
                  </button>
                </div>
              </div>

              @if (mode() === 'signup') {
                <div class="form-group">
                  <label class="form-label">CONFIRM PASSWORD</label>
                  <div class="input-field-wrapper">
                    <i class="fi fi-rr-shield-check field-icon"></i>
                    <input
                      [type]="showPassword() ? 'text' : 'password'"
                      class="form-input"
                      placeholder="••••••••••••"
                      [(ngModel)]="confirmPassword"
                      name="confirmPassword"
                      required
                      autocomplete="new-password"
                    />
                  </div>
                </div>
              }

              <button
                type="submit"
                class="btn btn-primary btn-submit font-mono"
                [disabled]="submitting() || !email || !password"
              >
                @if (submitting()) {
                  <i class="fi fi-rr-spinner spinner-icon"></i> Processing...
                } @else {
                  <i [class]="mode() === 'login' ? 'fi fi-rr-sign-in-alt' : 'fi fi-rr-user-add'"></i>
                  {{ mode() === 'login' ? 'Sign In & Enter Workspace' : 'Create Account & Enter' }}
                }
              </button>
            </form>

            <!-- Bottom Toggle Switch -->
            <div class="auth-switch-footer font-mono">
              @if (mode() === 'login') {
                <span>Don't have an account? <a (click)="setMode('signup')">Create one now</a></span>
              } @else {
                <span>Already have an account? <a (click)="setMode('login')">Sign in instead</a></span>
              }
            </div>
          </div>
        </div>
      </main>

      <footer class="auth-page-footer font-mono">
        <span>bilo Developer Workspace • Built with Supabase RLS & Angular</span>
      </footer>
    </div>
  `,
  styles: [`
    .auth-page-container {
      min-height: 100vh;
      width: 100%;
      display: flex;
      flex-direction: column;
      background-color: var(--bg-canvas);
      color: var(--text-main);
    }

    .auth-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface);
    }

    .auth-card-wrapper {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }

    .auth-card {
      width: 100%;
      max-width: 920px;
      display: flex;
      border-radius: var(--radius-sm);
      overflow: hidden;
      box-shadow: var(--shadow-modal);
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
    }

    /* Left Hero Showcase Banner */
    .auth-hero-banner {
      flex: 1;
      background: var(--bg-surface-subtle);
      border-right: 1px solid var(--border-subtle);
      padding: 2.5rem 2rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.3);
      color: var(--accent-cyan);
      border-radius: var(--radius-xs);
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      align-self: flex-start;
    }

    .hero-title {
      font-size: 1.6rem;
      font-weight: 800;
      margin: 0 0 0.75rem 0;
      line-height: 1.25;
      letter-spacing: -0.02em;
      color: var(--text-main);
    }

    .hero-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin: 0 0 1.75rem 0;
    }

    .hero-features {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.775rem;
      color: var(--text-main);
    }

    /* Right Form Box */
    .auth-form-box {
      flex: 1.1;
      padding: 2.5rem 2.25rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .auth-mode-tabs {
      display: flex;
      gap: 0.35rem;
      background: var(--bg-surface-subtle);
      padding: 0.3rem;
      border-radius: var(--radius-xs);
      border: 1px solid var(--border-subtle);
      margin-bottom: 1.5rem;
    }

    .mode-tab-btn {
      flex: 1;
      padding: 0.5rem;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.775rem;
      font-weight: 600;
      border-radius: var(--radius-xs);
      cursor: pointer;
      transition: var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }

    .mode-tab-btn.active {
      background: var(--bg-surface);
      color: var(--text-main);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    }

    .form-header h2 {
      margin: 0 0 0.35rem 0;
      font-size: 1.25rem;
      font-weight: 700;

    }

    .form-subtext {
      margin: 0 0 1.25rem 0;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .auth-alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 0.85rem;
      border-radius: var(--radius-xs);
      font-size: 0.775rem;
      margin-bottom: 1.15rem;
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

    .auth-main-form {
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
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

    .input-field-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .field-icon {
      position: absolute;
      left: 0.75rem;
      color: var(--text-subtle);
      font-size: 0.9rem;
    }

    .form-input {
      padding-left: 2.35rem;
      padding-right: 2.35rem;
      height: 38px;
    }

    .pwd-toggle-btn {
      position: absolute;
      right: 0.4rem;
      color: var(--text-subtle);
    }

    .btn-submit {
      width: 100%;
      height: 40px;
      font-size: 0.85rem;
      margin-top: 0.4rem;
    }

    .auth-switch-footer {
      margin-top: 1.25rem;
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .auth-switch-footer a {
      color: var(--accent-cyan);
      cursor: pointer;
      text-decoration: underline;
      font-weight: 600;
    }

    .auth-page-footer {
      padding: 0.85rem;
      text-align: center;
      border-top: 1px solid var(--border-subtle);
      font-size: 0.7rem;
      color: var(--text-subtle);
      background: var(--bg-surface);
    }

    .spinner-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .auth-hero-banner {
        display: none;
      }
      .auth-card {
        max-width: 440px;
      }
    }
  `]
})
export class AuthPageComponent {
  @Input() initialMode: 'login' | 'signup' = 'login';
  @Output() authenticated = new EventEmitter<void>();

  mode = signal<'login' | 'signup'>(this.initialMode);
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = signal<boolean>(false);
  submitting = signal<boolean>(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');

  constructor(
    public authService: AuthService,
    public workspaceService: WorkspaceService,
    public themeService: ThemeService
  ) {}

  setMode(m: 'login' | 'signup') {
    this.mode.set(m);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  async onSendMagicLink() {
    if (!this.email) {
      this.errorMessage.set('Please enter your email address to receive a magic link.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const { error } = await this.authService.signInWithMagicLink(this.email);
      if (error) {
        this.errorMessage.set(error.message || 'Failed to send magic link. Please check your email and try again.');
      } else {
        this.successMessage.set('Magic link sent successfully! Check your email inbox.');
      }
    } catch (e: any) {
      this.errorMessage.set(e?.message || 'Failed to send magic link. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  async onSubmit() {
    if (!this.email || !this.password) return;

    if (this.mode() === 'signup' && this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match. Please re-enter.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      if (this.mode() === 'login') {
        const { error } = await this.authService.signInWithEmailPassword(this.email, this.password);
        if (error) {
          this.errorMessage.set(error.message || 'Invalid email or password.');
        } else {
          this.successMessage.set('Authenticated! Redirecting to Today Dashboard...');
          this.workspaceService.setWorkspace('01 TODAY');
          this.authenticated.emit();
        }
      } else {
        const { data, error } = await this.authService.signUpWithEmailPassword(this.email, this.password);
        if (error) {
          this.errorMessage.set(error.message || 'Registration failed.');
        } else if (data?.user && !data?.session) {
          this.successMessage.set('Account created! Please check your email to confirm registration.');
        } else {
          this.successMessage.set('Account created successfully! Redirecting to Today Dashboard...');
          this.workspaceService.setWorkspace('01 TODAY');
          this.authenticated.emit();
        }
      }
    } catch (e: any) {
      this.errorMessage.set(e?.message || 'Authentication error occurred.');
    } finally {
      this.submitting.set(false);
    }
  }
}
