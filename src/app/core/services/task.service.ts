import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SyncService } from './sync.service';
import { ProjectService } from './project.service';
import { PushNotificationService } from './push-notification.service';
import { AuthService } from './auth.service';
import { Task, TaskComment, TaskStatusHistory } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  tasks = signal<Task[]>([]);
  taskComments = signal<Record<string, TaskComment[]>>({});
  taskStatusHistory = signal<Record<string, TaskStatusHistory[]>>({});
  loading = signal<boolean>(false);

  constructor(
    private supabaseService: SupabaseService,
    private syncService: SyncService,
    private projectService: ProjectService,
    private pushNotificationService: PushNotificationService,
    private authService: AuthService
  ) {
    this.loadFromStorage();
    this.loadTasksFromSupabase();
  }

  normalizeTaskStatuses(tasks: Task[]): { normalized: Task[]; hasChanges: boolean } {
    const validGlobalStatuses = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];

    let hasChanges = false;
    const normalized = tasks.map(t => {
      const currentStatus = (t.status || '').trim();
      let targetStatus = currentStatus;

      const exactMatch = validGlobalStatuses.find(s => s.toLowerCase() === currentStatus.toLowerCase());
      if (exactMatch) {
        targetStatus = exactMatch;
      } else {
        const lower = currentStatus.toLowerCase();
        if (lower.includes('backlog')) {
          targetStatus = 'Backlog';
        } else if (lower.includes('todo') || lower === 'to do' || lower === 'open') {
          targetStatus = 'To Do';
        } else if (lower.includes('progress') || lower.includes('doing') || lower === 'wip') {
          targetStatus = 'In Progress';
        } else if (lower.includes('review') || lower.includes('testing')) {
          targetStatus = 'In Review';
        } else if (lower.includes('done') || lower.includes('complete') || lower.includes('closed')) {
          targetStatus = 'Done';
        } else {
          targetStatus = 'Backlog';
        }
      }

      const targetCompleted = targetStatus === 'Done';

      if (targetStatus !== currentStatus || t.completed !== targetCompleted) {
        hasChanges = true;
        return {
          ...t,
          status: targetStatus,
          completed: targetCompleted,
          updated_at: new Date().toISOString()
        };
      }
      return t;
    });

    return { normalized, hasChanges };
  }

  loadFromStorage() {
    localStorage.removeItem('bilo_tasks_data');
    const currentUser = this.authService.user();
    if (!currentUser?.id) {
      this.tasks.set([]);
      this.taskComments.set({});
      this.taskStatusHistory.set({});
      return;
    }

    const cached = localStorage.getItem(`bilo_tasks_data_${currentUser.id}`);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data.tasks && Array.isArray(data.tasks)) {
          const cleanTasks = data.tasks.filter((t: Task) => !t.id.startsWith('task-demo-'));
          const { normalized } = this.normalizeTaskStatuses(cleanTasks);
          this.tasks.set(normalized);
          if (data.comments) {
            this.taskComments.set(data.comments);
          }
          if (data.statusHistory) {
            this.taskStatusHistory.set(data.statusHistory);
          }
          return;
        }
      } catch (e) {
        console.error('Failed to parse local tasks cache', e);
      }
    } else {
      this.tasks.set([]);
      this.taskComments.set({});
      this.taskStatusHistory.set({});
    }
  }

  private saveToStorage() {
    const currentUser = this.authService.user();
    if (!currentUser?.id) return;
    localStorage.setItem(`bilo_tasks_data_${currentUser.id}`, JSON.stringify({
      tasks: this.tasks(),
      comments: this.taskComments(),
      statusHistory: this.taskStatusHistory()
    }));
  }

  async loadTasksFromSupabase() {
    if (!this.syncService.isOnline()) return;

    const currentUser = this.authService.user();
    if (!currentUser) {
      this.tasks.set([]);
      this.taskComments.set({});
      this.taskStatusHistory.set({});
      return;
    }

    this.loading.set(true);
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('tasks')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const { normalized, hasChanges } = this.normalizeTaskStatuses(data as Task[]);
        this.tasks.set(normalized);
        this.saveToStorage();

        if (hasChanges) {
          for (const t of normalized) {
            this.supabaseService.supabase
              .from('tasks')
              .update({ status: t.status, completed: t.completed })
              .eq('id', t.id)
              .then();
          }
        }
      } else if (error) {
        console.warn('[TaskService] Could not fetch tasks from Supabase, keeping cached tasks:', error.message);
      }
    } catch (e) {
      console.warn('Could not load tasks from Supabase', e);
    } finally {
      this.loading.set(false);
    }
  }

  async createTask(taskData: Partial<Task>): Promise<Task> {
    const newId = crypto.randomUUID();

    let finalProjectId = taskData.project_id || '';
    if (!finalProjectId || finalProjectId === 'ALL' || !this.syncService.isValidUuid(finalProjectId)) {
      const activeProj = this.projectService.activeProject() || this.projectService.projects()[0];
      if (activeProj) {
        finalProjectId = activeProj.id;
      }
    }

    let initialStatus = (taskData.status || 'Backlog').trim();
    const exactMatch = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'].find(s => s.toLowerCase() === initialStatus.toLowerCase());
    if (exactMatch) {
      initialStatus = exactMatch;
    } else {
      const lower = initialStatus.toLowerCase();
      if (lower.includes('backlog')) initialStatus = 'Backlog';
      else if (lower.includes('todo') || lower === 'to do' || lower === 'open') initialStatus = 'To Do';
      else if (lower.includes('progress') || lower.includes('doing')) initialStatus = 'In Progress';
      else if (lower.includes('review')) initialStatus = 'In Review';
      else if (lower.includes('done') || lower.includes('complete')) initialStatus = 'Done';
      else initialStatus = 'Backlog';
    }

    const currentUser = this.authService.user();
    const newTask: Task = {
      id: newId,
      project_id: finalProjectId,
      user_id: currentUser?.id,
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      type: taskData.type || 'task',
      status: initialStatus,
      priority: taskData.priority || 'medium',
      severity: taskData.severity,
      reproducibility: taskData.reproducibility,
      reporter: taskData.reporter || currentUser?.email || 'Self',
      labels: taskData.labels || [],
      attachments: taskData.attachments || [],
      assignee: taskData.assignee || 'Self',
      due_date: taskData.due_date || '',
      position: 0,
      is_next: taskData.is_next || false,
      completed: initialStatus === 'Done',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Update signal state & local storage immediately
    this.tasks.update(list => [newTask, ...list]);

    // Queue mutation for sync FIRST
    const payload: any = {
      id: newTask.id,
      project_id: this.syncService.isValidUuid(newTask.project_id) ? newTask.project_id : null,
      title: newTask.title,
      description: newTask.description,
      type: newTask.type,
      status: newTask.status,
      priority: newTask.priority,
      severity: newTask.severity,
      reproducibility: newTask.reproducibility,
      reporter: newTask.reporter,
      labels: newTask.labels,
      attachments: newTask.attachments,
      assignee: newTask.assignee,
      due_date: newTask.due_date && newTask.due_date.trim() !== '' ? newTask.due_date : null,
      completed: newTask.completed
    };
    if (currentUser?.id) {
      payload.user_id = currentUser.id;
    }
    this.syncService.enqueue('CREATE_TASK', payload);

    // Record initial status history SECOND
    const historyEntry: TaskStatusHistory = {
      id: crypto.randomUUID(),
      task_id: newTask.id,
      user_id: currentUser?.id,
      from_status: '',
      to_status: initialStatus,
      changed_by: newTask.assignee || 'Self',
      created_at: newTask.created_at
    };
    this.recordStatusHistory(historyEntry);

    this.projectService.logActivity(newTask.project_id, 'Task Created', `Created task "${newTask.title}"`);
    this.pushNotificationService.notifyTaskCreated(newTask.title);
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existingTask = this.tasks().find(t => t.id === id);
    const updatedFields = {
      ...updates,
      completed: updates.status ? updates.status === 'done' || updates.status === 'Done' : undefined,
      updated_at: new Date().toISOString()
    };

    let updatedTask: Task | null = null;
    this.tasks.update(list => list.map(t => {
      if (t.id === id) {
        updatedTask = { ...t, ...updatedFields } as Task;
        return updatedTask;
      }
      return t;
    }));

    if (updatedTask) {
      const taskObj: Task = updatedTask;
      if (updates.status && existingTask && updates.status.trim().toLowerCase() !== existingTask.status.trim().toLowerCase()) {
        const historyEntry: TaskStatusHistory = {
          id: crypto.randomUUID(),
          task_id: id,
          from_status: existingTask.status,
          to_status: updates.status,
          changed_by: updates.assignee || existingTask.assignee || 'Self',
          created_at: new Date().toISOString()
        };
        this.recordStatusHistory(historyEntry);
        this.projectService.logActivity(taskObj.project_id, 'Status Updated', `Task "${taskObj.title}" moved to ${updates.status}`);
        
        this.pushNotificationService.notifyTaskStatusChanged(taskObj.title, existingTask.status, updates.status);
      } else {
        this.saveToStorage();
        this.projectService.logActivity(taskObj.project_id, 'Task Updated', `Updated task "${taskObj.title}"`);
      }
      const payloadFields = { ...updatedFields };
      if ('due_date' in payloadFields && (!payloadFields.due_date || (typeof payloadFields.due_date === 'string' && payloadFields.due_date.trim() === ''))) {
        (payloadFields as any).due_date = null;
      }
      this.syncService.enqueue('UPDATE_TASK', { id, ...payloadFields });
    }

    return updatedTask;
  }

  recordStatusHistory(entry: TaskStatusHistory) {
    this.taskStatusHistory.update(map => ({
      ...map,
      [entry.task_id]: [...(map[entry.task_id] || []), entry]
    }));
    this.saveToStorage();
    this.syncService.enqueue('ADD_STATUS_HISTORY', entry);
  }

  async loadStatusHistoryForTask(taskId: string): Promise<TaskStatusHistory[]> {
    if (this.syncService.isOnline()) {
      try {
        const { data, error } = await this.supabaseService.supabase
          .from('task_status_history')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          this.taskStatusHistory.update(map => ({
            ...map,
            [taskId]: data as TaskStatusHistory[]
          }));
          this.saveToStorage();
          return data as TaskStatusHistory[];
        }
      } catch (e) {
        // fallback
      }
    }

    const localList = this.taskStatusHistory()[taskId] || [];
    if (localList.length === 0) {
      const task = this.tasks().find(t => t.id === taskId);
      if (task) {
        return [
          {
            id: 'init-' + task.id,
            task_id: task.id,
            from_status: '',
            to_status: task.status,
            changed_by: task.assignee || 'Self',
            created_at: task.created_at
          }
        ];
      }
    }

    return [...localList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async deleteTask(id: string) {
    const existing = this.tasks().find(t => t.id === id);
    if (existing) {
      this.projectService.logActivity(existing.project_id, 'Task Deleted', `Deleted task "${existing.title}"`);
    }
    this.tasks.update(list => list.filter(t => t.id !== id));
    this.saveToStorage();
    this.syncService.enqueue('DELETE_TASK', { id });
  }

  // --- Task Comments / Notes ---

  async loadCommentsForTask(taskId: string): Promise<TaskComment[]> {
    if (this.syncService.isOnline()) {
      try {
        const { data, error } = await this.supabaseService.supabase
          .from('task_comments')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          this.taskComments.update(map => ({
            ...map,
            [taskId]: data as TaskComment[]
          }));
          this.saveToStorage();
          return data as TaskComment[];
        }
      } catch (e) {
        console.warn('Could not load comments from Supabase', e);
      }
    }

    return this.taskComments()[taskId] || [];
  }

  async addComment(taskId: string, content: string, authorName: string = 'Self'): Promise<TaskComment> {
    const currentUser = this.authService.user();
    const newComm: TaskComment = {
      id: crypto.randomUUID(),
      task_id: taskId,
      user_id: currentUser?.id,
      author_name: authorName,
      content,
      created_at: new Date().toISOString()
    };

    const task = this.tasks().find(t => t.id === taskId);
    if (task) {
      this.projectService.logActivity(task.project_id, 'Comment Added', `Added comment on "${task.title}"`);
    }

    // Update signal state immediately
    this.taskComments.update(map => ({
      ...map,
      [taskId]: [...(map[taskId] || []), newComm]
    }));
    this.saveToStorage();

    this.syncService.enqueue('ADD_COMMENT', newComm);
    return newComm;
  }

  async updateComment(commentId: string, taskId: string, newContent: string): Promise<TaskComment | null> {
    const updatedAt = new Date().toISOString();
    let updatedComment: TaskComment | null = null;

    this.taskComments.update(map => {
      const list = map[taskId] || [];
      const newList: TaskComment[] = list.map(c => {
        if (c.id === commentId) {
          const updated: TaskComment = { ...c, content: newContent, updated_at: updatedAt };
          updatedComment = updated;
          return updated;
        }
        return c;
      });
      return { ...map, [taskId]: newList };
    });

    this.saveToStorage();
    this.syncService.enqueue('UPDATE_COMMENT', { id: commentId, content: newContent, updated_at: updatedAt });
    return updatedComment;
  }

  async deleteComment(commentId: string, taskId: string): Promise<void> {
    this.taskComments.update(map => {
      const list = map[taskId] || [];
      return {
        ...map,
        [taskId]: list.filter(c => c.id !== commentId)
      };
    });

    this.saveToStorage();
    this.syncService.enqueue('DELETE_COMMENT', { id: commentId });
  }

  resetState() {
    const currentUser = this.authService.user();
    if (currentUser?.id) {
      localStorage.removeItem(`bilo_tasks_data_${currentUser.id}`);
    }
    localStorage.removeItem('bilo_tasks_data');
    this.tasks.set([]);
    this.taskComments.set({});
    this.taskStatusHistory.set({});
  }
}
