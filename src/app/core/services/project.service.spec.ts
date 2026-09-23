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
      isOnline: () => false
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
});
