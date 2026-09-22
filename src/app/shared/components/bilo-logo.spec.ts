import { describe, it, expect, beforeEach } from 'vitest';
import { BiloLogoComponent } from './bilo-logo';
import { ThemeService } from '../../core/services/theme.service';

describe('BiloLogoComponent', () => {
  let themeService: ThemeService;
  let component: BiloLogoComponent;

  beforeEach(() => {
    localStorage.clear();
    themeService = new ThemeService();
    component = new BiloLogoComponent(themeService);
  });

  it('should initialize with default input values', () => {
    expect(component.size).toBe('sm');
    expect(component.showText).toBe(true);
    expect(component.compact).toBe(false);
    expect(component.classNames).toBe('');
  });

  it('should inject theme service and access theme status', () => {
    expect(component.themeService).toBe(themeService);
    expect(component.themeService.isDarkMode()).toBe(true);
  });
});
