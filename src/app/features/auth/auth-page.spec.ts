import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthPageComponent } from './auth-page';

describe('AuthPageComponent Password Enforcement & Strength', () => {
  let component: AuthPageComponent;
  let mockAuthService: any;
  let mockWorkspaceService: any;
  let mockThemeService: any;

  beforeEach(() => {
    mockAuthService = {
      isSupabaseConfigured: true,
      signUpWithEmailPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signInWithEmailPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signInWithMagicLink: vi.fn().mockResolvedValue({ error: null })
    };
    mockWorkspaceService = {
      setWorkspace: vi.fn()
    };
    mockThemeService = {
      isDarkMode: vi.fn().mockReturnValue(true),
      toggleTheme: vi.fn()
    };

    component = new AuthPageComponent(mockAuthService, mockWorkspaceService, mockThemeService);
  });

  it('should enforce minimum 6 characters for signup on client side without calling AuthService', async () => {
    component.mode.set('signup');
    component.email = 'user@example.com';
    component.password = '12345';
    component.confirmPassword = '12345';

    await component.onSubmit();

    expect(mockAuthService.signUpWithEmailPassword).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Password must be at least 6 characters long.');
  });

  it('should calculate password strength accurately', () => {
    component.password = '123';
    expect(component.passwordStrengthWidth()).toBe('33%');
    expect(component.passwordStrengthClass()).toBe('text-rose');
    expect(component.passwordStrengthLabel()).toBe('Too short (min 6 chars)');

    component.password = '123456';
    expect(component.passwordStrengthWidth()).toBe('66%');
    expect(component.passwordStrengthClass()).toBe('text-cyan');
    expect(component.passwordStrengthLabel()).toBe('Good');

    component.password = 'StrongP@ssw0rd!';
    expect(component.passwordStrengthWidth()).toBe('100%');
    expect(component.passwordStrengthClass()).toBe('text-emerald');
    expect(component.passwordStrengthLabel()).toBe('Strong');
  });

  it('should format cryptic Supabase short password error into clean message', async () => {
    component.mode.set('signup');
    component.email = 'user@example.com';
    component.password = 'abcdef';
    component.confirmPassword = 'abcdef';

    mockAuthService.signUpWithEmailPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Password should be at least 6 characters' }
    });

    await component.onSubmit();

    expect(component.errorMessage()).toBe('Password must be at least 6 characters long.');
  });

  it('should ignore concurrent onSubmit calls when submitting is active', async () => {
    component.mode.set('login');
    component.email = 'user@example.com';
    component.password = 'password123';
    component.submitting.set(true);

    await component.onSubmit();

    expect(mockAuthService.signInWithEmailPassword).not.toHaveBeenCalled();
  });

  it('should auto-hide visible password after 5 seconds to mitigate shoulder-surfing', () => {
    vi.useFakeTimers();
    expect(component.showPassword()).toBe(false);

    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(component.showPassword()).toBe(false);

    vi.useRealTimers();
  });
});
