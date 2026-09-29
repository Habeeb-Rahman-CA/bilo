import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  icon?: string;
  duration: number;
  createdAt: number;
}

export interface ShowToastOptions {
  type?: ToastType;
  icon?: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<ToastItem[]>([]);

  private defaultDuration = 3500;
  private maxToasts = 5;

  show(message: string, options?: ShowToastOptions): string {
    if (!message || !message.trim()) return '';

    const id = 'toast-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
    const type: ToastType = options?.type || 'info';
    const duration = options?.duration ?? this.defaultDuration;
    const icon = options?.icon;

    const item: ToastItem = {
      id,
      message: message.trim(),
      type,
      icon,
      duration,
      createdAt: Date.now()
    };

    this.toasts.update(list => {
      const updated = [...list, item];
      if (updated.length > this.maxToasts) {
        return updated.slice(updated.length - this.maxToasts);
      }
      return updated;
    });

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  success(message: string, duration?: number): string {
    return this.show(message, { type: 'success', icon: 'fi fi-rr-check-circle text-emerald', duration });
  }

  error(message: string, duration?: number): string {
    return this.show(message, { type: 'error', icon: 'fi fi-rr-cross-circle text-rose', duration });
  }

  warning(message: string, duration?: number): string {
    return this.show(message, { type: 'warning', icon: 'fi fi-rr-exclamation text-amber', duration });
  }

  info(message: string, duration?: number): string {
    return this.show(message, { type: 'info', icon: 'fi fi-rr-info text-cyan', duration });
  }

  remove(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  clear(): void {
    this.toasts.set([]);
  }
}
