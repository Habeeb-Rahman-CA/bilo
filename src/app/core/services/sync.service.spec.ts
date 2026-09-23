import { describe, it, expect, beforeEach } from 'vitest';
import { SyncService } from './sync.service';

describe('SyncService User Data Isolation & DLQ Escalation', () => {
  let syncService: SyncService;
  let mockSupabaseService: any;
  let currentMockUserId: string | null = 'user-111';
  let mockUpsertError: any = null;

  beforeEach(() => {
    localStorage.clear();
    currentMockUserId = 'user-111';
    mockUpsertError = null;

    mockSupabaseService = {
      supabase: {
        auth: {
          getUser: async () => ({
            data: { user: currentMockUserId ? { id: currentMockUserId } : null }
          })
        },
        from: (table: string) => ({
          upsert: async (payload: any[]) => {
            const item = payload[0];
            if (item && item.id === 'task-deleted-parent') {
              return { error: { code: '23503', message: 'violates foreign key constraint' } };
            }
            return { error: mockUpsertError };
          },
          update: () => ({ eq: async () => ({ error: mockUpsertError }) }),
          delete: () => ({
            eq: async (col: string, val: string) => {
              if (val === 'task-deleted-parent') {
                return { error: { code: '23503', message: 'violates foreign key constraint' } };
              }
              return { error: mockUpsertError };
            }
          })
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
    await syncService.enqueue('CREATE_TASK', { title: 'User 111 Task' });

    currentMockUserId = 'user-222';
    await syncService.loadQueueFromStorage('user-222');

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
    expect(syncService.pendingSyncQueue().length).toBe(0);
  });

  it('should escalate fatal DB errors (e.g. FK 23503) to Dead-Letter Queue without blocking queue', async () => {
    syncService.pendingSyncQueue.set([
      {
        id: 'op-fatal',
        user_id: 'user-111',
        type: 'DELETE_TASK',
        payload: { id: 'task-deleted-parent' },
        timestamp: new Date().toISOString()
      },
      {
        id: 'op-valid',
        user_id: 'user-111',
        type: 'CREATE_PROJECT',
        payload: { id: 'p-valid-1', name: 'Valid Proj' },
        timestamp: new Date().toISOString()
      }
    ]);

    await syncService.processQueue();

    // Fatal op should be moved to DLQ, and valid op behind it should succeed and clear queue!
    expect(syncService.deadLetterQueue().length).toBe(1);
    expect(syncService.deadLetterQueue()[0].id).toBe('op-fatal');
    expect(syncService.pendingSyncQueue().length).toBe(0);
  });

  it('should escalate op to DLQ after MAX_RETRIES (3) on persistent transient errors', async () => {
    syncService.pendingSyncQueue.set([
      {
        id: 'op-transient',
        user_id: 'user-111',
        type: 'UPDATE_TASK',
        payload: { id: 't-1', title: 'Test' },
        timestamp: new Date().toISOString(),
        retryCount: 2
      }
    ]);

    mockUpsertError = { code: '500', message: 'Internal Server Error' };

    await syncService.processQueue();

    expect(syncService.pendingSyncQueue().length).toBe(0);
    expect(syncService.deadLetterQueue().length).toBe(1);
    expect(syncService.deadLetterQueue()[0].id).toBe('op-transient');
  });

  it('should clear memory state on resetState', async () => {
    await syncService.enqueue('CREATE_TASK', { title: 'Task 1' });
    expect(syncService.pendingSyncQueue().length).toBe(1);

    syncService.resetState();
    expect(syncService.pendingSyncQueue().length).toBe(0);
    expect(syncService.deadLetterQueue().length).toBe(0);
  });
});
