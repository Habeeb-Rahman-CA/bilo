import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface PendingSyncOp {
  id: string;
  user_id: string;
  type:
  | 'CREATE_TASK'
  | 'UPDATE_TASK'
  | 'DELETE_TASK'
  | 'CREATE_PROJECT'
  | 'UPDATE_PROJECT'
  | 'DELETE_PROJECT'
  | 'ADD_COMMENT'
  | 'UPDATE_COMMENT'
  | 'DELETE_COMMENT'
  | 'ADD_STATUS_HISTORY'
  | 'ADD_PROJECT_ACTIVITY';
  payload: any;
  timestamp: string;
  retryCount?: number;
  lastError?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  readonly MAX_RETRIES = 3;
  readonly MAX_QUEUE_SIZE = 500;

  isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  connectionStatus = signal<'online' | 'degraded' | 'offline'>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'
  );
  pendingSyncQueue = signal<PendingSyncOp[]>([]);
  deadLetterQueue = signal<PendingSyncOp[]>([]);
  syncing = signal<boolean>(false);

  private onRestoredCallbacks: Array<() => void> = [];
  private healthCheckTimer: any = null;

  constructor(private supabaseService: SupabaseService) {
    this.loadQueueFromStorage();
    this.loadDlqFromStorage();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', async () => {
        console.log('[bilo Sync] Network connectivity restored. Testing server connection...');
        await this.retryConnection();
      });

      window.addEventListener('offline', () => {
        console.log('[bilo Sync] Device went offline. Queueing local mutations for sync.');
        this.isOnline.set(false);
        this.connectionStatus.set('offline');
      });

      window.addEventListener('beforeunload', () => {
        this.saveQueueToStorage();
        this.saveDlqToStorage();
      });
    }

    this.startHealthCheckLoop();

    // Initial sync check if online and items pending
    if (this.isOnline() && this.pendingSyncQueue().length > 0) {
      this.processQueue();
    }
  }

  onConnectionRestored(cb: () => void) {
    this.onRestoredCallbacks.push(cb);
  }

  private notifyRestored() {
    this.onRestoredCallbacks.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error('[bilo Sync] Error executing connection restored callback:', e);
      }
    });
  }

  startHealthCheckLoop() {
    if (typeof window === 'undefined') return;
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    const runCheck = async () => {
      if (!this.supabaseService.isConfigured) return;
      if (!navigator.onLine) {
        this.isOnline.set(false);
        this.connectionStatus.set('offline');
        return;
      }

      const isHealthy = await this.supabaseService.checkConnectionHealth();
      const previousState = this.connectionStatus();

      if (isHealthy) {
        this.isOnline.set(true);
        this.connectionStatus.set('online');
        if (previousState !== 'online' || this.pendingSyncQueue().length > 0) {
          console.log('[bilo Sync] Server connected. Processing pending sync queue...');
          this.processQueue();
          if (previousState !== 'online') {
            this.notifyRestored();
          }
        }
      } else {
        this.connectionStatus.set('degraded');
        this.isOnline.set(false);
      }
    };

    // Run health check probe every 25 seconds
    this.healthCheckTimer = setInterval(runCheck, 25000);
  }

  async retryConnection(): Promise<boolean> {
    if (!this.supabaseService.isConfigured) {
      return false;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnline.set(false);
      this.connectionStatus.set('offline');
      return false;
    }

    const isHealthy = await this.supabaseService.checkConnectionHealth();
    if (isHealthy) {
      this.isOnline.set(true);
      this.connectionStatus.set('online');
      await this.processQueue();
      this.notifyRestored();
      return true;
    } else {
      this.isOnline.set(false);
      this.connectionStatus.set('degraded');
      return false;
    }
  }

  private async getCurrentUserId(): Promise<string | null> {
    try {
      const { data } = await this.supabaseService.supabase.auth.getUser();
      return data?.user?.id || null;
    } catch {
      return null;
    }
  }

  private getStorageKey(userId?: string | null): string {
    if (userId && userId !== 'guest') {
      return `bilo_sync_queue_${userId}`;
    }
    return 'bilo_sync_queue_guest';
  }

  private getDlqStorageKey(userId?: string | null): string {
    if (userId && userId !== 'guest') {
      return `bilo_sync_dlq_${userId}`;
    }
    return 'bilo_sync_dlq_guest';
  }

  async loadQueueFromStorage(userId?: string | null) {
    const uid = userId || (await this.getCurrentUserId());
    const storageKey = this.getStorageKey(uid);
    let cached = localStorage.getItem(storageKey);

    // Legacy un-scoped key fallback/migration
    if (!cached && localStorage.getItem('bilo_sync_queue')) {
      cached = localStorage.getItem('bilo_sync_queue');
      localStorage.removeItem('bilo_sync_queue');
      if (cached && uid) {
        localStorage.setItem(storageKey, cached);
      }
    }

    if (cached) {
      try {
        const queue = JSON.parse(cached);
        if (Array.isArray(queue)) {
          const validQueue = queue.map((op: any) => ({
            ...op,
            user_id: op.user_id || uid || 'guest'
          }));
          this.pendingSyncQueue.set(this.compactQueue(validQueue));
          return;
        }
      } catch (e) {
        console.error('[bilo Sync] Failed to parse offline sync queue:', e);
      }
    }
    this.pendingSyncQueue.set([]);
  }

  async loadDlqFromStorage(userId?: string | null) {
    const uid = userId || (await this.getCurrentUserId());
    const storageKey = this.getDlqStorageKey(uid);
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        const dlq = JSON.parse(cached);
        if (Array.isArray(dlq)) {
          this.deadLetterQueue.set(dlq);
          return;
        }
      } catch (e) {
        console.error('[bilo Sync] Failed to parse Dead-Letter Queue:', e);
      }
    }
    this.deadLetterQueue.set([]);
  }

  private async saveQueueToStorage(userId?: string | null) {
    const uid = userId || (await this.getCurrentUserId());
    const storageKey = this.getStorageKey(uid);
    localStorage.setItem(storageKey, JSON.stringify(this.pendingSyncQueue()));
  }

  private async saveDlqToStorage(userId?: string | null) {
    const uid = userId || (await this.getCurrentUserId());
    const storageKey = this.getDlqStorageKey(uid);
    localStorage.setItem(storageKey, JSON.stringify(this.deadLetterQueue()));
  }

  resetState() {
    this.pendingSyncQueue.set([]);
    this.deadLetterQueue.set([]);
    this.syncing.set(false);
  }

  compactQueue(queue: PendingSyncOp[]): PendingSyncOp[] {
    if (!queue || queue.length === 0) return [];

    const result: PendingSyncOp[] = [];
    const deletedTaskIds = new Set<string>();
    const deletedProjectIds = new Set<string>();
    const deletedCommentIds = new Set<string>();

    for (let i = queue.length - 1; i >= 0; i--) {
      const op = queue[i];

      // Handle Task operations
      if (op.type === 'DELETE_TASK') {
        const taskId = op.payload?.id;
        if (taskId) deletedTaskIds.add(taskId);
        result.unshift(op);
        continue;
      }

      if (op.type === 'CREATE_TASK') {
        const taskId = op.payload?.id;
        const projId = op.payload?.project_id;
        if (projId && deletedProjectIds.has(projId)) continue;

        if (taskId && deletedTaskIds.has(taskId)) {
          const delIdx = result.findIndex(r => r.type === 'DELETE_TASK' && r.payload?.id === taskId);
          if (delIdx !== -1) result.splice(delIdx, 1);
          continue;
        }
        if (taskId) {
          const updateIndices: number[] = [];
          for (let rIdx = 0; rIdx < result.length; rIdx++) {
            if (result[rIdx].type === 'UPDATE_TASK' && result[rIdx].payload?.id === taskId) {
              op.payload = { ...op.payload, ...result[rIdx].payload };
              updateIndices.push(rIdx);
            }
          }
          for (let u = updateIndices.length - 1; u >= 0; u--) {
            result.splice(updateIndices[u], 1);
          }
        }
        result.unshift(op);
        continue;
      }

      if (op.type === 'UPDATE_TASK') {
        const taskId = op.payload?.id;
        const projId = op.payload?.project_id;
        if (projId && deletedProjectIds.has(projId)) continue;
        if (taskId && deletedTaskIds.has(taskId)) continue;

        const existingCreate = result.find(r => r.type === 'CREATE_TASK' && r.payload?.id === taskId);
        if (existingCreate) {
          existingCreate.payload = { ...op.payload, ...existingCreate.payload };
          continue;
        }

        const existingUpdate = result.find(r => r.type === 'UPDATE_TASK' && r.payload?.id === taskId);
        if (existingUpdate) {
          existingUpdate.payload = { ...op.payload, ...existingUpdate.payload };
          continue;
        }
        result.unshift(op);
        continue;
      }

      // Handle Task-subordinate entities (Comments, Status History) when task is deleted
      if (op.type === 'ADD_COMMENT' || op.type === 'UPDATE_COMMENT' || op.type === 'DELETE_COMMENT' || op.type === 'ADD_STATUS_HISTORY') {
        const taskId = op.payload?.task_id;
        if (taskId && deletedTaskIds.has(taskId)) continue;
      }

      // Handle Project operations
      if (op.type === 'DELETE_PROJECT') {
        const projId = op.payload?.id;
        if (projId) deletedProjectIds.add(projId);
        result.unshift(op);
        continue;
      }

      if (op.type === 'CREATE_PROJECT') {
        const projId = op.payload?.id;
        if (projId && deletedProjectIds.has(projId)) {
          const delIdx = result.findIndex(r => r.type === 'DELETE_PROJECT' && r.payload?.id === projId);
          if (delIdx !== -1) result.splice(delIdx, 1);
          continue;
        }
        if (projId) {
          const updateIndices: number[] = [];
          for (let rIdx = 0; rIdx < result.length; rIdx++) {
            if (result[rIdx].type === 'UPDATE_PROJECT' && result[rIdx].payload?.id === projId) {
              op.payload = { ...op.payload, ...result[rIdx].payload };
              updateIndices.push(rIdx);
            }
          }
          for (let u = updateIndices.length - 1; u >= 0; u--) {
            result.splice(updateIndices[u], 1);
          }
        }
        result.unshift(op);
        continue;
      }

      if (op.type === 'UPDATE_PROJECT') {
        const projId = op.payload?.id;
        if (projId && deletedProjectIds.has(projId)) continue;

        const existingCreate = result.find(r => r.type === 'CREATE_PROJECT' && r.payload?.id === projId);
        if (existingCreate) {
          existingCreate.payload = { ...op.payload, ...existingCreate.payload };
          continue;
        }

        const existingUpdate = result.find(r => r.type === 'UPDATE_PROJECT' && r.payload?.id === projId);
        if (existingUpdate) {
          existingUpdate.payload = { ...op.payload, ...existingUpdate.payload };
          continue;
        }
        result.unshift(op);
        continue;
      }

      // Handle Project-subordinate entities when project is deleted
      if (op.type === 'ADD_PROJECT_ACTIVITY') {
        const projId = op.payload?.project_id;
        if (projId && deletedProjectIds.has(projId)) continue;
      }

      // Handle Comment operations
      if (op.type === 'DELETE_COMMENT') {
        const commId = op.payload?.id;
        if (commId) deletedCommentIds.add(commId);
        result.unshift(op);
        continue;
      }

      if (op.type === 'ADD_COMMENT') {
        const commId = op.payload?.id;
        if (commId && deletedCommentIds.has(commId)) {
          const delIdx = result.findIndex(r => r.type === 'DELETE_COMMENT' && r.payload?.id === commId);
          if (delIdx !== -1) result.splice(delIdx, 1);
          continue;
        }
        if (commId) {
          const updateIndices: number[] = [];
          for (let rIdx = 0; rIdx < result.length; rIdx++) {
            if (result[rIdx].type === 'UPDATE_COMMENT' && result[rIdx].payload?.id === commId) {
              op.payload = { ...op.payload, ...result[rIdx].payload };
              updateIndices.push(rIdx);
            }
          }
          for (let u = updateIndices.length - 1; u >= 0; u--) {
            result.splice(updateIndices[u], 1);
          }
        }
        result.unshift(op);
        continue;
      }

      if (op.type === 'UPDATE_COMMENT') {
        const commId = op.payload?.id;
        if (commId && deletedCommentIds.has(commId)) continue;

        const existingAdd = result.find(r => r.type === 'ADD_COMMENT' && r.payload?.id === commId);
        if (existingAdd) {
          existingAdd.payload = { ...op.payload, ...existingAdd.payload };
          continue;
        }

        const existingUpdate = result.find(r => r.type === 'UPDATE_COMMENT' && r.payload?.id === commId);
        if (existingUpdate) {
          existingUpdate.payload = { ...op.payload, ...existingUpdate.payload };
          continue;
        }
        result.unshift(op);
        continue;
      }

      // Handle duplicate Status History entries
      if (op.type === 'ADD_STATUS_HISTORY') {
        const isDuplicate = result.some(r =>
          r.type === 'ADD_STATUS_HISTORY' &&
          r.payload?.task_id === op.payload?.task_id &&
          r.payload?.from_status === op.payload?.from_status &&
          r.payload?.to_status === op.payload?.to_status
        );
        if (isDuplicate) continue;
      }

      result.unshift(op);
    }

    if (result.length > this.MAX_QUEUE_SIZE) {
      const overflowCount = result.length - this.MAX_QUEUE_SIZE;
      console.warn(`[bilo Sync] Queue size exceeded MAX_QUEUE_SIZE (${this.MAX_QUEUE_SIZE}). Trimming ${overflowCount} oldest operations.`);
      return result.slice(overflowCount);
    }

    return result;
  }

  async enqueue(opType: PendingSyncOp['type'], payload: any) {
    const currentUserId = await this.getCurrentUserId();
    const op: PendingSyncOp = {
      id: crypto.randomUUID(),
      user_id: currentUserId || 'guest',
      type: opType,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    this.pendingSyncQueue.update(q => {
      if (this.syncing() && q.length > 0) {
        const inFlight = q[0];
        const rest = q.slice(1);
        return [inFlight, ...this.compactQueue([...rest, op])];
      }
      return this.compactQueue([...q, op]);
    });

    await this.saveQueueToStorage(currentUserId);

    if (this.isOnline()) {
      this.processQueue();
    }
  }

  private isFatalError(error: any): boolean {
    if (!error) return false;
    const code = String(error.code || error.status || '');
    const message = String(error.message || '').toLowerCase();

    // PostgreSQL & PostgREST Fatal Error Codes:
    // 23503: Foreign key violation (e.g. parent project or task deleted)
    // 22P02: Invalid text representation (malformed UUID)
    // 42501: Row Level Security policy violation
    // 23505: Unique constraint violation
    // 42703: Undefined column
    // 400: Bad request / malformed payload
    // 404: Endpoint / resource not found
    if (
      code === '23503' ||
      code === '22P02' ||
      code === '42501' ||
      code === '23505' ||
      code === '42703' ||
      code === 'PGRST100' ||
      code === 'PGRST200' ||
      code === '400' ||
      code === '404' ||
      message.includes('violates foreign key constraint') ||
      message.includes('violates row-level security policy') ||
      message.includes('invalid input syntax for type uuid')
    ) {
      return true;
    }
    return false;
  }

  private isRateLimitError(error: any): boolean {
    if (!error) return false;
    const code = String(error.code || error.status || '');
    const message = String(error.message || '').toLowerCase();
    return code === '429' || code === '503' || message.includes('rate limit') || message.includes('too many requests');
  }

  private async moveToDlq(op: PendingSyncOp, reason: string, currentUserId: string) {
    const dlqItem: PendingSyncOp = {
      ...op,
      lastError: reason,
      timestamp: new Date().toISOString()
    };
    this.deadLetterQueue.update(d => [dlqItem, ...d]);
    this.pendingSyncQueue.update(q => q.filter(o => o.id !== op.id));
    await this.saveQueueToStorage(currentUserId);
    await this.saveDlqToStorage(currentUserId);
  }

  readonly LOCK_TIMEOUT_MS = 30000;
  private lastSyncStartTime: number = 0;

  private async executeOpWithTimeout(
    op: PendingSyncOp,
    currentUserId: string,
    timeoutMs: number = 15000
  ): Promise<{ success: boolean; fatal?: boolean; rateLimited?: boolean; error?: string }> {
    let timer: any;
    const timeoutPromise = new Promise<{ success: boolean; fatal?: boolean; rateLimited?: boolean; error?: string }>(resolve => {
      timer = setTimeout(() => {
        resolve({ success: false, fatal: false, error: `Operation ${op.type} (${op.id}) timed out after ${timeoutMs}ms` });
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        this.executeOpResult(op, currentUserId),
        timeoutPromise
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async processQueue() {
    const now = Date.now();
    if (this.syncing()) {
      if (now - this.lastSyncStartTime > this.LOCK_TIMEOUT_MS) {
        console.warn('[bilo Sync] Stale lock detected (>30s). Force resetting syncing signal.');
        this.syncing.set(false);
      } else {
        return;
      }
    }

    if (!this.isOnline() || !this.supabaseService.isConfigured) return;
    if (this.pendingSyncQueue().length === 0) return;

    this.syncing.set(true);
    this.lastSyncStartTime = Date.now();

    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) return;

      const attemptedIds = new Set<string>();

      while (this.pendingSyncQueue().length > 0 && this.isOnline()) {
        const queue = this.pendingSyncQueue();
        const op = queue[0];

        // CRITICAL SECURITY GUARD: Discard operations created by a different user to prevent cross-user contamination
        if (op.user_id && op.user_id !== 'guest' && op.user_id !== currentUserId) {
          console.error(`[bilo Sync Security] Cross-user contamination blocked! Dropping op ${op.type} (${op.id}) created by user ${op.user_id} under active session ${currentUserId}`);
          await this.moveToDlq(op, 'Cross-user session mismatch blocked for security', currentUserId);
          continue;
        }

        if (attemptedIds.has(op.id)) {
          // All remaining items in the queue have been attempted in this pass. Exit loop to avoid rapid retry spinning.
          break;
        }

        attemptedIds.add(op.id);
        const result = await this.executeOpWithTimeout(op, currentUserId, 15000);

        if (result.success) {
          this.pendingSyncQueue.update(q => q.filter(o => o.id !== op.id));
          await this.saveQueueToStorage(currentUserId);
        } else if (result.rateLimited) {
          console.warn(`[bilo Sync] Rate limit (HTTP 429) hit on op ${op.type} (${op.id}). Backing off for 3 seconds.`);
          await new Promise(res => setTimeout(res, 3000));
          break; // Pause loop to allow rate limit bucket to refill
        } else if (result.fatal || (op.retryCount || 0) + 1 >= this.MAX_RETRIES) {
          const reason = result.error || (result.fatal ? 'Fatal database error' : 'Exceeded max retries');
          console.warn(`[bilo Sync] Escalating unresolvable sync op ${op.type} (${op.id}) to Dead-Letter Queue. Reason: ${reason}`);
          await this.moveToDlq(op, reason, currentUserId);
          // Continue processing the remaining queue items so the rest of the queue is unblocked!
        } else {
          const newRetryCount = (op.retryCount || 0) + 1;
          console.warn(`[bilo Sync] Transient error syncing op ${op.type} (${op.id}), retry ${newRetryCount}/${this.MAX_RETRIES}: ${result.error}`);
          const updatedOp: PendingSyncOp = {
            ...op,
            retryCount: newRetryCount,
            lastError: result.error
          };
          // Move transiently failing item to the END of the queue so it does not block remaining sync items!
          this.pendingSyncQueue.update(q => [...q.filter(o => o.id !== op.id), updatedOp]);
          await this.saveQueueToStorage(currentUserId);
        }
      }
    } catch (e) {
      console.error('[bilo Sync] Unexpected error processing sync queue:', e);
    } finally {
      this.syncing.set(false);
    }
  }

  isValidUuid(val?: string): boolean {
    if (!val) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);
  }

  private sanitizeTaskPayload(payload: any): any {
    const clean = { ...payload };
    if (clean.workflow_id && !this.isValidUuid(clean.workflow_id)) {
      clean.workflow_id = null;
    }
    if (clean.project_id && !this.isValidUuid(clean.project_id)) {
      clean.project_id = null;
    }
    if (!clean.due_date || (typeof clean.due_date === 'string' && clean.due_date.trim() === '')) {
      clean.due_date = null;
    }
    return clean;
  }

  private async executeOpResult(op: PendingSyncOp, currentUserId: string): Promise<{ success: boolean; fatal?: boolean; rateLimited?: boolean; error?: string }> {
    const sb = this.supabaseService.supabase;
    const { type, payload } = op;

    if (!currentUserId) return { success: false, fatal: true, error: 'User unauthenticated' };

    try {
      switch (type) {
        case 'CREATE_TASK': {
          const cleanPayload = this.sanitizeTaskPayload(payload);
          cleanPayload.user_id = currentUserId;
          let { error } = await sb.from('tasks').upsert([cleanPayload]);

          // Retry 1: Schema mismatch (missing columns like attachments)
          if (error && error.code === 'PGRST204') {
            delete cleanPayload.attachments;
            const retry = await sb.from('tasks').upsert([cleanPayload]);
            if (retry.error) {
              return { success: false, fatal: this.isFatalError(retry.error), rateLimited: this.isRateLimitError(retry.error), error: retry.error.message };
            }
            return { success: true };
          }

          // Retry 2: FK Constraint violation (e.g. deleted workflow or project on server)
          if (error && (error.code === '23503' || String(error.message).includes('foreign key constraint'))) {
            if (cleanPayload.workflow_id) cleanPayload.workflow_id = null;
            if (cleanPayload.project_id) cleanPayload.project_id = null;

            const fkRetry = await sb.from('tasks').upsert([cleanPayload]);
            if (fkRetry.error) {
              return {
                success: false,
                fatal: this.isFatalError(fkRetry.error),
                rateLimited: this.isRateLimitError(fkRetry.error),
                error: `FK retry failed: ${fkRetry.error.message}`
              };
            }
            return { success: true };
          }

          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          return { success: true };
        }
        case 'UPDATE_TASK': {
          const { id, ...updates } = this.sanitizeTaskPayload(payload);
          const cleanUpdates: any = { id, ...updates, user_id: currentUserId };
          let { error } = await sb.from('tasks').upsert([cleanUpdates]);

          // Retry 1: Schema mismatch (missing columns like attachments)
          if (error && error.code === 'PGRST204') {
            delete cleanUpdates.attachments;
            const retry = await sb.from('tasks').upsert([cleanUpdates]);
            if (retry.error) {
              return { success: false, fatal: this.isFatalError(retry.error), rateLimited: this.isRateLimitError(retry.error), error: retry.error.message };
            }
            return { success: true };
          }

          // Retry 2: FK Constraint violation (e.g. deleted workflow or project on server)
          if (error && (error.code === '23503' || String(error.message).includes('foreign key constraint'))) {
            if (cleanUpdates.workflow_id) cleanUpdates.workflow_id = null;
            if (cleanUpdates.project_id) cleanUpdates.project_id = null;

            const fkRetry = await sb.from('tasks').upsert([cleanUpdates]);
            if (fkRetry.error) {
              return {
                success: false,
                fatal: this.isFatalError(fkRetry.error),
                rateLimited: this.isRateLimitError(fkRetry.error),
                error: `FK retry failed: ${fkRetry.error.message}`
              };
            }
            return { success: true };
          }

          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          return { success: true };
        }
        case 'DELETE_TASK': {
          const { error } = await sb.from('tasks').delete().eq('id', payload.id);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          return { success: true };
        }
        case 'CREATE_PROJECT': {
          const cleanPayload = { ...payload, user_id: currentUserId };
          let { error } = await sb.from('projects').upsert([cleanPayload]);
          if (error && error.code === 'PGRST204') {
            delete cleanPayload.image_url;
            delete cleanPayload.icon;
            const retry = await sb.from('projects').upsert([cleanPayload]);
            if (retry.error) {
              return { success: false, fatal: this.isFatalError(retry.error), rateLimited: this.isRateLimitError(retry.error), error: retry.error.message };
            }
            if (currentUserId) {
              const { error: memErr } = await sb.from('project_members').upsert([{
                project_id: payload.id,
                user_id: currentUserId,
                role: 'owner'
              }]);
              if (memErr) {
                console.warn('[bilo Sync] project_members upsert warning:', memErr.message);
              }
            }
            return { success: true };
          }
          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          if (currentUserId) {
            const { error: memErr } = await sb.from('project_members').upsert([{
              project_id: payload.id,
              user_id: currentUserId,
              role: 'owner'
            }]);
            if (memErr) {
              console.warn('[bilo Sync] project_members upsert warning:', memErr.message);
            }
          }
          return { success: true };
        }
        case 'UPDATE_PROJECT': {
          const { id, ...updates } = payload;
          const cleanUpdates = { ...updates };
          let { error } = await sb.from('projects').update(cleanUpdates).eq('id', id);
          if (error && error.code === 'PGRST204') {
            delete cleanUpdates.image_url;
            delete cleanUpdates.icon;
            const retry = await sb.from('projects').update(cleanUpdates).eq('id', id);
            if (retry.error) {
              return { success: false, fatal: this.isFatalError(retry.error), rateLimited: this.isRateLimitError(retry.error), error: retry.error.message };
            }
            return { success: true };
          }
          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          return { success: true };
        }
        case 'DELETE_PROJECT': {
          const projId = payload.id;
          try {
            const { data: projTasks } = await sb.from('tasks').select('id').eq('project_id', projId);
            if (projTasks && projTasks.length > 0) {
              const taskIds = projTasks.map(t => t.id);
              await sb.from('task_comments').delete().in('task_id', taskIds);
              await sb.from('task_status_history').delete().in('task_id', taskIds);
            }
            await sb.from('tasks').delete().eq('project_id', projId);
            await sb.from('workflows').delete().eq('project_id', projId);
            await sb.from('project_activities').delete().eq('project_id', projId);
            await sb.from('project_members').delete().eq('project_id', projId);
          } catch (e) {
            console.warn('[SyncService] Non-fatal error during pre-delete cascade cleanup:', e);
          }

          const { error } = await sb.from('projects').delete().eq('id', projId);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          return { success: true };
        }
        case 'ADD_COMMENT': {
          const cleanPayload = { ...payload, user_id: currentUserId };
          if (!cleanPayload.task_id || !this.isValidUuid(cleanPayload.task_id)) {
            return { success: false, fatal: true, error: 'Invalid or missing task_id UUID' };
          }
          const { error } = await sb.from('task_comments').upsert([cleanPayload]);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          return { success: true };
        }
        case 'UPDATE_COMMENT': {
          const { id, content, updated_at } = payload;
          const { error } = await sb.from('task_comments').update({ content, updated_at }).eq('id', id);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          return { success: true };
        }
        case 'DELETE_COMMENT': {
          const { error } = await sb.from('task_comments').delete().eq('id', payload.id);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          return { success: true };
        }
        case 'ADD_STATUS_HISTORY': {
          const cleanPayload = { ...payload, user_id: currentUserId };
          if (!cleanPayload.task_id || !this.isValidUuid(cleanPayload.task_id)) {
            return { success: false, fatal: true, error: 'Invalid or missing task_id UUID' };
          }
          const { error } = await sb.from('task_status_history').upsert([cleanPayload]);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          return { success: true };
        }
        case 'ADD_PROJECT_ACTIVITY': {
          const cleanPayload = { ...payload, user_id: currentUserId };
          const { error } = await sb.from('project_activities').upsert([cleanPayload]);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), rateLimited: this.isRateLimitError(error), error: error.message };
          }
          return { success: true };
        }
        default:
          return { success: true };
      }
    } catch (e: any) {
      return { success: false, fatal: false, rateLimited: this.isRateLimitError(e), error: e?.message || 'Execution exception' };
    }
  }
}

