import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';
import { WorkflowService } from '../../core/services/workflow.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { Project, Task } from '../../core/models/project.model';
import { ProjectModalComponent } from '../../shared/components/project-modal';
import { WorkflowModalComponent } from '../../shared/components/workflow-modal';


@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProjectModalComponent,
    WorkflowModalComponent
  ],
  template: `
    <div class="projects-workspace font-mono">
      <!-- 1. Header Bar -->
      <div class="view-header-strip paper-panel">
        <div class="view-header-left">
          <span class="badge-mono">02 PROJECTS</span>
          <h2 class="view-header-title">Projects Workspace</h2>
          <span class="badge-mono text-muted">Total: {{ filteredProjects().length }}</span>
        </div>

        <div class="view-header-right">
          <div class="search-box">
            <i class="fi fi-rr-search search-icon"></i>
            <input
              type="text"
              class="form-input search-input font-mono"
              placeholder="Search projects..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
            />
          </div>

          <button class="btn btn-secondary btn-sm" (click)="openGlobalWorkflowModal()" title="Configure global status workflows">
            <i class="fi fi-rr-settings-sliders text-cyan"></i> Workflow Config
          </button>

          <button class="btn btn-primary btn-sm" (click)="openCreateProjectModal()">
            <i class="fi fi-rr-folder-add"></i> Create Project
          </button>
        </div>
      </div>

      <!-- 2. Main Projects Cards Grid -->
      @if (projectService.loading()) {
        <div class="projects-grid">
          @for (i of [1, 2, 3]; track i) {
            <div class="skeleton-card paper-panel font-mono">
              <div class="skeleton-line" style="width: 50%; height: 18px;"></div>
              <div class="skeleton-line" style="width: 85%;"></div>
              <div class="skeleton-line" style="width: 70%;"></div>
              <div class="skeleton-box" style="height: 48px; margin-top: 0.5rem;"></div>
            </div>
          }
        </div>
      } @else {
        <div class="projects-grid">
          @for (p of filteredProjects(); track p.id) {
          @let summary = getProjectSummary(p.id);
          @let workflows = workflowService.getWorkflowsForProject(p.id);

          <div class="project-card paper-panel">
            <!-- Card Header -->
            <div class="card-header">
              <div class="title-group">
                @let projImg = p.image_url || p.icon;
                @if (isImageIcon(projImg)) {
                  <img [src]="projImg" class="project-icon-avatar" alt="Project Image" />
                } @else if (projImg) {
                  <i [class]="projImg" class="project-icon-symbol" [style.color]="p.color || 'var(--accent-cyan)'"></i>
                } @else {
                  <span class="status-dot" [style.background-color]="p.color || 'var(--accent-cyan)'"></span>
                }
                <h3 class="project-title">{{ p.name }}</h3>
              </div>

              <span
                class="badge-mono status-badge"
                [class.badge-active]="p.status === 'active'"
                [class.badge-done]="p.status === 'completed'"
              >
                {{ p.status || 'active' }}
              </span>
            </div>

            <!-- Description & Repo Link -->
            <div class="card-body">
              @if (p.description) {
                <p class="project-desc">{{ p.description }}</p>
              }

              <!-- Task Progress Meter -->
              <div class="progress-section">
                <div class="progress-labels font-mono">
                  <span class="lbl-left">Progress</span>
                  <span class="lbl-right">{{ summary.completedTasks }}/{{ summary.totalTasks }} Tasks ({{ summary.percent }}%)</span>
                </div>
                <div class="mini-bar-track">
                  <div
                    class="mini-bar-fill"
                    [style.width]="summary.percent + '%'"
                    [style.background-color]="p.color || 'var(--accent-cyan)'"
                  ></div>
                </div>
              </div>

              <!-- Task Metrics Chips -->
              <div class="metrics-row font-mono">
                <div class="metric-pill" title="Total Tasks">
                  <i class="fi fi-rr-list-check text-subtle"></i>
                  <span>{{ summary.totalTasks }} Total</span>
                </div>

                <div class="metric-pill" title="Open Bugs">
                  <i class="fi fi-rr-bug text-rose"></i>
                  <span [class.text-rose]="summary.openBugs > 0">{{ summary.openBugs }} Bugs</span>
                </div>

                <div class="metric-pill" title="Overdue / Due Tasks">
                  <i class="fi fi-rr-clock text-amber"></i>
                  <span [class.text-amber]="summary.dueSoon > 0">{{ summary.dueSoon }} Due</span>
                </div>
              </div>

              <!-- Workflow Stages Config Preview -->
              <div class="workflow-preview font-mono">
                <span class="wf-lbl">Workflow Statuses:</span>
                <div class="wf-chips">
                  @for (wf of workflows; track wf.id) {
                    <span class="wf-chip" [style.border-color]="wf.color">
                      <span class="status-dot" [style.background-color]="wf.color"></span>
                      {{ wf.name }}
                    </span>
                  }
                </div>
              </div>
            </div>

            <!-- Card Actions Footer -->
            <div class="card-footer font-mono">
              <div class="footer-left">
                <button
                  class="btn btn-secondary btn-xs"
                  (click)="openEditProjectModal(p)"
                  title="Edit Project Details"
                >
                  <i class="fi fi-rr-edit text-muted"></i> Edit
                </button>
              </div>

              <button
                class="btn btn-primary btn-xs"
                (click)="openProjectBoard(p.id)"
                title="Go to Kanban Board for this project"
              >
                <i class="fi fi-rr-apps"></i> Board
              </button>
            </div>
          </div>
        }

        <!-- Create New Project Card Prompt -->
        <div class="create-project-card paper-panel" (click)="openCreateProjectModal()">
          <div class="create-card-inner font-mono">
            <div class="create-icon-wrapper">
              <i class="fi fi-rr-folder-add"></i>
            </div>
            <h4>Create New Project</h4>
            <p>Define a new project repository and customize its workflow status pipeline.</p>
          </div>
        </div>
      </div>
    }

      <!-- Modals -->
      @if (showProjectModal()) {
        <app-project-modal
          [projectToEdit]="editingProject()"
          (close)="closeProjectModal()"
        ></app-project-modal>
      }

      @if (showWorkflowModal()) {
        <app-workflow-modal
          (close)="closeWorkflowModal()"
        ></app-workflow-modal>
      }
    </div>
  `,
  styles: [`
    .projects-workspace {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 1rem;
      width: 100%;
      box-sizing: border-box;
    }

    /* Header Strip */
    .projects-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.85rem;
      padding: 0.75rem 1.1rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
    }
    .banner-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .banner-left h2 {
      font-size: 1.1rem;
      font-weight: 700;
    }
    .banner-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .search-box {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-icon {
      position: absolute;
      left: 0.6rem;
      color: var(--text-subtle);
      font-size: 0.75rem;
    }
    .search-input {
      padding-left: 1.8rem;
      width: 200px;
      font-size: 0.775rem;
      height: 30px;
    }

    /* Projects Cards Grid */
    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.1rem;
      width: 100%;
    }

    .project-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      padding: 1.1rem;
      transition: var(--transition-fast);
      box-sizing: border-box;
    }
    .project-card:hover {
      border-color: var(--border-medium);
    }

    /* Card Top Header */
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.85rem;
      gap: 0.5rem;
    }
    .title-group {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      flex: 1;
      overflow: hidden;
    }
    .project-icon-avatar {
      width: 24px;
      height: 24px;
      border-radius: var(--radius-xs);
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid var(--border-subtle);
    }
    .project-icon-symbol {
      font-size: 1.1rem;
      line-height: 1;
      flex-shrink: 0;
    }
    .project-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status-badge {
      text-transform: uppercase;
      font-size: 0.65rem;
    }
    .badge-active {
      background: #f0fdf4;
      color: var(--accent-emerald);
      border-color: #bbf7d0;
    }

    /* Card Body */
    .card-body {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      flex: 1;
    }
    .project-desc {
      font-size: 0.775rem;
      color: var(--text-muted);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .repo-link {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.725rem;
      color: var(--accent-cyan);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .repo-link:hover {
      text-decoration: underline;
    }
    .repo-url-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Progress Bar */
    .progress-section {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .progress-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
    }
    .lbl-left { color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
    .lbl-right { color: var(--text-main); font-weight: 600; }
    .mini-bar-track {
      width: 100%;
      height: 5px;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      overflow: hidden;
    }
    .mini-bar-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    /* Metrics Chips */
    .metrics-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .metric-pill {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.45rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    /* Workflow Chips Preview */
    .workflow-preview {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding-top: 0.4rem;
      border-top: 1px dashed var(--border-subtle);
    }
    .wf-lbl {
      font-size: 0.675rem;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .wf-chips {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      flex-wrap: wrap;
    }
    .wf-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.65rem;
      padding: 0.1rem 0.35rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xs);
      color: var(--text-main);
    }

    /* Card Footer Actions */
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.85rem;
      margin-top: 0.85rem;
      border-top: 1px solid var(--border-subtle);
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    /* Create New Project Card Prompt */
    .create-project-card {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 260px;
      border: 2px dashed var(--border-medium);
      border-radius: var(--radius-xs);
      background: var(--bg-surface-subtle);
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .create-project-card:hover {
      background: var(--bg-surface-hover);
      border-color: var(--text-main);
    }
    .create-card-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.5rem;
      padding: 1.5rem;
      color: var(--text-muted);
    }
    .create-icon-wrapper {
      font-size: 2rem;
      color: var(--text-main);
    }
    .create-card-inner h4 {
      font-size: 0.95rem;
      color: var(--text-main);
    }
    .create-card-inner p {
      font-size: 0.725rem;
      color: var(--text-subtle);
      max-width: 220px;
      line-height: 1.35;
    }
  `]
})
export class ProjectsComponent {
  searchQuery = signal<string>('');
  showProjectModal = signal<boolean>(false);
  editingProject = signal<Project | null>(null);
  showWorkflowModal = signal<boolean>(false);

