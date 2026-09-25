import { Injectable, signal, computed, Injector } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TaskService } from './task.service';
import { Workflow } from '../models/project.model';

export const DEFAULT_GLOBAL_WORKFLOWS: Workflow[] = [
  { id: 'wf-backlog', project_id: 'global', name: 'Backlog', color: '#64748b', position: 0, created_at: '' },
  { id: 'wf-todo', project_id: 'global', name: 'To Do', color: '#3b82f6', position: 1, created_at: '' },
  { id: 'wf-in-progress', project_id: 'global', name: 'In Progress', color: '#eab308', position: 2, created_at: '' },
  { id: 'wf-in-review', project_id: 'global', name: 'In Review', color: '#a855f7', position: 3, created_at: '' },
  { id: 'wf-done', project_id: 'global', name: 'Done', color: '#22c55e', position: 4, created_at: '' }
];

export function createDefaultWorkflowsForProject(projectId: string): Workflow[] {
  return [
    { id: `wf-backlog-${projectId}`, project_id: projectId, name: 'Backlog', color: '#64748b', position: 0, created_at: new Date().toISOString() },
    { id: `wf-todo-${projectId}`, project_id: projectId, name: 'To Do', color: '#3b82f6', position: 1, created_at: new Date().toISOString() },
    { id: `wf-in-progress-${projectId}`, project_id: projectId, name: 'In Progress', color: '#eab308', position: 2, created_at: new Date().toISOString() },
    { id: `wf-in-review-${projectId}`, project_id: projectId, name: 'In Review', color: '#a855f7', position: 3, created_at: new Date().toISOString() },
    { id: `wf-done-${projectId}`, project_id: projectId, name: 'Done', color: '#22c55e', position: 4, created_at: new Date().toISOString() }
  ];
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  workflowsByProject = signal<Record<string, Workflow[]>>({});
  loading = signal<boolean>(false);

  // Backward compatibility getter for globalWorkflows
  globalWorkflows = computed<Workflow[]>(() => {
    const all = this.workflowsByProject();
    const keys = Object.keys(all);
    if (keys.length > 0 && all[keys[0]] && all[keys[0]].length > 0) {
      return all[keys[0]];
    }
    return DEFAULT_GLOBAL_WORKFLOWS;
  });

  constructor(
    private supabaseService: SupabaseService,
    private injector?: Injector
  ) {
    this.loadFromStorage();
    this.loadAllWorkflows();
  }

  loadFromStorage() {
    const cached = localStorage.getItem('bilo_workflows_by_project');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (data && typeof data === 'object') {
          this.workflowsByProject.set(data);
          return;
        }
      } catch (e) {
        console.error('Failed to parse local workflows cache', e);
      }
    }
  }

  private saveToStorage() {
    localStorage.setItem('bilo_workflows_by_project', JSON.stringify(this.workflowsByProject()));
  }

  deleteWorkflowsForProject(projectId: string) {
    if (!projectId) return;
    this.workflowsByProject.update(map => {
      const updated = { ...map };
      delete updated[projectId];
      return updated;
    });
    this.saveToStorage();
  }

  async loadAllWorkflows() {
    if (!this.supabaseService.isConfigured) return;
    this.loading.set(true);
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('workflows')
        .select('*')
        .order('position', { ascending: true });

      if (!error && data && data.length > 0) {
        const grouped: Record<string, Workflow[]> = {};
        (data as Workflow[]).forEach(w => {
          const pid = w.project_id || 'global';
          if (!grouped[pid]) grouped[pid] = [];
          grouped[pid].push(w);
        });
        this.workflowsByProject.set(grouped);
        this.saveToStorage();
      }
    } catch (e) {
      console.warn('Could not load workflows from Supabase', e);
    } finally {
      this.loading.set(false);
    }
  }

  getWorkflowsForProject(projectId?: string): Workflow[] {
    const key = projectId || 'global';
    const current = this.workflowsByProject()[key];
    if (current && current.length > 0) {
      return current;
    }
    return createDefaultWorkflowsForProject(key);
  }

  async createWorkflow(projectId: string, name: string, color: string = '#06b6d4'): Promise<Workflow> {
    const key = projectId || 'global';
    const current = this.getWorkflowsForProject(key);
    const cleanName = (name || '').trim() || 'New Status';

    let finalName = cleanName;
    let counter = 1;
    while (current.some(w => w.name.trim().toLowerCase() === finalName.toLowerCase())) {
      finalName = `${cleanName} (${counter})`;
      counter++;
    }

    const generatedId = crypto.randomUUID();

    const newWorkflow: Workflow = {
      id: generatedId,
      project_id: key,
      name: finalName,
      color: color || '#06b6d4',
      position: current.length,
      created_at: new Date().toISOString()
    };

    const updatedList = [...current, newWorkflow];
    this.workflowsByProject.update(map => ({
      ...map,
      [key]: updatedList
    }));
    this.saveToStorage();

    try {
      await this.supabaseService.supabase
        .from('workflows')
        .insert([{
          id: newWorkflow.id,
          project_id: key,
          name: newWorkflow.name,
          color: newWorkflow.color,
          position: newWorkflow.position
        }]);
    } catch (e) {
      console.warn('Supabase workflow insert warning:', e);
    }

    return newWorkflow;
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>, projectId?: string): Promise<Workflow | null> {
    let updatedWf: Workflow | null = null;
    const targetProj = projectId || 'global';
    const currentWorkflows = this.getWorkflowsForProject(targetProj);

    const finalUpdates = { ...updates };
    if (updates.name !== undefined) {
      const cleanName = updates.name.trim() || 'Status';
      let finalName = cleanName;
      let counter = 1;
      while (currentWorkflows.some(w => w.id !== id && w.name.trim().toLowerCase() === finalName.toLowerCase())) {
        finalName = `${cleanName} (${counter})`;
        counter++;
      }
      finalUpdates.name = finalName;
    }

    this.workflowsByProject.update(map => {
      const result: Record<string, Workflow[]> = { ...map };
      for (const p in result) {
        if (!projectId || p === targetProj) {
          result[p] = result[p].map(w => {
            if (w.id === id) {
              updatedWf = { ...w, ...finalUpdates };
              return updatedWf;
            }
            return w;
          });
        }
      }
      return result;
    });

    if (updatedWf) {
      this.saveToStorage();
      if (updates.name && this.injector) {
        try {
          const taskService = this.injector.get(TaskService);
          const newName = updates.name.trim();
          const targetWfId = id;
          const matchingTasks = taskService.tasks().filter(
            t => t.workflow_id === targetWfId || (t.project_id === targetProj && t.status.toLowerCase() === (updatedWf?.name.toLowerCase() || ''))
          );
          for (const t of matchingTasks) {
            taskService.updateTask(t.id, { status: newName, workflow_id: targetWfId });
          }
        } catch (e) {}
      }
    }

    try {
      await this.supabaseService.supabase
        .from('workflows')
        .update(updates)
        .eq('id', id);
    } catch (e) {
      console.warn('Supabase workflow update warning:', e);
    }

    return updatedWf;
  }

  async deleteWorkflow(id: string, projectId?: string, fallbackWorkflowId?: string) {
    let targetProjectId = projectId;
    let deletedWf: Workflow | undefined;

    for (const [p, list] of Object.entries(this.workflowsByProject())) {
      const found = list.find(w => w.id === id);
      if (found) {
        deletedWf = found;
        if (!targetProjectId) targetProjectId = p;
        break;
      }
    }

    targetProjectId = targetProjectId || 'global';
    const currentList = this.workflowsByProject()[targetProjectId] || [];
    const remainingWorkflows = currentList.filter(w => w.id !== id);

    let fallbackWf: Workflow | undefined;
    if (fallbackWorkflowId) {
      fallbackWf = remainingWorkflows.find(w => w.id === fallbackWorkflowId || w.name === fallbackWorkflowId);
    }
    if (!fallbackWf && remainingWorkflows.length > 0) {
      fallbackWf = remainingWorkflows[0];
    }
    if (!fallbackWf) {
      const defaults = createDefaultWorkflowsForProject(targetProjectId);
      fallbackWf = defaults[0];
    }

    // 1) Reassign all affected tasks FIRST before removing column from signal state
    if (this.injector && fallbackWf) {
      try {
        const taskService = this.injector.get(TaskService);
        if (taskService) {
          const allTasks = taskService.tasks();
          const deletedWfNameLower = deletedWf?.name?.trim().toLowerCase();

          const affectedTasks = allTasks.filter(t => {
            const matchesWfId = t.workflow_id === id;
            const matchesStatusId = t.status === id;
            const matchesStatusName = !!(deletedWfNameLower && t.status?.trim().toLowerCase() === deletedWfNameLower);
            const matchesProject = targetProjectId === 'global' || !t.project_id || t.project_id === targetProjectId || !projectId;

            return (matchesWfId || matchesStatusId || matchesStatusName) && matchesProject;
          });

          for (const t of affectedTasks) {
            await taskService.updateTask(t.id, {
              workflow_id: fallbackWf.id,
              status: fallbackWf.name
            });
          }

          if (this.supabaseService.supabase && affectedTasks.length > 0) {
            const affectedIds = affectedTasks.map(t => t.id);
            await this.supabaseService.supabase
              .from('tasks')
              .update({
                workflow_id: fallbackWf.id,
                status: fallbackWf.name,
                updated_at: new Date().toISOString()
              })
              .in('id', affectedIds);
          }
        }
      } catch (e) {
        console.warn('Task migration during workflow deletion warning:', e);
      }
    }

    // 2) Remove column from signal state & local storage after task reassignment, and scrub deleted ID from allowed_transitions
    this.workflowsByProject.update(map => {
      const result: Record<string, Workflow[]> = { ...map };
      for (const p in result) {
        if (!projectId || p === targetProjectId) {
          const filtered = result[p].filter(w => w.id !== id);
          result[p] = filtered.map(w => {
            if (w.allowed_transitions && w.allowed_transitions.includes(id)) {
              const newAllowed = w.allowed_transitions.filter(targetId => targetId !== id);
              const newAllowAll = newAllowed.length === 0 ? true : (w.allow_all_transitions !== false);
              return {
                ...w,
                allowed_transitions: newAllowed,
                allow_all_transitions: newAllowAll
              };
            }
            return w;
          });
        }
      }
      return result;
    });
    this.saveToStorage();

    // 3) Remove workflow from database
    try {
      await this.supabaseService.supabase
        .from('workflows')
        .delete()
        .eq('id', id);
    } catch (e) {
      console.warn('Supabase workflow delete warning:', e);
    }
  }

  async updateWorkflowPositions(projectId: string, orderedWorkflows: Workflow[]) {
    const key = projectId || 'global';
    const updated = orderedWorkflows.map((w, idx) => ({
      ...w,
      project_id: key,
      position: idx
    }));

    this.workflowsByProject.update(map => ({
      ...map,
      [key]: updated
    }));
    this.saveToStorage();

    if (this.supabaseService.supabase && updated.length > 0) {
      try {
        const batchRecords = updated.map(w => ({
          id: w.id,
          project_id: key,
          position: w.position,
          name: w.name,
          color: w.color,
          allow_all_transitions: w.allow_all_transitions !== false,
          allowed_transitions: w.allowed_transitions || []
        }));

        await this.supabaseService.supabase
          .from('workflows')
          .upsert(batchRecords);
      } catch (e) {
        console.warn('Supabase workflow position update warning:', e);
      }
    }
  }

  async resetToDefaultWorkflows(projectId: string): Promise<Workflow[]> {
    const key = projectId || 'global';
    const oldWorkflows = this.getWorkflowsForProject(key);
    const defaults = createDefaultWorkflowsForProject(key);
    this.workflowsByProject.update(map => ({
      ...map,
      [key]: defaults
    }));
    this.saveToStorage();

    if (this.supabaseService.supabase) {
      try {
        const oldIds = oldWorkflows.map(w => w.id);
        if (oldIds.length > 0) {
          await this.supabaseService.supabase
            .from('workflows')
            .delete()
            .eq('project_id', key);
        }
        const batchDefaults = defaults.map(w => ({
          id: w.id,
          project_id: key,
          name: w.name,
          color: w.color,
          position: w.position
        }));

        await this.supabaseService.supabase
          .from('workflows')
          .upsert(batchDefaults);
      } catch (e) {
        console.warn('Supabase resetToDefaultWorkflows warning:', e);
      }
    }

    if (this.injector) {
      try {
        const taskService = this.injector.get(TaskService);
        if (taskService) {
          const allTasks = taskService.tasks();
          const projectTasks = allTasks.filter(t => key === 'global' || t.project_id === key);

          const findBestMatchingDefault = (t: any): Workflow => {
            if (t.workflow_id) {
              const exactWf = defaults.find(d => d.id === t.workflow_id);
              if (exactWf) return exactWf;
            }

            let statusName = (t.status || '').trim().toLowerCase();
            if (t.workflow_id) {
              const oldWf = oldWorkflows.find(w => w.id === t.workflow_id);
              if (oldWf) statusName = oldWf.name.trim().toLowerCase();
            }

            if (statusName) {
              const exactName = defaults.find(d => d.name.toLowerCase() === statusName);
              if (exactName) return exactName;

              if (statusName.includes('backlog')) return defaults.find(d => d.name === 'Backlog') || defaults[0];
              if (statusName.includes('todo') || statusName === 'to do' || statusName === 'open') return defaults.find(d => d.name === 'To Do') || defaults[1];
              if (statusName.includes('progress') || statusName.includes('doing') || statusName === 'wip') return defaults.find(d => d.name === 'In Progress') || defaults[2];
              if (statusName.includes('review') || statusName.includes('testing') || statusName.includes('qa')) return defaults.find(d => d.name === 'In Review') || defaults[3];
              if (statusName.includes('done') || statusName.includes('complete') || statusName.includes('closed')) return defaults.find(d => d.name === 'Done') || defaults[4];
            }

            return defaults[0];
          };

          for (const t of projectTasks) {
            const targetDefault = findBestMatchingDefault(t);
            await taskService.updateTask(t.id, {
              workflow_id: targetDefault.id,
              status: targetDefault.name
            });
          }
        }
      } catch (e) {
        console.warn('Task migration during resetToDefaultWorkflows warning:', e);
      }
    }

    return defaults;
  }

  // --- Workflow Transition Rules ---

  canTransition(fromStatusNameOrId: string, toStatusNameOrId: string, projectId?: string): boolean {
    if (!fromStatusNameOrId || !toStatusNameOrId) return true;
    if (fromStatusNameOrId.trim().toLowerCase() === toStatusNameOrId.trim().toLowerCase()) return true;

    const workflows = this.getWorkflowsForProject(projectId);
    const targetWf = workflows.find(
      w => w.id === toStatusNameOrId || w.name.trim().toLowerCase() === toStatusNameOrId.trim().toLowerCase()
    );

    if (!targetWf) return true; // If target status is unknown, allow by default
    if (targetWf.allow_all_transitions !== false) return true; // Allow all by default unless explicitly disabled

    const activeWfIds = new Set(workflows.map(w => w.id));
    const validAllowed = (targetWf.allowed_transitions || []).filter(id => activeWfIds.has(id));

    // If all configured allowed transitions were deleted or invalid, fall back to allowing transitions
    if (validAllowed.length === 0) return true;

    const fromWf = workflows.find(
      w => w.id === fromStatusNameOrId || w.name.trim().toLowerCase() === fromStatusNameOrId.trim().toLowerCase()
    );

    if (fromWf && validAllowed.includes(fromWf.id)) return true;
    if (validAllowed.includes(fromStatusNameOrId)) return true;

    return false;
  }

  async updateWorkflowTransitions(
    projectId: string,
    workflowId: string,
    allowAllTransitions: boolean,
    allowedTransitions: string[]
  ) {
    const key = projectId || 'global';
    this.workflowsByProject.update(map => {
      const current = map[key] || [];
      const updated = current.map(w => {
        if (w.id === workflowId) {
          return {
            ...w,
            allow_all_transitions: allowAllTransitions,
            allowed_transitions: allowedTransitions
          };
        }
        return w;
      });
      return { ...map, [key]: updated };
    });
    this.saveToStorage();

    try {
      await this.supabaseService.supabase
        .from('workflows')
        .update({
          allow_all_transitions: allowAllTransitions,
          allowed_transitions: allowedTransitions
        })
        .eq('id', workflowId);
    } catch (e) {
      console.warn('Supabase workflow transition update warning:', e);
    }
  }

  async resetToSequentialPipeline(projectId: string) {
    const key = projectId || 'global';
    const workflows = [...this.getWorkflowsForProject(key)];
    const updated = workflows.map((w, idx) => {
      if (idx === 0) {
        return { ...w, allow_all_transitions: true, allowed_transitions: [] };
      }
      const prevWf = workflows[idx - 1];
      return {
        ...w,
        allow_all_transitions: false,
        allowed_transitions: [prevWf.id]
      };
    });

    this.workflowsByProject.update(map => ({
      ...map,
      [key]: updated
    }));
    this.saveToStorage();

    for (const w of updated) {
      try {
        await this.supabaseService.supabase
          .from('workflows')
          .update({
            allow_all_transitions: w.allow_all_transitions,
            allowed_transitions: w.allowed_transitions
          })
          .eq('id', w.id);
      } catch (e) {
        console.warn('Supabase sequential pipeline update warning:', e);
      }
    }
  }

  async allowAllTransitionsForProject(projectId: string) {
    const key = projectId || 'global';
    const workflows = this.getWorkflowsForProject(key);
    const updated = workflows.map(w => ({
      ...w,
      allow_all_transitions: true,
      allowed_transitions: []
    }));

    this.workflowsByProject.update(map => ({
      ...map,
      [key]: updated
    }));
    this.saveToStorage();
  }

  resetState() {
    this.workflowsByProject.set({ global: [...DEFAULT_GLOBAL_WORKFLOWS] });
    this.loading.set(false);
  }
}

