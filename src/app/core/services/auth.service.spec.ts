import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';
import { ProjectService } from './project.service';
import { TaskService } from './task.service';
import { WorkflowService } from './workflow.service';
import { SyncService } from './sync.service';

describe('AuthService initAuth resilience', () => {
  it('should set authLoading to false even if getSession throws an error', async () => {
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockRejectedValue(new Error('Network request failed')),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } })
        }
      }
    };

    const mockInjector: any = {
      get: vi.fn().mockReturnValue(null)
    };

    const authService = new AuthService(mockSupabaseService, mockInjector);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(authService.authLoading()).toBe(false);
  });

  it('should unsubscribe onAuthStateChange subscription on ngOnDestroy', async () => {
    const unsubscribeSpy = vi.fn();
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: unsubscribeSpy } } })
        }
      }
    };

    const mockInjector: any = {
      get: vi.fn().mockReturnValue(null)
    };

    const authService = new AuthService(mockSupabaseService, mockInjector);
    await new Promise(resolve => setTimeout(resolve, 50));

    authService.ngOnDestroy();
    expect(unsubscribeSpy).toHaveBeenCalled();
  });
});

describe('AuthService signUpWithEmailPassword validation', () => {
  it('should reject invalid email address format without calling Supabase', async () => {
    const signUpSpy = vi.fn();
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }),
          signUp: signUpSpy
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);

    const res = await authService.signUpWithEmailPassword('not-an-email', 'securePassword123');

    expect(signUpSpy).not.toHaveBeenCalled();
    expect(res.error).toBeDefined();
    expect(res.error?.message).toContain('Invalid email address format');
  });

  it('should reject passwords shorter than 6 characters without calling Supabase', async () => {
    const signUpSpy = vi.fn();
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }),
          signUp: signUpSpy
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);

    const res = await authService.signUpWithEmailPassword('user@example.com', '12345');

    expect(signUpSpy).not.toHaveBeenCalled();
    expect(res.error).toBeDefined();
    expect(res.error?.message).toContain('Password must be at least 6 characters long');
  });

  it('should proceed to Supabase signUp when email format and password length are valid', async () => {
    const signUpSpy = vi.fn().mockResolvedValue({ data: { user: { id: '123' }, session: null }, error: null });
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }),
          signUp: signUpSpy
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);

    const res = await authService.signUpWithEmailPassword(' user@example.com ', 'validPassword123');

    expect(signUpSpy).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'validPassword123'
    });
    expect(res.error).toBeNull();
    expect(res.data.user).toEqual({ id: '123' });
  });
});

describe('AuthService signInWithMagicLink validation and error handling', () => {
  it('should reject invalid email format without calling signInWithOtp', async () => {
    const signInWithOtpSpy = vi.fn();
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithOtp: signInWithOtpSpy
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);

    const res = await authService.signInWithMagicLink('invalid-email');

    expect(signInWithOtpSpy).not.toHaveBeenCalled();
    expect(res.error).toBeDefined();
    expect(res.error?.message).toContain('Invalid email address format');
  });

  it('should return error if Supabase signInWithOtp fails', async () => {
    const signInWithOtpSpy = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email rate limit exceeded' }
    });
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithOtp: signInWithOtpSpy
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);

    const res = await authService.signInWithMagicLink('user@example.com');

    expect(signInWithOtpSpy).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(res.error).toBeDefined();
    expect(res.error?.message).toBe('Email rate limit exceeded');
  });

  it('should catch thrown exceptions and return structured error response', async () => {
    const signInWithOtpSpy = vi.fn().mockRejectedValue(new Error('Network error sending magic link'));
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithOtp: signInWithOtpSpy
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);

    const res = await authService.signInWithMagicLink('user@example.com');

    expect(res.error).toBeDefined();
    expect(res.error?.message).toBe('Network error sending magic link');
  });
});

describe('AuthService updateProfile display_name validation', () => {
  it('should throw an error if display_name is empty or whitespace only', async () => {
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } })
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);
    authService.user.set({ id: 'user-1', email: 'test@example.com' } as any);

    await expect(authService.updateProfile({ display_name: '   ' })).rejects.toThrow('Display name cannot be empty');
  });

  it('should throw an error if display_name exceeds 20 characters', async () => {
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } })
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);
    authService.user.set({ id: 'user-1', email: 'test@example.com' } as any);

    const longName = 'a'.repeat(21);
    await expect(authService.updateProfile({ display_name: longName })).rejects.toThrow('Display name must not exceed 20 characters');
  });

  it('should successfully update profile when display_name is valid (1-20 chars)', async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    const updateUserSpy = vi.fn().mockResolvedValue({ error: null });
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        from: vi.fn().mockReturnValue({ upsert: upsertSpy }),
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }),
          updateUser: updateUserSpy
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);
    authService.user.set({ id: 'user-1', email: 'test@example.com' } as any);

    await authService.updateProfile({ display_name: ' Valid User Name ' });

    expect(authService.userProfile()?.display_name).toBe('Valid User Name');
    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Valid User Name' }));
  });
});

