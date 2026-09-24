import { ProjectRole } from '../models/project.model';

const INVITE_SECRET_SEED = 'bilo_secure_invite_hmac_secret_v1_2026';
const DEFAULT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface VerifiedInvitePayload {
  projectId: string;
  role: ProjectRole;
  expiresAt: number;
  nonce: string;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

async function getHmacKey(): Promise<CryptoKey | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(INVITE_SECRET_SEED),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSecureInviteToken(
  projectId: string,
  role: ProjectRole = 'member',
  expiresInMs: number = DEFAULT_EXPIRATION_MS
): Promise<string> {
  const expiresAt = Date.now() + expiresInMs;
  let nonce = '';

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const nonceArray = new Uint8Array(16);
    crypto.getRandomValues(nonceArray);
    nonce = arrayBufferToHex(nonceArray.buffer);
  } else {
    nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  const payloadString = `${projectId}:${role}:${expiresAt}:${nonce}`;
  let signatureHex = '';

  const key = await getHmacKey();
  if (key && typeof crypto !== 'undefined' && crypto.subtle) {
    const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadString));
    signatureHex = arrayBufferToHex(sigBuffer);
  } else {
    signatureHex = 'fallback_sig_' + nonce;
  }

  const payloadObj = {
    pid: projectId,
    r: role,
    exp: expiresAt,
    n: nonce,
    sig: signatureHex
  };

  const jsonStr = JSON.stringify(payloadObj);
  // Base64URL encode
  if (typeof btoa !== 'undefined') {
    return btoa(jsonStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return encodeURIComponent(jsonStr);
}

export async function verifySecureInviteToken(token: string): Promise<VerifiedInvitePayload | null> {
  if (!token || typeof token !== 'string') return null;

  try {
    let jsonStr = '';
    if (typeof atob !== 'undefined') {
      let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }
      jsonStr = atob(base64);
    } else {
      jsonStr = decodeURIComponent(token);
    }

    const parsed = JSON.parse(jsonStr);
    if (!parsed || !parsed.pid || !parsed.r || !parsed.exp || !parsed.n || !parsed.sig) {
      return null;
    }

    // Expiration check
    if (Date.now() > Number(parsed.exp)) {
      console.warn('[InviteToken] Invite link expired');
      return null;
    }

    // Signature check via Web Crypto HMAC
    const key = await getHmacKey();
    if (key && typeof crypto !== 'undefined' && crypto.subtle) {
      const payloadString = `${parsed.pid}:${parsed.r}:${parsed.exp}:${parsed.n}`;
      const expectedBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadString));
      const expectedSigHex = arrayBufferToHex(expectedBuffer);

      if (expectedSigHex !== parsed.sig) {
        console.error('[InviteToken] Tampered token signature detected! Invite rejected.');
        return null;
      }
    }

    return {
      projectId: parsed.pid,
      role: parsed.r as ProjectRole,
      expiresAt: Number(parsed.exp),
      nonce: parsed.n
    };
  } catch (e) {
    console.warn('[InviteToken] Token verification failed:', e);
    return null;
  }
}
