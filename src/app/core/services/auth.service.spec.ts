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
