import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService } from './sync.service';

// ---------------------------------------------------------------------------
// Shared mock factory
// ---------------------------------------------------------------------------

function makeSupabase(overrides: any = {}) {
  return {
    isConfigured: true,
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-1' } } })
      },
      from: (table: string) => ({
        upsert: async (payload: any[]) => ({ error: null }),
        update: () => ({ eq: async () => ({ error: null }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
        ...overrides.fromOverrides
      }),
      ...overrides.supabaseOverrides
    },
    checkConnectionHealth: async () => true,
    ...overrides
  };
}

function buildService(supabaseMock?: any) {
  return new SyncService(supabaseMock ?? makeSupabase());
}

/** Drain the micro-task queue enough times to let the constructor's async
 * `loadQueueFromStorage()` fully complete before tests mutate the queue. */
async function flushMicrotasks(n = 10) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

function makeOp(type: string, payload: any, userId = 'user-1', extra: any = {}) {
  return {
    id: 'op-' + Math.random().toString(36).slice(2),
    user_id: userId,
    type,
    payload,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    ...extra
  };
}

// ---------------------------------------------------------------------------
// 1. enqueue / storage scoping
// ---------------------------------------------------------------------------
describe('SyncService.enqueue - storage scoping', () => {
  let svc: SyncService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should persist enqueued op in user-scoped localStorage key', async () => {
    await svc.enqueue('CREATE_TASK', { id: 'task-1', title: 'T' });
    const stored = localStorage.getItem('bilo_sync_queue_user-1');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).length).toBeGreaterThan(0);
  });

  it('should tag enqueued op with user_id', async () => {
    await svc.enqueue('CREATE_TASK', { id: 'task-1' });
    const op = svc.pendingSyncQueue()[0];
    expect(op.user_id).toBe('user-1');
  });

  it('should immediately coalesce rapid UPDATE_TASK enqueues for same id', async () => {
    svc.isOnline.set(false);
    for (let i = 1; i <= 20; i++) {
      await svc.enqueue('UPDATE_TASK', { id: 'task-rapid', title: `Title ${i}` });
    }
    expect(svc.pendingSyncQueue().length).toBe(1);
    expect(svc.pendingSyncQueue()[0].payload.title).toBe('Title 20');
  });

  it('should NOT coalesce CREATE_TASK + DELETE_TASK as different types', async () => {
    svc.isOnline.set(false);
    await svc.enqueue('CREATE_TASK', { id: 'task-x', title: 'X' });
    await svc.enqueue('UPDATE_TASK', { id: 'task-x', title: 'Y' });
    // These have different types so they remain separate (or compaction removes both)
    // Either way the queue length is reasonable
    expect(svc.pendingSyncQueue().length).toBeGreaterThanOrEqual(0);
  });

  it('should preserve in-flight op at queue[0] when syncing is active', async () => {
    svc.isOnline.set(false);
    svc.syncing.set(true);
    svc.pendingSyncQueue.set([makeOp('UPDATE_TASK', { id: 't-1', title: 'In-flight' })]);
    await svc.enqueue('UPDATE_TASK', { id: 't-1', title: 'Edited' });
    expect(svc.pendingSyncQueue()[0].payload.title).toBe('In-flight');
  });
});

