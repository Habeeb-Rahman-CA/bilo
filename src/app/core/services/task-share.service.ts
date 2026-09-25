import { Injectable, signal, effect } from '@angular/core';
import { Task, Project } from '../models/project.model';
import { getTaskKey } from '../utils/task-key.util';
import { copyToClipboard } from '../utils/clipboard.util';
import { TaskService } from './task.service';
import { ProjectService } from './project.service';
import { WorkspaceService } from './workspace.service';

@Injectable({
  providedIn: 'root'
})
export class TaskShareService {
  toastMessage = signal<string | null>(null);
  activeSharedTask = signal<Task | null>(null);
  private hasProcessedInitialUrl = false;

  constructor(
    private taskService: TaskService,
    private projectService: ProjectService,
    private workspaceService: WorkspaceService
  ) {
    // Reactive effect: fires automatically whenever tasks() update/load
    effect(() => {
      const tasks = this.taskService.tasks();
      if (!this.hasProcessedInitialUrl && tasks.length > 0) {
        this.checkUrlForTaskParam();
      }
    });

    // Also check immediately in case tasks are already cached
    setTimeout(() => {
      if (!this.hasProcessedInitialUrl) {
        this.checkUrlForTaskParam();
      }
    }, 100);
  }

  /**
   * Copies task share link to clipboard & displays toast message
   */
  async copyTaskShareLink(task: Task, event?: Event): Promise<string> {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const key = getTaskKey(task, this.projectService.projects());
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = `${baseUrl}?task=${key}`;

    const success = await copyToClipboard(shareUrl);
    if (success) {
      this.showToast(`Link copied for ${key}!`);
    } else {
      console.warn('Failed to auto-copy share link to clipboard:', shareUrl);
      this.showToast(`Share URL: ${shareUrl}`);
    }

    return shareUrl;
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 3000);
  }

  /**
   * Checks URL query params or hash for ?task=KEY or ?task=UUID
   */
  checkUrlForTaskParam() {
    const urlParams = new URLSearchParams(window.location.search);
    let taskParam = urlParams.get('task') || urlParams.get('taskId');

    if (!taskParam && window.location.hash.includes('?')) {
      const queryStr = window.location.hash.split('?')[1];
      if (queryStr) {
        const hashParams = new URLSearchParams(queryStr);
        taskParam = hashParams.get('task') || hashParams.get('taskId');
      }
    }

    if (!taskParam && window.location.href.includes('task=')) {
      const match = window.location.href.match(/[?&]task=([^&]+)/);
      if (match) taskParam = match[1];
    }

    if (taskParam) {
      const opened = this.openTaskByParam(taskParam);
      if (opened) {
        this.hasProcessedInitialUrl = true;
      }
    }
  }

  /**
   * Finds task matching ID and opens detail modal
   */
  openTaskByParam(param: string): boolean {
    const cleanParam = decodeURIComponent(param).trim().toUpperCase();
    const tasks = this.taskService.tasks();
    const projects = this.projectService.projects();

    if (tasks.length === 0) return false;

    const matched = tasks.find(t => {
      // 1. Direct UUID or prefix match
      if (t.id.toUpperCase() === cleanParam || t.id.toUpperCase().startsWith(cleanParam)) return true;
      // 2. Exact Key match (e.g. BIL-104)
      const key = getTaskKey(t, projects).toUpperCase();
      if (key === cleanParam) return true;
      // 3. Numeric match if user passed e.g. ?task=104
      const parts = key.split('-');
      if (parts[1] && parts[1] === cleanParam) return true;
      return false;
    });

    if (matched) {
      this.activeSharedTask.set(matched);
      const matchedKey = getTaskKey(matched, projects);
      this.showToast(`Opened shared task ${matchedKey}`);
      return true;
    }

    return false;
  }

  closeSharedTaskModal() {
    this.activeSharedTask.set(null);
  }
}
