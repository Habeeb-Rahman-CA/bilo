import { describe, it, expect } from 'vitest';
import { createSecureInviteToken, verifySecureInviteToken } from './invite-token.util';

describe('InviteTokenUtil Cryptographic Security', () => {
  it('should generate a valid cryptographically signed invite token', async () => {
    const token = await createSecureInviteToken('proj-12345', 'member');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const verified = await verifySecureInviteToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.projectId).toBe('proj-12345');
    expect(verified?.role).toBe('member');
    expect(verified?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should reject tampered invite tokens where role or project ID was modified', async () => {
    const token = await createSecureInviteToken('proj-secret', 'viewer');

    // Decode and modify role to 'owner'
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const parsed = JSON.parse(atob(base64));

    parsed.r = 'owner'; // Attempt privilege escalation attack

    const tamperedJson = JSON.stringify(parsed);
    const tamperedToken = btoa(tamperedJson).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const verified = await verifySecureInviteToken(tamperedToken);
    expect(verified).toBeNull(); // Must reject tampered signature!
  });

  it('should reject expired invite tokens', async () => {
    // Generate token expiring -10 seconds in the past
    const expiredToken = await createSecureInviteToken('proj-exp', 'member', -10000);
    const verified = await verifySecureInviteToken(expiredToken);
    expect(verified).toBeNull();
  });
});
