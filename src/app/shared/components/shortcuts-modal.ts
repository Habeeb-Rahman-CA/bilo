import { Component, signal, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceService } from '../../core/services/workspace.service';
import { PwaInstallService } from '../../core/services/pwa-install.service';
import { registerModal, unregisterModal, isTopModal } from '../../core/utils/modal-stack.util';

@Component({
  selector: 'app-shortcuts-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" [style.z-index]="modalZIndex" (click)="close()" role="dialog" aria-modal="true" aria-labelledby="shortcuts-modal-title">
      <div class="help-modal-card paper-panel font-mono" (click)="$event.stopPropagation()">
        <!-- Modal Header Strip -->
        <div class="modal-header">
          <div class="header-left">
            <h3 id="shortcuts-modal-title"><i class="fi fi-rr-interrogation text-cyan" aria-hidden="true"></i> Workspace Help & Keyboard Shortcuts</h3>
          </div>
          <button class="btn btn-ghost btn-xs close-btn" (click)="close()" title="Close (Esc)" aria-label="Close shortcuts modal">
            <span class="key-badge">ESC</span>
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div class="help-tab-bar">
          <button
            class="help-tab-btn"
            [class.active]="activeTab() === 'shortcuts'"
            (click)="activeTab.set('shortcuts')"
          >
            <i class="fi fi-rr-keyboard"></i> Keyboard Shortcuts
          </button>
          <button
            class="help-tab-btn"
            [class.active]="activeTab() === 'features'"
            (click)="activeTab.set('features')"
          >
            <i class="fi fi-rr-apps"></i> Workspace Features
          </button>
          <button
            class="help-tab-btn"
            [class.active]="activeTab() === 'markdown'"
            (click)="activeTab.set('markdown')"
          >
            <i class="fi fi-rr-document"></i> Markdown Guide
          </button>
          <button
            class="help-tab-btn"
            [class.active]="activeTab() === 'workflows'"
            (click)="activeTab.set('workflows')"
          >
            <i class="fi fi-rr-workflow"></i> Workflows
          </button>
          <button
            class="help-tab-btn"
            [class.active]="activeTab() === 'desktop'"
            (click)="activeTab.set('desktop')"
          >
            <i class="fi fi-rr-laptop"></i> Desktop App
          </button>
        </div>

        <!-- Tab Body Content -->
        <div class="modal-body">
          <!-- TAB 1: KEYBOARD SHORTCUTS REFERENCE -->
          @if (activeTab() === 'shortcuts') {
            <div class="tab-pane">
              <div class="shortcuts-grid">
                <!-- Column 1: Workspace Navigation (Dynamic from WorkspaceService) -->
                <div class="shortcuts-column">
                  <div class="column-header">
                    <i class="fi fi-rr-layout-fluid text-cyan"></i>
                    <span>WORKSPACE NAVIGATION</span>
                  </div>

                  <div class="shortcut-list">
                    @for (ws of workspaceService.workspaces; track ws.id) {
                      <div class="shortcut-item">
                        <div class="item-info">
                          <span class="item-title"><i [class]="ws.icon"></i> {{ ws.code }} {{ ws.name }}</span>
                          <span class="item-desc">{{ ws.desc }}</span>
                        </div>
                        <span class="key-badge">{{ ws.key }}</span>
                      </div>
                    }
                  </div>
                </div>

                <!-- Column 2: Global Controls (Dynamic from WorkspaceService) -->
                <div class="shortcuts-column">
                  <div class="column-header">
                    <i class="fi fi-rr-bolt text-amber"></i>
                    <span>GLOBAL COMMANDS & ACTIONS</span>
                  </div>

                  <div class="shortcut-list">
                    @for (shortcut of workspaceService.globalShortcuts; track shortcut.title) {
                      <div class="shortcut-item">
                        <div class="item-info">
                          <span class="item-title">{{ shortcut.title }}</span>
                          <span class="item-desc">{{ shortcut.desc }}</span>
                        </div>
                        <div class="keys-inline">
                          @for (k of shortcut.keys; track $index) {
                            <span class="key-badge">{{ k }}</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- TAB 2: WORKSPACE FEATURES -->
          @if (activeTab() === 'features') {
            <div class="tab-pane">
              <div class="features-grid">
                <div class="feature-card">
                  <div class="card-title">
                    <i class="fi fi-rr-time-past text-cyan"></i>
                    <span>Activity Log & Timeline History</span>
                  </div>
                  <p class="card-desc">
                    Real-time vertical timeline surfacing task creation, status shifts, priority edits, assignee updates, due date changes, and comments with color-coded badges and transition state chips.
                  </p>
                  <div class="card-tags">
                    <span class="badge-mono">Timeline Nodes</span>
                    <span class="badge-mono">Live History</span>
                    <span class="badge-mono">Action Badges</span>
                  </div>
                </div>

                <div class="feature-card">
                  <div class="card-title">
                    <i class="fi fi-rr-edit text-amber"></i>
                    <span>Rich Text & Markdown Editor</span>
                  </div>
                  <p class="card-desc">
                    Format task descriptions and comments with interactive toolbar actions (Headings, Bold, Italic, Strikethrough, Lists, Checklists, Code blocks) and live preview mode.
                  </p>
                  <div class="card-tags">
                    <span class="badge-mono">Live Preview</span>
                    <span class="badge-mono">Formatting Toolbar</span>
                    <span class="badge-mono">Code Blocks</span>
                  </div>
                </div>

                <div class="feature-card">
                  <div class="card-title">
                    <i class="fi fi-rr-picture text-rose"></i>
                    <span>Comment Image Attachments & Lightbox</span>
                  </div>
                  <p class="card-desc">
                    Drag & drop or paste image screenshots into task comments. Includes pre-posting thumbnail previews, delete controls, and click-to-expand lightbox overlay.
                  </p>
                  <div class="card-tags">
                    <span class="badge-mono">Drag & Drop</span>
                    <span class="badge-mono">Thumbnails</span>
                    <span class="badge-mono">Lightbox View</span>
                  </div>
                </div>

                <div class="feature-card">
                  <div class="card-title">
                    <i class="fi fi-rr-bug text-rose"></i>
                    <span>Application Feedback & Bug Reports</span>
                  </div>
                  <p class="card-desc">
                    Report bugs or submit feedback with screenshot attachments directly to the bilo project backlog. Includes category selection, priority, severity, and reproducibility tracking.
                  </p>
                  <div class="card-tags">
                    <span class="badge-mono">Screenshot Upload</span>
                    <span class="badge-mono">Category Flag</span>
                    <span class="badge-mono">Direct Backlog</span>
                  </div>
                </div>

                <div class="feature-card">
                  <div class="card-title">
                    <i class="fi fi-rr-users-alt text-purple"></i>
                    <span>Team Access & Shareable Invite Links</span>
                  </div>
                  <p class="card-desc">
                    Generate shareable invite links with custom role selection (Member, Admin, Viewer), add team members by email or user ID, and manage project permissions.
                  </p>
                  <div class="card-tags">
                    <span class="badge-mono">Invite via Link</span>
                    <span class="badge-mono">Role Access</span>
                    <span class="badge-mono">Custom Select</span>
                  </div>
                </div>

                <div class="feature-card">
                  <div class="card-title">
                    <i class="fi fi-rr-list-check text-emerald"></i>
                    <span>Backlog & Filters</span>
                  </div>
                  <p class="card-desc">
                    Comprehensive table view with multi-column sorting (Priority, Due Date, Title, Created Date) and multi-field dropdown filters (Project, Issue Type, Priority, Status).
                  </p>
                  <div class="card-tags">
                    <span class="badge-mono">Batch Update</span>
                    <span class="badge-mono">Multi-Select</span>
                    <span class="badge-mono">Reset Filters</span>
                  </div>
                </div>

                <div class="feature-card">
                  <div class="card-title">
                    <i class="fi fi-rr-calendar text-cyan"></i>
                    <span>Interactive Calendar Scheduler</span>
                  </div>
                  <p class="card-desc">
                    Monthly calendar surfacing created, closed, and due tasks. Features a side drawer for unscheduled tasks and native drag-and-drop to immediately assign due dates.
                  </p>
                  <div class="card-tags">
                    <span class="badge-mono">Drag & Drop</span>
                    <span class="badge-mono">Event Filters</span>
                    <span class="badge-mono">Month Navigation</span>
                  </div>
                </div>

                <div class="feature-card">
                  <div class="card-title">
                    <i class="fi fi-rr-file-excel text-purple"></i>
                    <span>Multi-Sheet Excel Export</span>
                  </div>
                  <p class="card-desc">
                    Export your entire bilo workspace into a structured Excel spreadsheet (<code>.xlsx</code>) containing 4 dedicated sheets: Completed Tasks, All Tasks, Projects Summary, and Activity Stream.
                  </p>
                  <div class="card-tags">
                    <span class="badge-mono">.XLSX Format</span>
                    <span class="badge-mono">4 Worksheets</span>
                    <span class="badge-mono">Audit Backup</span>
                  </div>
                </div>

                <div class="feature-card">
                  <div class="card-title">
                    <i class="fi fi-rr-search text-amber"></i>
                    <span>Omni Command Palette</span>
                  </div>
                  <p class="card-desc">
                    Instant fuzzy search across your projects, task titles, descriptions, and workspace actions. Click the top search bar anytime to trigger.
                  </p>
                  <div class="card-tags">
                    <span class="badge-mono">Search Palette</span>
                    <span class="badge-mono">Instant Search</span>
                    <span class="badge-mono">Quick Actions</span>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- TAB 3: MARKDOWN & FORMATTING GUIDE -->
          @if (activeTab() === 'markdown') {
            <div class="tab-pane">
              <div class="markdown-guide-container font-mono">
                <div class="guide-header">
                  <i class="fi fi-rr-document text-cyan"></i>
                  <span>Rich Text & Markdown Quick Reference</span>
                </div>
                <p class="guide-text">
                  Use standard Markdown syntax or the interactive toolbar in task descriptions and comments to format your text cleanly.
                </p>

                <div class="markdown-grid font-mono">
                  <div class="md-card">
                    <span class="md-title"><i class="fi fi-rr-text text-amber"></i> HEADINGS</span>
                    <div class="md-code-box">
                      <code># Heading 1</code><br>
                      <code>## Heading 2</code><br>
                      <code>### Heading 3</code>
                    </div>
                  </div>

                  <div class="md-card">
                    <span class="md-title"><i class="fi fi-rr-bold text-cyan"></i> TEXT STYLING</span>
                    <div class="md-code-box">
                      <code>**Bold text**</code><br>
                      <code>*Italic text*</code><br>
                      <code>~~Strikethrough~~</code>
                    </div>
                  </div>

                  <div class="md-card">
                    <span class="md-title"><i class="fi fi-rr-list text-emerald"></i> LISTS & CHECKLISTS</span>
                    <div class="md-code-box">
                      <code>- Bullet point item</code><br>
                      <code>1. Numbered item</code><br>
                      <code>- [ ] Checklist item</code>
                    </div>
                  </div>

                  <div class="md-card">
                    <span class="md-title"><i class="fi fi-rr-code-simple text-rose"></i> CODE & QUOTES</span>
                    <div class="md-code-box">
                      <code>\`inline code\`</code><br>
                      <code>&gt; Blockquote text</code><br>
                      <code>\`\`\`code block\`\`\`</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- TAB 4: WORKFLOW ARCHITECTURE -->
          @if (activeTab() === 'workflows') {
            <div class="tab-pane">
              <div class="workflow-guide-box">
                <div class="guide-header">
                  <i class="fi fi-rr-settings text-cyan"></i>
                  <span>Centralized Project Workflow Management</span>
                </div>
                <p class="guide-text">
                  In bilo, workflow configuration is centralized exclusively within the <strong>06 SETTINGS</strong> workspace. Each project features a status configuration pipeline where you can add custom columns, edit column titles, change color accents, or remove unnecessary workflow states.
                </p>

                <div class="workflow-steps font-mono">
                  <div class="step-row">
                    <span class="step-number">1</span>
                    <div class="step-content">
                      <span class="step-title">Configure Statuses in 06 SETTINGS</span>
                      <span class="step-desc">Select <code><i class="fi fi-rr-settings"></i> 06 SETTINGS</code> in the left sidebar to manage project status workflows.</span>
                    </div>
                  </div>

                  <div class="step-row">
                    <span class="step-number">2</span>
                    <div class="step-content">
                      <span class="step-title">Customize Columns & Accents</span>
                      <span class="step-desc">Add new status columns (e.g. In Dev, Testing, Blocked), edit names, or assign custom color indicators.</span>
                    </div>
                  </div>

                  <div class="step-row">
                    <span class="step-number">3</span>
                    <div class="step-content">
                      <span class="step-title">Track & Drag in 03 BOARD</span>
                      <span class="step-desc">The 03 BOARD workspace automatically reflects your project's custom column pipeline for fluid task drag-and-drop.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- TAB 5: DESKTOP & MOBILE APP DOWNLOAD GUIDE -->
          @if (activeTab() === 'desktop') {
            <div class="tab-pane">
              <div class="desktop-guide-wrapper font-mono">
                <div class="guide-header">
                  <i class="fi fi-rr-laptop text-cyan"></i>
                  <span>Desktop & Mobile Application Download</span>
                </div>
                <p class="guide-text">
                  Bilo is engineered as a zero-dependency Progressive Web Application (PWA). You can install it on <strong>macOS</strong>, <strong>Windows</strong>, <strong>Linux</strong>, <strong>Android</strong>, or <strong>iOS</strong> directly from your browser to run as a native desktop application with full offline support, keyboard shortcuts, and instant launching.
                </p>

                <!-- Installation Status Hero Box -->
                <div class="status-box" [ngClass]="{
                  'status-granted': pwaInstallService.isStandalone(),
                  'status-default': pwaInstallService.canInstallPwa(),
                  'status-unsupported': !pwaInstallService.isStandalone() && !pwaInstallService.canInstallPwa()
                }">
                  <div class="status-left">
                    @if (pwaInstallService.isStandalone()) {
                      <i class="fi fi-rr-check-circle icon-lg text-emerald"></i>
                      <div>
                        <strong>App Installed & Active in Standalone Mode</strong>
                        <p class="status-desc">You are running Bilo as a standalone desktop application. Offline caching and desktop shortcuts are active.</p>
                      </div>
                    } @else if (pwaInstallService.canInstallPwa()) {
                      <i class="fi fi-rr-download icon-lg text-cyan"></i>
                      <div>
                        <strong>Desktop App Ready to Install</strong>
                        <p class="status-desc">Your browser supports one-click PWA desktop installation. Click Install below to add Bilo to your system applications.</p>
                      </div>
                    } @else {
                      <i class="fi fi-rr-laptop icon-lg text-sky"></i>
                      <div>
                        <strong>Install Bilo as a Standalone Application</strong>
                        <p class="status-desc">Follow the step-by-step browser guides below to install Bilo on your desktop or mobile device.</p>
                      </div>
                    }
                  </div>

                  @if (pwaInstallService.canInstallPwa()) {
                    <div class="status-action">
                      <button class="btn btn-primary btn-xs" (click)="pwaInstallService.promptInstall()">
                        <i class="fi fi-rr-download"></i> Install Desktop App
                      </button>
                    </div>
                  }
                </div>

                <!-- Desktop App Features Grid -->
                <div class="desktop-features-grid font-mono">
                  <div class="feature-card">
                    <div class="card-title text-cyan"><i class="fi fi-rr-wifi-slash"></i> Offline Support</div>
                    <p class="card-desc">Task edits, comments, and status shifts are saved locally and synced automatically when back online.</p>
                  </div>
                  <div class="feature-card">
                    <div class="card-title text-emerald"><i class="fi fi-rr-rocket-lunch"></i> Instant Launch</div>
                    <p class="card-desc">Launch Bilo directly from your desktop dock, taskbar, or system application launcher.</p>
                  </div>
                  <div class="feature-card">
                    <div class="card-title text-amber"><i class="fi fi-rr-keyboard"></i> Shortcuts</div>
                    <p class="card-desc">Full <code>Cmd+K</code> / <code>Ctrl+K</code> command palette searching and hotkeys without browser conflicts.</p>
                  </div>
                  <div class="feature-card">
                    <div class="card-title text-purple"><i class="fi fi-rr-bell-ring"></i> Notifications</div>
                    <p class="card-desc">System tray alerts and push notifications for task updates and due dates.</p>
                  </div>
                </div>

                <!-- Installation Guides -->
                <div class="install-guides-wrapper font-mono">
                  <span class="md-title"><i class="fi fi-rr-interrogation text-cyan"></i> STEP-BY-STEP INSTALLATION GUIDES</span>

                  <div class="guide-cards-grid">
                    <!-- Chrome / Edge / Brave -->
                    <div class="guide-card">
                      <div class="guide-card-header">
                        <i class="fi fi-rr-browser text-cyan"></i>
                        <span>Chrome, Edge, Brave (Desktop)</span>
                      </div>
                      <ol class="guide-steps">
                        <li>Look for the <strong>Install App icon</strong> <i class="fi fi-rr-download text-cyan"></i> on the right side of the address bar.</li>
                        <li>Or click browser menu <code>(⋮)</code> &rarr; <code>Save and Share</code> &rarr; <code>Install Bilo...</code></li>
                        <li>Confirm by clicking <strong>Install</strong> in the popup prompt.</li>
                      </ol>
                    </div>

                    <!-- Safari macOS / iOS -->
                    <div class="guide-card">
                      <div class="guide-card-header">
                        <i class="fi fi-rr-apple text-cyan"></i>
                        <span>Safari (macOS & iOS)</span>
                      </div>
                      <ol class="guide-steps">
                        <li>On macOS Safari, click <strong>File</strong> in menu bar &rarr; <code>Add to Dock</code>.</li>
                        <li>On iOS Safari, tap the <strong>Share</strong> button <i class="fi fi-rr-share"></i> at the bottom.</li>
                        <li>Scroll down and select <strong>Add to Home Screen</strong>.</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <div class="footer-left">
            <span class="status-dot dot-emerald"></span>
            <span>PRESS <strong>{{ workspaceService.workspaceKeyRange }}</strong> FOR WORKSPACES • PRESS <strong>⌘K</strong> FOR SEARCH • PRESS <strong>N</strong> FOR TASK</span>
          </div>
          <div class="footer-right-actions">
            <button class="btn btn-ghost btn-xs text-rose" (click)="close(); workspaceService.openReportIssueModal()">
              <i class="fi fi-rr-bug"></i> Submit Feedback & Bug Report
            </button>
            <button class="btn btn-secondary btn-xs" (click)="close()">Got it</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .help-modal-card {
      width: 100%;
      max-width: 720px;
      max-height: 85vh;
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
      font-size: 1rem;
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

    /* Tab Bar */
    .help-tab-bar {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.4rem 1.15rem;
      background: var(--bg-surface-subtle);
      border-bottom: 1px solid var(--border-subtle);
    }
    .help-tab-btn {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.65rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 600;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-xs);
      color: var(--text-muted);
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .help-tab-btn:hover {
      color: var(--text-main);
      background: var(--bg-surface-hover);
    }
    .help-tab-btn.active {
      background: var(--bg-surface);
      color: var(--text-main);
      border-color: var(--border-subtle);
      font-weight: 700;
    }

    /* Modal Body */
    .modal-body {
      padding: 1.15rem;
      overflow-y: auto;
      flex: 1;
      max-height: calc(85vh - 120px);
    }

    /* Tab 1: Shortcuts Grid */
    .shortcuts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.15rem;
    }
    @media (max-width: 640px) {
      .shortcuts-grid { grid-template-columns: 1fr; }
    }

    .shortcuts-column {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .column-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.725rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.04em;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid var(--border-subtle);
    }

    .shortcut-list {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .shortcut-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.45rem 0.65rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .item-info {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .item-title {
      font-size: 0.775rem;
      font-weight: 700;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .item-desc {
      font-size: 0.675rem;
      color: var(--text-muted);
    }
    .keys-inline {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* Tab 2: Features Grid */
    .features-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }
    @media (max-width: 640px) {
      .features-grid { grid-template-columns: 1fr; }
    }

    .feature-card {
      padding: 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .card-title {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.825rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .card-desc {
      font-size: 0.725rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.4;
      font-family: var(--font-sans);
    }
    .card-tags {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
      margin-top: 0.25rem;
    }

    /* Tab 3: Workflow Architecture */
    .workflow-guide-box {
      padding: 1rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .guide-header {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .guide-text {
      font-size: 0.775rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.5;
      font-family: var(--font-sans);
    }
    .workflow-steps {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      margin-top: 0.4rem;
    }
    .step-row {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      padding: 0.55rem 0.75rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .step-number {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--text-main);
      color: var(--bg-canvas);
      font-size: 0.7rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .step-content {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .step-title {
      font-size: 0.775rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .step-desc {
      font-size: 0.7rem;
      color: var(--text-muted);
      font-family: var(--font-sans);
    }

    /* Tab 3: Markdown Formatting Guide */
    .markdown-guide-container {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      padding: 0.5rem 0.25rem;
    }
    .markdown-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }
    @media (max-width: 640px) {
      .markdown-grid { grid-template-columns: 1fr; }
    }
    .md-card {
      padding: 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .md-title {
      font-size: 0.775rem;
      font-weight: 700;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .md-code-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 0.5rem 0.65rem;
      font-size: 0.725rem;
      color: var(--accent-cyan);
      line-height: 1.5;
    }

    /* Tab 5: Desktop App Download Guide Styles */
    .desktop-guide-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      padding: 0.25rem;
    }
    .status-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 1rem;
      border-radius: var(--radius-xs);
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface-subtle);
      gap: 1rem;
    }
    .status-box.status-granted {
      border-color: rgba(16, 185, 129, 0.3);
      background: rgba(16, 185, 129, 0.05);
    }
    .status-box.status-default {
      border-color: rgba(6, 182, 212, 0.3);
      background: rgba(6, 182, 212, 0.05);
    }
    .status-box.status-unsupported {
      border-color: var(--border-subtle);
      background: var(--bg-surface-subtle);
    }
    .status-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .icon-lg {
      font-size: 1.4rem;
    }
    .status-desc {
      font-size: 0.725rem;
      color: var(--text-muted);
      margin: 0.15rem 0 0 0;
      font-family: var(--font-sans);
    }
    .status-action {
      flex-shrink: 0;
    }

    .desktop-features-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }
    @media (max-width: 640px) {
      .desktop-features-grid { grid-template-columns: 1fr; }
    }

    .install-guides-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      margin-top: 0.25rem;
    }
    .guide-cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }
    @media (max-width: 640px) {
      .guide-cards-grid { grid-template-columns: 1fr; }
    }
    .guide-card {
      padding: 0.85rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .guide-card-header {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.775rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .guide-steps {
      margin: 0;
      padding-left: 1.1rem;
      font-size: 0.725rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      line-height: 1.4;
      font-family: var(--font-sans);
    }
    .guide-steps code {
      background: var(--bg-surface);
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
      font-size: 0.675rem;
      color: var(--accent-cyan);
      font-family: var(--font-mono);
    }

    /* Footer */
    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.65rem 1.15rem;
      background: var(--bg-surface-subtle);
      border-top: 1px solid var(--border-subtle);
      font-size: 0.675rem;
      color: var(--text-muted);
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .footer-right-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `]
})
export class ShortcutsModalComponent implements OnInit, OnDestroy {
  activeTab = signal<'shortcuts' | 'features' | 'markdown' | 'workflows' | 'desktop'>('shortcuts');
  modalZIndex = 2000;
  private readonly modalId = 'shortcuts-modal';

  constructor(
    public workspaceService: WorkspaceService,
    public pwaInstallService: PwaInstallService,
    private elementRef: ElementRef
  ) { }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isTopModal(this.modalId)) {
      e.preventDefault();
      this.close();
      return;
    }

    if (e.key === 'Tab' && isTopModal(this.modalId)) {
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
  }

  ngOnDestroy() {
    unregisterModal(this.modalId);
  }

  close() {
    unregisterModal(this.modalId);
    this.workspaceService.shortcutsModalOpen.set(false);
  }
}