describe('AuthService updateProfile avatar_url validation', () => {
  it('should throw an error if avatar_url starts with javascript:', async () => {
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } })
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);
    authService.user.set({ id: 'user-1', email: 'test@example.com' } as any);

    await expect(authService.updateProfile({ avatar_url: 'javascript:alert(1)' })).rejects.toThrow('Invalid avatar URL');
  });

  it('should throw an error if avatar_url is data:text/html', async () => {
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } })
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);
    authService.user.set({ id: 'user-1', email: 'test@example.com' } as any);

    await expect(authService.updateProfile({ avatar_url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' })).rejects.toThrow('Invalid avatar URL');
  });

  it('should accept valid http, https, blob, or image data URI for avatar_url', async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        from: vi.fn().mockReturnValue({ upsert: upsertSpy }),
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }),
          updateUser: vi.fn().mockResolvedValue({ error: null })
        }
      }
    };
    const mockInjector: any = { get: vi.fn().mockReturnValue(null) };
    const authService = new AuthService(mockSupabaseService, mockInjector);
    authService.user.set({ id: 'user-1', email: 'test@example.com' } as any);

    const validDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await authService.updateProfile({ avatar_url: validDataUri });

    expect(authService.userProfile()?.avatar_url).toBe(validDataUri);
  });
});

describe('AuthService claimUnassignedData RPC and fallback migration', () => {
  it('should use RPC migration when server-side RPC function is present', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: true, error: null });
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        rpc: rpcSpy,
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } })
        }
      }
    };
    const mockInjector: any = {
      get: vi.fn().mockReturnValue({
        loadFromSupabase: vi.fn().mockResolvedValue(true),
        loadTasksFromSupabase: vi.fn().mockResolvedValue(true),
        loadAllWorkflows: vi.fn().mockResolvedValue(true)
      })
    };
    const authService = new AuthService(mockSupabaseService, mockInjector);
    authService.user.set({ id: 'user-777', email: 'owner@example.com' } as any);

    const res = await authService.claimUnassignedData();

    expect(rpcSpy).toHaveBeenCalledWith('migrate_unassigned_data_to_user', { target_user_id: 'user-777' });
    expect(res.success).toBe(true);
    expect(res.method).toBe('rpc');
  });

  it('should execute client-side fallback migration when RPC function is missing or fails', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: null, error: { message: 'function migrate_unassigned_data_to_user() does not exist' } });
    const updateSpy = vi.fn().mockReturnValue({ is: vi.fn().mockResolvedValue({ error: null }) });
    const fromSpy = vi.fn().mockReturnValue({ update: updateSpy });

    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        rpc: rpcSpy,
        from: fromSpy,
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } })
        }
      }
    };
    const mockInjector: any = {
      get: vi.fn().mockReturnValue({
        loadFromSupabase: vi.fn().mockResolvedValue(true),
        loadTasksFromSupabase: vi.fn().mockResolvedValue(true),
        loadAllWorkflows: vi.fn().mockResolvedValue(true)
      })
    };
    const authService = new AuthService(mockSupabaseService, mockInjector);
    authService.user.set({ id: 'user-888', email: 'fallback@example.com' } as any);

    const res = await authService.claimUnassignedData();

    expect(rpcSpy).toHaveBeenCalled();
    expect(fromSpy).toHaveBeenCalledWith('projects');
    expect(fromSpy).toHaveBeenCalledWith('tasks');
    expect(res.success).toBe(true);
    expect(res.method).toBe('fallback');
  });
});

describe('AuthService cross-tab sign-out and state isolation', () => {
  it('should reset user, session, profile, and all service states when handleCrossTabSignOut is called', async () => {
    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }),
          signOut: vi.fn().mockResolvedValue({ error: null })
        }
      }
    };
    const resetProjectSpy = vi.fn();
    const resetTaskSpy = vi.fn();
    const resetWorkflowSpy = vi.fn();
    const resetSyncSpy = vi.fn();

    const mockInjector: any = {
      get: vi.fn((token: any) => {
        if (token === ProjectService) return { resetState: resetProjectSpy };
        if (token === TaskService) return { resetState: resetTaskSpy };
        if (token === WorkflowService) return { resetState: resetWorkflowSpy };
        if (token === SyncService) return { resetState: resetSyncSpy };
        return null;
      })
    };

    const authService = new AuthService(mockSupabaseService, mockInjector);
    authService.user.set({ id: 'user-tab-1', email: 'tab@example.com' } as any);
    authService.session.set({ access_token: 'abc' } as any);
    authService.userProfile.set({ id: 'user-tab-1', display_name: 'Tab User', avatar_url: null, email: 'tab@example.com' });

    authService.handleCrossTabSignOut();

    expect(authService.user()).toBeNull();
    expect(authService.session()).toBeNull();
    expect(authService.userProfile()).toBeNull();
    expect(resetProjectSpy).toHaveBeenCalled();
    expect(resetTaskSpy).toHaveBeenCalled();
    expect(resetWorkflowSpy).toHaveBeenCalled();
    expect(resetSyncSpy).toHaveBeenCalled();
  });

  it('should purge remote Supabase data and local storage when purgeAllUserDataFromRemoteAndLocal is invoked', async () => {
    const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({ delete: () => ({ eq: deleteEqMock }) });

    const mockSupabaseService: any = {
      isConfigured: true,
      supabase: {
        from: fromMock,
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
          onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } })
        }
      }
    };

    const mockInjector: any = {
      get: vi.fn(() => ({ resetState: vi.fn() }))
    };

    const authService = new AuthService(mockSupabaseService, mockInjector);
    authService.user.set({ id: 'user-purge-999', email: 'purge@example.com' } as any);
    localStorage.setItem('bilo_projects_data_user-purge-999', '{"projects":[]}');

    await authService.purgeAllUserDataFromRemoteAndLocal();

    expect(fromMock).toHaveBeenCalledWith('tasks');
    expect(fromMock).toHaveBeenCalledWith('projects');
    expect(fromMock).toHaveBeenCalledWith('workflows');
    expect(deleteEqMock).toHaveBeenCalledWith('user_id', 'user-purge-999');
    expect(localStorage.getItem('bilo_projects_data_user-purge-999')).toBeNull();
    expect(authService.user()).toBeNull();
  });
});






