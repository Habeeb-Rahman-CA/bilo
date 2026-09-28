import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectService } from './project.service';
import { signal } from '@angular/core';

describe('ProjectService Workspace Naming', () => {
  let projectService: ProjectService;
  let mockSupabaseService: any;
  let mockSyncService: any;
  let mockAuthService: any;

  beforeEach(() => {
    localStorage.clear();
    mockSupabaseService = {
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            })
          })
        })
      }
    };

    mockSyncService = {
      isOnline: () => false,
      onConnectionRestored: (cb: any) => {},
      enqueue: () => {}
    };

    mockAuthService = {
      user: signal({ id: 'user-123', email: 'habeebu@example.com' }),
      userName: signal('Habeebu'),
      userEmail: signal('habeebu@example.com')
    };

    const mockTaskService = {
      deletedProjectId: null as string | null,
      deleteTasksForProject(id: string) {
        this.deletedProjectId = id;
      }
    };

    const mockWorkflowService = {
      deletedProjectId: null as string | null,
      deleteWorkflowsForProject(id: string) {
        this.deletedProjectId = id;
      }
    };

    const mockInjector = {
      get: (token: any) => {
        if (token.name === 'TaskService' || token?.constructor?.name === 'TaskService') return mockTaskService;
        if (token.name === 'WorkflowService' || token?.constructor?.name === 'WorkflowService') return mockWorkflowService;
        return mockTaskService;
      }
    };

    projectService = new ProjectService(
      mockSupabaseService as any,
      mockSyncService as any,
      mockAuthService as any,
      mockInjector as any
    );
  });

  it('should generate default workspace name using user name (e.g. "Habeebu\'s Workspace")', () => {
    const defaultName = projectService.getDefaultWorkspaceName();
    expect(defaultName).toBe("Habeebu's Workspace");
  });

  it('should generate valid slug from workspace name', () => {
    const slug = projectService.generateSlug("Habeebu's Workspace");
    expect(slug).toBe("habeebus-workspace");
  });

  it('should fallback to email name if user name is not provided or default "User"', () => {
    mockAuthService.userName.set('User');
    mockAuthService.userEmail.set('john@example.com');
    const defaultName = projectService.getDefaultWorkspaceName();
    expect(defaultName).toBe("John's Workspace");
  });

  it('should reject invalid file inputs in uploadProjectImage', async () => {
    const textFile = new File(['hello'], 'doc.txt', { type: 'text/plain' });
    const result = await projectService.uploadProjectImage(textFile);
    expect(result).toBe('');
  });

  it('should auto-disambiguate duplicate project names and slugs for the same user', async () => {
    await projectService.createProject({ name: 'Alpha Engine' });
    expect(projectService.projects()[0].name).toBe('Alpha Engine');
    expect(projectService.projects()[0].slug).toBe('alpha-engine');

    // Create project with identical name under same user
    const secondProj = await projectService.createProject({ name: 'Alpha Engine' });
    expect(secondProj.name).toBe('Alpha Engine (2)');
    expect(secondProj.slug).toBe('alpha-engine-2');
  });

  it('should allow different users to create projects with the same workspace name', async () => {
    // User 1 creates 'Beta Service'
    const projUser1 = await projectService.createProject({ name: 'Beta Service' });
    expect(projUser1.name).toBe('Beta Service');
    expect(projUser1.slug).toBe('beta-service');

    // Switch active session to User 2
    mockAuthService.user.set({ id: 'user-456', email: 'user2@example.com' });
    projectService.projects.set([]); // User 2 workspace scope

    // User 2 creates 'Beta Service' without any suffix collision
    const projUser2 = await projectService.createProject({ name: 'Beta Service' });
    expect(projUser2.name).toBe('Beta Service');
    expect(projUser2.slug).toBe('beta-service');
  });

  it('should cascade delete tasks, workflows, and activities when deleteProject is invoked', async () => {
    const initialCount = projectService.projects().length;
    const proj = await projectService.createProject({ name: 'Project To Delete' });
    expect(projectService.projects().length).toBe(initialCount + 1);

    await projectService.deleteProject(proj.id);
    expect(projectService.projects().length).toBe(initialCount);
  });

  it('should generate a cryptographically signed invite link', async () => {
    const link = await projectService.generateInviteLink('proj-999', 'admin');
    expect(link).toContain('token=');
  });

  it('should prevent adding duplicate project members in addProjectMember and joinProjectViaInvite', async () => {
    mockSyncService.isOnline = () => true;
    let upsertCount = 0;
    mockSupabaseService.supabase.from = () => ({
      select: () => ({
        eq: () => Promise.resolve({
          data: [{ id: 'm-1', project_id: 'p-100', user_id: 'user-123', role: 'member' }],
          error: null
        })
      }),
      upsert: () => {
        upsertCount++;
        return Promise.resolve({ error: null });
      }
    });

    const result = await projectService.addProjectMember('p-100', 'user-123', 'member');
    expect(result).toBe(true);
    expect(upsertCount).toBe(0);
  });

  it('should return fallback member options and log error feedback when Supabase fails', async () => {
    mockSyncService.isOnline = () => true;
    mockSupabaseService.supabase.from = () => ({
      select: () => ({
        eq: () => Promise.resolve({
          data: null,
          error: { message: 'Supabase table connection failure' }
        })
      })
    });

    const options = await projectService.getWorkspaceMemberOptions('proj-err', 'John Doe');
    expect(options.length).toBeGreaterThan(0);
    expect(options.some(o => o.value === 'Unassigned')).toBe(true);
    expect(options.some(o => o.value === 'John Doe')).toBe(true);
  });

  it('should retain active project or fallback cleanly when setActiveProject is called with non-existent ID', async () => {
    const proj = await projectService.createProject({ name: 'Valid Project' });
    expect(projectService.activeProject()?.id).toBe(proj.id);

    // Call setActiveProject with invalid/unknown ID
    const result = projectService.setActiveProject('non-existent-id-999');
    expect(result).toBe(false);
    expect(projectService.activeProject()).not.toBeNull();
    expect(projectService.activeProject()).not.toBeUndefined();
    expect(projectService.activeProject()?.id).toBe(proj.id);
  });

  it('should sanitize HTML and script tags in logActivity to prevent XSS in activity feed', () => {
    projectService.logActivity(
      'proj-1',
      '<script>alert("XSS Action")</script>Task Created',
      'Created task "<img src=x onerror=alert(1)>Fix Login Bug" <iframe src="evil.com"></iframe>'
    );

    const latest = projectService.activities()[0];
    expect(latest).toBeDefined();
    expect(latest.action).not.toContain('<script>');
    expect(latest.action).toBe('Task Created');
    expect(latest.description).not.toContain('<img');
    expect(latest.description).not.toContain('<iframe');
    expect(latest.description).toBe('Created task "Fix Login Bug"');
  });

  it('should invalidate invite links when revokeInviteLinks is called', async () => {
    const link = await projectService.generateInviteLink('proj-revoke-1', 'member');
    expect(link).toContain('token=');

    const isRevokedBefore = projectService.isInviteLinkRevoked('proj-revoke-1', Date.now());
    expect(isRevokedBefore).toBe(false);

    projectService.revokeInviteLinks('proj-revoke-1');

    const isRevokedAfter = projectService.isInviteLinkRevoked('proj-revoke-1', Date.now() - 5000);
    expect(isRevokedAfter).toBe(true);
  });

  it('should block former collaborators from rejoining via old invite links', async () => {
    projectService.projects.set([
      { id: 'proj-collab-1', name: 'Collab Workspace', user_id: 'owner-999', slug: 'collab', status: 'active', color: '#06b6d4', labels: [], created_at: '', updated_at: '' }
    ]);

    // Simulate collaborator was removed from project
    localStorage.setItem('bilo_removed_members_proj-collab-1', JSON.stringify(['user-123', 'habeebu@example.com']));

    const joinResult = await projectService.joinProjectViaInvite('proj-collab-1', 'member');
    expect(joinResult.success).toBe(false);
    expect(joinResult.error).toContain('Former collaborators who were removed');
  });

  it('should return clear feedback when adding invalid email format or unregistered user', async () => {
    mockSyncService.isOnline = () => true;
    mockSupabaseService.isConfigured = true;
    mockSupabaseService.supabase.from = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null })
        })
      })
    });

    // Test invalid email format
    const invalidRes = await projectService.addProjectMemberDetailed('p-1', 'not-a-valid-email@');
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error).toContain('not a valid email address format');

    // Test unregistered user email
    const unregisteredRes = await projectService.addProjectMemberDetailed('p-1', 'unregistered@domain.com');
    expect(unregisteredRes.success).toBe(false);
    expect(unregisteredRes.code).toBe('USER_NOT_FOUND');
    expect(unregisteredRes.error).toContain('No registered account found for "unregistered@domain.com"');
  });

  it('should reject joinProjectViaInvite when token signature is tampered or project ID mismatches', async () => {
    projectService.projects.set([
      { id: 'proj-sec-1', name: 'Secure Project', user_id: 'user-1', slug: 'sec', status: 'active', color: '#06b6d4', labels: [], created_at: '', updated_at: '' }
    ]);

    const tamperedToken = 'invalid_base64_token_tampered';
    const tamperedResult = await projectService.joinProjectViaInvite('proj-sec-1', 'admin', undefined, tamperedToken);
    expect(tamperedResult.success).toBe(false);
    expect(tamperedResult.error).toContain('Security rejection');
  });

  it('should accept joinProjectViaInvite when token is valid and cryptographically signed', async () => {
    const validToken = await projectService.generateInviteLink('proj-valid-1', 'admin');
    const tokenStr = new URL(validToken).searchParams.get('token');

    projectService.projects.set([
      { id: 'proj-valid-1', name: 'Valid Project', user_id: 'owner-1', slug: 'val', status: 'active', color: '#06b6d4', labels: [], created_at: '', updated_at: '' }
    ]);

    const joinResult = await projectService.joinProjectViaInvite('proj-valid-1', 'admin', undefined, tokenStr || undefined);
    expect(joinResult.success).toBe(true);
  });
});
