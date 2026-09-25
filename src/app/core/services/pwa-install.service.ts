import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PwaInstallService {
  deferredPrompt = signal<any>(null);
  canInstallPwa = signal<boolean>(false);
  isStandalone = signal<boolean>(false);

  constructor() {
    this.initPwaInstall();
  }

  private initPwaInstall() {
    if (typeof window === 'undefined') return;

    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      this.isStandalone.set(true);
    }

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt.set(e);
      this.canInstallPwa.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt.set(null);
      this.canInstallPwa.set(false);
      this.isStandalone.set(true);
    });
  }

  async promptInstall() {
    const promptEvent = this.deferredPrompt();
    if (!promptEvent) return;

    try {
      promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (err) {
      console.warn('[bilo PWA] Error triggering install prompt:', err);
    } finally {
      // Consumed BeforeInstallPromptEvent cannot be re-used. Always clear state to prevent dead install button.
      this.canInstallPwa.set(false);
      this.deferredPrompt.set(null);
    }
  }
}
