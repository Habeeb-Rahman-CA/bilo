import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UpdateService } from './update.service';

describe('UpdateService', () => {
  let service: UpdateService;
  let mockRegistration: any;
  let listeners: Record<string, Function> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    listeners = {};

    mockRegistration = {
      waiting: null,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn((event, callback) => {
        listeners[event] = callback;
      })
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue(mockRegistration),
        addEventListener: vi.fn(),
        controller: {}
      },
      configurable: true,
      writable: true
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should register service worker and set update interval', async () => {
    service = new UpdateService();
    await Promise.resolve();

    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
  });

  it('should clear update interval when ngOnDestroy is called', async () => {
    service = new UpdateService();
    await Promise.resolve(); // resolve register promise

    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    service.ngOnDestroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should detect open modal dialogs as unsaved changes', () => {
    service = new UpdateService();
    expect(service.hasUnsavedChanges()).toBe(false);

    const modal = document.createElement('div');
    modal.className = 'modal';
    document.body.appendChild(modal);

    expect(service.hasUnsavedChanges()).toBe(true);

    document.body.removeChild(modal);
    expect(service.hasUnsavedChanges()).toBe(false);
  });

  it('should prompt user confirmation on activateUpdate if unsaved data exists', () => {
    service = new UpdateService();
    const modal = document.createElement('div');
    modal.className = 'modal';
    document.body.appendChild(modal);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    service.activateUpdate();

    expect(confirmSpy).toHaveBeenCalled();
    document.body.removeChild(modal);
  });
});
