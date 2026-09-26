export interface RateLimitStatus {
  allowed: boolean;
  waitSeconds: number;
  remainingAttempts: number;
  message?: string;
}

export class AuthRateLimiter {
  private failedAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number }>();
  private magicLinkCooldowns = new Map<string, number>();

  private readonly maxFailedAttempts = 5;
  private readonly lockoutDurationMs = 60 * 1000; // 60 seconds lockout after 5 failed attempts
  private readonly attemptWindowMs = 15 * 60 * 1000; // 15 minutes window
  private readonly magicLinkCooldownMs = 60 * 1000; // 60 seconds cooldown for magic link requests

  private normalizeKey(email: string): string {
    return (email || 'anonymous').toLowerCase().trim();
  }

  checkLoginRateLimit(email: string): RateLimitStatus {
    const key = this.normalizeKey(email);
    const now = Date.now();
    const entry = this.failedAttempts.get(key);

    if (entry) {
      if (entry.lockedUntil > now) {
        const waitSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
        return {
          allowed: false,
          waitSeconds,
          remainingAttempts: 0,
          message: `Too many failed login attempts. Please wait ${waitSeconds}s before trying again.`
        };
      }

      if (now - entry.lastAttempt > this.attemptWindowMs) {
        this.failedAttempts.delete(key);
        return { allowed: true, waitSeconds: 0, remainingAttempts: this.maxFailedAttempts };
      }

      const remaining = Math.max(0, this.maxFailedAttempts - entry.count);
      return { allowed: true, waitSeconds: 0, remainingAttempts: remaining };
    }

    return { allowed: true, waitSeconds: 0, remainingAttempts: this.maxFailedAttempts };
  }

  recordFailedLogin(email: string): RateLimitStatus {
    const key = this.normalizeKey(email);
    const now = Date.now();
    let entry = this.failedAttempts.get(key);

    if (!entry || (now - entry.lastAttempt > this.attemptWindowMs)) {
      entry = { count: 1, lastAttempt: now, lockedUntil: 0 };
    } else {
      entry.count += 1;
      entry.lastAttempt = now;
    }

    if (entry.count >= this.maxFailedAttempts) {
      entry.lockedUntil = now + this.lockoutDurationMs;
    }

    this.failedAttempts.set(key, entry);

    if (entry.lockedUntil > now) {
      const waitSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
      return {
        allowed: false,
        waitSeconds,
        remainingAttempts: 0,
        message: `Too many failed login attempts. Account temporarily locked for security. Please wait ${waitSeconds}s.`
      };
    }

    const remaining = Math.max(0, this.maxFailedAttempts - entry.count);
    return { allowed: true, waitSeconds: 0, remainingAttempts: remaining };
  }

  recordSuccessfulLogin(email: string): void {
    const key = this.normalizeKey(email);
    this.failedAttempts.delete(key);
  }

  checkMagicLinkRateLimit(email: string): RateLimitStatus {
    const key = this.normalizeKey(email);
    const now = Date.now();
    const until = this.magicLinkCooldowns.get(key) || 0;

    if (until > now) {
      const waitSeconds = Math.ceil((until - now) / 1000);
      return {
        allowed: false,
        waitSeconds,
        remainingAttempts: 0,
        message: `Magic link request rate limited. Please wait ${waitSeconds}s before requesting another email.`
      };
    }

    return { allowed: true, waitSeconds: 0, remainingAttempts: 1 };
  }

  recordMagicLinkSent(email: string): void {
    const key = this.normalizeKey(email);
    this.magicLinkCooldowns.set(key, Date.now() + this.magicLinkCooldownMs);
  }

  resetAll(): void {
    this.failedAttempts.clear();
    this.magicLinkCooldowns.clear();
  }
}

export const globalAuthRateLimiter = new AuthRateLimiter();
