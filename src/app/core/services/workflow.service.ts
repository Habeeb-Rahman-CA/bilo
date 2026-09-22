import { Injectable, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
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

  constructor(private supabaseService: SupabaseService) {
    this.loadFromStorage();
    this.loadAllWorkflows();
    this.subscribeToRealtimeWorkflows();
  }

  private realtimeChannel: any = null;

  subscribeToRealtimeWorkflows() {
    if (this.realtimeChannel) return;
    try {
      this.realtimeChannel = this.supabaseService.supabase
        .channel('realtime:workflows')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'workflows' },
          (payload: any) => this.handleRealtimeWorkflowChange(payload)
        )
        .subscribe();
    } catch (e) {
      console.warn('[WorkflowService] Realtime subscription skipped in fallback mode', e);
    }
  }

  handleRealtimeWorkflowChange(payload: any) {
    if (!payload || !payload.eventType) return;

    const eventType = payload.eventType;
    const newRecord = payload.new as Workflow;
    const oldRecord = payload.old as Workflow;

    if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRecord && newRecord.id) {
      const pid = newRecord.project_id || 'global';
      this.workflowsByProject.update(map => {
        const current = map[pid] || [];
        const exists = current.some(w => w.id === newRecord.id);
        let updated: Workflow[];
        if (exists) {
          updated = current.map(w => (w.id === newRecord.id ? { ...w, ...newRecord } : w));
        } else {
          updated = [...current, newRecord];
        }
        return { ...map, [pid]: updated };
      });
    } else if (eventType === 'DELETE' && oldRecord && oldRecord.id) {
      const pid = oldRecord.project_id || 'global';
      this.workflowsByProject.update(map => {
        const current = map[pid] || [];
        return { ...map, [pid]: current.filter(w => w.id !== oldRecord.id) };
      });
    }
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

  async loadAllWorkflows() {
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
    const generatedId = crypto.randomUUID();

    const newWorkflow: Workflow = {
      id: generatedId,
      project_id: key,
      name: name.trim(),
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

    this.workflowsByProject.update(map => {
      const result: Record<string, Workflow[]> = { ...map };
      for (const p in result) {
        if (!projectId || p === targetProj) {
          result[p] = result[p].map(w => {
            if (w.id === id) {
              updatedWf = { ...w, ...updates };
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

  async deleteWorkflow(id: string, projectId?: string) {
    this.workflowsByProject.update(map => {
      const result: Record<string, Workflow[]> = { ...map };
      for (const p in result) {
        if (!projectId || p === projectId) {
          result[p] = result[p].filter(w => w.id !== id);
        }
      }
      return result;
    });
    this.saveToStorage();

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

    for (const w of updated) {
      try {
        await this.supabaseService.supabase
          .from('workflows')
          .upsert({ id: w.id, project_id: key, position: w.position, name: w.name, color: w.color });
      } catch (e) {
        console.warn('Supabase workflow position update warning:', e);
      }
    }
  }

  async resetToDefaultWorkflows(projectId: string): Promise<Workflow[]> {
    const key = projectId || 'global';
    const defaults = createDefaultWorkflowsForProject(key);
    this.workflowsByProject.update(map => ({
      ...map,
      [key]: defaults
    }));
    this.saveToStorage();
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

    const fromWf = workflows.find(
      w => w.id === fromStatusNameOrId || w.name.trim().toLowerCase() === fromStatusNameOrId.trim().toLowerCase()
    );

    const allowed = targetWf.allowed_transitions || [];
    if (fromWf && allowed.includes(fromWf.id)) return true;
    if (allowed.includes(fromStatusNameOrId)) return true;

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
}

