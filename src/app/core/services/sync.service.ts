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
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  isOnline = signal<boolean>(navigator.onLine);
  pendingSyncQueue = signal<PendingSyncOp[]>([]);
  syncing = signal<boolean>(false);

  constructor(private supabaseService: SupabaseService) {
    this.loadQueueFromStorage();

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

  private async saveQueueToStorage(userId?: string | null) {
    const uid = userId || (await this.getCurrentUserId());
    const storageKey = this.getStorageKey(uid);
    localStorage.setItem(storageKey, JSON.stringify(this.pendingSyncQueue()));
  }

  resetState() {
    this.pendingSyncQueue.set([]);
    this.syncing.set(false);
  }

  async enqueue(opType: PendingSyncOp['type'], payload: any) {
    const currentUserId = await this.getCurrentUserId();
    const op: PendingSyncOp = {
      id: crypto.randomUUID(),
      user_id: currentUserId || 'guest',
      type: opType,
      payload,
      timestamp: new Date().toISOString()
    };

    this.pendingSyncQueue.update(q => [...q, op]);
    await this.saveQueueToStorage(currentUserId);

    if (this.isOnline()) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.syncing() || !this.isOnline()) return;
    if (this.pendingSyncQueue().length === 0) return;

    const currentUserId = await this.getCurrentUserId();
    if (!currentUserId) return;

    this.syncing.set(true);

    try {
      while (this.pendingSyncQueue().length > 0 && this.isOnline()) {
        const queue = this.pendingSyncQueue();
        const op = queue[0];

        // CRITICAL SECURITY GUARD: Discard operations created by a different user to prevent cross-user contamination
        if (op.user_id && op.user_id !== 'guest' && op.user_id !== currentUserId) {
          console.error(`[bilo Sync Security] Cross-user contamination blocked! Dropping op ${op.type} (${op.id}) created by user ${op.user_id} under active session ${currentUserId}`);
          this.pendingSyncQueue.update(q => q.slice(1));
          await this.saveQueueToStorage(currentUserId);
          continue;
        }

        const success = await this.executeOp(op, currentUserId);
        if (success) {
          this.pendingSyncQueue.update(q => q.slice(1));
          await this.saveQueueToStorage(currentUserId);
        } else {
          console.warn(`[bilo Sync] Operation ${op.type} failed. Pausing sync queue to preserve order.`);
          break;
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

  private async executeOp(op: PendingSyncOp, currentUserId: string): Promise<boolean> {
    const sb = this.supabaseService.supabase;
    const { type, payload } = op;

    if (!currentUserId) return false;

    switch (type) {
      case 'CREATE_TASK': {
        const cleanPayload = this.sanitizeTaskPayload(payload);
        cleanPayload.user_id = currentUserId;
        let { error } = await sb.from('tasks').upsert([cleanPayload]);
        if (error && error.code === 'PGRST204') {
          delete cleanPayload.attachments;
          const retry = await sb.from('tasks').upsert([cleanPayload]);
          return !retry.error;
        }
        return !error;
      }
      case 'UPDATE_TASK': {
        const { id, ...updates } = this.sanitizeTaskPayload(payload);
        const cleanUpdates: any = { id, ...updates, user_id: currentUserId };
        let { error } = await sb.from('tasks').upsert([cleanUpdates]);
        if (error && error.code === 'PGRST204') {
          delete cleanUpdates.attachments;
          const retry = await sb.from('tasks').upsert([cleanUpdates]);
          return !retry.error;
        }
        return !error;
      }
      case 'DELETE_TASK': {
        const { error } = await sb.from('tasks').delete().eq('id', payload.id);
        return !error;
      }
      case 'CREATE_PROJECT': {
        const cleanPayload = { ...payload, user_id: currentUserId };
        let { error } = await sb.from('projects').upsert([cleanPayload]);
        if (error && error.code === 'PGRST204') {
          delete cleanPayload.image_url;
          delete cleanPayload.icon;
          const retry = await sb.from('projects').upsert([cleanPayload]);
          if (!retry.error && currentUserId) {
            await sb.from('project_members').upsert([{
              project_id: payload.id,
              user_id: currentUserId,
              role: 'owner'
            }]);
          }
          return !retry.error;
        }
        if (!error && currentUserId) {
          await sb.from('project_members').upsert([{
            project_id: payload.id,
            user_id: currentUserId,
            role: 'owner'
          }]);
        }
        return !error;
      }
      case 'UPDATE_PROJECT': {
        const { id, ...updates } = payload;
        const cleanUpdates = { ...updates };
        let { error } = await sb.from('projects').update(cleanUpdates).eq('id', id);
        if (error && error.code === 'PGRST204') {
          delete cleanUpdates.image_url;
          delete cleanUpdates.icon;
          const retry = await sb.from('projects').update(cleanUpdates).eq('id', id);
          return !retry.error;
        }
        return !error;
      }
      case 'DELETE_PROJECT': {
        const { error } = await sb.from('projects').delete().eq('id', payload.id);
        return !error;
      }
      case 'ADD_COMMENT': {
        const cleanPayload = { ...payload, user_id: currentUserId };
        if (!cleanPayload.task_id || !this.isValidUuid(cleanPayload.task_id)) {
          return true;
        }
        const { error } = await sb.from('task_comments').upsert([cleanPayload]);
        if (error && error.code === '23503') {
          console.warn('[bilo Sync] task_comments FK missing, resolved gracefully:', cleanPayload);
          return true;
        }
        return !error;
      }
      case 'UPDATE_COMMENT': {
        const { id, content, updated_at } = payload;
        const { error } = await sb.from('task_comments').update({ content, updated_at }).eq('id', id);
        return !error;
      }
      case 'DELETE_COMMENT': {
        const { error } = await sb.from('task_comments').delete().eq('id', payload.id);
        return !error;
      }
      case 'ADD_STATUS_HISTORY': {
        const cleanPayload = { ...payload, user_id: currentUserId };
        if (!cleanPayload.task_id || !this.isValidUuid(cleanPayload.task_id)) {
          return true;
        }
        const { error } = await sb.from('task_status_history').upsert([cleanPayload]);
        if (error && error.code === '23503') {
          console.warn('[bilo Sync] task_status_history FK missing, resolved gracefully:', cleanPayload);
          return true;
        }
        return !error;
      }
      case 'ADD_PROJECT_ACTIVITY': {
        const cleanPayload = { ...payload, user_id: currentUserId };
        const { error } = await sb.from('project_activities').upsert([cleanPayload]);
        return !error;
      }
      default:
        return true;
    }
  }
}
