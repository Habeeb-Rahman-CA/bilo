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

  isOnline = signal<boolean>(navigator.onLine);
  pendingSyncQueue = signal<PendingSyncOp[]>([]);
  deadLetterQueue = signal<PendingSyncOp[]>([]);
  syncing = signal<boolean>(false);

  constructor(private supabaseService: SupabaseService) {
    this.loadQueueFromStorage();
    this.loadDlqFromStorage();

    window.addEventListener('online', () => {
      console.log('[bilo Sync] Network connectivity restored. Triggering offline sync...');
      this.isOnline.set(true);
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('[bilo Sync] Device went offline. Queueing local mutations for sync.');
      this.isOnline.set(false);
    });

    // Initial sync check if online and items pending
    if (this.isOnline() && this.pendingSyncQueue().length > 0) {
      this.processQueue();
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
          this.pendingSyncQueue.set(validQueue);
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

    this.pendingSyncQueue.update(q => [...q, op]);
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

    if (!this.isOnline()) return;
    if (this.pendingSyncQueue().length === 0) return;

    this.syncing.set(true);
    this.lastSyncStartTime = Date.now();

    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) return;

      while (this.pendingSyncQueue().length > 0 && this.isOnline()) {
        const queue = this.pendingSyncQueue();
        const op = queue[0];

        // CRITICAL SECURITY GUARD: Discard operations created by a different user to prevent cross-user contamination
        if (op.user_id && op.user_id !== 'guest' && op.user_id !== currentUserId) {
          console.error(`[bilo Sync Security] Cross-user contamination blocked! Dropping op ${op.type} (${op.id}) created by user ${op.user_id} under active session ${currentUserId}`);
          await this.moveToDlq(op, 'Cross-user session mismatch blocked for security', currentUserId);
          continue;
        }

        const result = await this.executeOpResult(op, currentUserId);

        if (result.success) {
          this.pendingSyncQueue.update(q => q.slice(1));
          await this.saveQueueToStorage(currentUserId);
        } else if (result.fatal || (op.retryCount || 0) + 1 >= this.MAX_RETRIES) {
          const reason = result.error || (result.fatal ? 'Fatal database error' : 'Exceeded max retries');
          console.warn(`[bilo Sync] Escalating unresolvable sync op ${op.type} (${op.id}) to Dead-Letter Queue. Reason: ${reason}`);
          await this.moveToDlq(op, reason, currentUserId);
          // Continue processing the remaining queue items so the rest of the queue is unblocked!
        } else {
          const newRetryCount = (op.retryCount || 0) + 1;
          console.warn(`[bilo Sync] Transient error syncing op ${op.type} (${op.id}), retry ${newRetryCount}/${this.MAX_RETRIES}: ${result.error}`);
          this.pendingSyncQueue.update(q => [
            { ...op, retryCount: newRetryCount, lastError: result.error },
            ...q.slice(1)
          ]);
          await this.saveQueueToStorage(currentUserId);
          break; // Pause loop for this cycle to allow transient network/server glitches to resolve
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

  private async executeOpResult(op: PendingSyncOp, currentUserId: string): Promise<{ success: boolean; fatal?: boolean; error?: string }> {
    const sb = this.supabaseService.supabase;
    const { type, payload } = op;

    if (!currentUserId) return { success: false, fatal: true, error: 'User unauthenticated' };

    try {
      switch (type) {
        case 'CREATE_TASK': {
          const cleanPayload = this.sanitizeTaskPayload(payload);
          cleanPayload.user_id = currentUserId;
          let { error } = await sb.from('tasks').upsert([cleanPayload]);
          if (error && error.code === 'PGRST204') {
            delete cleanPayload.attachments;
            const retry = await sb.from('tasks').upsert([cleanPayload]);
            if (retry.error) {
              return { success: false, fatal: this.isFatalError(retry.error), error: retry.error.message };
            }
            return { success: true };
          }
          if (error) {
            return { success: false, fatal: this.isFatalError(error), error: error.message };
          }
          return { success: true };
        }
        case 'UPDATE_TASK': {
          const { id, ...updates } = this.sanitizeTaskPayload(payload);
          const cleanUpdates: any = { id, ...updates, user_id: currentUserId };
          let { error } = await sb.from('tasks').upsert([cleanUpdates]);
          if (error && error.code === 'PGRST204') {
            delete cleanUpdates.attachments;
            const retry = await sb.from('tasks').upsert([cleanUpdates]);
            if (retry.error) {
              return { success: false, fatal: this.isFatalError(retry.error), error: retry.error.message };
            }
            return { success: true };
          }
          if (error) {
            return { success: false, fatal: this.isFatalError(error), error: error.message };
          }
          return { success: true };
        }
        case 'DELETE_TASK': {
          const { error } = await sb.from('tasks').delete().eq('id', payload.id);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), error: error.message };
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
              return { success: false, fatal: this.isFatalError(retry.error), error: retry.error.message };
            }
            if (currentUserId) {
              await sb.from('project_members').upsert([{
                project_id: payload.id,
                user_id: currentUserId,
                role: 'owner'
              }]);
            }
            return { success: true };
          }
          if (error) {
            return { success: false, fatal: this.isFatalError(error), error: error.message };
          }
          if (currentUserId) {
            await sb.from('project_members').upsert([{
              project_id: payload.id,
              user_id: currentUserId,
              role: 'owner'
            }]);
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
              return { success: false, fatal: this.isFatalError(retry.error), error: retry.error.message };
            }
            return { success: true };
          }
          if (error) {
            return { success: false, fatal: this.isFatalError(error), error: error.message };
          }
          return { success: true };
        }
        case 'DELETE_PROJECT': {
          const { error } = await sb.from('projects').delete().eq('id', payload.id);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), error: error.message };
          }
          return { success: true };
        }
        case 'ADD_COMMENT': {
          const cleanPayload = { ...payload, user_id: currentUserId };
          if (!cleanPayload.task_id || !this.isValidUuid(cleanPayload.task_id)) {
            return { success: true };
          }
          const { error } = await sb.from('task_comments').upsert([cleanPayload]);
          if (error) {
            if (error.code === '23503') {
              console.warn('[bilo Sync] task_comments FK missing, resolved gracefully:', cleanPayload);
              return { success: true };
            }
            return { success: false, fatal: this.isFatalError(error), error: error.message };
          }
          return { success: true };
        }
        case 'UPDATE_COMMENT': {
          const { id, content, updated_at } = payload;
          const { error } = await sb.from('task_comments').update({ content, updated_at }).eq('id', id);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), error: error.message };
          }
          return { success: true };
        }
        case 'DELETE_COMMENT': {
          const { error } = await sb.from('task_comments').delete().eq('id', payload.id);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), error: error.message };
          }
          return { success: true };
        }
        case 'ADD_STATUS_HISTORY': {
          const cleanPayload = { ...payload, user_id: currentUserId };
          if (!cleanPayload.task_id || !this.isValidUuid(cleanPayload.task_id)) {
            return { success: true };
          }
          const { error } = await sb.from('task_status_history').upsert([cleanPayload]);
          if (error) {
            if (error.code === '23503') {
              console.warn('[bilo Sync] task_status_history FK missing, resolved gracefully:', cleanPayload);
              return { success: true };
            }
            return { success: false, fatal: this.isFatalError(error), error: error.message };
          }
          return { success: true };
        }
        case 'ADD_PROJECT_ACTIVITY': {
          const cleanPayload = { ...payload, user_id: currentUserId };
          const { error } = await sb.from('project_activities').upsert([cleanPayload]);
          if (error) {
            return { success: false, fatal: this.isFatalError(error), error: error.message };
          }
          return { success: true };
        }
        default:
          return { success: true };
      }
    } catch (e: any) {
      return { success: false, fatal: false, error: e?.message || 'Execution exception' };
    }
  }
}