  constructor(
    public projectService: ProjectService,
    public taskService: TaskService,
    public workflowService: WorkflowService,
    public workspaceService: WorkspaceService
  ) { }

  isImageIcon(val?: string): boolean {
    if (!val) return false;
    return val.startsWith('data:') || val.startsWith('http://') || val.startsWith('https://');
  }

  filteredProjects = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.projectService.projects();
    if (!q) return all;
    return all.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  });

  getProjectSummary(projectId: string) {
    const tasks = this.taskService.tasks().filter(t => t.project_id === projectId);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed || (t.status || '').toLowerCase() === 'done').length;
    const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const openBugs = tasks.filter(t => !t.completed && (t.status || '').toLowerCase() !== 'done' && t.type === 'bug').length;

    const todayStr = new Date().toISOString().split('T')[0];
    const dueSoon = tasks.filter(t => !t.completed && (t.status || '').toLowerCase() !== 'done' && t.due_date && t.due_date <= todayStr).length;

    return {
      totalTasks,
      completedTasks,
      percent,
      openBugs,
      dueSoon
    };
  }

  openCreateProjectModal() {
    this.editingProject.set(null);
    this.showProjectModal.set(true);
  }

  openEditProjectModal(p: Project) {
    this.editingProject.set(p);
    this.showProjectModal.set(true);
  }

  closeProjectModal() {
    this.showProjectModal.set(false);
    this.editingProject.set(null);
  }

  openGlobalWorkflowModal() {
    this.showWorkflowModal.set(true);
  }

  closeWorkflowModal() {
    this.showWorkflowModal.set(false);
  }

  openProjectBoard(projectId: string) {
    this.projectService.explicitBoardProjectId.set(projectId);
    const proj = this.projectService.projects().find(p => p.id === projectId);
    if (proj) {
      this.projectService.activeProject.set(proj);
    }
    this.workspaceService.setWorkspace('03 TASKS');
  }
}
