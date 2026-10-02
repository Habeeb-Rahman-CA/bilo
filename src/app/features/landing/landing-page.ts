import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { BiloLogoComponent } from '../../shared/components/bilo-logo';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, BiloLogoComponent],
  template: `
    <div class="landing-page-container font-mono">
      <!-- Fixed Navigation Bar -->
      <header class="landing-nav-bar paper-panel">
        <div class="nav-left">
          <app-bilo-logo size="md" [showText]="true"></app-bilo-logo>
        </div>

        <div class="nav-right">
          <button
            type="button"
            class="btn btn-ghost btn-sm theme-toggle-btn"
            (click)="themeService.toggleTheme()"
            [title]="themeService.isDarkMode() ? 'Switch to Light Theme' : 'Switch to Dark Theme'"
          >
            <i [class]="themeService.isDarkMode() ? 'fi fi-rr-sun' : 'fi fi-rr-moon-stars'"></i>
            <span class="desktop-only text-xs">{{ themeService.isDarkMode() ? 'Light Mode' : 'Dark Mode' }}</span>
          </button>

          <button
            type="button"
            class="btn btn-primary btn-sm nav-get-started-btn"
            (click)="getStarted.emit()"
          >
            <i class="fi fi-rr-sign-in-alt"></i>
            <span>Get Started</span>
          </button>
        </div>
      </header>

      <!-- Main Landing Body -->
      <main class="landing-body">

        <!-- Hero Section -->
        <section class="landing-hero-section">
          <div class="hero-badge-pill">
            <span class="badge-mono text-cyan">
              <i class="fi fi-rr-rocket"></i> A PRODUCT BY BILETLABS &bull; WORKSPACE FOR DEVELOPERS & TEAMS
            </span>
          </div>

          <h1 class="hero-main-title">
            Minimalist Task & Project Management Built for Speed
          </h1>

          <p class="hero-subtext">
            Bilo combines high-velocity backlog planning, custom Kanban status workflows, drag-and-drop calendar scheduling, and offline-first PWA sync into one unified craft paper workspace.
          </p>

          <div class="hero-cta-group">
            <button
              type="button"
              class="btn btn-primary btn-md hero-primary-btn"
              (click)="getStarted.emit()"
            >
              <i class="fi fi-rr-bolt"></i>
              <span>Get Started Free</span>
              <i class="fi fi-rr-arrow-right"></i>
            </button>

            <button
              type="button"
              class="btn btn-secondary btn-md hero-secondary-btn"
              (click)="scrollToSection('features')"
            >
              <i class="fi fi-rr-eye text-cyan"></i>
              <span>Explore Features</span>
            </button>
          </div>

          <!-- Hero Workspace Interactive Mockup Preview -->
          <div class="hero-mockup-wrapper">
            <div class="hero-mockup-card paper-panel">
              <!-- Window Chrome Header -->
              <div class="mockup-chrome-bar">
                <div class="chrome-dots">
                  <span class="dot dot-red"></span>
                  <span class="dot dot-yellow"></span>
                  <span class="dot dot-green"></span>
                </div>
                <div class="chrome-title font-mono">
                  <i class="fi fi-rr-layout-fluid text-cyan"></i> bilo workspace &mdash; 03 BOARD
                </div>
                <div class="chrome-badge font-mono">
                  <span class="status-pulse-dot"></span> PWA ONLINE
                </div>
              </div>

              <!-- Mockup Board Layout -->
              <div class="mockup-board-grid">
                <!-- Column 1: Backlog / To Do -->
                <div class="mockup-col">
                  <div class="col-header font-mono">
                    <span class="col-name text-purple">TO DO</span>
                    <span class="col-count">3</span>
                  </div>
                  <div class="mockup-task-card paper-panel">
                    <div class="task-meta">
                      <span class="task-key">BILO-42</span>
                      <span class="priority-tag high">HIGH</span>
                    </div>
                    <div class="task-title-text">Implement PWA offline background sync queue</div>
                    <div class="task-footer">
                      <span class="project-pill"><i class="fi fi-rr-folder text-amber"></i> Core Service</span>
                      <i class="fi fi-rr-clock text-amber"></i>
                    </div>
                  </div>
                  <div class="mockup-task-card paper-panel">
                    <div class="task-meta">
                      <span class="task-key">BILO-45</span>
                      <span class="priority-tag medium">MED</span>
                    </div>
                    <div class="task-title-text">Add 7-day velocity chart to backlog header</div>
                    <div class="task-footer">
                      <span class="project-pill"><i class="fi fi-rr-folder text-amber"></i> Analytics</span>
                    </div>
                  </div>
                </div>

                <!-- Column 2: In Progress -->
                <div class="mockup-col">
                  <div class="col-header font-mono">
                    <span class="col-name text-cyan">IN PROGRESS</span>
                    <span class="col-count">2</span>
                  </div>
                  <div class="mockup-task-card paper-panel active-drag">
                    <div class="task-meta">
                      <span class="task-key">BILO-39</span>
                      <span class="priority-tag urgent">URGENT</span>
                    </div>
                    <div class="task-title-text">Refactor custom status column state machine</div>
                    <div class="task-footer">
                      <span class="project-pill"><i class="fi fi-rr-folder text-cyan"></i> Workflow Engine</span>
                      <span class="user-pill"><i class="fi fi-rr-user text-cyan"></i> Alex</span>
                    </div>
                  </div>
                </div>

                <!-- Column 3: Done -->
                <div class="mockup-col desktop-only">
                  <div class="col-header font-mono">
                    <span class="col-name text-emerald">DONE</span>
                    <span class="col-count">4</span>
                  </div>
                  <div class="mockup-task-card paper-panel task-done">
                    <div class="task-meta">
                      <span class="task-key">BILO-31</span>
                      <span class="priority-tag low font-mono">DONE</span>
                    </div>
                    <div class="task-title-text">Configure Cloud Workspace Access & Roles</div>
                    <div class="task-footer">
                      <span class="project-pill"><i class="fi fi-rr-check-circle text-emerald"></i> Security</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Mockup Floating Command Palette Pill -->
              <div class="mockup-palette-pill font-mono">
                <i class="fi fi-rr-command text-cyan"></i>
                <span>Press <strong>⌘K</strong> for Command Search &bull; Press <strong>N</strong> for New Task</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Stats Bar Section -->
        <section class="landing-stats-section">
          <div class="stats-grid paper-panel">
            <div class="stat-card">
              <span class="stat-num text-cyan">100%</span>
              <span class="stat-label">Offline Capable</span>
            </div>
            <div class="stat-card">
              <span class="stat-num text-emerald">&lt; 10ms</span>
              <span class="stat-label">Input Latency</span>
            </div>
            <div class="stat-card">
              <span class="stat-num text-purple">SECURE</span>
              <span class="stat-label">Cloud Isolated</span>
            </div>
            <div class="stat-card">
              <span class="stat-num text-amber">PWA</span>
              <span class="stat-label">Push Enabled</span>
            </div>
          </div>
        </section>

        <!-- Core Features Section -->
        <section id="features" class="landing-features-section">
          <div class="section-header">
            <span class="badge-mono text-cyan"><i class="fi fi-rr-star"></i> CORE SYSTEM CAPABILITIES</span>
            <h2 class="section-title">Everything You Need for Developer Productivity</h2>
            <p class="section-subtext">
              Designed from the ground up to eliminate clutter, enforce strong project data isolation, and provide smooth offline-first workflow execution.
            </p>
          </div>

          <div class="features-grid">
            <!-- Feature 1: Dynamic Kanban & Custom Status Workflows -->
            <div class="feature-card paper-panel">
              <div class="feature-icon-box text-cyan">
                <i class="fi fi-rr-layout-fluid"></i>
              </div>
              <h3 class="feature-title">Dynamic Kanban & Custom Workflows</h3>
              <p class="feature-desc">
                Create project-specific status columns with custom color accents and transition rules. Enforce strict sequential pipeline flows or enable open status movements.
              </p>
              <div class="feature-pills">
                <span class="badge-mono">STATE MACHINE</span>
                <span class="badge-mono">CUSTOM COLORS</span>
              </div>
            </div>

            <!-- Feature 2: PWA & Offline-First Sync Engine -->
            <div class="feature-card paper-panel">
              <div class="feature-icon-box text-amber">
                <i class="fi fi-rr-wifi-slash"></i>
              </div>
              <h3 class="feature-title">Offline-First PWA Sync Engine</h3>
              <p class="feature-desc">
                Work without internet interruptions. Tasks and workflow edits persist locally instantly and auto-sync to real-time cloud backend upon network reconnection.
              </p>
              <div class="feature-pills">
                <span class="badge-mono">LOCAL FIRST</span>
                <span class="badge-mono">AUTO RETRY</span>
              </div>
            </div>

            <!-- Feature 3: Drag & Drop Calendar Scheduler -->
            <div class="feature-card paper-panel">
              <div class="feature-icon-box text-purple">
                <i class="fi fi-rr-calendar"></i>
              </div>
              <h3 class="feature-title">Drag & Drop Calendar Scheduler</h3>
              <p class="feature-desc">
                Visual month grid layout with date event tracking. Touch & mouse drag tasks directly onto calendar cells or assign due dates via the unscheduled side drawer.
              </p>
              <div class="feature-pills">
                <span class="badge-mono">SIDE DRAWER</span>
                <span class="badge-mono">TOUCH SUPPORT</span>
              </div>
            </div>

            <!-- Feature 4: High-Velocity Backlog & Analytics -->
            <div class="feature-card paper-panel">
              <div class="feature-icon-box text-emerald">
                <i class="fi fi-rr-chart-histogram"></i>
              </div>
              <h3 class="feature-title">Backlog & 7-Day Velocity Planning</h3>
              <p class="feature-desc">
                Bulk multi-select tasks, filter by priority or issue type, search titles, and monitor completion velocity charts with peak output tracking.
              </p>
              <div class="feature-pills">
                <span class="badge-mono">BULK ACTIONS</span>
                <span class="badge-mono">7-DAY VELOCITY</span>
              </div>
            </div>

            <!-- Feature 5: Workspace Data & Cloud Isolation -->
            <div class="feature-card paper-panel">
              <div class="feature-icon-box text-rose">
                <i class="fi fi-rr-shield-check"></i>
              </div>
              <h3 class="feature-title">Workspace Data & Cloud Security</h3>
              <p class="feature-desc">
                Multi-tenant project workspace management backed by isolated cloud database access control policies and cryptographic token link invites.
              </p>
              <div class="feature-pills">
                <span class="badge-mono">DATA ISOLATION</span>
                <span class="badge-mono">LINK INVITES</span>
              </div>
            </div>

            <!-- Feature 6: Command Palette & Keyboard Shortcuts -->
            <div class="feature-card paper-panel">
              <div class="feature-icon-box text-cyan">
                <i class="fi fi-rr-command"></i>
              </div>
              <h3 class="feature-title">Command Palette & Rapid Shortcuts</h3>
              <p class="feature-desc">
                Trigger global search across all projects with <code>⌘K</code> or <code>Ctrl+K</code>. Jump between views instantly using single-key shortcuts <code>1-6</code>.
              </p>
              <div class="feature-pills">
                <span class="badge-mono">COMMAND PALETTE</span>
                <span class="badge-mono">HOTKEYS</span>
              </div>
            </div>
          </div>
        </section>

        <!-- How It Works Section -->
        <section class="landing-steps-section">
          <div class="section-header">
            <span class="badge-mono text-cyan"><i class="fi fi-rr-diagram-project"></i> SIMPLE WORKFLOW</span>
            <h2 class="section-title">Get Started in 3 Simple Steps</h2>
          </div>

          <div class="steps-grid">
            <div class="step-card paper-panel">
              <div class="step-num text-cyan">01</div>
              <h4 class="step-title">Create Workspace</h4>
              <p class="step-desc">Set up your workspace project with custom slug, color accent, and tech stack tags.</p>
            </div>

            <div class="step-card paper-panel">
              <div class="step-num text-purple">02</div>
              <h4 class="step-title">Configure Status Pipeline</h4>
              <p class="step-desc">Customize your Kanban board columns and transition rules to fit your team's process.</p>
            </div>

            <div class="step-card paper-panel">
              <div class="step-num text-emerald">03</div>
              <h4 class="step-title">Execute & Sync Offline</h4>
              <p class="step-desc">Plan tasks in the backlog, schedule on calendar, and work uninterrupted online or offline.</p>
            </div>
          </div>
        </section>

        <!-- CTA Banner Card -->
        <section class="landing-cta-section">
          <div class="cta-card paper-panel">
            <div class="cta-content">
              <h2 class="cta-title">Ready to Streamline Your Workspace?</h2>
              <p class="cta-desc">
                Experience high-performance project management built with craft paper precision, real-time cloud sync, and low-latency performance.
              </p>
              <button
                type="button"
                class="btn btn-primary btn-md cta-btn"
                (click)="getStarted.emit()"
              >
                <i class="fi fi-rr-bolt"></i>
                <span>Get Started Now</span>
                <i class="fi fi-rr-arrow-right"></i>
              </button>
            </div>
          </div>
        </section>

      </main>

      <!-- Landing Page Footer -->
      <footer class="landing-footer paper-panel">
        <div class="footer-left">
          <app-bilo-logo size="sm" [showText]="true"></app-bilo-logo>
          <span class="footer-version">&bull; v1.2.0</span>
        </div>

        <div class="footer-center text-muted">
          <span>Personal & Team Workspace &bull; Built by Biletlabs &bull; Local & Cloud Sync</span>
        </div>

        <div class="footer-right">
          <button
            type="button"
            class="btn btn-ghost btn-xs text-cyan"
            (click)="getStarted.emit()"
          >
            <i class="fi fi-rr-sign-in-alt"></i> Sign In / Register
          </button>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .landing-page-container {
      min-height: 100vh;
      width: 100%;
      background: var(--bg-canvas);
      color: var(--text-main);
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    /* Navigation Header Bar */
    .landing-nav-bar {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1.5rem;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      backdrop-filter: blur(8px);
    }
    .nav-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .nav-get-started-btn {
      height: 32px;
      padding: 0.25rem 0.85rem;
    }

    /* Landing Body */
    .landing-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3.5rem;
      padding: 2.5rem 1.5rem;
      max-width: 1120px;
      margin: 0 auto;
      width: 100%;
      box-sizing: border-box;
    }

    /* Hero Section */
    .landing-hero-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.25rem;
      padding-top: 1rem;
    }
    .hero-badge-pill {
      margin-bottom: 0.25rem;
    }
    .hero-main-title {
      font-size: 2.35rem;
      font-weight: 800;
      line-height: 1.2;
      color: var(--text-main);
      max-width: 820px;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .hero-subtext {
      font-size: 0.95rem;
      color: var(--text-muted);
      max-width: 680px;
      margin: 0;
      line-height: 1.55;
    }
    .hero-cta-group {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .hero-primary-btn {
      height: 42px;
      padding: 0.5rem 1.35rem;
      font-size: 0.85rem;
      font-weight: 700;
    }
    .hero-secondary-btn {
      height: 42px;
      padding: 0.5rem 1.15rem;
      font-size: 0.85rem;
      font-weight: 600;
    }

    /* Hero Mockup Preview Card */
    .hero-mockup-wrapper {
      width: 100%;
      margin-top: 1.5rem;
    }
    .hero-mockup-card {
      padding: 0;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      overflow: hidden;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
    }
    .mockup-chrome-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.55rem 1rem;
      background: var(--bg-surface-subtle);
      border-bottom: 1px solid var(--border-subtle);
    }
    .chrome-dots {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
    }
    .dot-red { background: #f43f5e; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }
    .chrome-title {
      font-size: 0.725rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .chrome-badge {
      font-size: 0.65rem;
      color: var(--accent-emerald);
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-weight: 700;
    }

    /* Mockup Board Grid */
    .mockup-board-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.85rem;
      padding: 1rem;
      background: var(--bg-canvas);
    }
    .mockup-col {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .col-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.725rem;
      font-weight: 700;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .mockup-task-card {
      padding: 0.65rem 0.75rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      text-align: left;
    }
    .mockup-task-card.active-drag {
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 1px var(--accent-cyan);
    }
    .task-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.65rem;
    }
    .task-key {
      color: var(--text-muted);
      font-weight: 700;
    }
    .priority-tag {
      font-size: 0.6rem;
      padding: 0.1rem 0.35rem;
      border-radius: 3px;
      font-weight: 700;
    }
    .priority-tag.high { background: rgba(244, 63, 94, 0.15); color: #f43f5e; }
    .priority-tag.medium { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .priority-tag.urgent { background: rgba(225, 29, 72, 0.2); color: #e11d48; }
    .priority-tag.low { background: rgba(16, 185, 129, 0.15); color: #10b981; }

    .task-title-text {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-main);
      line-height: 1.35;
    }
    .task-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.65rem;
      color: var(--text-muted);
    }
    .project-pill {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .mockup-palette-pill {
      padding: 0.55rem;
      background: var(--bg-surface-subtle);
      border-top: 1px solid var(--border-subtle);
      font-size: 0.7rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
    }

    /* Stats Strip Section */
    .landing-stats-section {
      width: 100%;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      padding: 1.15rem 1.5rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      text-align: center;
    }
    .stat-num {
      font-size: 1.4rem;
      font-weight: 800;
    }
    .stat-label {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Core Features Section */
    .landing-features-section {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }
    .section-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.5rem;
    }
    .section-title {
      font-size: 1.65rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0;
    }
    .section-subtext {
      font-size: 0.875rem;
      color: var(--text-muted);
      max-width: 620px;
      margin: 0;
      line-height: 1.5;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.25rem;
    }
    .feature-card {
      padding: 1.35rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: var(--transition-fast);
    }
    .feature-card:hover {
      border-color: var(--border-medium);
      transform: translateY(-2px);
      background: var(--bg-surface-hover);
    }
    .feature-icon-box {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-xs);
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
    }
    .feature-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-main);
      margin: 0;
    }
    .feature-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.5;
      flex: 1;
    }
    .feature-pills {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    /* How It Works Section */
    .landing-steps-section {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .steps-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
    .step-card {
      padding: 1.25rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .step-num {
      font-size: 1.75rem;
      font-weight: 800;
      line-height: 1;
    }
    .step-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-main);
      margin: 0;
    }
    .step-desc {
      font-size: 0.775rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.45;
    }

    /* CTA Banner Section */
    .landing-cta-section {
      width: 100%;
    }
    .cta-card {
      padding: 2.25rem 1.5rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-xs);
      text-align: center;
    }
    .cta-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.85rem;
      max-width: 580px;
      margin: 0 auto;
    }
    .cta-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0;
    }
    .cta-desc {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.45;
    }
    .cta-btn {
      height: 42px;
      padding: 0.5rem 1.5rem;
      font-size: 0.85rem;
      font-weight: 700;
      margin-top: 0.5rem;
    }

    /* Footer */
    .landing-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: var(--bg-surface);
      border-top: 1px solid var(--border-subtle);
      font-size: 0.75rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .footer-version {
      color: var(--text-subtle);
    }
    .footer-center {
      font-size: 0.7rem;
    }

    /* Mobile Responsiveness */
    @media (max-width: 768px) {
      .landing-nav-bar {
        padding: 0.65rem 1rem;
      }
      .landing-body {
        padding: 1.5rem 1rem;
        gap: 2.5rem;
      }
      .hero-main-title {
        font-size: 1.65rem;
      }
      .hero-subtext {
        font-size: 0.85rem;
      }
      .hero-cta-group {
        width: 100%;
        flex-direction: column;
      }
      .hero-primary-btn, .hero-secondary-btn {
        width: 100%;
      }
      .mockup-board-grid {
        grid-template-columns: 1fr 1fr;
      }
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
        padding: 0.85rem;
      }
      .features-grid {
        grid-template-columns: 1fr;
      }
      .steps-grid {
        grid-template-columns: 1fr;
      }
      .landing-footer {
        flex-direction: column;
        text-align: center;
        gap: 0.5rem;
      }
    }
  `]
})
export class LandingPageComponent {
  @Output() getStarted = new EventEmitter<void>();

  constructor(public themeService: ThemeService) {}

  scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
