import { Injectable, signal, Injector } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SyncService } from './sync.service';
import { ProjectService } from './project.service';
import { PushNotificationService } from './push-notification.service';
import { AuthService } from './auth.service';
import { WorkflowService } from './workflow.service';
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
    private authService: AuthService,
    private injector?: Injector
  ) {
    this.loadFromStorage();
    this.loadTasksFromSupabase();

    this.syncService.onConnectionRestored(() => {
      console.log('[TaskService] Connection restored. Reloading remote tasks...');
      this.loadTasksFromSupabase();
    });
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
          targetStatus = currentStatus || 'Backlog';
        }
      }

      const targetCompleted = targetStatus.toLowerCase() === 'done' || targetStatus.toLowerCase() === 'completed' || t.completed === true;

      if (targetStatus !== currentStatus || t.completed !== targetCompleted) {
        hasChanges = true;
        return {
          ...t,
          status: targetStatus,
          completed: targetCompleted
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
    const key = `bilo_tasks_data_${currentUser.id}`;

    const payload = {
      tasks: this.tasks(),
      comments: this.taskComments(),
      statusHistory: this.taskStatusHistory()
    };

    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e: any) {
      console.warn('[TaskService] LocalStorage quota exceeded when saving tasks data. Sanitizing cached attachments...', e);
      try {
        const sanitizedTasks = payload.tasks.map(t => {
          if (t.attachments && t.attachments.length > 0) {
            return {
              ...t,
              attachments: t.attachments.map(att => (att && att.length > 1024) ? '[Attachment cached remotely]' : att)
            };
          }
          return t;
        });

        const fallbackPayload = {
          tasks: sanitizedTasks,
          comments: payload.comments,
          statusHistory: payload.statusHistory
        };

        localStorage.setItem(key, JSON.stringify(fallbackPayload));
      } catch (fallbackErr) {
        console.error('[TaskService] Could not save task cache even after sanitizing attachments:', fallbackErr);
      }
    }
  }

  async loadTasksFromSupabase() {
    if (!this.syncService.isOnline() || !this.supabaseService.isConfigured) return;

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
        const remoteTasks = data as Task[];
        const localTasks = this.tasks();
        const pendingQueue = this.syncService.pendingSyncQueue();

        const pendingTaskIds = new Set(
          pendingQueue
            .filter(op => op.type === 'CREATE_TASK' || op.type === 'UPDATE_TASK' || op.type === 'DELETE_TASK')
            .map(op => op.payload.id || op.payload.task_id)
            .filter(Boolean)
        );

        const mergedMap = new Map<string, Task>();

        remoteTasks.forEach(rt => {
          mergedMap.set(rt.id, rt);
        });

        localTasks.forEach(lt => {
          if (pendingTaskIds.has(lt.id)) {
            mergedMap.set(lt.id, lt);
          } else if (mergedMap.has(lt.id)) {
            const rt = mergedMap.get(lt.id)!;
            const ltTime = lt.updated_at ? new Date(lt.updated_at).getTime() : 0;
            const rtTime = rt.updated_at ? new Date(rt.updated_at).getTime() : 0;
            if (ltTime > rtTime) {
              mergedMap.set(lt.id, lt);
            }
          } else {
            mergedMap.set(lt.id, lt);
          }
        });

        const deletedTaskIds = new Set(
          pendingQueue.filter(op => op.type === 'DELETE_TASK').map(op => op.payload.id).filter(Boolean)
        );
        const finalTasksList = Array.from(mergedMap.values()).filter(t => !deletedTaskIds.has(t.id));

        const { normalized } = this.normalizeTaskStatuses(finalTasksList);
        this.tasks.set(normalized);
        this.saveToStorage();
      } else if (error) {
        console.warn('[TaskService] Could not fetch tasks from Supabase, keeping cached tasks:', error.message);
      }
    } catch (e) {
      console.warn('Could not load tasks from Supabase', e);
    } finally {
      this.loading.set(false);
    }
  }

  validateWorkflowId(projectId: string, workflowId?: string, status?: string): string | undefined {
    if (!workflowId) return undefined;

    try {
      let projWorkflows: any[] = [];
      if (this.injector) {
        try {
          const workflowService = this.injector.get(WorkflowService);
          if (workflowService) {
            projWorkflows = workflowService.getWorkflowsForProject(projectId) || [];
          }
        } catch (e) {}
      }

      if (projWorkflows.length > 0) {
        const match = projWorkflows.find(w => w.id === workflowId || (w.id && w.id.toLowerCase() === workflowId.toLowerCase()));
        if (match) {
          return match.id;
        }

        if (status) {
          const statusMatch = projWorkflows.find(w => w.name && w.name.toLowerCase() === status.trim().toLowerCase());
          if (statusMatch) {
            return statusMatch.id;
          }
        }
      }

      if (this.syncService.isValidUuid(workflowId)) {
        return workflowId;
      }
    } catch (e) {
      if (this.syncService.isValidUuid(workflowId)) {
        return workflowId;
      }
    }

    console.warn(`[TaskService] Invalid workflow_id "${workflowId}" rejected for project "${projectId}". Setting workflow_id to undefined.`);
    return undefined;
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
      else initialStatus = initialStatus || 'Backlog';
    }

    const currentUser = this.authService.user();
    const cleanTitle = (taskData.title || '').trim();
    const finalTitle = cleanTitle.length > 0 ? cleanTitle : 'Untitled Task';

    // Calculate unique, collision-free position for the new task in its column/project
    const columnTasks = this.tasks().filter(
      t => t.project_id === finalProjectId && t.status.toLowerCase() === initialStatus.toLowerCase()
    );
    const maxPos = columnTasks.reduce((max, t) => Math.max(max, typeof t.position === 'number' ? t.position : 0), -1);
    let targetPosition = typeof taskData.position === 'number' ? taskData.position : maxPos + 1;
    while (columnTasks.some(t => t.position === targetPosition)) {
      targetPosition++;
    }

    const validatedWorkflowId = this.validateWorkflowId(
      finalProjectId,
      taskData.workflow_id,
      initialStatus
    );

    const newTask: Task = {
      id: newId,
      project_id: finalProjectId,
      workflow_id: validatedWorkflowId,
      user_id: currentUser?.id,
      title: finalTitle,
      description: taskData.description || '',
      type: taskData.type || 'task',
      status: initialStatus,
      priority: taskData.priority || 'medium',
      severity: taskData.severity,
      reproducibility: taskData.reproducibility,
      reporter: taskData.reporter || currentUser?.email || 'User',
      is_app_report: taskData.is_app_report || false,
      report_category: taskData.report_category,
      labels: taskData.labels || [],
      attachments: taskData.attachments || [],
      assignee: taskData.assignee || 'Unassigned',
      due_date: taskData.due_date || '',
      position: targetPosition,
      is_next: taskData.is_next || false,
      completed: initialStatus.toLowerCase() === 'done' || initialStatus.toLowerCase() === 'completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.tasks.update(list => [newTask, ...list]);

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
      is_app_report: newTask.is_app_report,
      report_category: newTask.report_category,
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

    const historyEntry: TaskStatusHistory = {
      id: crypto.randomUUID(),
      task_id: newTask.id,
      user_id: currentUser?.id,
      from_status: '',
      to_status: initialStatus,
      action_type: 'created',
      details: `Created task with initial status "${initialStatus}"`,
      changed_by: currentUser?.email ? currentUser.email.split('@')[0] : 'User',
      created_at: newTask.created_at
    };
    this.recordStatusHistory(historyEntry);

    this.projectService.logActivity(newTask.project_id, 'Task Created', `Created task "${newTask.title}"`);
    this.pushNotificationService.notifyTaskCreated(newTask.title);
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existingTask = this.tasks().find(t => t.id === id);
    if (!existingTask) return null;

    const newStatus = updates.status !== undefined ? updates.status : existingTask.status;
    const targetCompleted = updates.status !== undefined
      ? (newStatus.toLowerCase() === 'done' || newStatus.toLowerCase() === 'completed')
      : (updates.completed !== undefined ? updates.completed : existingTask.completed);

    const updatedFields: any = {
      ...updates,
      status: newStatus,
      completed: targetCompleted,
      updated_at: new Date().toISOString()
    };

    if (updates.title !== undefined) {
      const cleanTitle = updates.title.trim();
      updatedFields.title = cleanTitle.length > 0 ? cleanTitle : (existingTask.title || 'Untitled Task');
    }

    if (updates.workflow_id !== undefined) {
      const validWfId = this.validateWorkflowId(
        existingTask.project_id,
        updates.workflow_id,
        updates.status || existingTask.status
      );
      updatedFields.workflow_id = validWfId;
    }

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
      const currentUser = this.authService.user();
      const updaterName = currentUser?.email ? currentUser.email.split('@')[0] : (taskObj.assignee || 'User');

      // 1) Status Change
      if (updates.status && existingTask && updates.status.trim().toLowerCase() !== existingTask.status.trim().toLowerCase()) {
        const historyEntry: TaskStatusHistory = {
          id: crypto.randomUUID(),
          task_id: id,
          from_status: existingTask.status,
          to_status: updates.status,
          action_type: 'status',
          details: `Moved status from "${existingTask.status}" to "${updates.status}"`,
          changed_by: updaterName,
          created_at: new Date().toISOString()
        };
        this.recordStatusHistory(historyEntry);
        this.projectService.logActivity(taskObj.project_id, 'Status Updated', `Task "${taskObj.title}" moved to ${updates.status}`);
        this.pushNotificationService.notifyTaskStatusChanged(taskObj.title, existingTask.status, updates.status);
      }

      // 2) Assignee Change
      if (updates.assignee !== undefined && updates.assignee !== existingTask.assignee) {
        const oldVal = existingTask.assignee || 'Unassigned';
        const newVal = updates.assignee || 'Unassigned';
        this.recordStatusHistory({
          id: crypto.randomUUID(),
          task_id: id,
          from_status: taskObj.status,
          to_status: taskObj.status,
          action_type: 'assignee',
          details: `Changed assignee from "${oldVal}" to "${newVal}"`,
          changed_by: updaterName,
          created_at: new Date().toISOString()
        });
      }

      // 3) Priority Change
      if (updates.priority !== undefined && updates.priority !== existingTask.priority) {
        this.recordStatusHistory({
          id: crypto.randomUUID(),
          task_id: id,
          from_status: taskObj.status,
          to_status: taskObj.status,
          action_type: 'priority',
          details: `Changed priority to "${updates.priority.toUpperCase()}"`,
          changed_by: updaterName,
          created_at: new Date().toISOString()
        });
      }

      // 4) Title Change
      if (updates.title !== undefined && updates.title.trim() !== existingTask.title.trim()) {
        this.recordStatusHistory({
          id: crypto.randomUUID(),
          task_id: id,
          from_status: taskObj.status,
          to_status: taskObj.status,
          action_type: 'title',
          details: `Updated title to "${updates.title.trim()}"`,
          changed_by: updaterName,
          created_at: new Date().toISOString()
        });
      }

      // 5) Description Change
      if (updates.description !== undefined && updates.description !== existingTask.description) {
        this.recordStatusHistory({
          id: crypto.randomUUID(),
          task_id: id,
          from_status: taskObj.status,
          to_status: taskObj.status,
          action_type: 'description',
          details: `Updated task description`,
          changed_by: updaterName,
          created_at: new Date().toISOString()
        });
      }

      // 6) Due Date Change
      if (updates.due_date !== undefined && updates.due_date !== existingTask.due_date) {
        const dateVal = updates.due_date ? updates.due_date : 'None';
        this.recordStatusHistory({
          id: crypto.randomUUID(),
          task_id: id,
          from_status: taskObj.status,
          to_status: taskObj.status,
          action_type: 'due_date',
          details: `Updated due date to ${dateVal}`,
          changed_by: updaterName,
          created_at: new Date().toISOString()
        });
      }

      this.saveToStorage();

      const payloadFields = { ...updatedFields };
      if ('due_date' in payloadFields && (!payloadFields.due_date || (typeof payloadFields.due_date === 'string' && payloadFields.due_date.trim() === ''))) {
        (payloadFields as any).due_date = null;
      }
      if ('workflow_id' in payloadFields && (!payloadFields.workflow_id || !this.syncService.isValidUuid(payloadFields.workflow_id))) {
        (payloadFields as any).workflow_id = null;
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
    const localList = this.taskStatusHistory()[taskId] || [];

    if (this.syncService.isOnline()) {
      try {
        const { data, error } = await this.supabaseService.supabase
          .from('task_status_history')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const remoteHistory = data as TaskStatusHistory[];
          const pendingQueue = this.syncService.pendingSyncQueue();
          const pendingOps = pendingQueue.filter(op => op.type === 'ADD_STATUS_HISTORY' && op.payload.task_id === taskId);
          const pendingIds = new Set(pendingOps.map(op => op.payload.id).filter(Boolean));

          const mergedMap = new Map<string, TaskStatusHistory>();
          remoteHistory.forEach(h => mergedMap.set(h.id, h));
          localList.forEach(h => {
            if (pendingIds.has(h.id) || !mergedMap.has(h.id)) {
              mergedMap.set(h.id, h);
            }
          });

          const finalHistory = Array.from(mergedMap.values())
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          this.taskStatusHistory.update(map => ({
            ...map,
            [taskId]: finalHistory
          }));
          this.saveToStorage();
          return finalHistory;
        }
      } catch (e) {
        // fallback
      }
    }

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

    // 1) Filter out task from tasks list
    this.tasks.update(list => list.filter(t => t.id !== id));

    // 2) Delete task comments from memory map
    this.taskComments.update(map => {
      if (!(id in map)) return map;
      const updated = { ...map };
      delete updated[id];
      return updated;
    });

    // 3) Delete status history from memory map
    this.taskStatusHistory.update(map => {
      if (!(id in map)) return map;
      const updated = { ...map };
      delete updated[id];
      return updated;
    });

    this.saveToStorage();
    this.syncService.enqueue('DELETE_TASK', { id });
  }

  async batchDeleteTasks(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;

    const idSet = new Set(ids);
    const existingTasks = this.tasks().filter(t => idSet.has(t.id));
    if (existingTasks.length === 0) return;

    // Log batch activity
    const firstProjId = existingTasks[0].project_id;
    this.projectService.logActivity(
      firstProjId,
      'Batch Delete',
      `Permanently deleted ${existingTasks.length} task${existingTasks.length > 1 ? 's' : ''}`
    );

    // 1) Batch filter tasks
    this.tasks.update(list => list.filter(t => !idSet.has(t.id)));

    // 2) Batch filter task comments
    this.taskComments.update(map => {
      const updated = { ...map };
      let changed = false;
      idSet.forEach(id => {
        if (id in updated) {
          delete updated[id];
          changed = true;
        }
      });
      return changed ? updated : map;
    });

    // 3) Batch filter status history
    this.taskStatusHistory.update(map => {
      const updated = { ...map };
      let changed = false;
      idSet.forEach(id => {
        if (id in updated) {
          delete updated[id];
          changed = true;
        }
      });
      return changed ? updated : map;
    });

    // 4) Single localStorage serialization for the entire batch
    this.saveToStorage();

    // 5) Queue sync delete operations
    idSet.forEach(id => {
      this.syncService.enqueue('DELETE_TASK', { id });
    });
  }

  deleteTasksForProject(projectId: string) {
    if (!projectId) return;

    const projectTaskIds = new Set(
      this.tasks().filter(t => t.project_id === projectId).map(t => t.id)
    );

    // Filter tasks
    this.tasks.update(list => list.filter(t => t.project_id !== projectId));

    // Filter task comments & status history
    this.taskComments.update(map => {
      const updated = { ...map };
      projectTaskIds.forEach(tid => delete updated[tid]);
      return updated;
    });

    this.taskStatusHistory.update(map => {
      const updated = { ...map };
      projectTaskIds.forEach(tid => delete updated[tid]);
      return updated;
    });

    this.saveToStorage();
  }

  // --- Task Comments / Notes ---

  async loadCommentsForTask(taskId: string): Promise<TaskComment[]> {
    const localComments = this.taskComments()[taskId] || [];

    if (this.syncService.isOnline()) {
      try {
        const { data, error } = await this.supabaseService.supabase
          .from('task_comments')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          const remoteComments = data as TaskComment[];
          const pendingQueue = this.syncService.pendingSyncQueue();

          const pendingOps = pendingQueue.filter(op =>
            (op.type === 'ADD_COMMENT' || op.type === 'UPDATE_COMMENT' || op.type === 'DELETE_COMMENT') &&
            (op.payload.task_id === taskId || op.payload.id)
          );
          const pendingCommentIds = new Set(pendingOps.map(op => op.payload.id).filter(Boolean));
          const deletedCommentIds = new Set(pendingQueue.filter(op => op.type === 'DELETE_COMMENT').map(op => op.payload.id).filter(Boolean));

          const mergedMap = new Map<string, TaskComment>();
          remoteComments.forEach(c => mergedMap.set(c.id, c));
          localComments.forEach(c => {
            if (pendingCommentIds.has(c.id) || !mergedMap.has(c.id)) {
              mergedMap.set(c.id, c);
            }
          });

          const finalComments = Array.from(mergedMap.values())
            .filter(c => !deletedCommentIds.has(c.id))
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          this.taskComments.update(map => ({
            ...map,
            [taskId]: finalComments
          }));
          this.saveToStorage();
          return finalComments;
        }
      } catch (e) {
        console.warn('Could not load comments from Supabase', e);
      }
    }

    return localComments;
  }

  async addComment(taskId: string, content: string, authorName: string = 'User', attachments: string[] = []): Promise<TaskComment> {
    const currentUser = this.authService.user();
    const displayName = authorName !== 'User' && authorName !== 'Self' ? authorName : (
      currentUser?.user_metadata?.['display_name'] ||
      currentUser?.user_metadata?.['full_name'] ||
      (currentUser?.email ? currentUser.email.split('@')[0] : 'User')
    );

    const newComm: TaskComment = {
      id: crypto.randomUUID(),
      task_id: taskId,
      user_id: currentUser?.id,
      author_name: displayName,
      content,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      created_at: new Date().toISOString()
    };

    const task = this.tasks().find(t => t.id === taskId);
    if (task) {
      this.projectService.logActivity(task.project_id, 'Comment Added', `Added comment on "${task.title}"`);
      this.recordStatusHistory({
        id: crypto.randomUUID(),
        task_id: taskId,
        from_status: task.status,
        to_status: task.status,
        action_type: 'comment',
        details: attachments && attachments.length > 0
          ? `Added a comment with ${attachments.length} image attachment(s)`
          : `Added a comment`,
        changed_by: displayName,
        created_at: newComm.created_at
      });
    }

    // Update signal state immediately
    this.taskComments.update(map => ({
      ...map,
      [taskId]: [...(map[taskId] || []), newComm]
    }));
    this.saveToStorage();

    this.syncService.enqueue('ADD_COMMENT', newComm);

    // Immediate direct Supabase upsert if online
    if (this.syncService.isOnline()) {
      const payload: any = { ...newComm };
      if (currentUser?.id && !payload.user_id) {
        payload.user_id = currentUser.id;
      }
      this.supabaseService.supabase
        .from('task_comments')
        .upsert([payload])
        .then(({ error }) => {
          if (error) {
            console.warn('[TaskService] Direct comment insert failed:', error.message);
          }
        });
    }

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
