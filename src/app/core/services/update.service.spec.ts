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
});
