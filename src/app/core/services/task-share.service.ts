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
    if (typeof window === 'undefined') return;

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
      this.hasProcessedInitialUrl = true;
      const opened = this.openTaskByParam(taskParam);
      if (!opened) {
        // Clean up invalid task parameter from URL to prevent broken navigation state
        const cleanUrl = window.location.pathname + (window.location.hash || '');
        window.history.replaceState(null, '', cleanUrl);
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

    // 1. Exact UUID match (highest priority)
    let matched = tasks.find(t => t.id.toUpperCase() === cleanParam);

    // 2. UUID Prefix match (if param is at least 8 chars long)
    if (!matched && cleanParam.length >= 8) {
      matched = tasks.find(t => t.id.toUpperCase().startsWith(cleanParam));
    }

    // 3. Sequential Task Key match (e.g. BIL-1, BIL-104)
    if (!matched) {
      matched = tasks.find(t => {
        const key = getTaskKey(t, projects, tasks).toUpperCase();
        return key === cleanParam;
      });
    }

    // 4. Fallback Task Key / Numeric match
    if (!matched) {
      matched = tasks.find(t => {
        const key = getTaskKey(t, projects).toUpperCase();
        if (key === cleanParam) return true;
        const parts = key.split('-');
        if (parts[1] && parts[1] === cleanParam) return true;
        return false;
      });
    }

    if (matched) {
      this.activeSharedTask.set(matched);
      const matchedKey = getTaskKey(matched, projects, tasks);
      this.showToast(`Opened shared task ${matchedKey}`);
      return true;
    }

    this.showToast(`Shared task "${cleanParam}" not found or may have been deleted`);
    return false;
  }

  closeSharedTaskModal() {
    this.activeSharedTask.set(null);
  }
}
