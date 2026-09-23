import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowService } from '../../core/services/workflow.service';
import { TaskService } from '../../core/services/task.service';
import { Project, Workflow } from '../../core/models/project.model';

@Component({
  selector: 'app-workflow-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>
            <i class="fi fi-rr-settings-sliders text-cyan"></i>
            <span>Global Workflow Configuration</span>
          </h3>
          <button class="btn btn-ghost btn-sm" (click)="close.emit()">
            <i class="fi fi-rr-cross"></i>
          </button>
        </div>

        <p class="modal-subtext">
          Configure universal workflow status columns shared across all projects in Bilo. Changes sync directly with your database.
        </p>

        <div class="columns-list">
          @if (columns.length === 0) {
            <div class="empty-list">
              <i class="fi fi-rr-info empty-icon"></i>
              <p>No workflow status columns defined. Add your first status column below!</p>
            </div>
          } @else {
            @for (col of columns; track col.id; let i = $index) {
              <div class="column-item">
                <span class="drag-handle"><i class="fi fi-rr-menu-dots-vertical"></i></span>

                <input
                  type="color"
                  class="color-picker-inline"
                  [(ngModel)]="col.color"
                />

                <input
                  type="text"
                  class="form-input col-name-input"
                  [(ngModel)]="col.name"
                  placeholder="Status Column Name (e.g. Backlog, In Progress)"
                />

                <div class="col-actions">
                  @if (i > 0) {
                    <button type="button" class="btn btn-ghost btn-sm btn-icon" (click)="moveColumn(i, -1)">
                      <i class="fi fi-rr-angle-up"></i>
                    </button>
                  }
                  @if (i < columns.length - 1) {
                    <button type="button" class="btn btn-ghost btn-sm btn-icon" (click)="moveColumn(i, 1)">
                      <i class="fi fi-rr-angle-down"></i>
                    </button>
                  }
                  <button type="button" class="btn btn-ghost btn-sm btn-icon btn-danger" (click)="removeColumn(col, i)">
                    <i class="fi fi-rr-trash"></i>
                  </button>
                </div>
              </div>
            }
          }
        </div>

        <!-- Add Column Row -->
        <div class="add-col-row">
          <input
            type="text"
            class="form-input new-col-input"
            placeholder="New status column name (e.g. In Review, QA)..."
            [(ngModel)]="newColumnName"
            (keyup.enter)="addNewWorkflowColumn()"
          />
          <button type="button" class="btn btn-primary btn-sm" (click)="addNewWorkflowColumn()">
            <i class="fi fi-rr-plus"></i> Add Status
          </button>
        </div>

        <div class="modal-footer">
          <div class="right-buttons">
            <button type="button" class="btn btn-secondary" (click)="close.emit()">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" (click)="saveWorkflowChanges()">
              <i class="fi fi-rr-check"></i> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-subtext {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 1.25rem;
      line-height: 1.45;
    }
    .columns-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      overflow-y: auto;
      padding-right: 0.25rem;
      margin-bottom: 1rem;
    }
    .empty-list {
      padding: 1.5rem;
      text-align: center;
      color: var(--text-subtle);
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-md);
      font-size: 0.85rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    .empty-icon {
      font-size: 1.5rem;
      color: var(--accent-cyan);
    }
    .column-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: var(--bg-surface);
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }
    .drag-handle {
      color: var(--text-subtle);
    }
    .color-picker-inline {
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      cursor: pointer;
    }
    .col-name-input {
      flex: 1;
      padding: 0.35rem 0.6rem;
      font-size: 0.875rem;
    }
    .col-actions {
      display: flex;
      align-items: center;
      gap: 0.2rem;
    }
    .add-col-row {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .new-col-input {
      flex: 1;
      font-size: 0.85rem;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding-top: 1rem;
      border-top: 1px solid var(--border-subtle);
    }
    .right-buttons {
      display: flex;
      gap: 0.75rem;
    }
  `]
})
export class WorkflowModalComponent implements OnInit {
  @Input() project: Project | null = null;
  @Output() close = new EventEmitter<void>();

  columns: Workflow[] = [];
  deletedColumnIds: string[] = [];
  newColumnName = '';

  constructor(
    private workflowService: WorkflowService,
    private taskService: TaskService
  ) {}

  ngOnInit() {
    const projId = this.project?.id || 'global';
    const existing = this.workflowService.getWorkflowsForProject(projId);
    this.columns = JSON.parse(JSON.stringify(existing));
  }

  async addNewWorkflowColumn() {
    if (!this.newColumnName.trim()) return;
    const name = this.newColumnName.trim();
    const projId = this.project?.id || 'global';
    const created = await this.workflowService.createWorkflow(projId, name);
    this.columns.push(JSON.parse(JSON.stringify(created)));
    this.newColumnName = '';
  }

  async removeColumn(col: Workflow, index: number) {
    if (this.columns.length <= 1) {
      alert('Cannot delete the only remaining status column in a workflow.');
      return;
    }

    const projId = this.project?.id || 'global';
    const colNameLower = col.name.trim().toLowerCase();

    const assignedTasks = this.taskService.tasks().filter(t => {
      if (projId !== 'global' && t.project_id !== projId) return false;
      if (t.workflow_id === col.id) return true;
      if (t.status === col.id) return true;
      if (colNameLower && t.status?.trim().toLowerCase() === colNameLower) return true;
      return false;
    });

    if (assignedTasks.length > 0) {
      const remainingCols = this.columns.filter((_, i) => i !== index);
      const fallbackName = remainingCols.length > 0 ? remainingCols[0].name : 'Backlog';
      const confirmed = window.confirm(
        `Column "${col.name}" currently has ${assignedTasks.length} task(s) assigned to it.\n\nDeleting this column will reassign those task(s) to "${fallbackName}". Are you sure you want to proceed?`
      );
      if (!confirmed) return;
    }

    this.columns.splice(index, 1);
    if (col.id && !col.id.startsWith('temp-')) {
      if (!this.deletedColumnIds.includes(col.id)) {
        this.deletedColumnIds.push(col.id);
      }
    }
  }

  moveColumn(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= this.columns.length) return;
    const temp = this.columns[index];
    this.columns[index] = this.columns[target];
    this.columns[target] = temp;
  }

  async saveWorkflowChanges() {
    const projId = this.project?.id || 'global';
    for (const delId of this.deletedColumnIds) {
      await this.workflowService.deleteWorkflow(delId, projId);
    }

    await this.workflowService.updateWorkflowPositions(projId, this.columns);
    this.close.emit();
  }
}
