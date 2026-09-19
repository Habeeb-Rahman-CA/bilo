import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface PendingSyncOp {
  id: string;
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

  private loadQueueFromStorage() {
    const cached = localStorage.getItem('bilo_sync_queue');
    if (cached) {
      try {
        const queue = JSON.parse(cached);
        if (Array.isArray(queue)) {
          this.pendingSyncQueue.set(queue);
        }
      } catch (e) {
        console.error('Failed to parse offline sync queue:', e);
      }
    }
  }

  private saveQueueToStorage() {
    localStorage.setItem('bilo_sync_queue', JSON.stringify(this.pendingSyncQueue()));
  }

  enqueue(opType: PendingSyncOp['type'], payload: any) {
    const op: PendingSyncOp = {
      id: crypto.randomUUID(),
      type: opType,
      payload,
      timestamp: new Date().toISOString()
    };

    this.pendingSyncQueue.update(q => [...q, op]);
    this.saveQueueToStorage();

    if (this.isOnline()) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.syncing() || !this.isOnline()) return;
    if (this.pendingSyncQueue().length === 0) return;

    this.syncing.set(true);

    try {
      while (this.pendingSyncQueue().length > 0 && this.isOnline()) {
        const queue = this.pendingSyncQueue();
        const op = queue[0];

        const success = await this.executeOp(op);
        if (success) {
          this.pendingSyncQueue.update(q => q.slice(1));
          this.saveQueueToStorage();
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

  private async executeOp(op: PendingSyncOp): Promise<boolean> {
    const sb = this.supabaseService.supabase;
    const { type, payload } = op;
    const { data: authData } = await sb.auth.getUser();
    const currentUserId = authData?.user?.id;

    switch (type) {
      case 'CREATE_TASK': {
        const cleanPayload = this.sanitizeTaskPayload(payload);
        if (currentUserId && !cleanPayload.user_id) {
          cleanPayload.user_id = currentUserId;
        }
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
        const cleanUpdates = { ...updates };
        let { error } = await sb.from('tasks').update(cleanUpdates).eq('id', id);
        if (error && error.code === 'PGRST204') {
          delete cleanUpdates.attachments;
          const retry = await sb.from('tasks').update(cleanUpdates).eq('id', id);
          return !retry.error;
        }
        return !error;
      }
      case 'DELETE_TASK': {
        const { error } = await sb.from('tasks').delete().eq('id', payload.id);
        return !error;
      }
      case 'CREATE_PROJECT': {
        const cleanPayload = { ...payload };
        if (currentUserId && !cleanPayload.user_id) {
          cleanPayload.user_id = currentUserId;
        }
        let { error } = await sb.from('projects').upsert([cleanPayload]);
        if (error && error.code === 'PGRST204') {
          delete cleanPayload.image_url;
          delete cleanPayload.icon;
          const retry = await sb.from('projects').upsert([cleanPayload]);
          return !retry.error;
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
        const cleanPayload = { ...payload };
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
        const cleanPayload = { ...payload };
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
        const { error } = await sb.from('project_activities').upsert([payload]);
        return !error;
      }
      default:
        return true;
    }
  }
}
