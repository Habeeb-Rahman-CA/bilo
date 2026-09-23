import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService, PendingSyncOp } from './sync.service';

describe('SyncService User Data Isolation & Security Guard', () => {
  let syncService: SyncService;
  let mockSupabaseService: any;
  let currentMockUserId: string | null = 'user-111';

  beforeEach(() => {
    localStorage.clear();
    currentMockUserId = 'user-111';

    mockSupabaseService = {
      supabase: {
        auth: {
          getUser: async () => ({
            data: { user: currentMockUserId ? { id: currentMockUserId } : null }
          })
        },
        from: () => ({
          upsert: async () => ({ error: null }),
          update: () => ({ eq: async () => ({ error: null }) }),
          delete: () => ({ eq: async () => ({ error: null }) })
        })
      }
    };

    syncService = new SyncService(mockSupabaseService as any);
  });

  it('should scope sync queue storage to user ID in localStorage', async () => {
    await syncService.enqueue('CREATE_TASK', { title: 'User 1 Task' });

    const key = `bilo_sync_queue_user-111`;
    const stored = localStorage.getItem(key);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored || '[]');
    expect(parsed.length).toBe(1);
    expect(parsed[0].user_id).toBe('user-111');
  });

  it('should block and drop cross-user operations if User 2 is logged in', async () => {
    // User 111 creates an operation
    await syncService.enqueue('CREATE_TASK', { title: 'User 111 Task' });

    // Switch active session to User 222
    currentMockUserId = 'user-222';
    await syncService.loadQueueFromStorage('user-222');

    // Add User 111 op manually to queue to test processQueue security guard
    syncService.pendingSyncQueue.set([
      {
        id: 'op-1',
        user_id: 'user-111',
        type: 'CREATE_TASK',
        payload: { title: 'User 111 Task' },
        timestamp: new Date().toISOString()
      }
    ]);

    await syncService.processQueue();

    // The cross-user operation created by user-111 should be dropped under user-222 session
    expect(syncService.pendingSyncQueue().length).toBe(0);
  });

  it('should clear memory state on resetState', async () => {
    await syncService.enqueue('CREATE_TASK', { title: 'Task 1' });
    expect(syncService.pendingSyncQueue().length).toBe(1);

    syncService.resetState();
    expect(syncService.pendingSyncQueue().length).toBe(0);
  });
});
