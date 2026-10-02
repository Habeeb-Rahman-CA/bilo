import { describe, it, expect } from 'vitest';
import { formatAuthError } from './auth-error.util';

describe('formatAuthError Utility', () => {
  it('should format invalid credentials error correctly', () => {
    expect(formatAuthError({ message: 'AuthApiError: Invalid login credentials' }))
      .toBe('Invalid email or password. Please check your credentials and try again.');
    expect(formatAuthError('invalid_credentials'))
      .toBe('Invalid email or password. Please check your credentials and try again.');
  });

  it('should format user already exists error correctly', () => {
    expect(formatAuthError({ message: 'User already registered' }))
      .toBe('An account with this email address already exists. Please sign in instead.');
    expect(formatAuthError('user_already_exists'))
      .toBe('An account with this email address already exists. Please sign in instead.');
  });

  it('should format short password error correctly', () => {
    expect(formatAuthError({ message: 'Password should be at least 6 characters' }))
      .toBe('Password must be at least 6 characters long.');
  });

  it('should format rate limit error correctly', () => {
    expect(formatAuthError({ message: 'over_email_send_rate_limit' }))
      .toBe('Too many authentication attempts. Please wait a few moments before trying again.');
  });

  it('should format network error correctly', () => {
    expect(formatAuthError(new Error('Failed to fetch')))
      .toBe('Unable to connect to the authentication server. Please check your internet connection.');
  });

  it('should clean up technical error prefixes for unrecognized errors', () => {
    expect(formatAuthError({ message: 'AuthApiError: Custom domain not verified' }))
      .toBe('Custom domain not verified.');
  });

  it('should return default fallback message when error is empty or undefined', () => {
    expect(formatAuthError(null)).toBe('An unexpected authentication error occurred.');
    expect(formatAuthError(undefined)).toBe('An unexpected authentication error occurred.');
  });
});