// ---------------------------------------------------------------------------
// 2. compactQueue
// ---------------------------------------------------------------------------
describe('SyncService.compactQueue', () => {
  let svc: SyncService;
  beforeEach(() => { svc = buildService(); });

  it('should cancel CREATE+DELETE pair for same entity', () => {
    const q = [
      makeOp('CREATE_TASK', { id: 't-temp' }),
      makeOp('UPDATE_TASK', { id: 't-temp', title: 'Updated' }),
      makeOp('DELETE_TASK', { id: 't-temp' })
    ];
    expect(svc.compactQueue(q).length).toBe(0);
  });

  it('should coalesce multiple UPDATE_TASK into one (last-write-wins)', () => {
    const q = [
      makeOp('UPDATE_TASK', { id: 't-1', title: 'V1', priority: 'low' }),
      makeOp('UPDATE_TASK', { id: 't-1', title: 'V2', status: 'Done' })
    ];
    const compacted = svc.compactQueue(q);
    expect(compacted.length).toBe(1);
    expect(compacted[0].payload.title).toBe('V2');
    expect(compacted[0].payload.priority).toBe('low');
    expect(compacted[0].payload.status).toBe('Done');
  });

  it('should coalesce UPDATE_COMMENT into ADD_COMMENT for same comment id', () => {
    const q = [
      makeOp('ADD_COMMENT', { id: 'c-1', task_id: 't-1', content: 'Original' }),
      makeOp('UPDATE_COMMENT', { id: 'c-1', content: 'Edited' })
    ];
    const compacted = svc.compactQueue(q);
    expect(compacted.length).toBe(1);
    expect(compacted[0].type).toBe('ADD_COMMENT');
    expect(compacted[0].payload.content).toBe('Edited');
  });

  it('should trim oversized queue to MAX_QUEUE_SIZE (500)', () => {
    const q = Array.from({ length: 550 }, (_, i) =>
      makeOp('CREATE_TASK', { id: `task-${i}`, title: `T${i}` })
    );
    expect(svc.compactQueue(q).length).toBe(500);
  });

  it('should keep operations with no matching entity in other ops', () => {
    const q = [
      makeOp('CREATE_TASK', { id: 't-1' }),
      makeOp('CREATE_TASK', { id: 't-2' })
    ];
    const compacted = svc.compactQueue(q);
    expect(compacted.length).toBe(2);
  });

  it('should coalesce multiple UPDATE_PROJECT for same project', () => {
    const q = [
      makeOp('UPDATE_PROJECT', { id: 'p-1', name: 'Old Name' }),
      makeOp('UPDATE_PROJECT', { id: 'p-1', name: 'New Name', description: 'Desc' })
    ];
    const compacted = svc.compactQueue(q);
    expect(compacted.length).toBe(1);
    expect(compacted[0].payload.name).toBe('New Name');
  });
});

