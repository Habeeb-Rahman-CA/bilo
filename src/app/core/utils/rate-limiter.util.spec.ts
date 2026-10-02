import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthRateLimiter } from './rate-limiter.util';

describe('AuthRateLimiter Unit Tests', () => {
  let rateLimiter: AuthRateLimiter;

  beforeEach(() => {
    rateLimiter = new AuthRateLimiter();
  });

  it('should allow login attempt when failed count is below 5', () => {
    const status = rateLimiter.checkLoginRateLimit('test@example.com');
    expect(status.allowed).toBe(true);
    expect(status.remainingAttempts).toBe(5);
  });

  it('should lock user out after 5 consecutive failed attempts', () => {
    const email = 'test@example.com';
    for (let i = 0; i < 4; i++) {
      const res = rateLimiter.recordFailedLogin(email);
      expect(res.allowed).toBe(true);
      expect(res.remainingAttempts).toBe(4 - i);
    }

    // 5th failed attempt triggers lockout
    const fifthRes = rateLimiter.recordFailedLogin(email);
    expect(fifthRes.allowed).toBe(false);
    expect(fifthRes.waitSeconds).toBeGreaterThan(0);
    expect(fifthRes.message).toContain('Too many failed login attempts');

    // Subsequent check is blocked
    const checkRes = rateLimiter.checkLoginRateLimit(email);
    expect(checkRes.allowed).toBe(false);
  });

  it('should reset failed count on successful login', () => {
    const email = 'test@example.com';
    rateLimiter.recordFailedLogin(email);
    rateLimiter.recordFailedLogin(email);
    rateLimiter.recordFailedLogin(email);

    rateLimiter.recordSuccessfulLogin(email);

    const checkRes = rateLimiter.checkLoginRateLimit(email);
    expect(checkRes.allowed).toBe(true);
    expect(checkRes.remainingAttempts).toBe(5);
  });

  it('should enforce cooldown on magic link requests', () => {
    const email = 'test@example.com';
    const firstCheck = rateLimiter.checkMagicLinkRateLimit(email);
    expect(firstCheck.allowed).toBe(true);

    rateLimiter.recordMagicLinkSent(email);

    const secondCheck = rateLimiter.checkMagicLinkRateLimit(email);
    expect(secondCheck.allowed).toBe(false);
    expect(secondCheck.waitSeconds).toBeGreaterThan(0);
    expect(secondCheck.message).toContain('Magic link request rate limited');
  });
});
