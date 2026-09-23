import { describe, it, expect } from 'vitest';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  it('should initialize and report isConfigured status accurately', () => {
    const service = new SupabaseService();
    expect(service.supabase).toBeDefined();
    expect(typeof service.isConfigured).toBe('boolean');
  });
});
