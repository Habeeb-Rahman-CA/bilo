import { Injectable, signal, computed, OnDestroy } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService implements OnDestroy {
  readonly theme = signal<ThemeMode>(this.getInitialTheme());
  readonly isDarkMode = computed(() => this.theme() === 'dark');

  private mediaQueryList: MediaQueryList | null = null;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    this.applyTheme(this.theme());
    this.listenSystemPreferenceChanges();
  }

  private getInitialTheme(): ThemeMode {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bilo_theme');
        if (saved === 'dark' || saved === 'light') {
          return saved;
        }
        // Evict corrupted/invalid storage value to prevent flash of wrong theme
        if (saved !== null) {
          localStorage.removeItem('bilo_theme');
        }
      } catch (e) {
        console.warn('[ThemeService] Could not access localStorage:', e);
      }

      try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return 'dark';
        }
      } catch (e) {
        console.warn('[ThemeService] Could not query matchMedia:', e);
      }
    }
    return 'dark';
  }

  toggleTheme() {
    const nextTheme: ThemeMode = this.theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  setTheme(mode: ThemeMode) {
    if (mode !== 'dark' && mode !== 'light') return;
    this.theme.set(mode);
    this.applyTheme(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bilo_theme', mode);
      } catch (e) {
        console.warn('[ThemeService] Could not save theme to localStorage:', e);
      }
    }
  }

  private applyTheme(mode: ThemeMode) {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    root.setAttribute('data-theme', mode);

    if (mode === 'dark') {
      body.classList.add('dark-theme');
      body.classList.remove('light-theme');
    } else {
      body.classList.remove('dark-theme');
      body.classList.add('light-theme');
    }

    // Update PWA meta theme-color tag
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', mode === 'dark' ? '#09090b' : '#f8f6f0');
    }
  }

  private listenSystemPreferenceChanges() {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    try {
      this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQueryListener = (e: MediaQueryListEvent) => {
        try {
          const saved = localStorage.getItem('bilo_theme');
          if (saved !== 'dark' && saved !== 'light') {
            this.setTheme(e.matches ? 'dark' : 'light');
          }
        } catch (err) {
          console.warn('[ThemeService] Error checking localStorage on theme change:', err);
        }
      };

      if (this.mediaQueryList.addEventListener) {
        this.mediaQueryList.addEventListener('change', this.mediaQueryListener);
      } else if ((this.mediaQueryList as any).addListener) {
        (this.mediaQueryList as any).addListener(this.mediaQueryListener);
      }
    } catch (e) {
      console.warn('[ThemeService] Error adding matchMedia listener:', e);
    }
  }

  ngOnDestroy() {
    if (this.mediaQueryList && this.mediaQueryListener) {
      if (this.mediaQueryList.removeEventListener) {
        this.mediaQueryList.removeEventListener('change', this.mediaQueryListener);
      } else if ((this.mediaQueryList as any).removeListener) {
        (this.mediaQueryList as any).removeListener(this.mediaQueryListener);
      }
      this.mediaQueryList = null;
      this.mediaQueryListener = null;
    }
  }
}
