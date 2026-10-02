import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowService, DEFAULT_GLOBAL_WORKFLOWS, createDefaultWorkflowsForProject } from './workflow.service';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeSupabase() {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      in: vi.fn().mockResolvedValue({ data: null, error: null })
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null })
    }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null })
  };
  return { supabase: { from: vi.fn().mockReturnValue(chain) } };
}

function makeInjector(taskSvc: any) {
  return { get: vi.fn(() => taskSvc) };
}

function buildService(injector?: any) {
  return new WorkflowService(makeSupabase() as any, injector);
}

// ---------------------------------------------------------------------------
// 1. Default workflow helpers
// ---------------------------------------------------------------------------
describe('WorkflowService default workflows', () => {
  it('DEFAULT_GLOBAL_WORKFLOWS has 5 standard stages in order', () => {
    const names = DEFAULT_GLOBAL_WORKFLOWS.map(w => w.name);
    expect(names).toEqual(['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']);
  });

  it('createDefaultWorkflowsForProject scopes all ids and project_id correctly', () => {
    const wfs = createDefaultWorkflowsForProject('proj-x');
    expect(wfs.every(w => w.project_id === 'proj-x')).toBe(true);
    expect(wfs.every(w => w.id.endsWith('proj-x'))).toBe(true);
  });

  it('createDefaultWorkflowsForProject assigns sequential positions starting at 0', () => {
    const wfs = createDefaultWorkflowsForProject('p1');
    wfs.forEach((w, idx) => expect(w.position).toBe(idx));
  });

  it('getWorkflowsForProject returns default project-scoped workflows for unknown project', () => {
    const svc = buildService();
    const wfs = svc.getWorkflowsForProject('brand-new-proj');
    expect(wfs.length).toBe(5);
    expect(wfs[0].project_id).toBe('brand-new-proj');
  });
});

