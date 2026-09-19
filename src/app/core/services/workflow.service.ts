import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Workflow } from '../models/project.model';

export const DEFAULT_GLOBAL_WORKFLOWS: Workflow[] = [
  { id: 'wf-backlog', project_id: 'global', name: 'Backlog', color: '#64748b', position: 0, created_at: '' },
  { id: 'wf-todo', project_id: 'global', name: 'To Do', color: '#3b82f6', position: 1, created_at: '' },
  { id: 'wf-in-progress', project_id: 'global', name: 'In Progress', color: '#eab308', position: 2, created_at: '' },
  { id: 'wf-in-review', project_id: 'global', name: 'In Review', color: '#a855f7', position: 3, created_at: '' },
  { id: 'wf-done', project_id: 'global', name: 'Done', color: '#22c55e', position: 4, created_at: '' }
];

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  globalWorkflows = signal<Workflow[]>(DEFAULT_GLOBAL_WORKFLOWS);
  workflows = this.globalWorkflows;
  loading = signal<boolean>(false);

  constructor(private supabaseService: SupabaseService) {
    this.loadFromStorage();
    this.loadAllWorkflows();
  }

  loadFromStorage() {
    const cached = localStorage.getItem('bilo_global_workflows');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (Array.isArray(data) && data.length > 0) {
          this.globalWorkflows.set(data);
          return;
        }
      } catch (e) {
        console.error('Failed to parse local workflows cache', e);
      }
    }
  }

  private saveToStorage() {
    localStorage.setItem('bilo_global_workflows', JSON.stringify(this.globalWorkflows()));
  }

  async loadAllWorkflows() {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('workflows')
        .select('*')
        .order('position', { ascending: true });

      if (!error && data && data.length > 0) {
        // Map unique workflow names for global config
        const seenNames = new Set<string>();
        const uniqueGlobal: Workflow[] = [];

        (data as Workflow[]).forEach(w => {
          if (!seenNames.has(w.name.toLowerCase())) {
            seenNames.add(w.name.toLowerCase());
            uniqueGlobal.push({
              ...w,
              project_id: 'global'
            });
          }
        });

        if (uniqueGlobal.length > 0) {
          this.globalWorkflows.set(uniqueGlobal);
          this.saveToStorage();
        }
      } else {
        // Seed default global workflows to Supabase if empty
        this.saveToStorage();
      }
    } catch (e) {
      console.warn('Could not load workflows from Supabase', e);
    } finally {
      this.loading.set(false);
    }
  }

  getWorkflowsForProject(_projectId?: string): Workflow[] {
    return this.globalWorkflows();
  }

  async createWorkflow(_projectId: string, name: string, color: string = '#06b6d4'): Promise<Workflow> {
    const current = this.globalWorkflows();
    const generatedId = crypto.randomUUID();

    const newWorkflow: Workflow = {
      id: generatedId,
      project_id: 'global',
      name: name.trim(),
      color: color || '#06b6d4',
      position: current.length,
      created_at: new Date().toISOString()
    };

    this.globalWorkflows.update(list => [...list, newWorkflow]);
    this.saveToStorage();

    try {
      await this.supabaseService.supabase
        .from('workflows')
        .insert([{
          id: newWorkflow.id,
          project_id: 'global',
          name: newWorkflow.name,
          color: newWorkflow.color,
          position: newWorkflow.position
        }]);
    } catch (e) {
      console.warn('Supabase workflow insert warning:', e);
    }

    return newWorkflow;
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow | null> {
    let updatedWf: Workflow | null = null;
    this.globalWorkflows.update(list => list.map(w => {
      if (w.id === id) {
        updatedWf = { ...w, ...updates };
        return updatedWf;
      }
      return w;
    }));

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

  async deleteWorkflow(id: string) {
    this.globalWorkflows.update(list => list.filter(w => w.id !== id));
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

  async updateWorkflowPositions(_projectId: string, orderedWorkflows: Workflow[]) {
    const updated = orderedWorkflows.map((w, idx) => ({
      ...w,
      project_id: 'global',
      position: idx
    }));

    this.globalWorkflows.set(updated);
    this.saveToStorage();

    for (const w of updated) {
      try {
        await this.supabaseService.supabase
          .from('workflows')
          .upsert({ id: w.id, project_id: 'global', position: w.position, name: w.name, color: w.color });
      } catch {}
    }
  }
}
