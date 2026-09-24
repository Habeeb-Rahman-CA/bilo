import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectService } from './project.service';
import { signal } from '@angular/core';

describe('ProjectService Workspace Naming', () => {
  let projectService: ProjectService;
  let mockSupabaseService: any;
  let mockSyncService: any;
  let mockAuthService: any;

  beforeEach(() => {
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

    projectService = new ProjectService(
      mockSupabaseService as any,
      mockSyncService as any,
      mockAuthService as any
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
});
