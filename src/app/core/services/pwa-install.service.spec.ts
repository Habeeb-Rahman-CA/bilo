import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PwaInstallService } from './pwa-install.service';

describe('PwaInstallService', () => {
  let service: PwaInstallService;

  beforeEach(() => {
    window.matchMedia = window.matchMedia || vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    service = new PwaInstallService();
  });

  it('should initialize with canInstallPwa false by default', () => {
    expect(service.canInstallPwa()).toBe(false);
    expect(service.deferredPrompt()).toBeNull();
  });

  it('should handle beforeinstallprompt event and update signals', () => {
    const mockEvent = new Event('beforeinstallprompt');
    (mockEvent as any).prompt = vi.fn();
    (mockEvent as any).userChoice = Promise.resolve({ outcome: 'accepted' });

    window.dispatchEvent(mockEvent);

    expect(service.canInstallPwa()).toBe(true);
    expect(service.deferredPrompt()).toBe(mockEvent);
  });

  it('should handle appinstalled event and reset prompt state', () => {
    const mockEvent = new Event('beforeinstallprompt');
    window.dispatchEvent(mockEvent);
    expect(service.canInstallPwa()).toBe(true);

    const installedEvent = new Event('appinstalled');
    window.dispatchEvent(installedEvent);

    expect(service.canInstallPwa()).toBe(false);
    expect(service.isStandalone()).toBe(true);
    expect(service.deferredPrompt()).toBeNull();
  });

  it('should trigger promptInstall and update state when user accepts', async () => {
    const mockPrompt = vi.fn();
    const mockEvent = new Event('beforeinstallprompt');
    (mockEvent as any).prompt = mockPrompt;
    (mockEvent as any).userChoice = Promise.resolve({ outcome: 'accepted' });

    window.dispatchEvent(mockEvent);

    await service.promptInstall();

    expect(mockPrompt).toHaveBeenCalled();
    expect(service.canInstallPwa()).toBe(false);
    expect(service.deferredPrompt()).toBeNull();
  });

  it('should reset state and hide install button when user dismisses prompt', async () => {
    const mockPrompt = vi.fn();
    const mockEvent = new Event('beforeinstallprompt');
    (mockEvent as any).prompt = mockPrompt;
    (mockEvent as any).userChoice = Promise.resolve({ outcome: 'dismissed' });

    window.dispatchEvent(mockEvent);

    await service.promptInstall();

    expect(mockPrompt).toHaveBeenCalled();
    expect(service.canInstallPwa()).toBe(false);
    expect(service.deferredPrompt()).toBeNull();
  });
});
