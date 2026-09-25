import { Injectable, signal, OnDestroy } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UpdateService implements OnDestroy {
  updateAvailable = signal<boolean>(false);
  private waitingWorker: ServiceWorker | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private manualActivation = false;

  constructor() {
    this.initServiceWorker();
  }

  private initServiceWorker(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // 1. Check if a worker is already waiting in background
      if (registration.waiting) {
        this.waitingWorker = registration.waiting;
        this.updateAvailable.set(true);
      }

      // 2. Listen for new worker installations
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.waitingWorker = newWorker;
            this.updateAvailable.set(true);
          }
        });
      });

      // 3. Periodically check for app updates every 15 minutes
      if (typeof window !== 'undefined') {
        this.checkInterval = setInterval(() => {
          registration.update().catch((err) => {
            console.warn('[UpdateService] Failed to check for SW updates:', err);
          });
        }, 15 * 60 * 1000);
      }
    }).catch((err) => {
      console.warn('[UpdateService] Service Worker registration failed:', err);
    });

    // 4. Handle controllerchange: reload safely only when no active unsaved modal or form data is present
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;

      if (!this.manualActivation && this.hasUnsavedChanges()) {
        console.warn('[UpdateService] Service Worker updated in background. Deferring reload because unsaved modal/form data is present.');
        this.updateAvailable.set(true);
        return;
      }

      refreshing = true;
      window.location.reload();
    });
  }

  /**
   * Detects whether user has open modals or active unsaved input/textarea/contenteditable elements.
   */
  hasUnsavedChanges(): boolean {
    if (typeof document === 'undefined') return false;

    // Check for active open modal containers in DOM
    const openModals = document.querySelectorAll('.modal, [role="dialog"], dialog[open]');
    if (openModals.length > 0) return true;

    // Check if focused element is a dirty form input or editor
    const activeEl = document.activeElement;
    if (activeEl) {
      const tagName = activeEl.tagName.toLowerCase();
      if (tagName === 'textarea' || (tagName === 'input' && !['button', 'submit', 'reset', 'checkbox', 'radio'].includes((activeEl as HTMLInputElement).type))) {
        if ((activeEl as HTMLInputElement | HTMLTextAreaElement).value.trim().length > 0) {
          return true;
        }
      }
      if (activeEl instanceof HTMLElement && activeEl.isContentEditable && (activeEl.textContent || '').trim().length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Called when user clicks "Reload now" on the Update Notification Banner.
   */
  activateUpdate(): void {
    if (this.hasUnsavedChanges() && typeof window !== 'undefined') {
      const confirmReload = window.confirm('You have unsaved form or modal data open. Reloading will discard your changes. Continue?');
      if (!confirmReload) return;
    }

    this.manualActivation = true;
    if (this.waitingWorker) {
      this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }

  ngOnDestroy(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