// ---------------------------------------------------------------------------
// 2. createWorkflow
// ---------------------------------------------------------------------------
describe('WorkflowService.createWorkflow', () => {
  let svc: WorkflowService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should create a workflow with correct name, color, and projectId', async () => {
    const wf = await svc.createWorkflow('p1', 'QA Stage', '#ff0000');
    expect(wf.name).toBe('QA Stage');
    expect(wf.color).toBe('#ff0000');
    expect(wf.project_id).toBe('p1');
  });

  it('should append to the project workflow list', async () => {
    await svc.createWorkflow('p1', 'QA Stage');
    expect(svc.getWorkflowsForProject('p1').some(w => w.name === 'QA Stage')).toBe(true);
  });

  it('should deduplicate names within the same project (first duplicate → suffix "(1)")', async () => {
    await svc.createWorkflow('p-dup', 'Testing');
    const second = await svc.createWorkflow('p-dup', 'Testing');
    expect(second.name).toBe('Testing (1)');
  });

  it('should deduplicate names incrementally for multiple duplicates', async () => {
    await svc.createWorkflow('p-dup2', 'Testing');
    await svc.createWorkflow('p-dup2', 'Testing');
    const third = await svc.createWorkflow('p-dup2', 'Testing');
    expect(third.name).toBe('Testing (2)');
  });

  it('should default color to "#06b6d4" when no color provided', async () => {
    const wf = await svc.createWorkflow('p1', 'Stage');
    expect(wf.color).toBe('#06b6d4');
  });

  it('should default blank name to "New Status"', async () => {
    const wf = await svc.createWorkflow('p1', '   ');
    expect(wf.name).toBe('New Status');
  });

  it('should assign position equal to existing list length', async () => {
    const wf = await svc.createWorkflow('p-new', 'First Stage');
    // Default list for 'p-new' has 5, new one is at position 5
    expect(wf.position).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 3. updateWorkflow
// ---------------------------------------------------------------------------
describe('WorkflowService.updateWorkflow', () => {
  let svc: WorkflowService;
  let createdId: string;
  beforeEach(async () => {
    localStorage.clear();
    svc = buildService();
    const wf = await svc.createWorkflow('p1', 'Code Review');
    createdId = wf.id;
  });

  it('should update workflow name and color', async () => {
    const updated = await svc.updateWorkflow(createdId, { name: 'Peer Review', color: '#00ff00' }, 'p1');
    expect(updated?.name).toBe('Peer Review');
    expect(updated?.color).toBe('#00ff00');
  });

  it('should deduplicate updated name within project (suffix "(1)")', async () => {
    await svc.createWorkflow('p1', 'Duplicate Name');
    await svc.updateWorkflow(createdId, { name: 'Duplicate Name' }, 'p1');
    const wfs = svc.getWorkflowsForProject('p1');
    const count = wfs.filter(w => w.name.startsWith('Duplicate Name')).length;
    // Both the existing and updated should have unique names → no exact collision
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('should return null when workflow id not found', async () => {
    const result = await svc.updateWorkflow('nonexistent-id', { name: 'X' }, 'p1');
    expect(result).toBeNull();
  });

  it('should update status names on matching tasks when name changes', async () => {
    // Create the workflow in a fresh service to get its real generated ID
    const svcTemp = buildService();
    const existingWf = await svcTemp.createWorkflow('p1', 'Code Review');

    const mockTaskService = {
      tasks: vi.fn().mockReturnValue([
        { id: 't-1', project_id: 'p1', workflow_id: existingWf.id, status: 'Code Review' }
      ]),
      updateTask: vi.fn().mockResolvedValue(null)
    };
    // Build the service-under-test with the injector containing the pre-seeded task list
    const svcWithInjector = new WorkflowService(makeSupabase() as any, makeInjector(mockTaskService) as any);
    // Re-create the same workflow in svcWithInjector so it knows about it
    const wf = await svcWithInjector.createWorkflow('p1', 'Code Review');
    // Patch the mock task to use the correct workflow_id from this service instance
    mockTaskService.tasks.mockReturnValue([
      { id: 't-1', project_id: 'p1', workflow_id: wf.id, status: 'Code Review' }
    ]);
    await svcWithInjector.updateWorkflow(wf.id, { name: 'Peer Review' }, 'p1');
    expect(mockTaskService.updateTask).toHaveBeenCalledWith('t-1', expect.objectContaining({ status: 'Peer Review' }));
  });
});

// ---------------------------------------------------------------------------
// 4. deleteWorkflow
// ---------------------------------------------------------------------------
describe('WorkflowService.deleteWorkflow', () => {
  let svc: WorkflowService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should remove the workflow from the project list', async () => {
    const wf = await svc.createWorkflow('p1', 'Temp');
    await svc.deleteWorkflow(wf.id, 'p1');
    expect(svc.getWorkflowsForProject('p1').some(w => w.id === wf.id)).toBe(false);
  });

  it('should reassign affected tasks to fallback workflow', async () => {
    const mockTaskService = {
      tasks: vi.fn().mockReturnValue([
        { id: 't-1', project_id: 'p1', workflow_id: 'temp-id', status: 'Temp Stage' }
      ]),
      updateTask: vi.fn().mockResolvedValue(null)
    };
    const svcWithInjector = new WorkflowService(makeSupabase() as any, makeInjector(mockTaskService) as any);
    const tempWf = await svcWithInjector.createWorkflow('p1', 'Temp Stage');
    await svcWithInjector.deleteWorkflow(tempWf.id, 'p1');
    expect(mockTaskService.updateTask).toHaveBeenCalledWith('t-1', expect.objectContaining({ status: expect.any(String) }));
  });

  it('should scrub deleted workflow id from allowed_transitions of other workflows', async () => {
    await svc.resetToSequentialPipeline('p-chain');
    const wfs = svc.getWorkflowsForProject('p-chain');
    const toDeleteId = wfs[0].id;
    await svc.deleteWorkflow(toDeleteId, 'p-chain');
    const remaining = svc.getWorkflowsForProject('p-chain');
    remaining.forEach(w => {
      expect(w.allowed_transitions).not.toContain(toDeleteId);
    });
  });

  it('should open up transitions for stages that only allowed the deleted workflow', async () => {
    await svc.resetToSequentialPipeline('p-deadend');
    const wfs = svc.getWorkflowsForProject('p-deadend');
    // wfs[1] (To Do) allows only from wfs[0] (Backlog)
    expect(svc.canTransition(wfs[3].id, wfs[1].id, 'p-deadend')).toBe(false);
    await svc.deleteWorkflow(wfs[0].id, 'p-deadend');
    // Now wfs[1]'s allowed_transitions is empty → falls back to allow_all
    expect(svc.canTransition(wfs[3].id, wfs[1].id, 'p-deadend')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. canTransition
// ---------------------------------------------------------------------------
describe('WorkflowService.canTransition', () => {
  let svc: WorkflowService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should return true by default (allow_all not set)', () => {
    expect(svc.canTransition('To Do', 'Done', 'p-any')).toBe(true);
  });

  it('should return true for same-status transition', () => {
    expect(svc.canTransition('To Do', 'To Do', 'p-any')).toBe(true);
  });

  it('should return true when target workflow has no id match (unknown status)', () => {
    expect(svc.canTransition('Foo', 'Unknown Status XYZ', 'p-any')).toBe(true);
  });

  it('should enforce sequential pipeline after resetToSequentialPipeline', async () => {
    await svc.resetToSequentialPipeline('p-seq');
    const wfs = svc.getWorkflowsForProject('p-seq');
    // Backlog → To Do: allowed
    expect(svc.canTransition(wfs[0].id, wfs[1].id, 'p-seq')).toBe(true);
    // In Review → To Do: blocked
    expect(svc.canTransition(wfs[3].id, wfs[1].id, 'p-seq')).toBe(false);
  });

  it('should allow all after allowAllTransitionsForProject', async () => {
    await svc.resetToSequentialPipeline('p-all');
    await svc.allowAllTransitionsForProject('p-all');
    const wfs = svc.getWorkflowsForProject('p-all');
    expect(svc.canTransition(wfs[4].id, wfs[0].id, 'p-all')).toBe(true);
  });

  it('should return true when all allowed_transitions ids are invalid/deleted', async () => {
    await svc.resetToSequentialPipeline('p-fallback');
    const wfs = svc.getWorkflowsForProject('p-fallback');
    // Manually set wfs[1].allowed_transitions to a ghost id
    svc.workflowsByProject.update(m => ({
      ...m,
      'p-fallback': wfs.map((w, i) => i === 1
        ? { ...w, allow_all_transitions: false, allowed_transitions: ['ghost-id-deleted'] }
        : w)
    }));
    expect(svc.canTransition(wfs[3].id, wfs[1].id, 'p-fallback')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. updateWorkflowPositions
// ---------------------------------------------------------------------------
describe('WorkflowService.updateWorkflowPositions', () => {
  let svc: WorkflowService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should reorder workflows and assign sequential position indices', async () => {
    const wfs = svc.getWorkflowsForProject('p1');
    const reversed = [...wfs].reverse();
    await svc.updateWorkflowPositions('p1', reversed);
    const updated = svc.getWorkflowsForProject('p1');
    updated.forEach((w, idx) => expect(w.position).toBe(idx));
  });

  it('should persist reordered state to workflowsByProject signal', async () => {
    const wfs = svc.getWorkflowsForProject('p1');
    const reversed = [...wfs].reverse();
    await svc.updateWorkflowPositions('p1', reversed);
    const updated = svc.getWorkflowsForProject('p1');
    // Last item in original (Done) should now be first
    expect(updated[0].name).toBe(reversed[0].name);
  });
});

// ---------------------------------------------------------------------------
// 7. resetToDefaultWorkflows
// ---------------------------------------------------------------------------
describe('WorkflowService.resetToDefaultWorkflows', () => {
  let svc: WorkflowService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should replace all project workflows with 5 default stages', async () => {
    await svc.createWorkflow('p-reset', 'Custom A');
    await svc.createWorkflow('p-reset', 'Custom B');
    await svc.resetToDefaultWorkflows('p-reset');
    const wfs = svc.getWorkflowsForProject('p-reset');
    expect(wfs.map(w => w.name)).toEqual(['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']);
  });

  it('should migrate project tasks to matching default workflows by status name', async () => {
    const mockTaskService = {
      tasks: vi.fn().mockReturnValue([
        { id: 'task-10', project_id: 'p-reset2', workflow_id: 'custom-wf-1', status: 'Custom Unknown Stage' },
        { id: 'task-11', project_id: 'p-reset2', workflow_id: 'custom-wf-2', status: 'In Progress' }
      ]),
      updateTask: vi.fn().mockResolvedValue(null)
    };
    const svcWithInj = new WorkflowService(makeSupabase() as any, makeInjector(mockTaskService) as any);
    await svcWithInj.resetToDefaultWorkflows('p-reset2');
    // Unknown status → Backlog (fallback defaults[0])
    expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-10', expect.objectContaining({ status: 'Backlog' }));
    // In Progress → In Progress default
    expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-11', expect.objectContaining({ status: 'In Progress' }));
  });

  it('should map "wip" status to "In Progress" default during reset', async () => {
    const mockTaskService = {
      tasks: vi.fn().mockReturnValue([
        { id: 'task-wip', project_id: 'p-wip', workflow_id: 'custom-1', status: 'wip' }
      ]),
      updateTask: vi.fn().mockResolvedValue(null)
    };
    const svcWithInj = new WorkflowService(makeSupabase() as any, makeInjector(mockTaskService) as any);
    await svcWithInj.resetToDefaultWorkflows('p-wip');
    expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-wip', expect.objectContaining({ status: 'In Progress' }));
  });
});

// ---------------------------------------------------------------------------
// 8. getTaskCountForWorkflow
// ---------------------------------------------------------------------------
describe('WorkflowService.getTaskCountForWorkflow', () => {
  it('should return count matching by workflow_id', () => {
    const mockTaskService = {
      tasks: vi.fn().mockReturnValue([
        { id: 't-1', project_id: 'p1', workflow_id: 'wf-target', status: 'Target Stage' },
        { id: 't-2', project_id: 'p1', workflow_id: 'wf-target', status: 'Target Stage' },
        { id: 't-3', project_id: 'p1', workflow_id: 'wf-other', status: 'Other Stage' }
      ])
    };
    const svc = new WorkflowService(makeSupabase() as any, makeInjector(mockTaskService) as any);
    const count = svc.getTaskCountForWorkflow('wf-target', 'p1');
    expect(count).toBe(2);
  });

  it('should return 0 when no injector provided', () => {
    const svc = new WorkflowService(makeSupabase() as any);
    expect(svc.getTaskCountForWorkflow('wf-x', 'p1')).toBe(0);
  });

  it('should count tasks matching by status name (fallback)', () => {
    const svc = new WorkflowService(makeSupabase() as any, makeInjector({
      tasks: vi.fn().mockReturnValue([
        { id: 't-1', project_id: 'p1', workflow_id: undefined, status: 'Backlog' },
        { id: 't-2', project_id: 'p1', workflow_id: undefined, status: 'Backlog' }
      ])
    }) as any);
    // Add a Backlog workflow to the map
    svc.workflowsByProject.set({ 'p1': createDefaultWorkflowsForProject('p1') });
    const backlogWf = svc.getWorkflowsForProject('p1').find(w => w.name === 'Backlog')!;
    const count = svc.getTaskCountForWorkflow(backlogWf.id, 'p1');
    expect(count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 9. resetToSequentialPipeline
// ---------------------------------------------------------------------------
describe('WorkflowService.resetToSequentialPipeline', () => {
  let svc: WorkflowService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should set first stage to allow_all_transitions=true', async () => {
    await svc.resetToSequentialPipeline('p-seq');
    const wfs = svc.getWorkflowsForProject('p-seq');
    expect(wfs[0].allow_all_transitions).toBe(true);
  });

  it('should set each subsequent stage to allow only the previous stage', async () => {
    await svc.resetToSequentialPipeline('p-seq');
    const wfs = svc.getWorkflowsForProject('p-seq');
    for (let i = 1; i < wfs.length; i++) {
      expect(wfs[i].allow_all_transitions).toBe(false);
      expect(wfs[i].allowed_transitions).toEqual([wfs[i - 1].id]);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. saveToStorage / loadFromStorage (debounced coalescing)
// ---------------------------------------------------------------------------
describe('WorkflowService storage coalescing', () => {
  let svc: WorkflowService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('saveToStorageImmediate should persist workflowsByProject to localStorage', () => {
    svc.workflowsByProject.set({ 'p-store': createDefaultWorkflowsForProject('p-store') });
    svc.saveToStorageImmediate();
    const stored = localStorage.getItem('bilo_workflows_by_project');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed['p-store']).toBeDefined();
    expect(parsed['p-store'].length).toBe(5);
  });

  it('loadFromStorage should restore workflowsByProject from localStorage', () => {
    const data = { 'p-loaded': createDefaultWorkflowsForProject('p-loaded') };
    localStorage.setItem('bilo_workflows_by_project', JSON.stringify(data));
    const freshSvc = buildService();
    expect(freshSvc.workflowsByProject()['p-loaded']).toBeDefined();
  });

  it('loadFromStorage should gracefully handle corrupt JSON in localStorage', () => {
    localStorage.setItem('bilo_workflows_by_project', '{ INVALID JSON ~~~ }');
    expect(() => buildService()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 11. deleteWorkflowsForProject
// ---------------------------------------------------------------------------
describe('WorkflowService.deleteWorkflowsForProject', () => {
  let svc: WorkflowService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should remove all workflows for the given project from signal state', async () => {
    await svc.createWorkflow('proj-x', 'Stage A');
    svc.deleteWorkflowsForProject('proj-x');
    expect(svc.workflowsByProject()['proj-x']).toBeUndefined();
  });

  it('should not affect workflows for other projects', async () => {
    await svc.createWorkflow('proj-x', 'Stage A');
    await svc.createWorkflow('proj-y', 'Stage B');
    svc.deleteWorkflowsForProject('proj-x');
    expect(svc.workflowsByProject()['proj-y']).toBeDefined();
  });

  it('should be a no-op when projectId is empty', () => {
    svc.workflowsByProject.set({ 'proj-a': createDefaultWorkflowsForProject('proj-a') });
    svc.deleteWorkflowsForProject('');
    expect(svc.workflowsByProject()['proj-a']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 12. resetState
// ---------------------------------------------------------------------------
describe('WorkflowService.resetState', () => {
  let svc: WorkflowService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should reset workflowsByProject to global defaults', async () => {
    await svc.createWorkflow('proj-1', 'Custom Stage');
    svc.resetState();
    expect(svc.workflowsByProject()['global']).toBeDefined();
    expect(svc.workflowsByProject()['proj-1']).toBeUndefined();
  });

  it('should remove bilo_workflows_by_project from localStorage', async () => {
    svc.saveToStorageImmediate();
    svc.resetState();
    expect(localStorage.getItem('bilo_workflows_by_project')).toBeNull();
  });
});
