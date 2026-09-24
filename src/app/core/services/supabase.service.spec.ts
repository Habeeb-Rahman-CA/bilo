import { describe, it, expect } from 'vitest';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  it('should initialize and report isConfigured status accurately', () => {
    const service = new SupabaseService();
    expect(service.supabase).toBeDefined();
    expect(typeof service.isConfigured).toBe('boolean');
  });

  it('should return false for checkConnectionHealth when unconfigured or network unreachable', async () => {
    const service = new SupabaseService();
    const stubClient = {
      from: () => ({
        select: () => ({
          limit: async () => ({ error: { message: 'Network unreachable' } })
        })
      })
    };
    (service as any).client = stubClient;
    const isHealthy = await service.checkConnectionHealth();
    expect(isHealthy).toBe(false);
  });
});
