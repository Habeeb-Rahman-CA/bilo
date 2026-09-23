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

