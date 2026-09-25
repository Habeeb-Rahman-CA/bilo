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
      isConfigured: true,
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
            if (item && item.id === 't-fail') {
              return { error: { code: '500', message: 'Transient 500 Error' } };
            }
            return { error: mockUpsertError };
          },
          update: () => ({
            eq: async (col: string, val: string) => {
              if (val === 't-fail') {
                return { error: { code: '500', message: 'Transient 500 Error' } };
              }
              return { error: mockUpsertError };
            }
          }),
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

  it('should rotate transiently failing op to end of queue and continue processing remaining items', async () => {
    syncService.pendingSyncQueue.set([
      {
        id: 'op-failing',
        user_id: 'user-111',
        type: 'UPDATE_TASK',
        payload: { id: 't-fail', title: 'Fail' },
        timestamp: new Date().toISOString(),
        retryCount: 0
      },
      {
        id: 'op-success',
        user_id: 'user-111',
        type: 'CREATE_PROJECT',
        payload: { id: 'p-succ-1', name: 'Success Proj' },
        timestamp: new Date().toISOString(),
        retryCount: 0
      }
    ]);

    mockUpsertError = null;

    await syncService.processQueue();

    expect(syncService.pendingSyncQueue().length).toBe(1);
    expect(syncService.pendingSyncQueue()[0].id).toBe('op-failing');
    expect(syncService.pendingSyncQueue()[0].retryCount).toBe(1);
  });

  it('should reset syncing signal to false even if processQueue throws an exception', async () => {
    syncService.pendingSyncQueue.set([
      {
        id: 'op-throw',
        user_id: 'user-111',
        type: 'CREATE_TASK',
        payload: { title: 'Test' },
        timestamp: new Date().toISOString()
      }
    ]);

    // Force getUser to throw an unexpected exception inside processQueue
    mockSupabaseService.supabase.auth.getUser = async () => {
      throw new Error('Unexpected auth failure');
    };

    await syncService.processQueue();
    expect(syncService.syncing()).toBe(false);
  });

  it('should auto-recover from stale lock (>30s) on subsequent processQueue calls', async () => {
    syncService.syncing.set(true);
    // Simulate stale lock starting 35 seconds ago
    (syncService as any).lastSyncStartTime = Date.now() - 35000;
    syncService.pendingSyncQueue.set([]);

    await syncService.processQueue();
    expect(syncService.syncing()).toBe(false);
  });

  it('should clear memory state on resetState', async () => {
    await syncService.enqueue('CREATE_TASK', { title: 'Task 1' });
    expect(syncService.pendingSyncQueue().length).toBe(1);

    syncService.resetState();
    expect(syncService.pendingSyncQueue().length).toBe(0);
    expect(syncService.deadLetterQueue().length).toBe(0);
  });

  it('should probe connection health and trigger restored callbacks on retryConnection', async () => {
    let callbackTriggered = false;
    syncService.onConnectionRestored(() => {
      callbackTriggered = true;
    });

    mockSupabaseService.checkConnectionHealth = async () => true;

    const restored = await syncService.retryConnection();

    expect(restored).toBe(true);
    expect(syncService.isOnline()).toBe(true);
    expect(syncService.connectionStatus()).toBe('online');
    expect(callbackTriggered).toBe(true);
  });

  it('should set connectionStatus to degraded when checkConnectionHealth fails', async () => {
    mockSupabaseService.checkConnectionHealth = async () => false;

    const restored = await syncService.retryConnection();

    expect(restored).toBe(false);
    expect(syncService.isOnline()).toBe(false);
    expect(syncService.connectionStatus()).toBe('degraded');
  });

  it('should compact queue by canceling CREATE + DELETE operations for the same entity', () => {
    const queue: any[] = [
      { id: '1', user_id: 'user-111', type: 'CREATE_TASK', payload: { id: 'task-999', title: 'Temp Task' }, timestamp: '1' },
      { id: '2', user_id: 'user-111', type: 'UPDATE_TASK', payload: { id: 'task-999', title: 'Updated Temp Task' }, timestamp: '2' },
      { id: '3', user_id: 'user-111', type: 'DELETE_TASK', payload: { id: 'task-999' }, timestamp: '3' }
    ];

    const compacted = syncService.compactQueue(queue);
    expect(compacted.length).toBe(0);
  });

  it('should compact queue by coalescing multiple UPDATE_TASK operations for the same task', () => {
    const queue: any[] = [
      { id: '1', user_id: 'user-111', type: 'UPDATE_TASK', payload: { id: 'task-1', title: 'Title V1', priority: 'low' }, timestamp: '1' },
      { id: '2', user_id: 'user-111', type: 'UPDATE_TASK', payload: { id: 'task-1', title: 'Title V2', status: 'done' }, timestamp: '2' }
    ];

    const compacted = syncService.compactQueue(queue);
    expect(compacted.length).toBe(1);
    expect(compacted[0].payload).toEqual({ id: 'task-1', title: 'Title V2', priority: 'low', status: 'done' });
  });

  it('should trim operations when exceeding MAX_QUEUE_SIZE (500)', () => {
    const largeQueue: any[] = Array.from({ length: 550 }, (_, i) => ({
      id: `op-${i}`,
      user_id: 'user-111',
      type: 'CREATE_TASK',
      payload: { id: `task-${i}`, title: `Task ${i}` },
      timestamp: String(i)
    }));

    const compacted = syncService.compactQueue(largeQueue);
    expect(compacted.length).toBe(500);
    expect(compacted[0].id).toBe('op-50');
  });

  it('should pause loop on rate limit error (HTTP 429) without escalating retryCount', async () => {
    syncService.pendingSyncQueue.set([
      {
        id: 'op-ratelimited',
        user_id: 'user-111',
        type: 'CREATE_TASK',
        payload: { id: 't-rl', title: 'Rate Limited Task' },
        timestamp: new Date().toISOString(),
        retryCount: 0
      }
    ]);

    mockUpsertError = { code: '429', message: 'Too Many Requests - Rate limit exceeded' };

    await syncService.processQueue();

    expect(syncService.pendingSyncQueue().length).toBe(1);
    expect(syncService.pendingSyncQueue()[0].retryCount).toBe(0);
    expect(syncService.deadLetterQueue().length).toBe(0);
  });
});

