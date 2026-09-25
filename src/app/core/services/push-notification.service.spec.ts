import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PushNotificationService } from './push-notification.service';

describe('PushNotificationService Permission Revocation Safeguards', () => {
  let service: PushNotificationService;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    Object.defineProperty(window, 'Notification', {
      value: class MockNotification {
        static permission: NotificationPermission = 'granted';
        static requestPermission = vi.fn().mockResolvedValue('granted');
        onclick: any = null;
        close = vi.fn();
        constructor(public title: string, public options: any) {}
      },
      configurable: true,
      writable: true
    });

    service = new PushNotificationService();
  });

  it('should sync permission status and return false when Notification.permission becomes denied', async () => {
    (window.Notification as any).permission = 'denied';

    const sent = await service.sendNotification('Test Title', 'Test Body');

    expect(sent).toBe(false);
    expect(service.permissionStatus()).toBe('denied');
    expect(service.notificationsEnabled()).toBe(false);
  });

  it('should handle NotAllowedError DOMException when permission is revoked out-of-band', async () => {
    (window.Notification as any).permission = 'granted';
    service.notificationsEnabled.set(true);

    // Mock constructor throwing NotAllowedError when browser denies creation
    Object.defineProperty(window, 'Notification', {
      value: vi.fn().mockImplementation(() => {
        const err = new DOMException('The Notification permission has been denied', 'NotAllowedError');
        throw err;
      }),
      configurable: true,
      writable: true
    });
    (window.Notification as any).permission = 'denied';

    const sent = await service.sendNotification('Test Title', 'Test Body');

    expect(sent).toBe(false);
    expect(service.permissionStatus()).toBe('denied');
  });

  it('should isolate notification history per user and clear on resetState', () => {
    // User A history
    localStorage.setItem('bilo_notification_history_user_A', JSON.stringify([
      { id: '1', title: 'User A Notif', body: 'Body A', time: '10:00 AM', type: 'system' }
    ]));
    // User B history
    localStorage.setItem('bilo_notification_history_user_B', JSON.stringify([
      { id: '2', title: 'User B Notif', body: 'Body B', time: '11:00 AM', type: 'system' }
    ]));

    // Load User A
    service.loadHistoryFromStorage('user_A');
    expect(service.notificationHistory().length).toBe(1);
    expect(service.notificationHistory()[0].title).toBe('User A Notif');

    // Reset state on sign-out
    service.resetState();
    expect(service.notificationHistory().length).toBe(0);

    // Load User B
    service.loadHistoryFromStorage('user_B');
    expect(service.notificationHistory().length).toBe(1);
    expect(service.notificationHistory()[0].title).toBe('User B Notif');
  });
});
