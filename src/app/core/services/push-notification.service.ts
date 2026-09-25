import { Injectable, signal } from '@angular/core';

export interface PushNotificationLog {
  id: string;
  title: string;
  body: string;
  time: string;
  type: 'test' | 'reminder' | 'created' | 'completed' | 'status_change' | 'system';
}

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  permissionStatus = signal<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  isSubscribed = signal<boolean>(false);
  notificationsEnabled = signal<boolean>(false);
  
  // Custom Notification Toggles
  notifyOnTaskCreate = signal<boolean>(true);
  notifyOnStatusChange = signal<boolean>(true);

  toastMessage = signal<string | null>(null);
  notificationHistory = signal<PushNotificationLog[]>([]);

  private swRegistration: ServiceWorkerRegistration | null = null;

  private currentUserId: string | null = null;

  constructor() {
    this.init();
  }

  getHistoryStorageKey(userId?: string | null): string {
    const uid = userId !== undefined ? userId : this.currentUserId;
    return uid ? `bilo_notification_history_${uid}` : 'bilo_notification_history';
  }

  loadHistoryFromStorage(userId?: string | null) {
    this.currentUserId = userId || null;
    const key = this.getHistoryStorageKey(userId);
    const storedHistory = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (storedHistory) {
      try {
        this.notificationHistory.set(JSON.parse(storedHistory));
        return;
      } catch (e) {
        console.error('[bilo Push] Error reading notification history:', e);
      }
    }
    this.notificationHistory.set([]);
  }

  resetState() {
    this.currentUserId = null;
    this.notificationHistory.set([]);
  }

  async init() {
    // 1. Check Browser Notification API Support
    if (!('Notification' in window)) {
      this.permissionStatus.set('unsupported');
      console.warn('[bilo Push] Browser does not support Desktop Notifications.');
      return;
    }

    this.permissionStatus.set(Notification.permission);

    // 2. Load stored user preferences
    const storedEnabled = localStorage.getItem('bilo_push_enabled');
    if (storedEnabled !== null) {
      this.notificationsEnabled.set(storedEnabled === 'true' && Notification.permission === 'granted');
    } else if (Notification.permission === 'granted') {
      this.notificationsEnabled.set(true);
    }

    const storedCreate = localStorage.getItem('bilo_notify_task_create');
    if (storedCreate !== null) this.notifyOnTaskCreate.set(storedCreate === 'true');

    const storedStatus = localStorage.getItem('bilo_notify_status_change');
    if (storedStatus !== null) this.notifyOnStatusChange.set(storedStatus === 'true');

    // 3. Load stored notification history
    this.loadHistoryFromStorage();

    // 4. Attach Service Worker registration if active
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        this.swRegistration = reg;

        // Check if there is an active push subscription
        if (reg.pushManager) {
          const sub = await reg.pushManager.getSubscription();
          this.isSubscribed.set(!!sub);
        }
      } catch (e) {
        console.warn('[bilo Push] Service worker not ready for push subscription check:', e);
      }
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      this.showToast('Push Notifications are not supported in this browser.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permissionStatus.set(permission);

      if (permission === 'granted') {
        this.notificationsEnabled.set(true);
        localStorage.setItem('bilo_push_enabled', 'true');
        this.showToast('Push Notifications enabled successfully!');
        
        // Attempt SW subscription
        await this.subscribeToPush();
        
        // Dispatch initial welcome notification
        this.sendNotification(
          'Notifications Activated!',
          'You will now receive alerts for new tasks and status updates.',
          'system'
        );
        return true;
      } else if (permission === 'denied') {
        this.notificationsEnabled.set(false);
        localStorage.setItem('bilo_push_enabled', 'false');
        this.showToast('Notification permission was blocked in browser settings.');
        return false;
      }
    } catch (error) {
      console.error('[bilo Push] Error requesting permission:', error);
    }
    return false;
  }

  async subscribeToPush() {
    if (!this.swRegistration || !('pushManager' in this.swRegistration)) {
      return;
    }

    try {
      let sub = await this.swRegistration.pushManager.getSubscription();
      if (!sub) {
        console.log('[bilo Push] Registering push manager listener...');
        this.isSubscribed.set(true);
      } else {
        this.isSubscribed.set(true);
      }
    } catch (err) {
      console.warn('[bilo Push] Failed to register push subscription:', err);
    }
  }

  toggleNotifications(enable?: boolean) {
    const targetState = enable !== undefined ? enable : !this.notificationsEnabled();

    if (targetState && this.permissionStatus() !== 'granted') {
      this.requestPermission();
      return;
    }

    this.notificationsEnabled.set(targetState);
    localStorage.setItem('bilo_push_enabled', String(targetState));

    if (targetState) {
      this.showToast('Push Notifications enabled');
    } else {
      this.showToast('Push Notifications disabled');
    }
  }

  toggleSetting(key: 'create' | 'status_change') {
    if (key === 'create') {
      const val = !this.notifyOnTaskCreate();
      this.notifyOnTaskCreate.set(val);
      localStorage.setItem('bilo_notify_task_create', String(val));
    } else if (key === 'status_change') {
      const val = !this.notifyOnStatusChange();
      this.notifyOnStatusChange.set(val);
      localStorage.setItem('bilo_notify_status_change', String(val));
    }
  }

  syncPermissionState(): 'default' | 'granted' | 'denied' | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      this.permissionStatus.set('unsupported');
      return 'unsupported';
    }

    const current = Notification.permission;
    this.permissionStatus.set(current);
    if (current !== 'granted') {
      this.notificationsEnabled.set(false);
      localStorage.setItem('bilo_push_enabled', 'false');
    }
    return current;
  }

  async sendNotification(
    title: string,
    body: string,
    type: 'test' | 'reminder' | 'created' | 'completed' | 'status_change' | 'system' = 'system',
    data: any = {}
  ): Promise<boolean> {
    const livePermission = this.syncPermissionState();

    if (!this.notificationsEnabled() || livePermission !== 'granted') {
      console.log('[bilo Push] Notification skipped: Permission not granted or notifications disabled.');
      return false;
    }

    const options: any = {
      body,
      icon: '/bilo-icon-dark.png',
      badge: '/bilo-icon-dark.png',
      vibrate: [100, 50, 100],
      tag: `bilo-notify-${Date.now()}`,
      data: { url: '/', ...data }
    };

    let sent = false;

    // Method A: Service Worker showNotification (preferred for background & PWA)
    if (this.swRegistration && 'showNotification' in this.swRegistration) {
      try {
        await this.swRegistration.showNotification(title, options);
        sent = true;
      } catch (err: any) {
        console.warn('[bilo Push] SW showNotification failed, falling back to window Notification:', err);
        if (err?.name === 'NotAllowedError' || String(err?.message).includes('denied') || String(err?.message).includes('permission')) {
          this.syncPermissionState();
          return false;
        }
      }
    }

    // Method B: Standard Window Notification API fallback
    if (!sent && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, options);
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
        sent = true;
      } catch (err: any) {
        console.error('[bilo Push] Notification creation failed:', err);
        if (err?.name === 'NotAllowedError' || String(err?.message).includes('denied') || String(err?.message).includes('permission')) {
          this.syncPermissionState();
          return false;
        }
      }
    }

    if (sent) {
      const logEntry: PushNotificationLog = {
        id: crypto.randomUUID(),
        title,
        body,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type
      };

      this.notificationHistory.update(list => [logEntry, ...list.slice(0, 19)]);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.getHistoryStorageKey(), JSON.stringify(this.notificationHistory()));
      }
    }

    return sent;
  }

  async sendTestNotification() {
    if (this.permissionStatus() !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) return;
    }

    const success = await this.sendNotification(
      'bilo Push Notification Test',
      'Push notifications active for task creation & status updates!',
      'test'
    );

    if (success) {
      this.showToast('Test Notification triggered successfully!');
    } else {
      this.showToast('Failed to trigger test notification. Check browser settings.');
    }
  }

  notifyTaskCreated(taskTitle: string) {
    if (!this.notifyOnTaskCreate()) return;
    this.sendNotification(
      'New Task Created',
      `"${taskTitle}" was added to your workspace.`,
      'created'
    );
  }

  notifyTaskStatusChanged(taskTitle: string, fromStatus: string, toStatus: string) {
    if (!this.notifyOnStatusChange()) return;
    this.sendNotification(
      'Task Status Changed',
      `"${taskTitle}" moved from ${fromStatus} to ${toStatus}.`,
      'status_change'
    );
  }

  clearHistory() {
    this.notificationHistory.set([]);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.getHistoryStorageKey());
      localStorage.removeItem('bilo_notification_history');
    }
    this.showToast('Notification log cleared');
  }

  showToast(message: string) {
    this.toastMessage.set(message);
    setTimeout(() => {
      if (this.toastMessage() === message) {
        this.toastMessage.set(null);
      }
    }, 3500);
  }
}
