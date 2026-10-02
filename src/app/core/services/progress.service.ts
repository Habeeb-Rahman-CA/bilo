import { Injectable, signal } from '@angular/core';

export type ProgressOperationType = 'batch' | 'export' | 'upload' | 'sync';

export interface ProgressState {
  id: string;
  type: ProgressOperationType;
  title: string;
  message: string;
  percentage: number;
  currentStep?: number;
  totalSteps?: number;
  loadedBytes?: number;
  totalBytes?: number;
  status: 'active' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
}

export interface StartProgressOptions {
  message?: string;
  totalSteps?: number;
  totalBytes?: number;
}

export interface UpdateProgressOptions {
  message?: string;
  currentStep?: number;
  totalSteps?: number;
  loadedBytes?: number;
  totalBytes?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  activeProgress = signal<ProgressState | null>(null);
  progressQueue = signal<ProgressState[]>([]);

  start(
    id: string,
    type: ProgressOperationType,
    title: string,
    options?: StartProgressOptions
  ): string {
    const initialState: ProgressState = {
      id,
      type,
      title,
      message: options?.message || 'Initializing...',
      percentage: 0,
      currentStep: 0,
      totalSteps: options?.totalSteps,
      totalBytes: options?.totalBytes,
      loadedBytes: 0,
      status: 'active',
      startTime: Date.now()
    };

    this.activeProgress.set(initialState);
    this.progressQueue.update(list => [...list.filter(p => p.id !== id), initialState]);
    return id;
  }

  update(id: string, percentage: number, options?: UpdateProgressOptions | string): void {
    const clampedPct = Math.min(100, Math.max(0, Math.round(percentage)));
    const opts: UpdateProgressOptions = typeof options === 'string' ? { message: options } : (options || {});

    this.activeProgress.update(current => {
      if (!current || current.id !== id) return current;
      return {
        ...current,
        percentage: clampedPct,
        message: opts.message !== undefined ? opts.message : current.message,
        currentStep: opts.currentStep !== undefined ? opts.currentStep : current.currentStep,
        totalSteps: opts.totalSteps !== undefined ? opts.totalSteps : current.totalSteps,
        loadedBytes: opts.loadedBytes !== undefined ? opts.loadedBytes : current.loadedBytes,
        totalBytes: opts.totalBytes !== undefined ? opts.totalBytes : current.totalBytes
      };
    });

    this.progressQueue.update(list => list.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        percentage: clampedPct,
        message: opts.message !== undefined ? opts.message : item.message,
        currentStep: opts.currentStep !== undefined ? opts.currentStep : item.currentStep,
        totalSteps: opts.totalSteps !== undefined ? opts.totalSteps : item.totalSteps,
        loadedBytes: opts.loadedBytes !== undefined ? opts.loadedBytes : item.loadedBytes,
        totalBytes: opts.totalBytes !== undefined ? opts.totalBytes : item.totalBytes
      };
    }));
  }

  complete(id: string, completionMessage?: string): void {
    const msg = completionMessage || 'Operation complete';

    this.activeProgress.update(current => {
      if (!current || current.id !== id) return current;
      return {
        ...current,
        percentage: 100,
        message: msg,
        status: 'completed',
        endTime: Date.now()
      };
    });

    this.progressQueue.update(list => list.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        percentage: 100,
        message: msg,
        status: 'completed',
        endTime: Date.now()
      };
    }));

    setTimeout(() => {
      if (this.activeProgress()?.id === id) {
        this.activeProgress.set(null);
      }
    }, 2000);
  }

  fail(id: string, errorMessage?: string): void {
    const msg = errorMessage || 'Operation failed';

    this.activeProgress.update(current => {
      if (!current || current.id !== id) return current;
      return {
        ...current,
        message: msg,
        status: 'failed',
        endTime: Date.now()
      };
    });

    this.progressQueue.update(list => list.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        message: msg,
        status: 'failed',
        endTime: Date.now()
      };
    }));

    setTimeout(() => {
      if (this.activeProgress()?.id === id) {
        this.activeProgress.set(null);
      }
    }, 3000);
  }

  clear(): void {
    this.activeProgress.set(null);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
