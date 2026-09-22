import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowService, DEFAULT_GLOBAL_WORKFLOWS, createDefaultWorkflowsForProject } from './workflow.service';
import { SupabaseService } from './supabase.service';

describe('WorkflowService', () => {
  let mockSupabaseService: any;
  let service: WorkflowService;

  beforeEach(() => {
    localStorage.clear();
    mockSupabaseService = {
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null })
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null })
          }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      }
    };
    service = new WorkflowService(mockSupabaseService as SupabaseService);
  });

  it('should export DEFAULT_GLOBAL_WORKFLOWS with 5 standard stages', () => {
    expect(DEFAULT_GLOBAL_WORKFLOWS.length).toBe(5);
    expect(DEFAULT_GLOBAL_WORKFLOWS.map(w => w.name)).toEqual([
      'Backlog', 'To Do', 'In Progress', 'In Review', 'Done'
    ]);
  });

  it('should generate default workflows for a given project ID', () => {
    const workflows = createDefaultWorkflowsForProject('proj-abc');
    expect(workflows.length).toBe(5);
    expect(workflows[0].project_id).toBe('proj-abc');
    expect(workflows[0].id).toBe('wf-backlog-proj-abc');
  });

  it('should get default workflows for project when no custom workflows exist', () => {
    const workflows = service.getWorkflowsForProject('proj-xyz');
    expect(workflows.length).toBe(5);
    expect(workflows[0].project_id).toBe('proj-xyz');
  });

  it('should create a new workflow for a project', async () => {
    const created = await service.createWorkflow('proj-1', 'QA Testing', '#ff0000');

    expect(created.name).toBe('QA Testing');
    expect(created.color).toBe('#ff0000');
    expect(created.project_id).toBe('proj-1');

    const list = service.getWorkflowsForProject('proj-1');
    expect(list.some(w => w.id === created.id)).toBe(true);
  });

  it('should update an existing workflow', async () => {
    const created = await service.createWorkflow('proj-1', 'Code Review');
    const updated = await service.updateWorkflow(created.id, { name: 'Peer Review', color: '#00ff00' }, 'proj-1');

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Peer Review');
    expect(updated?.color).toBe('#00ff00');
  });

  it('should delete a workflow', async () => {
    const created = await service.createWorkflow('proj-1', 'Temp Stage');
    expect(service.getWorkflowsForProject('proj-1').length).toBe(6);

    await service.deleteWorkflow(created.id, 'proj-1');
    expect(service.getWorkflowsForProject('proj-1').length).toBe(5);
  });

  it('should allow transition by default when allow_all_transitions is true or undefined', () => {
    expect(service.canTransition('To Do', 'Done', 'proj-1')).toBe(true);
    expect(service.canTransition('wf-todo', 'wf-done', 'proj-1')).toBe(true);
  });

  it('should enforce sequential pipeline when resetToSequentialPipeline is called', async () => {
    await service.resetToSequentialPipeline('proj-seq');
    const workflows = service.getWorkflowsForProject('proj-seq');

    expect(workflows[0].allow_all_transitions).toBe(true);
    expect(workflows[1].allow_all_transitions).toBe(false);
    expect(workflows[1].allowed_transitions).toEqual([workflows[0].id]);

    // Stage 1 (To Do) allows transition from Stage 0 (Backlog)
    expect(service.canTransition(workflows[0].id, workflows[1].id, 'proj-seq')).toBe(true);

    // Stage 1 (To Do) forbids jump directly from Stage 3 (In Review)
    expect(service.canTransition(workflows[3].id, workflows[1].id, 'proj-seq')).toBe(false);
  });

  it('should allow all transitions when allowAllTransitionsForProject is called', async () => {
    await service.resetToSequentialPipeline('proj-seq');
    await service.allowAllTransitionsForProject('proj-seq');

    const workflows = service.getWorkflowsForProject('proj-seq');
    expect(workflows.every(w => w.allow_all_transitions === true)).toBe(true);
  });
});
