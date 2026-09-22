import { Injectable, signal, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  readonly theme = signal<ThemeMode>(this.getInitialTheme());
  readonly isDarkMode = computed(() => this.theme() === 'dark');

  constructor() {
    this.applyTheme(this.theme());
    this.listenSystemPreferenceChanges();
  }

  private getInitialTheme(): ThemeMode {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bilo_theme') as ThemeMode;
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
      // Default to dark theme for modern developer black & grey experience
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'dark';
  }

  toggleTheme() {
    const nextTheme: ThemeMode = this.theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  setTheme(mode: ThemeMode) {
    this.theme.set(mode);
    this.applyTheme(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bilo_theme', mode);
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

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      const saved = localStorage.getItem('bilo_theme');
      if (!saved) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}
