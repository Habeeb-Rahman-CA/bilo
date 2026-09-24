import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';

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