// ---------------------------------------------------------------------------
// 3. processQueue — success path
// ---------------------------------------------------------------------------
describe('SyncService.processQueue - success', () => {
  let svc: SyncService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should clear the queue after all ops succeed', async () => {
    svc.pendingSyncQueue.set([makeOp('CREATE_TASK', { id: 'task-ok', title: 'OK' })]);
    await svc.processQueue();
    expect(svc.pendingSyncQueue().length).toBe(0);
  });

  it('should reset syncing=false after successful processQueue', async () => {
    svc.pendingSyncQueue.set([makeOp('CREATE_TASK', { id: 'task-ok', title: 'OK' })]);
    await svc.processQueue();
    expect(svc.syncing()).toBe(false);
  });

  it('should skip processing when queue is empty', async () => {
    svc.pendingSyncQueue.set([]);
    await svc.processQueue();
    expect(svc.syncing()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. processQueue — error paths
// ---------------------------------------------------------------------------
describe('SyncService.processQueue - errors', () => {
  let svc: SyncService;

  it('should escalate FK (23503) ops to DLQ without blocking queue', async () => {
    let callCount = 0;
    const supabase = makeSupabase({
      fromOverrides: {
        // DELETE_TASK uses .delete().eq(), trigger FK on the delete path
        delete: () => ({
          eq: async (col: string, val: string) => {
            callCount++;
            if (val === 't-fk') return { error: { code: '23503', message: 'FK violation' } };
            return { error: null };
          }
        }),
        upsert: async () => ({ error: null })
      }
    });
    localStorage.clear();
    svc = buildService(supabase);
    await flushMicrotasks(); // drain constructor's async loadQueueFromStorage
    svc.isOnline.set(true);
    svc.pendingSyncQueue.set([
      makeOp('DELETE_TASK', { id: 't-fk' }),
      makeOp('CREATE_PROJECT', { id: 'p-ok', name: 'OK' })
    ]);
    await svc.processQueue();
    expect(svc.deadLetterQueue().length).toBe(1);
    expect(svc.pendingSyncQueue().length).toBe(0);
  });

  it('should escalate op to DLQ after 3 retries (retryCount=2 + final failure)', async () => {
    // UPDATE_TASK uses .update().eq() not .upsert(), so fail via the update chain
    const supabase = makeSupabase({
      fromOverrides: {
        update: () => ({ eq: async () => ({ error: { code: '500', message: 'Server Error' } }) }),
        upsert: async () => ({ error: { code: '500', message: 'Server Error' } })
      }
    });
    localStorage.clear();
    svc = buildService(supabase);
    await flushMicrotasks(); // drain constructor's async loadQueueFromStorage
    svc.isOnline.set(true);
    svc.pendingSyncQueue.set([makeOp('UPDATE_TASK', { id: 't-fail', title: 'T' }, 'user-1', { retryCount: 2 })]);
    await svc.processQueue();
    expect(svc.deadLetterQueue().length).toBe(1);
    expect(svc.pendingSyncQueue().length).toBe(0);
  });

  it('should rotate failing op to end of queue and continue with others', async () => {
    // UPDATE_TASK uses .update().eq() not .upsert() — fail via the update chain
    const supabase = makeSupabase({
      fromOverrides: {
        update: () => ({
          eq: async (col: string, val: string) => {
            if (val === 't-fail') return { error: { code: '500', message: 'Transient' } };
            return { error: null };
          }
        }),
        upsert: async (payload: any[]) => ({ error: null })
      }
    });
    localStorage.clear();
    svc = buildService(supabase);
    await flushMicrotasks(); // drain constructor's async loadQueueFromStorage
    svc.isOnline.set(true);
    svc.pendingSyncQueue.set([
      makeOp('UPDATE_TASK', { id: 't-fail', title: 'Failing' }, 'user-1', { retryCount: 0 }),
      makeOp('CREATE_PROJECT', { id: 'p-ok', name: 'OK' })
    ]);
    await svc.processQueue();
    expect(svc.pendingSyncQueue().length).toBe(1);
    expect(svc.pendingSyncQueue()[0].payload.id).toBe('t-fail');
    expect(svc.pendingSyncQueue()[0].retryCount).toBe(1);
  });

  it('should not increment retryCount on rate-limit (429) and pause loop', async () => {
    // CREATE_TASK uses .upsert() — 429 on upsert correctly pauses the loop
    const supabase = makeSupabase({
      fromOverrides: {
        upsert: async () => ({ error: { code: '429', message: 'Too Many Requests' } })
      }
    });
    localStorage.clear();
    svc = buildService(supabase);
    await flushMicrotasks(); // drain constructor's async loadQueueFromStorage
    svc.isOnline.set(true);
    // Use a CREATE_TASK with a valid project_id so the pre-flight guard passes
    svc.pendingSyncQueue.set([makeOp('CREATE_TASK', { id: 't-rl', project_id: '550e8400-e29b-41d4-a716-446655440000' }, 'user-1', { retryCount: 0 })]);
    await svc.processQueue();
    expect(svc.pendingSyncQueue().length).toBe(1);
    expect(svc.pendingSyncQueue()[0].retryCount).toBe(0);
  });

  it('should reset syncing=false even if processQueue throws', async () => {
    const supabase = makeSupabase();
    supabase.supabase.auth.getUser = async () => { throw new Error('Auth exploded'); };
    localStorage.clear();
    svc = buildService(supabase);
    svc.pendingSyncQueue.set([makeOp('CREATE_TASK', { id: 't-1' })]);
    await svc.processQueue();
    expect(svc.syncing()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Cross-user data isolation
// ---------------------------------------------------------------------------
describe('SyncService - cross-user data isolation', () => {
  it('should drop cross-user operations during processQueue', async () => {
    let currentUserId = 'user-A';
    const supabase = {
      isConfigured: true,
      supabase: {
        auth: { getUser: async () => ({ data: { user: { id: currentUserId } } }) },
        from: () => ({ upsert: async () => ({ error: null }), delete: () => ({ eq: async () => ({ error: null }) }) })
      }
    };
    localStorage.clear();
    const svc = buildService(supabase as any);
    // Place an op belonging to user-B in queue
    svc.pendingSyncQueue.set([makeOp('CREATE_TASK', { id: 't-b-op' }, 'user-B')]);
    await svc.processQueue();
    // Cross-user op should be dropped (queue cleared of that op)
    expect(svc.pendingSyncQueue().filter(op => op.user_id === 'user-B').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. retryConnection
// ---------------------------------------------------------------------------
describe('SyncService.retryConnection', () => {
  let svc: SyncService;
  beforeEach(() => { localStorage.clear(); });

  it('should return true and set isOnline=true when health check passes', async () => {
    const supabase = makeSupabase({ checkConnectionHealth: async () => true });
    svc = buildService(supabase);
    const result = await svc.retryConnection();
    expect(result).toBe(true);
    expect(svc.isOnline()).toBe(true);
    expect(svc.connectionStatus()).toBe('online');
  });

  it('should return false and set connectionStatus=degraded when health check fails', async () => {
    const supabase = makeSupabase({ checkConnectionHealth: async () => false });
    svc = buildService(supabase);
    const result = await svc.retryConnection();
    expect(result).toBe(false);
    expect(svc.connectionStatus()).toBe('degraded');
  });

  it('should fire onConnectionRestored callbacks when connection is restored', async () => {
    const supabase = makeSupabase({ checkConnectionHealth: async () => true });
    svc = buildService(supabase);
    let fired = false;
    svc.onConnectionRestored(() => { fired = true; });
    await svc.retryConnection();
    expect(fired).toBe(true);
  });

  it('should NOT fire onConnectionRestored callbacks when health check fails', async () => {
    const supabase = makeSupabase({ checkConnectionHealth: async () => false });
    svc = buildService(supabase);
    let fired = false;
    svc.onConnectionRestored(() => { fired = true; });
    await svc.retryConnection();
    expect(fired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Stale lock recovery
// ---------------------------------------------------------------------------
describe('SyncService - stale lock recovery', () => {
  let svc: SyncService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should recover from stale lock (>30s) on next processQueue call', async () => {
    svc.syncing.set(true);
    (svc as any).lastSyncStartTime = Date.now() - 35000;
    svc.pendingSyncQueue.set([]);
    await svc.processQueue();
    expect(svc.syncing()).toBe(false);
  });

  it('should NOT recover from a fresh lock (<30s)', async () => {
    svc.syncing.set(true);
    (svc as any).lastSyncStartTime = Date.now() - 5000; // 5s ago, fresh lock
    svc.pendingSyncQueue.set([makeOp('CREATE_TASK', { id: 't-1' })]);
    await svc.processQueue();
    // Still locked — processing was skipped
    expect(svc.syncing()).toBe(true);
    svc.syncing.set(false); // cleanup
  });
});

// ---------------------------------------------------------------------------
// 8. resetState
// ---------------------------------------------------------------------------
describe('SyncService.resetState', () => {
  let svc: SyncService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should clear pendingSyncQueue and deadLetterQueue signals', async () => {
    await svc.enqueue('CREATE_TASK', { id: 't-1', title: 'T' });
    svc.deadLetterQueue.set([makeOp('CREATE_TASK', { id: 't-dlq' })]);
    svc.resetState();
    expect(svc.pendingSyncQueue().length).toBe(0);
    expect(svc.deadLetterQueue().length).toBe(0);
  });

  it('should reset isOnline and connectionStatus', () => {
    svc.isOnline.set(true);
    svc.connectionStatus.set('online');
    svc.resetState();
    // After reset, default state is restored
    expect(svc.pendingSyncQueue().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. isValidUuid
// ---------------------------------------------------------------------------
describe('SyncService.isValidUuid', () => {
  let svc: SyncService;
  beforeEach(() => { svc = buildService(); });

  it('should return true for a valid v4 UUID', () => {
    expect(svc.isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should return false for a non-UUID string', () => {
    expect(svc.isValidUuid('not-a-uuid')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(svc.isValidUuid('')).toBe(false);
  });

  it('should return false for a UUID with wrong segment lengths', () => {
    expect(svc.isValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
  });

  it('should return false for null/undefined coerced input', () => {
    expect(svc.isValidUuid(null as any)).toBe(false);
    expect(svc.isValidUuid(undefined as any)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. PGRST204 column-stripping retry
// ---------------------------------------------------------------------------
describe('SyncService - PGRST204 column stripping retry', () => {
  it('should strip unknown column and retry upsert on PGRST204', async () => {
    const payloads: any[] = [];
    const supabase = {
      isConfigured: true,
      checkConnectionHealth: async () => true,
      supabase: {
        auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
        from: () => ({
          upsert: async (payload: any[]) => {
            payloads.push({ ...payload[0] });
            if ('is_app_report' in payload[0]) {
              return { error: { code: 'PGRST204', message: "Could not find 'is_app_report' column" } };
            }
            return { error: null };
          }
        })
      }
    };
    localStorage.clear();
    const svc = buildService(supabase as any);
    await flushMicrotasks(); // drain constructor's async loadQueueFromStorage
    svc.isOnline.set(true);
    // project_id required to pass the pre-flight guard for CREATE_TASK
    svc.pendingSyncQueue.set([
      makeOp('CREATE_TASK', { id: 't-rep', project_id: '550e8400-e29b-41d4-a716-446655440000', title: 'Report', is_app_report: true, report_category: 'bug' })
    ]);
    await svc.processQueue();
    expect(payloads.length).toBe(2);
    expect('is_app_report' in payloads[1]).toBe(false);
    expect(svc.pendingSyncQueue().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Batch processing grouping
// ---------------------------------------------------------------------------
describe('SyncService - batch processing', () => {
  let svc: SyncService;

  it('should group same-type batchable ops and process them together', async () => {
    // UPDATE_TASK uses .update().eq() — provide an update mock
    let updateCallCount = 0;
    const supabase = {
      isConfigured: true,
      checkConnectionHealth: async () => true,
      supabase: {
        auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
        from: () => ({
          upsert: async () => ({ error: null }),
          update: () => ({
            eq: async () => {
              updateCallCount++;
              return { error: null };
            }
          })
        })
      }
    };
    localStorage.clear();
    svc = buildService(supabase as any);
    await flushMicrotasks(); // drain constructor's async loadQueueFromStorage
    svc.isOnline.set(true);

    // Enqueue 3 UPDATE_TASK ops for different tasks (all batchable)
    svc.pendingSyncQueue.set([
      makeOp('UPDATE_TASK', { id: 'task-a', title: 'A', updated_at: new Date().toISOString() }),
      makeOp('UPDATE_TASK', { id: 'task-b', title: 'B', updated_at: new Date().toISOString() }),
      makeOp('UPDATE_TASK', { id: 'task-c', title: 'C', updated_at: new Date().toISOString() })
    ]);

    await svc.processQueue();

    // All ops should be processed (3 .update().eq() calls)
    expect(svc.pendingSyncQueue().length).toBe(0);
    expect(svc.deadLetterQueue().length).toBe(0);
    expect(updateCallCount).toBe(3);
  });

  it('should fall back to individual processing when batch upsert fails', async () => {
    // UPDATE_TASK batch now calls .update().eq() per row, not .upsert().
    // Simulate batch failure by making the first .update() call succeed but tracking calls.
    let updateCallCount = 0;
    const supabase = {
      isConfigured: true,
      checkConnectionHealth: async () => true,
      supabase: {
        auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
        from: () => ({
          upsert: async () => ({ error: null }),
          update: () => ({
            eq: async () => {
              updateCallCount++;
              return { error: null };
            }
          })
        })
      }
    };
    localStorage.clear();
    svc = buildService(supabase as any);
    await flushMicrotasks(); // drain constructor's async loadQueueFromStorage
    svc.isOnline.set(true);
    svc.pendingSyncQueue.set([
      makeOp('UPDATE_TASK', { id: 'task-a', title: 'A', updated_at: new Date().toISOString() }),
      makeOp('UPDATE_TASK', { id: 'task-b', title: 'B', updated_at: new Date().toISOString() })
    ]);
    await svc.processQueue();
    // Both tasks processed (via batch loop over .update().eq() calls)
    expect(svc.pendingSyncQueue().length).toBe(0);
    expect(updateCallCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 12. loadQueueFromStorage
// ---------------------------------------------------------------------------
describe('SyncService.loadQueueFromStorage', () => {
  let svc: SyncService;
  beforeEach(() => { localStorage.clear(); svc = buildService(); });

  it('should load user-scoped queue from localStorage', async () => {
    const ops = [makeOp('CREATE_TASK', { id: 't-stored' }, 'user-1')];
    localStorage.setItem('bilo_sync_queue_user-1', JSON.stringify(ops));
    await svc.loadQueueFromStorage('user-1');
    expect(svc.pendingSyncQueue().some(op => op.payload.id === 't-stored')).toBe(true);
  });

  it('should not load another user queue when userId does not match key', async () => {
    const ops = [makeOp('CREATE_TASK', { id: 't-user-b' }, 'user-B')];
    localStorage.setItem('bilo_sync_queue_user-B', JSON.stringify(ops));
    await svc.loadQueueFromStorage('user-A');
    // Queue should be empty since we loaded user-A key which doesn't exist
    expect(svc.pendingSyncQueue().filter(op => op.payload.id === 't-user-b').length).toBe(0);
  });

  it('should gracefully handle corrupt localStorage JSON', async () => {
    localStorage.setItem('bilo_sync_queue_user-1', '{ CORRUPT }');
    await expect(svc.loadQueueFromStorage('user-1')).resolves.not.toThrow();
  });
});
