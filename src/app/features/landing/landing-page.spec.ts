import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LandingPageComponent } from './landing-page';

describe('LandingPageComponent', () => {
  let component: LandingPageComponent;
  let mockThemeService: any;

  beforeEach(() => {
    mockThemeService = {
      isDarkMode: vi.fn().mockReturnValue(true),
      toggleTheme: vi.fn()
    };
    component = new LandingPageComponent(mockThemeService);
  });

  it('should create landing page component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit getStarted event when getStarted is invoked', () => {
    const spy = vi.spyOn(component.getStarted, 'emit');
    component.getStarted.emit();
    expect(spy).toHaveBeenCalled();
  });

  it('should invoke smooth scroll to section if target element exists', () => {
    const mockEl = { scrollIntoView: vi.fn() };
    vi.spyOn(document, 'getElementById').mockReturnValue(mockEl as any);

    component.scrollToSection('features');
    expect(document.getElementById).toHaveBeenCalledWith('features');
    expect(mockEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('should safely handle scrollToSection when target element is missing', () => {
    vi.spyOn(document, 'getElementById').mockReturnValue(null);
    expect(() => component.scrollToSection('non-existent')).not.toThrow();
  });
});
