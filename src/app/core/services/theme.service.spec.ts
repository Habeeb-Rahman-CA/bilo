// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.body.className = '';
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with dark theme by default when no local storage is present', () => {
    service = new ThemeService();
    expect(service.theme()).toBe('dark');
    expect(service.isDarkMode()).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.body.classList.contains('dark-theme')).toBe(true);
  });

  it('should initialize from saved localStorage theme', () => {
    localStorage.setItem('bilo_theme', 'light');
    service = new ThemeService();
    expect(service.theme()).toBe('light');
    expect(service.isDarkMode()).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.body.classList.contains('light-theme')).toBe(true);
  });

  it('should toggle theme from dark to light and update DOM and localStorage', () => {
    service = new ThemeService();
    expect(service.theme()).toBe('dark');

    service.toggleTheme();

    expect(service.theme()).toBe('light');
    expect(service.isDarkMode()).toBe(false);
    expect(localStorage.getItem('bilo_theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.body.classList.contains('light-theme')).toBe(true);
    expect(document.body.classList.contains('dark-theme')).toBe(false);
  });

  it('should explicit set theme using setTheme()', () => {
    service = new ThemeService();
    service.setTheme('light');
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('bilo_theme')).toBe('light');

    service.setTheme('dark');
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('bilo_theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
